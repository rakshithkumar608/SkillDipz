import logging
import json
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.assessment import CFBookmark, CFSolvedProblem
from app.models.student_profile import StudentProfile
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/practice", tags=["Practice — Codeforces"])

CF_BASE = "https://codeforces.com/api"
CF_PROBLEM_TTL = 86400  # 24h

ROLE_TO_CF_TAGS = {
    "backend":   ["implementation", "data structures", "sorting", "binary search", "two pointers"],
    "fullstack": ["implementation", "strings", "greedy", "math"],
    "data":      ["math", "combinatorics", "implementation", "dp"],
    "devops":    ["implementation", "greedy", "math"],
    "ai":        ["math", "probability", "greedy", "dp"],
}

DIFFICULTY_RANGES = {
    "Easy":   (800, 1100),
    "Medium": (1200, 1700),
    "Hard":   (1800, 3500),
}


async def fetch_cf_problems(tags: list, difficulty: str) -> list:
    """Fetch from Codeforces API. Cached 24h in Redis per role+difficulty."""
    redis = get_redis()
    primary_tag = tags[0] if tags else "implementation"
    cache_key = f"cf_problems:{primary_tag}:{difficulty}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(
            f"{CF_BASE}/problemset.problems",
            params={"tags": primary_tag},
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK":
        return []

    problems_raw = data["result"]["problems"]
    stats_map = {
        f"{s['contestId']}{s['index']}": s.get("solvedCount", 0)
        for s in data["result"].get("problemStatistics", [])
    }

    low, high = DIFFICULTY_RANGES.get(difficulty, (800, 3500))
    filtered = []
    for p in problems_raw:
        rating = p.get("rating")
        if not rating or not (low <= rating <= high):
            continue
        cf_id = f"{p['contestId']}{p['index']}"
        filtered.append({
            "cf_problem_id": cf_id,
            "contest_id": p["contestId"],
            "index": p["index"],
            "name": p["name"],
            "rating": rating,
            "tags": p.get("tags", []),
            "solved_count": stats_map.get(cf_id, 0),
            "difficulty": difficulty,
            "cf_url": f"https://codeforces.com/problemset/problem/{p['contestId']}/{p['index']}",
        })

    filtered.sort(key=lambda x: x["solved_count"], reverse=True)
    filtered = filtered[:120]

    if redis:
        try:
            await redis.setex(cache_key, CF_PROBLEM_TTL, json.dumps(filtered))
        except Exception:
            pass

    return filtered


@router.get("/problems")
async def get_coding_problems(
    role: str = Query("backend"),
    difficulty: str = Query("Easy"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Codeforces problems filtered by role tags + difficulty. Cached 24h."""
    if difficulty not in DIFFICULTY_RANGES:
        raise HTTPException(
            status_code=400, detail="difficulty must be Easy, Medium, or Hard")

    tags = ROLE_TO_CF_TAGS.get(role, ROLE_TO_CF_TAGS["backend"])
    try:
        problems = await fetch_cf_problems(tags, difficulty)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, detail="Codeforces API timed out. Try again.")
    except Exception as e:
        logger.error(f"CF API error: {e}")
        raise HTTPException(
            status_code=502, detail="Codeforces API temporarily unavailable.")

    student_id = str(current_user.id)
    solved = await CFSolvedProblem.find(CFSolvedProblem.student_id == student_id).to_list()
    solved_ids = {s.cf_problem_id for s in solved}

    bookmarks = await CFBookmark.find(CFBookmark.student_id == student_id).to_list()
    bookmark_ids = {b.cf_problem_id for b in bookmarks}

    start = (page - 1) * limit
    page_items = problems[start: start + limit]
    for p in page_items:
        p["is_solved"] = p["cf_problem_id"] in solved_ids
        p["is_bookmarked"] = p["cf_problem_id"] in bookmark_ids

    return {
        "total": len(problems),
        "page": page,
        "limit": limit,
        "problems": page_items,
    }


@router.post("/verify")
async def verify_cf_submission(
    body: dict,
    current_user: User = Depends(get_current_user),
):

    student_id = str(current_user.id)
    cf_handle = body.get("cf_handle", "").strip()
    cf_problem_id = body.get("cf_problem_id", "").strip()
    contest_id = body.get("contest_id")
    index = str(body.get("index", "")).upper()

    if not cf_handle or not cf_problem_id:
        raise HTTPException(
            status_code=400, detail="cf_handle and cf_problem_id required.")

    # Already credited?
    existing = await CFSolvedProblem.find_one(
        CFSolvedProblem.student_id == student_id,
        CFSolvedProblem.cf_problem_id == cf_problem_id,
    )
    if existing:
        return {"verified": True, "message": "Already credited!", "already_credited": True}

    # Fetch from Codeforces API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{CF_BASE}/user.status",
                params={"handle": cf_handle, "from": 1, "count": 30},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, detail="Codeforces API timed out.")
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Codeforces API error: {str(e)}")

    if data.get("status") == "FAILED":
        raise HTTPException(
            status_code=404,
            detail=f"CF handle '{cf_handle}' not found. Check spelling."
        )

    match = None
    for sub in data.get("result", []):
        prob = sub.get("problem", {})
        if (
            str(prob.get("contestId")) == str(contest_id)
            and prob.get("index", "").upper() == index
            and sub.get("verdict") == "OK"
        ):
            match = sub
            break

    if not match:
        return {
            "verified": False,
            "message": "No accepted submission found. Solve the problem on Codeforces first and try again.",
            "already_credited": False,
        }

    solved = CFSolvedProblem(
        student_id=student_id,
        cf_problem_id=cf_problem_id,
        contest_id=contest_id,
        index=index,
        name=match["problem"].get("name", ""),
        rating=match["problem"].get("rating"),
        cf_submission_id=str(match["id"]),
        cf_handle=cf_handle,
    )
    await solved.insert()

    # Save CF handle to profile if not set
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if profile and not profile.cf_handle:
        profile.cf_handle = cf_handle
        await profile.save()

    return {"verified": True, "message": "Submission verified and credited! 🎉", "already_credited": False}


@router.get("/solved")
async def get_solved_problems(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    solved = (
        await CFSolvedProblem.find(CFSolvedProblem.student_id == student_id)
        .sort(-CFSolvedProblem.solved_at)
        .to_list()
    )
    return [
        {
            "cf_problem_id": s.cf_problem_id,
            "name": s.name,
            "rating": s.rating,
            "cf_handle": s.cf_handle,
            "solved_at": s.solved_at.isoformat(),
            "cf_url": f"https://codeforces.com/problemset/problem/{s.contest_id}/{s.index}",
        }
        for s in solved
    ]


@router.get("/bookmarks")
async def get_bookmarks(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    items = await CFBookmark.find(CFBookmark.student_id == student_id).to_list()
    return [
        {
            "cf_problem_id": b.cf_problem_id,
            "name": b.name,
            "rating": b.rating,
            "tags": b.tags,
            "cf_url": f"https://codeforces.com/problemset/problem/{b.contest_id}/{b.index}",
            "bookmarked_at": b.bookmarked_at.isoformat(),
        }
        for b in items
    ]


@router.post("/bookmarks")
async def add_bookmark(body: dict, current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    cf_problem_id = body.get("cf_problem_id", "")
    if await CFBookmark.find_one(
        CFBookmark.student_id == student_id,
        CFBookmark.cf_problem_id == cf_problem_id,
    ):
        return {"message": "Already bookmarked."}

    await CFBookmark(
        student_id=student_id,
        cf_problem_id=cf_problem_id,
        contest_id=body.get("contest_id"),
        index=body.get("index", ""),
        name=body.get("name", ""),
        rating=body.get("rating"),
        tags=body.get("tags", []),
    ).insert()
    return {"message": "Bookmarked!"}


@router.delete("/bookmarks/{cf_problem_id}")
async def remove_bookmark(cf_problem_id: str, current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    b = await CFBookmark.find_one(
        CFBookmark.student_id == student_id,
        CFBookmark.cf_problem_id == cf_problem_id,
    )
    if not b:
        raise HTTPException(status_code=404, detail="Bookmark not found.")
    await b.delete()
    return {"message": "Removed."}


@router.get("/cf-profile")
async def get_cf_profile(
    handle: str = Query(...),
    current_user: User = Depends(get_current_user),
):
   
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{CF_BASE}/user.info", params={"handles": handle})
            resp.raise_for_status()
            data = resp.json()
        if data.get("status") != "OK" or not data.get("result"):
            raise HTTPException(status_code=404, detail="CF handle not found.")
        user = data["result"][0]
        return {
            "handle": user["handle"],
            "rating": user.get("rating"),
            "max_rating": user.get("maxRating"),
            "rank": user.get("rank", "unrated"),
            "avatar": user.get("avatar"),
            "contribution": user.get("contribution", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Codeforces API error: {str(e)}")
