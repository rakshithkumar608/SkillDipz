
import json
import logging
import re as _re
import httpx
from app.core.config import settings
from app.core.redis_client import get_redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
YT_CACHE_TTL = 6 * 60 * 60   # 6 hours


def _cache_key(skill: str, role: str) -> str:
    return f"yt_v2:{skill.lower().replace(' ', '_')}:{role.lower().replace(' ', '_')}"


def _parse_iso_duration(iso: str) -> str:
    m = _re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return ""
    h, mn, s = m.group(1), m.group(2), m.group(3)
    parts = []
    if h:
        parts.append(f"{h}h")
    if mn:
        parts.append(f"{mn}m")
    if not parts and s:
        parts.append(f"{s}s")  # only show seconds if no hours/minutes
    return " ".join(parts)


def _parse_duration_minutes(iso: str) -> float:
    """Convert ISO 8601 duration to total minutes."""
    m = _re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0.0
    h = int(m.group(1) or 0)
    mn = int(m.group(2) or 0)
    s = int(m.group(3) or 0)
    return h * 60 + mn + s / 60


async def _search_and_enrich(
    client: httpx.AsyncClient,
    skill: str,
    role: str,
    video_duration: str,
    max_results: int,
    category: str,
) -> list[dict]:
    """Search YouTube for videos and enrich with duration. category: 'core' or 'reference'."""
    if category == "core":
        query = f"{skill} complete tutorial full course {role}"
    else:
        query = f"{skill} quick guide practical example {role}"

    search_params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "videoDuration": video_duration,
        "relevanceLanguage": "en",
        "maxResults": max_results,
        "order": "relevance",
        "key": settings.YOUTUBE_API_KEY,
    }

    search_resp = await client.get(YOUTUBE_SEARCH_URL, params=search_params)
    search_resp.raise_for_status()
    search_data = search_resp.json()

    videos = []
    for item in search_data.get("items", []):
        vid_id = item.get("id", {}).get("videoId", "")
        if not vid_id:
            continue
        snippet = item.get("snippet", {})
        videos.append({
            "youtube_id": vid_id,
            "title": snippet.get("title", ""),
            "channel": snippet.get("channelTitle", ""),
            "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "duration_label": "",
            "category": category,
        })

    if not videos:
        return []

    # Enrich with duration
    video_ids = ",".join(v["youtube_id"] for v in videos)
    detail_resp = await client.get(
        YOUTUBE_VIDEOS_URL,
        params={"part": "contentDetails,statistics", "id": video_ids, "key": settings.YOUTUBE_API_KEY},
    )
    detail_resp.raise_for_status()
    detail_data = detail_resp.json()

    duration_map: dict[str, dict] = {}
    for detail_item in detail_data.get("items", []):
        vid_id = detail_item["id"]
        iso = detail_item.get("contentDetails", {}).get("duration", "")
        duration_map[vid_id] = {
            "label": _parse_iso_duration(iso),
            "minutes": _parse_duration_minutes(iso),
        }

    # Filter by duration range and attach labels
    filtered = []
    for v in videos:
        info = duration_map.get(v["youtube_id"], {})
        minutes = info.get("minutes", 0)
        v["duration_label"] = info.get("label", "")

        if category == "core":
            # Core: 20min–3hr (reject extremely long > 3hr or very short < 15min)
            if 15 <= minutes <= 180:
                filtered.append(v)
        else:
            # Reference: 5–30min
            if 4 <= minutes <= 35:
                filtered.append(v)

    # If filtering removed everything, fall back to returning what we had (still better than empty)
    return filtered[:max_results] if filtered else videos[:max_results]


async def fetch_skill_videos_structured(skill: str, role: str) -> dict:
    """
    Fetch 2 Core + 2 Reference videos for a skill gap.

    Returns:
        {
            "core": [video1, video2],       # long-form learning resources (2 alternatives)
            "reference": [video1, video2],  # shorter targeted reference videos
        }
    """
    if not settings.YOUTUBE_API_KEY:
        logger.warning("YOUTUBE_API_KEY not set — returning empty video list.")
        return {"core": [], "reference": []}

    cache_key = _cache_key(skill, role)
    redis = get_redis()

    # Try Redis cache first
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except (RedisError, Exception) as e:
            logger.warning(f"Redis read error in youtube cache: {e}")

    result = {"core": [], "reference": []}

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            # Fetch core videos (long-form, up to 3 to have buffer for filtering)
            core_videos = await _search_and_enrich(
                client, skill, role,
                video_duration="long",   # YouTube API: >20min
                max_results=3,
                category="core",
            )
            result["core"] = core_videos[:2]

            # Fetch reference videos (medium, up to 4 buffer)
            ref_videos = await _search_and_enrich(
                client, skill, role,
                video_duration="medium",  # YouTube API: 4-20min
                max_results=4,
                category="reference",
            )
            result["reference"] = ref_videos[:2]

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            logger.warning("YouTube API quota exhausted.")
        else:
            logger.error(f"YouTube API HTTP error: {e}")
        return result
    except Exception as e:
        logger.error(f"YouTube API call failed: {e}")
        return result

    # Cache the combined result
    if redis:
        try:
            await redis.setex(cache_key, YT_CACHE_TTL, json.dumps(result))
        except (RedisError, Exception) as e:
            logger.warning(f"Redis write error in youtube cache: {e}")

    return result


async def fetch_youtube_videos(skill: str, role: str) -> list[dict]:
    """
    Legacy compatibility wrapper — returns a flat list of up to 4 videos (core first, then reference).
    Used by the first-skill prefetch in _build_phases().
    """
    structured = await fetch_skill_videos_structured(skill, role)
    all_videos = structured.get("core", []) + structured.get("reference", [])
    return all_videos[:4]
