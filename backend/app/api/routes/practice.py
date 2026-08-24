import logging
import json
import httpx
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query

from pydantic import BaseModel
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.assessment import (
    CFBookmark,
    CFSolvedProblem,
    CodingQuestion,
    CodingSolvedProblem,
    CodingExample,
    CodingTestCase,
    AssessmentResult,
)
from app.models.activity_log import ActivityLog
from app.models.roadmap import StudentRoadmap
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


# ─── LeetCode Coding Arena — 70-80 AI Problems via Groq per Skill Gap ─────────

from app.services.code_runner import execute_code

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "qwen/qwen3.6-27b",
    "groq/compound-mini",
]


def _clean_json_text(text: str) -> str:
    """Removes markdown fences and finds JSON boundaries."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text.strip()


def _build_leetcode_prompt(skill: str, difficulty: str, count: int, subfocus: str) -> str:
    return f"""You are a FAANG software interview problem creator.
Generate exactly {count} realistic, highly technical LeetCode-style coding problems specifically testing "{skill}" and focusing on "{subfocus}".
Difficulty Level: {difficulty}.

CRITICAL REQUIREMENTS:
1. Every problem must be uniquely tailored to the engineering domain of "{skill}". For language/backend skills (Python, Java, C++, TypeScript, SQL, Node.js), focus on algorithmic paradigms, data structures, and edge cases.
2. Provide a clear problem statement, input/output formats, and constraints.
3. Every testcase must have valid "input" (a JSON array representing function argument parameters) and "expected" (the exact return value).
4. Provide starter_code and starter_code_templates for Python and JavaScript.
5. NO mock or placeholder text. Every problem must be real, solvable, and logically sound.

JSON SCHEMA:
{{
  "questions": [
    {{
      "title": "Distinct problem title",
      "concept": "{subfocus}",
      "topics": ["{skill}", "{subfocus}"],
      "difficulty": "{difficulty}",
      "description": "Comprehensive problem statement detailing inputs, transformation, and boundary edge cases.",
      "constraints": ["1 <= input.length <= 10^5"],
      "examples": [
        {{"input": "args representation", "output": "result", "explanation": "Detailed step-by-step reason."}}
      ],
      "function_name": "solve",
      "starter_code": "def solve(*args):\\n    pass",
      "starter_code_templates": {{
        "python": "def solve(*args):\\n    pass",
        "javascript": "function solve(...args) {{\\n  // Solution\\n}}",
        "typescript": "function solve(...args: any[]): any {{\\n  // Solution\\n}}"
      }},
      "hints": ["Consider optimal data structures.", "Handle edge cases."],
      "test_cases": [
        {{"input": [[2, 7, 11], 9], "expected": [0, 1]}}
      ]
    }}
  ]
}}""".strip()


async def _generate_leetcode_batch_via_groq(
    skill: str, difficulty: str, count: int, subfocus: str
) -> list[dict]:
    """Call Groq AI to generate a batch of LeetCode-style questions."""
    import asyncio
    from app.core.config import settings
    if not settings.GROQ_API_KEY:
        return []

    prompt = _build_leetcode_prompt(skill, difficulty, count, subfocus)
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in GROQ_MODELS:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical interview designer for LeetCode and FAANG. "
                        "You produce pristine, rigorous coding challenges with complete test cases. "
                        "Respond ONLY with valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "max_tokens": 3000,
        }

        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=35.0) as client:
                    res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
                    if res.status_code == 429:
                        await asyncio.sleep(2.0 * (attempt + 1))
                        continue
                    if res.status_code != 200:
                        logger.warning(f"Groq model '{model}' HTTP {res.status_code}: {res.text[:120]}")
                        break
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    cleaned = _clean_json_text(content)
                    parsed = json.loads(cleaned)
                    raw_qs = parsed.get("questions", [])
                    if raw_qs:
                        logger.info(f"⚡ Groq model '{model}' generated {len(raw_qs)} {difficulty} LeetCode problems for '{skill}' ({subfocus})")
                        return raw_qs
            except Exception as e:
                logger.warning(f"Groq model '{model}' failed for coding skill '{skill}': {e}")
                await asyncio.sleep(1.0)
                continue

    return []


async def _ensure_leetcode_questions_for_skill(skill: str) -> None:
    """
    Ensures a rich 100 to 120+ question bank of LeetCode-style coding challenges
    across EASY (35), MEDIUM (55), and HARD (25) exists in MongoDB for this roadmap skill.
    """
    skill_clean = skill.strip()
    existing_count = await CodingQuestion.find(
        {"$or": [
            {"skill_tags": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
            {"topics": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
        ], "is_active": True}
    ).count()

    if existing_count >= 100:
        logger.debug(f"Skill '{skill}' already has {existing_count} LeetCode questions in DB.")
        return

    import asyncio
    import uuid

    logger.info(f"Generating comprehensive 100-120+ LeetCode problem bank for '{skill}'...")

    # Structured batches across Easy (35), Medium (55), and Hard (25) = ~115+ questions
    batches = [
        # EASY (~35 Qs)
        {"diff": "EASY", "count": 9, "subfocus": "Fundamental syntax, variables, conditionals, and type conversion"},
        {"diff": "EASY", "count": 9, "subfocus": "Array manipulation, string parsing, and loop operations"},
        {"diff": "EASY", "count": 9, "subfocus": "Hash lookups, frequency counting, and basic set operations"},
        {"diff": "EASY", "count": 8, "subfocus": "Math, bitwise operations, and simple matrix traversals"},
        # MEDIUM (~55 Qs)
        {"diff": "MEDIUM", "count": 9, "subfocus": "Two pointers, fast-slow pointers, and sliding window algorithms"},
        {"diff": "MEDIUM", "count": 9, "subfocus": "Interval merging, sorting algorithms, and binary search variants"},
        {"diff": "MEDIUM", "count": 9, "subfocus": "Hash maps, prefix sums, and subarray pattern matches"},
        {"diff": "MEDIUM", "count": 9, "subfocus": "Linked lists, stacks, monotonic stacks, and queue operations"},
        {"diff": "MEDIUM", "count": 9, "subfocus": "Binary trees, BST traversal, BFS/DFS, and lowest common ancestor"},
        {"diff": "MEDIUM", "count": 10, "subfocus": "Dynamic programming (1D/2D memoization), recursion, and backtracking"},
        # HARD (~25 Qs)
        {"diff": "HARD", "count": 8, "subfocus": "Graph algorithms (Dijkstra, topological sort, union-find, strongly connected)"},
        {"diff": "HARD", "count": 9, "subfocus": "Advanced dynamic programming, state machine transitions, and string edit distance"},
        {"diff": "HARD", "count": 8, "subfocus": "Complex data structure design (LRU/LFU cache, Trie, Segment tree, sliding window maximum)"},
    ]

    for b in batches:
        raw_qs = await _generate_leetcode_batch_via_groq(
            skill=skill_clean,
            difficulty=b["diff"],
            count=b["count"],
            subfocus=b["subfocus"],
        )

        for q in raw_qs:
            if not isinstance(q, dict):
                continue
            title = str(q.get("title", "")).strip()
            if not title:
                continue

            # Prevent duplicate title for this skill
            exists = await CodingQuestion.find_one({"title": title, "skill_tags": skill_clean})
            if exists:
                continue

            try:
                examples = [
                    CodingExample(
                        input=str(ex.get("input", "")),
                        output=str(ex.get("output", "")),
                        explanation=ex.get("explanation") or None,
                    )
                    for ex in q.get("examples", [])
                    if isinstance(ex, dict) and "input" in ex and "output" in ex
                ]
                test_cases = [
                    CodingTestCase(
                        input=tc.get("input", []) if isinstance(tc.get("input"), list) else [tc.get("input")],
                        expected=tc.get("expected"),
                    )
                    for tc in q.get("test_cases", [])
                    if isinstance(tc, dict) and "expected" in tc
                ]

                if not test_cases:
                    continue

                templates = q.get("starter_code_templates") or {}
                if not isinstance(templates, dict) or not templates:
                    starter_py = q.get("starter_code", f"def solve():\n    pass")
                    templates = {
                        "python": starter_py,
                        "javascript": f"function solve() {{\n  // Solution\n}}",
                        "typescript": f"function solve(): any {{\n  // Solution\n}}",
                    }

                question_id = f"lc_{skill_clean.lower().replace(' ', '_')}_{b['diff'].lower()}_{uuid.uuid4().hex[:8]}"
                doc = CodingQuestion(
                    question_id=question_id,
                    title=title,
                    difficulty=b["diff"],
                    topics=q.get("topics", [skill_clean, b["subfocus"]]),
                    skill_tags=[skill_clean],
                    concept=q.get("concept", b["subfocus"]),
                    description=q.get("description", f"Solve the {title} challenge testing {skill_clean}."),
                    examples=examples,
                    constraints=q.get("constraints", ["1 <= input.length <= 10^4"]),
                    function_signature=q.get("function_signature", f"def solve():"),
                    starter_code=templates.get("python") or q.get("starter_code", ""),
                    starter_code_templates=templates,
                    hints=q.get("hints", ["Break the problem into sub-problems."]),
                    acceptance_rate=float(q.get("acceptance_rate") or round(65.0 + (10.0 if b['diff'] == 'EASY' else -15.0 if b['diff'] == 'HARD' else 0.0), 1)),
                    test_cases=test_cases,
                    is_active=True,
                )
                await doc.insert()
            except Exception as e:
                logger.warning(f"Failed to insert LeetCode question '{title}': {e}")

        await asyncio.sleep(0.3)


# ─── Endpoints for LeetCode Practice Arena

@router.get("/leetcode-problems")
async def get_leetcode_problems(
    skill: Optional[str] = Query(None),
    difficulty: Optional[str] = Query("ALL"),
    concept: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Returns AI-generated LeetCode coding challenges from MongoDB, ensuring 75-80 questions
    exist per roadmap skill / concept.
    """
    student_id = str(current_user.id)

    # 1. Determine active skills and their unlock status from student's Roadmap
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
    student_skills: List[str] = []
    skills_meta: dict = {}

    if roadmap and roadmap.phases:
        for phase_idx, phase in enumerate(roadmap.phases):
            p_dict = phase if isinstance(phase, dict) else (phase.dict() if hasattr(phase, "dict") else {})
            items = p_dict.get("items") or p_dict.get("skills") or []
            for item_idx, it in enumerate(items):
                s_name = it.get("skill") or it.get("name") or it.get("title") if isinstance(it, dict) else str(it)
                if s_name and s_name.strip() and "project" not in s_name.lower():
                    clean_s = s_name.strip()
                    if clean_s not in student_skills:
                        student_skills.append(clean_s)

                    watched_list = roadmap.watched_videos.get(clean_s.lower(), []) if roadmap.watched_videos else []
                    it_status = it.get("status", "locked") if isinstance(it, dict) else "locked"
                    it_prog = it.get("progress_pct", 0) if isinstance(it, dict) else 0

                    is_unl = (
                        (phase_idx == 0 and item_idx == 0)
                        or (it_status == "completed")
                        or (it_prog >= 50)
                        or (len(watched_list) >= 1)
                    )
                    l_reason = None if is_unl else f"Watch video tutorials on your Learning Roadmap for {clean_s} to unlock coding challenges."
                    skills_meta[clean_s] = {
                        "is_unlocked": is_unl,
                        "lock_reason": l_reason,
                        "progress_pct": it_prog or (100 if it_status == "completed" else len(watched_list) * 33),
                    }

    if not student_skills and not skill:
        return {
            "skill": "",
            "has_skill_gap": False,
            "student_skills": [],
            "skills_meta": {},
            "is_locked": False,
            "lock_reason": None,
            "total": 0,
            "page": page,
            "limit": limit,
            "total_solved": 0,
            "concepts": [],
            "problems": [],
        }

    target_skill = skill.strip() if skill else student_skills[0]
    target_meta = skills_meta.get(target_skill, {"is_unlocked": True, "lock_reason": None, "progress_pct": 100})
    is_skill_locked = not target_meta.get("is_unlocked", True)
    skill_lock_reason = target_meta.get("lock_reason")

    # 2. Ensure question bank exists for this skill
    skill_clean = target_skill.strip()
    existing_count = await CodingQuestion.find(
        {"$or": [
            {"skill_tags": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
            {"topics": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
        ], "is_active": True}
    ).count()

    if existing_count == 0:
        # First batch generation synchronously
        raw_first = await _generate_leetcode_batch_via_groq(
            skill=skill_clean,
            difficulty="EASY",
            count=8,
            subfocus="Fundamental syntax and basic operations",
        )
        import uuid
        for q in raw_first:
            if not isinstance(q, dict):
                continue
            title = str(q.get("title", "")).strip()
            if not title:
                continue
            try:
                examples = [
                    CodingExample(
                        input=str(ex.get("input", "")),
                        output=str(ex.get("output", "")),
                        explanation=ex.get("explanation") or None,
                    )
                    for ex in q.get("examples", [])
                    if isinstance(ex, dict) and "input" in ex and "output" in ex
                ]
                test_cases = [
                    CodingTestCase(
                        input=tc.get("input", []) if isinstance(tc.get("input"), list) else [tc.get("input")],
                        expected=tc.get("expected"),
                    )
                    for tc in q.get("test_cases", [])
                    if isinstance(tc, dict) and "expected" in tc
                ]
                if test_cases:
                    templates = q.get("starter_code_templates") or {
                        "python": q.get("starter_code", f"def solve():\n    pass"),
                        "javascript": "function solve() {\n  // Solution\n}",
                    }
                    doc = CodingQuestion(
                        question_id=f"lc_{skill_clean.lower().replace(' ', '_')}_easy_{uuid.uuid4().hex[:8]}",
                        title=title,
                        difficulty="EASY",
                        topics=q.get("topics", [skill_clean, "Fundamentals"]),
                        skill_tags=[skill_clean],
                        concept=q.get("concept", "Fundamentals"),
                        description=q.get("description", f"Solve the {title} challenge testing {skill_clean}."),
                        examples=examples,
                        constraints=q.get("constraints", ["1 <= input.length <= 10^4"]),
                        function_signature="def solve():",
                        starter_code=templates.get("python", ""),
                        starter_code_templates=templates,
                        hints=q.get("hints", ["Break the problem into sub-problems."]),
                        acceptance_rate=78.0,
                        test_cases=test_cases,
                        is_active=True,
                    )
                    await doc.insert()
            except Exception:
                pass

        # Trigger background task to populate the rest up to 100-120+ questions
        import asyncio
        asyncio.create_task(_ensure_leetcode_questions_for_skill(skill_clean))
    elif existing_count < 100:
        import asyncio
        asyncio.create_task(_ensure_leetcode_questions_for_skill(skill_clean))

    # 3. Build query filters
    query: dict = {"is_active": True}
    if target_skill:
        query["$or"] = [
            {"skill_tags": {"$elemMatch": {"$regex": f"^{re.escape(target_skill)}$", "$options": "i"}}},
            {"topics": {"$elemMatch": {"$regex": f"^{re.escape(target_skill)}$", "$options": "i"}}},
        ]

    if difficulty and difficulty.upper() != "ALL":
        query["difficulty"] = difficulty.upper()

    if concept and concept.strip():
        query["concept"] = {"$regex": re.escape(concept.strip()), "$options": "i"}

    if search and search.strip():
        query["$and"] = [
            {"$or": [
                {"title": {"$regex": re.escape(search.strip()), "$options": "i"}},
                {"concept": {"$regex": re.escape(search.strip()), "$options": "i"}},
                {"topics": {"$elemMatch": {"$regex": re.escape(search.strip()), "$options": "i"}}},
            ]}
        ]

    total = await CodingQuestion.find(query).count()
    skip = (page - 1) * limit
    questions = await CodingQuestion.find(query).skip(skip).limit(limit).to_list()

    # Solved questions for this user
    solved_docs = await CodingSolvedProblem.find(
        CodingSolvedProblem.student_id == student_id
    ).to_list()
    solved_ids = {s.question_id for s in solved_docs}

    # Count solved by difficulty for progressive problem unlocking
    solved_easy = sum(1 for s in solved_docs if "_easy_" in s.question_id)
    solved_med = sum(1 for s in solved_docs if "_medium_" in s.question_id)

    out = []
    for q in questions:
        # Determine problem-level lock status
        if is_skill_locked:
            p_unlocked = False
            p_reason = skill_lock_reason
        elif q.difficulty == "EASY":
            p_unlocked = True
            p_reason = None
        elif q.difficulty == "MEDIUM":
            p_unlocked = (solved_easy >= 1 or target_meta.get("progress_pct", 0) >= 30)
            p_reason = None if p_unlocked else "Solve at least 1 Easy challenge in this skill to unlock Medium challenges."
        elif q.difficulty == "HARD":
            p_unlocked = (solved_med >= 1 or target_meta.get("progress_pct", 0) >= 60)
            p_reason = None if p_unlocked else "Solve at least 1 Medium challenge in this skill to unlock Hard challenges."
        else:
            p_unlocked = True
            p_reason = None

        out.append({
            "question_id": q.question_id,
            "title": q.title,
            "difficulty": q.difficulty,
            "concept": q.concept or (q.topics[0] if q.topics else q.skill_tags[0] if q.skill_tags else "Core Logic"),
            "topics": q.topics,
            "skill_tags": q.skill_tags,
            "acceptance_rate": getattr(q, "acceptance_rate", 75.0),
            "is_solved": q.question_id in solved_ids,
            "is_unlocked": p_unlocked,
            "lock_reason": p_reason,
            "examples_count": len(q.examples),
            "test_cases_count": len(q.test_cases),
        })

    # Available concepts under target skill
    all_skill_qs = await CodingQuestion.find(
        {"$or": [
            {"skill_tags": {"$elemMatch": {"$regex": f"^{re.escape(target_skill)}$", "$options": "i"}}},
            {"topics": {"$elemMatch": {"$regex": f"^{re.escape(target_skill)}$", "$options": "i"}}},
        ], "is_active": True}
    ).to_list()
    concepts = sorted(list({q.concept for q in all_skill_qs if q.concept}))

    return {
        "skill": target_skill,
        "has_skill_gap": True,
        "student_skills": student_skills,
        "skills_meta": skills_meta,
        "is_locked": is_skill_locked,
        "lock_reason": skill_lock_reason,
        "total": total,
        "page": page,
        "limit": limit,
        "total_solved": len(solved_ids),
        "concepts": concepts,
        "problems": out,
    }


@router.get("/leetcode-problems/{question_id}")
async def get_leetcode_problem_details(
    question_id: str,
    current_user: User = Depends(get_current_user),
):
    """Returns complete LeetCode problem specification, starter codes, and public test cases."""
    q = await CodingQuestion.find_one(CodingQuestion.question_id == question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Coding problem not found.")

    student_id = str(current_user.id)
    solved = await CodingSolvedProblem.find_one(
        CodingSolvedProblem.student_id == student_id,
        CodingSolvedProblem.question_id == question_id,
    )

    return {
        "question_id": q.question_id,
        "title": q.title,
        "difficulty": q.difficulty,
        "concept": q.concept,
        "topics": q.topics,
        "skill_tags": q.skill_tags,
        "description": q.description,
        "constraints": getattr(q, "constraints", ["1 <= input.length <= 10^4"]),
        "examples": [
            {"input": e.input, "output": e.output, "explanation": e.explanation}
            for e in q.examples
        ],
        "starter_code": q.starter_code,
        "starter_code_templates": getattr(q, "starter_code_templates", {
            "python": q.starter_code,
            "javascript": "function solve() {\n  // Write solution here\n}",
        }),
        "hints": getattr(q, "hints", []),
        "acceptance_rate": getattr(q, "acceptance_rate", 75.0),
        "is_solved": bool(solved),
        "public_test_cases": [
            {"input": tc.input, "expected": tc.expected}
            for tc in q.test_cases[:3]
        ],
    }


class RunCodeRequest(BaseModel):
    question_id: str
    language: str
    code: str
    custom_test_cases: Optional[List[dict]] = None


@router.post("/run-code")
async def run_student_code(
    body: RunCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Executes student code against public test cases in an isolated subprocess.
    Returns per-case passed/failed metrics, runtime, and console logs.
    """
    q = await CodingQuestion.find_one(CodingQuestion.question_id == body.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Problem not found.")

    test_cases_to_run = body.custom_test_cases or [
        {"input": tc.input, "expected": tc.expected}
        for tc in q.test_cases[:3]
    ]

    exec_result = await execute_code(
        language=body.language,
        code=body.code,
        test_cases=test_cases_to_run,
        function_name="solve",
    )
    return exec_result


class SubmitCodeRequest(BaseModel):
    question_id: str
    language: str
    code: str


@router.post("/submit-code")
async def submit_student_code(
    body: SubmitCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates student code against ALL test cases (public + hidden).
    If accepted: records solve in DB and logs activity.
    """
    student_id = str(current_user.id)
    q = await CodingQuestion.find_one(CodingQuestion.question_id == body.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Problem not found.")

    all_test_cases = [
        {"input": tc.input, "expected": tc.expected}
        for tc in q.test_cases
    ]

    exec_result = await execute_code(
        language=body.language,
        code=body.code,
        test_cases=all_test_cases,
        function_name="solve",
    )

    if exec_result.get("status") == "ACCEPTED":
        existing = await CodingSolvedProblem.find_one(
            CodingSolvedProblem.student_id == student_id,
            CodingSolvedProblem.question_id == body.question_id,
        )
        if not existing:
            doc = CodingSolvedProblem(
                student_id=student_id,
                question_id=body.question_id,
                title=q.title,
                difficulty=q.difficulty,
                topics=q.topics,
            )
            await doc.insert()

            try:
                await ActivityLog(
                    student_id=student_id,
                    type="submission",
                    title=f"Solved LeetCode Challenge: {q.title}",
                    detail=f"{q.difficulty} · {q.concept or q.skill_tags[0]}",
                ).insert()
            except Exception:
                pass

        exec_result["already_credited"] = bool(existing)
        exec_result["message"] = "Accepted! All test cases passed! 🎉"

    return exec_result


