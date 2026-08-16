import logging
import json
import httpx
import re
from typing import Optional
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


# ─── Arena Problems — Real Questions via Groq AI per Skill Gap ────────────────

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _build_coding_question_prompt(skill: str, difficulty: str, count: int = 4) -> str:
    diff_map = {
        "EASY":   "beginner — single concept, small inputs, straightforward logic",
        "MEDIUM": "intermediate — combines 2-3 concepts, moderate input size",
        "HARD":   "advanced — optimization, edge cases, complex logic, larger inputs",
    }
    return f"""You are generating concept-wise JavaScript coding practice questions for the skill: "{skill}".
Difficulty: {difficulty} ({diff_map.get(difficulty, "intermediate")}).

TASK: Generate {count} questions, each covering a DISTINCT core concept/sub-topic within "{skill}".
Each question must target ONE specific concept (e.g., for "React" -> hooks, memoization, state management; for "Arrays" -> sliding window, two pointers, sorting, prefix sums).

STRICT RULES:
1. Each question = a pure JavaScript function (no I/O, no stdin/stdout).
2. Self-contained and testable: fn(...inputs) must return a value directly comparable to expected.
3. test_cases: use ONLY JSON primitives (numbers, strings, booleans, arrays, plain objects). NO class instances.
4. DO NOT use TreeNode, ListNode or other class-based structures.
5. starter_code must be a named function definition.
6. The "concept" field is the specific sub-topic this question tests (e.g., "Sliding Window", "Array Destructuring", "Closure").
7. Return ONLY valid JSON — no markdown, no explanation.

Return exactly this JSON:
{{
  "questions": [
    {{
      "concept": "Specific Sub-concept Name",
      "title": "Short descriptive problem title",
      "topics": ["Concept1", "Concept2"],
      "description": "Clear 2-3 sentence problem statement with constraints.",
      "examples": [
        {{"input": "human-readable input", "output": "human-readable output", "explanation": "brief why"}},
        {{"input": "another example input", "output": "expected output"}}
      ],
      "function_signature": "function functionName(param1, param2)",
      "starter_code": "function functionName(param1, param2) {{\\n  // Write your solution here\\n}}",
      "test_cases": [
        {{"input": [<actual value(s)>], "expected": <actual value>}},
        {{"input": [<actual value(s)>], "expected": <actual value>}},
        {{"input": [<actual value(s)>], "expected": <actual value>}}
      ]
    }}
  ]
}}""".strip()


async def _generate_questions_via_groq(skill: str, difficulty: str, count: int = 4) -> list[dict]:
    """Call Groq AI to generate real coding questions for a given skill + difficulty."""
    from app.core.config import settings
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — cannot generate coding questions.")
        return []

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert software engineering interview coach. "
                    "You create precise, testable JavaScript coding problems. "
                    "Always respond with strictly valid JSON only — no markdown, no extra text."
                ),
            },
            {"role": "user", "content": _build_coding_question_prompt(skill, difficulty, count)},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"].strip()
            parsed = json.loads(content)
            questions = parsed.get("questions", [])
            logger.info(f"⚡ Groq generated {len(questions)} {difficulty} questions for skill '{skill}'")
            return questions
    except Exception as e:
        logger.error(f"Groq coding question generation failed for skill='{skill}' diff='{difficulty}': {e}")
        return []


async def _ensure_questions_for_skill(skill: str) -> None:
    """
    For a given skill, generate and cache EASY + MEDIUM + HARD questions via Groq AI.
    Skip any difficulty level that already has questions in MongoDB for this skill.
    """
    # Check if ANY active questions exist for this skill in MongoDB
    skill_clean = skill.strip()
    existing_for_skill = await CodingQuestion.find(
        {"$or": [
            {"skill_tags": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
            {"topics": {"$elemMatch": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}},
            {"concept": {"$regex": f"^{re.escape(skill_clean)}$", "$options": "i"}}
        ], "is_active": True}
    ).count()

    if existing_for_skill >= 1:
        logger.debug(f"Skipping Groq generation — {existing_for_skill} questions already exist in DB for skill '{skill}'")
        return

    import uuid
    for difficulty in ["EASY", "MEDIUM", "HARD"]:

        logger.info(f"Generating {difficulty} questions for skill '{skill}'...")
        raw_questions = await _generate_questions_via_groq(skill, difficulty, count=4)

        for q in raw_questions:
            if not isinstance(q, dict):
                continue
            title = q.get("title", "").strip()
            if not title:
                continue

            # Skip duplicates by title + skill
            dup = await CodingQuestion.find_one({"title": title, "skill_tags": skill})
            if dup:
                continue

            try:
                examples = [
                    CodingExample(
                        input=str(ex.get("input", "")),
                        output=str(ex.get("output", "")),
                        explanation=ex.get("explanation") or None,
                    )
                    for ex in q.get("examples", [])
                ]
                test_cases = [
                    CodingTestCase(
                        input=tc.get("input", []),
                        expected=tc.get("expected"),
                    )
                    for tc in q.get("test_cases", [])
                    if isinstance(tc.get("input"), list)
                ]

                if not test_cases:
                    logger.warning(f"Skipping '{title}' — no valid test_cases returned by Groq.")
                    continue

                question_id = f"groq_{skill.lower().replace(' ', '_')}_{difficulty.lower()}_{uuid.uuid4().hex[:8]}"
                doc = CodingQuestion(
                    question_id=question_id,
                    title=title,
                    difficulty=difficulty,
                    topics=q.get("topics", [skill]),
                    skill_tags=[skill],
                    concept=q.get("concept", "").strip() or skill,
                    description=q.get("description", ""),
                    examples=examples,
                    function_signature=q.get("function_signature", "function solve()"),
                    starter_code=q.get("starter_code", "function solve() {\n  // Write your solution here\n}"),
                    test_cases=test_cases,
                )
                await doc.insert()
                logger.info(f"✅ Saved '{title}' ({difficulty}) for skill '{skill}'")
            except Exception as e:
                logger.warning(f"Failed to save question '{title}': {e}")


@router.get("/arena-problems")
async def get_arena_problems(
    current_user: User = Depends(get_current_user),
):
    """
    Returns real AI-generated coding questions from MongoDB, grouped and prioritized
    by the student's actual Skill Gap from their Roadmap + recent MCQ weak areas.
    Questions are generated on-demand via Groq AI and cached in MongoDB.
    Zero hardcoded/mock data.
    """
    student_id = str(current_user.id)

    # ── 1. Extract student's real weak skills from StudentRoadmap ──────────────
    weak_skills: list[dict] = []
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
    if roadmap and roadmap.phases:
        for phase in roadmap.phases:
            items = phase.get("items", []) if isinstance(phase, dict) else getattr(phase, "items", [])
            for item in items:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "project":
                    continue
                skill = item.get("skill", "").strip()
                gap = item.get("gap", 0)
                status = item.get("status", "")
                if skill and (status != "completed" or gap > 0):
                    weak_skills.append({"skill": skill, "gap": gap, "status": status})

    # ── 2. Augment with MCQ weak skill tags (score < 80%) ─────────────────────
    recent_results = (
        await AssessmentResult.find(AssessmentResult.student_id == student_id)
        .sort(-AssessmentResult.taken_at)
        .limit(5)
        .to_list()
    )
    existing_skill_names = {s["skill"].lower() for s in weak_skills}
    for r in recent_results:
        if r.score_pct < 80:
            for tag in r.skill_tags:
                if tag.lower() not in existing_skill_names:
                    existing_skill_names.add(tag.lower())
                    weak_skills.append({"skill": tag, "gap": 2, "status": "needs_practice"})

    # ── 3. For each weak skill, ensure Groq-generated questions exist in DB ───
    # Sort by gap descending so highest-gap skills are generated first
    top_skills = sorted(weak_skills, key=lambda x: x.get("gap", 0), reverse=True)[:6]

    for ws in top_skills:
        await _ensure_questions_for_skill(ws["skill"])

    # ── 4. Fetch all active questions from MongoDB ─────────────────────────────
    all_questions = await CodingQuestion.find(CodingQuestion.is_active == True).to_list()

    # ── 5. Rank: questions matching the student's weak skill names come first ──
    weak_skill_names_lower = [s["skill"].lower() for s in weak_skills]

    def rank_question(q: CodingQuestion) -> int:
        q_tags = [t.lower() for t in q.skill_tags + q.topics]
        score = 0
        for ws_lower in weak_skill_names_lower:
            if any(ws_lower in t or t in ws_lower for t in q_tags):
                score += 3
        # Bonus: sort EASY before MEDIUM before HARD within same score band
        diff_order = {"EASY": 0, "MEDIUM": 1, "HARD": 2}
        return score * 10 - diff_order.get(q.difficulty, 1)

    all_questions.sort(key=rank_question, reverse=True)

    out_problems = [
        {
            "id": q.question_id,
            "title": q.title,
            "difficulty": q.difficulty,
            "concept": getattr(q, "concept", None) or (q.topics[0] if q.topics else q.skill_tags[0] if q.skill_tags else "General"),
            "topics": q.topics,
            "skillTags": q.skill_tags,
            "description": q.description,
            "examples": [
                {"input": e.input, "output": e.output, "explanation": e.explanation}
                for e in q.examples
            ],
            "functionSignature": q.function_signature,
            "starterCode": q.starter_code,
            "testCases": [
                {"input": tc.input, "expected": tc.expected}
                for tc in q.test_cases
            ],
        }
        for q in all_questions
    ]

    # 6. Fetch student's solved coding problems from MongoDB
    solved_docs = await CodingSolvedProblem.find(
        CodingSolvedProblem.student_id == student_id
    ).to_list()
    solved_ids = [s.question_id for s in solved_docs]

    return {
        "weak_skills": weak_skills,
        "problems": out_problems,
        "solved_ids": solved_ids,
    }


class SubmitSolvedBody(BaseModel):
    question_id: str
    title: str
    difficulty: str
    topics: list[str] = []


@router.post("/arena-problems/submit-solved")
async def submit_solved_problem(
    body: SubmitSolvedBody,
    current_user: User = Depends(get_current_user),
):
    """
    Persists solved status for a coding practice problem in MongoDB
    and logs an activity entry in the student activity stream.
    """
    student_id = str(current_user.id)

    existing = await CodingSolvedProblem.find_one(
        CodingSolvedProblem.student_id == student_id,
        CodingSolvedProblem.question_id == body.question_id,
    )

    if not existing:
        doc = CodingSolvedProblem(
            student_id=student_id,
            question_id=body.question_id,
            title=body.title,
            difficulty=body.difficulty,
            topics=body.topics,
        )
        await doc.insert()

        # Log entry to Activity Stream (type: "submission")
        try:
            topics_str = ", ".join(body.topics[:2]) if body.topics else "General"
            await ActivityLog(
                student_id=student_id,
                type="submission",
                title=f"Solved Coding Challenge: {body.title}",
                detail=f"{body.difficulty} · {topics_str}",
            ).insert()
        except Exception as e:
            logger.warning(f"Could not log activity for coding challenge solve: {e}")

    return {"status": "ok", "question_id": body.question_id}

