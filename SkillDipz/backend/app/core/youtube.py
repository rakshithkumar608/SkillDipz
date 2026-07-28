
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
    return f"yt_results:{skill.lower().replace(' ', '_')}:{role.lower().replace(' ', '_')}"


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


async def fetch_youtube_videos(skill: str, role: str) -> list[dict]:
    if not settings.YOUTUBE_API_KEY:
        logger.warning("YOUTUBE_API_KEY not set — returning empty video list.")
        return []

    cache_key = _cache_key(skill, role)
    redis = get_redis()

    # --- Try Redis cache first ---
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except (RedisError, Exception) as e:
            logger.warning(f"Redis read error in youtube cache: {e}")

    # --- Call 1: search.list (find video IDs + snippets) ---
    search_params = {
        "part": "snippet",
        "q": f"{skill} tutorial {role}",
        "type": "video",
        "videoDuration": "medium",
        "relevanceLanguage": "en",
        "maxResults": 5,
        "key": settings.YOUTUBE_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            search_resp = await client.get(YOUTUBE_SEARCH_URL, params=search_params)
            search_resp.raise_for_status()
            search_data = search_resp.json()

            # Build initial video list from search results
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
                    "duration_label": "",  # filled next
                })

            if not videos:
                return []

            # --- Call 2: videos.list (fetch contentDetails for duration) ---
            video_ids = ",".join(v["youtube_id"] for v in videos)
            detail_resp = await client.get(
                YOUTUBE_VIDEOS_URL,
                params={
                    "part": "contentDetails",
                    "id": video_ids,
                    "key": settings.YOUTUBE_API_KEY,
                },
            )
            detail_resp.raise_for_status()
            detail_data = detail_resp.json()

            # Map videoId → formatted duration
            duration_map: dict[str, str] = {}
            for detail_item in detail_data.get("items", []):
                vid_id = detail_item["id"]
                iso = detail_item.get("contentDetails", {}).get("duration", "")
                duration_map[vid_id] = _parse_iso_duration(iso)

            # Attach duration to each video
            for v in videos:
                v["duration_label"] = duration_map.get(v["youtube_id"], "")

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            logger.warning("YouTube API quota exhausted.")
        else:
            logger.error(f"YouTube API HTTP error: {e}")
        return []
    except Exception as e:
        logger.error(f"YouTube API call failed: {e}")
        return []

    # --- Store in Redis cache ---
    if redis and videos:
        try:
            await redis.setex(cache_key, YT_CACHE_TTL, json.dumps(videos))
        except (RedisError, Exception) as e:
            logger.warning(f"Redis write error in youtube cache: {e}")

    return videos
