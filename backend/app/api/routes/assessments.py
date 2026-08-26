import uuid
import random
import logging
import json
import html
import httpx
import re
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.assessment import (
    AssessmentTopic,
    AssessmentSession,
    AssessmentResult,
    AssessmentQuestion,
    MCQQuestion,
    MCQOption,
)
from app.models.student_profile import StudentProfile
from app.models.roadmap import StudentRoadmap
from app.models.employability_score import EmployabilityScore
from app.models.activity_log import ActivityLog
from app.core.event_bus import event_bus
from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["Assessments — MCQ"])

QUIZAPI_BASE = "https://quizapi.io/api/v1/questions"
OPENTDB_BASE = "https://opentdb.com/api.php"


# Maps SkillDipz role → QuizAPI tags (real tag strings from quizapi.io)
ROLE_TO_QUIZAPI_TAGS = {
    "backend":   ["python", "sql", "mysql", "linux", "bash", "git", "docker"],
    "fullstack": ["javascript", "html", "css", "react", "git", "sql"],
    "data":      ["python", "sql", "mysql", "bash"],
    "devops":    ["docker", "linux", "bash", "devops", "git"],
    "ai":        ["python", "sql", "bash"],
}

# OpenTDB difficulty mapping
OPENTDB_DIFF = {
    "Beginner": "easy",
    "Intermediate": "medium",
    "Advanced": "hard",
}

QUIZAPI_DIFF = {
    "Beginner": "Easy",
    "Intermediate": "Medium",
    "Advanced": "Hard",
}


def normalize_quizapi_question(q: dict, skill_tag: str) -> Optional[MCQQuestion]:
    raw_answers = q.get("answers", {})
    raw_correct = q.get("correct_answers", {})

    options = []
    correct_key = None
    key_map = {"answer_a": "A", "answer_b": "B",
               "answer_c": "C", "answer_d": "D"}

    for field, letter in key_map.items():
        text = raw_answers.get(field)
        if text:
            options.append(MCQOption(key=letter, text=str(text).strip()))
            if raw_correct.get(f"{field}_correct") == "true":
                correct_key = letter

    if not options or not correct_key or len(options) < 2:
        return None  # Skip malformed question

    return MCQQuestion(
        question_id=f"qapi_{q['id']}",
        question=str(q.get("question", "")).strip(),
        options=options,
        correct_key=correct_key,
        explanation=q.get("description") or None,
        skill_tag=skill_tag,
        source="quizapi",
    )


def normalize_opentdb_question(q: dict) -> MCQQuestion:
    correct = html.unescape(q["correct_answer"])
    incorrects = [html.unescape(i) for i in q["incorrect_answers"]]

    all_answers = [correct] + incorrects
    random.shuffle(all_answers)

    options = []
    correct_key = "A"
    for i, text in enumerate(all_answers):
        letter = chr(65 + i)  # A, B, C, D
        options.append(MCQOption(key=letter, text=text))
        if text == correct:
            correct_key = letter

    return MCQQuestion(
        question_id=f"otdb_{uuid.uuid4().hex[:8]}",
        question=html.unescape(q["question"]),
        options=options,
        correct_key=correct_key,
        skill_tag="General CS",
        source="opentdb",
    )


async def fetch_questions_from_quizapi(
    tags: List[str], difficulty: str, count: int = 15
) -> List[MCQQuestion]:
    if not settings.QUIZ_API_KEY:
        return []

    redis = get_redis()
    cache_key = f"quiz:{'-'.join(sorted(tags[:2]))}:{difficulty}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                raw = json.loads(cached)
                questions = [MCQQuestion(**q) for q in raw]
                random.shuffle(questions)
                return questions[:count]
        except Exception:
            pass

    questions: List[MCQQuestion] = []
    try:
        # QuizAPI only accepts one tag at a time cleanly — try primary tag
        for tag in tags[:3]:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    QUIZAPI_BASE,
                    params={
                        "tags": tag,
                        "difficulty": QUIZAPI_DIFF.get(difficulty, "Medium"),
                        "limit": 20,
                        "random": "true",
                        "type": "MULTIPLE_CHOICE",
                    },
                    headers={"Authorization": f"Bearer {settings.QUIZ_API_KEY}"},
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                for q in data:
                    normalized = normalize_quizapi_question(
                        q, skill_tag=tag.title())
                    if normalized:
                        questions.append(normalized)
            if len(questions) >= count:
                break
    except Exception as e:
        logger.warning(f"QuizAPI error: {e}")

    if redis and questions:
        try:
            await redis.setex(
                cache_key,
                3600,  # 1 hour
                json.dumps([q.model_dump() for q in questions])
            )
        except Exception:
            pass

    random.shuffle(questions)
    return questions[:count]


async def fetch_questions_from_opentdb(difficulty: str, count: int = 10) -> List[MCQQuestion]:
    redis = get_redis()
    cache_key = f"opentdb:{difficulty}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                raw = json.loads(cached)
                questions = [MCQQuestion(**q) for q in raw]
                random.shuffle(questions)
                return questions[:count]
        except Exception:
            pass

    questions: List[MCQQuestion] = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                OPENTDB_BASE,
                params={
                    "amount": 20,
                    "category": 18,  # Science: Computers
                    "type": "multiple",
                    "difficulty": OPENTDB_DIFF.get(difficulty, "medium"),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("response_code") == 0:
                for q in data.get("results", []):
                    questions.append(normalize_opentdb_question(q))
    except Exception as e:
        logger.warning(f"OpenTDB error: {e}")

    if redis and questions:
        try:
            await redis.setex(
                cache_key,
                7200,  # 2 hours
                json.dumps([q.model_dump() for q in questions])
            )
        except Exception:
            pass

    random.shuffle(questions)
    return questions[:count]


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
    """Removes markdown fences and finds JSON object boundaries."""
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
        return text[start:end + 1].strip()
    return text.strip()


async def fetch_mcq_from_groq(
    topic_title: str, skill_tags: List[str], difficulty: str, count: int = 20
) -> List[MCQQuestion]:
    """
    Generate concept-wise MCQ questions for a student's skill gap using Groq AI.
    """
    if not settings.GROQ_API_KEY:
        return []

    tags_str = ", ".join(skill_tags) if skill_tags else topic_title
    prompt = f"""You are a senior technical assessment designer.
Generate exactly {count} multiple-choice technical interview questions testing "{topic_title}".
Target skills / concepts: {tags_str}.
Difficulty Level: {difficulty}.

STRICT RULES:
1. Each question must test practical technical concepts, code syntax, architectural trade-offs, performance, or real-world debugging.
2. Provide exactly 4 options per question: A, B, C, D.
3. correct_key MUST be one of "A", "B", "C", "D".
4. Provide a 1-2 sentence explanation of why the correct_key is right.
5. Return ONLY valid JSON, no markdown code fences.

JSON SCHEMA:
{{
  "questions": [
    {{
      "id": "1",
      "question": "Question text here?",
      "options": [
        {{"key": "A", "text": "Option A"}},
        {{"key": "B", "text": "Option B"}},
        {{"key": "C", "text": "Option C"}},
        {{"key": "D", "text": "Option D"}}
      ],
      "correct_key": "A",
      "explanation": "Brief explanation why A is correct.",
      "skill_tag": "{skill_tags[0] if skill_tags else topic_title}"
    }}
  ]
}}"""

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    import asyncio

    for model in GROQ_MODELS:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical assessment engineer. "
                        "You create rigorous, concept-focused multiple choice questions for software engineers. "
                        "Respond ONLY with valid JSON without markdown code fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 3000,
        }
        if "gpt-oss" in model or "llama" in model:
            payload["response_format"] = {"type": "json_object"}

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

                    out: List[MCQQuestion] = []
                    for item in raw_qs:
                        opts = [
                            MCQOption(key=o["key"], text=str(o["text"]).strip())
                            for o in item.get("options", [])
                            if isinstance(o, dict) and "key" in o and "text" in o
                        ]
                        if len(opts) == 4 and item.get("correct_key") in ["A", "B", "C", "D"]:
                            out.append(
                                MCQQuestion(
                                    question_id=f"groq_mcq_{uuid.uuid4().hex[:8]}",
                                    question=str(item.get("question", "")).strip(),
                                    options=opts,
                                    correct_key=item["correct_key"],
                                    explanation=item.get("explanation"),
                                    skill_tag=item.get("skill_tag", skill_tags[0] if skill_tags else topic_title),
                                    source="groq_ai",
                                )
                            )
                    if out:
                        logger.info(f"⚡ Groq model '{model}' generated {len(out)} MCQ questions for '{topic_title}'")
                        return out
            except Exception as e:
                logger.warning(f"Groq model '{model}' attempt {attempt+1} failed: {e}")
                await asyncio.sleep(1.0)

    logger.error(f"All Groq models failed for topic '{topic_title}'")
    return []


async def ensure_comprehensive_question_bank(topic: AssessmentTopic) -> None:
    """
    Ensures a massive 60-70 question multi-tier question bank (Beginner, Intermediate, Advanced)
    is generated via Groq AI and persisted in MongoDB for this skill / role.
    """
    skill_name = clean_skill_tag(topic)
    base_id = topic.topic_id.split("-set-")[0]

    existing_count = await AssessmentQuestion.find(
        {"$or": [
            {"topic_id": {"$regex": f"^{re.escape(base_id)}"}},
            {"skill_tag": skill_name},
        ], "is_active": True}
    ).count()

    if existing_count >= 50:
        return

    import asyncio
    clean_title = skill_name.strip()
    logger.info(f"Generating comprehensive 60-70 question bank for '{clean_title}' ({topic.role})...")

    # 3 comprehensive concept batches: Beginner (20), Intermediate (25), Advanced (20) = 65 questions
    batch_configs = [
        # Beginner Foundations (20 Qs)
        {"diff": "Beginner", "count": 20, "subfocus": "core syntax, fundamental types, operators, standard library functions, and control flow"},
        # Intermediate Architecture & Patterns (25 Qs)
        {"diff": "Intermediate", "count": 25, "subfocus": "data structures, OOP, functional patterns, API integration, database queries, and error handling"},
        # Advanced Engineering & Optimization (20 Qs)
        {"diff": "Advanced", "count": 20, "subfocus": "asynchronous concurrency, memory efficiency, profiling, security practices, and production architecture"},
    ]

    for cfg in batch_configs:
        sub_title = f"{clean_title}: {cfg['subfocus']}"
        qs = await fetch_mcq_from_groq(
            topic_title=sub_title,
            skill_tags=[clean_title],
            difficulty=cfg["diff"],
            count=cfg["count"],
        )
        for q in qs:
            exists = await AssessmentQuestion.find_one(
                {"$or": [
                    {"topic_id": {"$regex": f"^{re.escape(base_id)}"}},
                    {"skill_tag": clean_title},
                ], "question": q.question}
            )
            if not exists:
                await AssessmentQuestion(
                    role=topic.role,
                    topic_id=base_id,
                    topic_title=f"{clean_title} — Skill Assessment",
                    difficulty=cfg["diff"],
                    skill_tag=clean_title,
                    question=q.question,
                    options=q.options,
                    correct_key=q.correct_key,
                    explanation=q.explanation,
                    is_active=True,
                ).insert()
        await asyncio.sleep(1.5)


def clean_skill_tag(topic: AssessmentTopic) -> str:
    if topic.skill_tags:
        return topic.skill_tags[0]
    return topic.title.split("—")[0].strip()


async def get_questions_for_topic(topic: AssessmentTopic) -> List[MCQQuestion]:
    """
    Fetches 10 questions for this set from the comprehensive 50-70 question bank in MongoDB,
    triggering multi-tier Groq AI generation whenever needed.
    """
    skill_name = clean_skill_tag(topic)
    base_id = topic.topic_id.split("-set-")[0]

    # 1. Check existing questions for this skill
    existing = await AssessmentQuestion.find(
        {"$or": [
            {"topic_id": {"$regex": f"^{re.escape(base_id)}"}},
            {"skill_tag": skill_name},
        ], "is_active": True}
    ).to_list()

    if len(existing) < 30:
        await ensure_comprehensive_question_bank(topic)
        existing = await AssessmentQuestion.find(
            {"$or": [
                {"topic_id": {"$regex": f"^{re.escape(base_id)}"}},
                {"skill_tag": skill_name},
            ], "is_active": True}
        ).to_list()

    if existing:
        # Match questions by difficulty if available, else sample from bank
        diff_matched = [q for q in existing if q.difficulty.lower() == topic.difficulty.lower()]
        pool = diff_matched if len(diff_matched) >= topic.question_count else existing
        sample_size = min(len(pool), topic.question_count)
        chosen = random.sample(pool, sample_size)
        return [
            MCQQuestion(
                question_id=str(q.id),
                question=q.question,
                options=q.options,
                correct_key=q.correct_key,
                explanation=q.explanation,
                skill_tag=q.skill_tag,
                source="database",
            )
            for q in chosen
        ]

    # Fallback to direct Groq generation
    groq_qs = await fetch_mcq_from_groq(
        topic_title=topic.title,
        skill_tags=[skill_name],
        difficulty=topic.difficulty,
        count=topic.question_count,
    )
    return groq_qs[:topic.question_count] if groq_qs else []


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/available")
async def get_available_assessments(
    role: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    List active assessment topics strictly derived from the student's Learning Roadmap.
    Enforces progressive unlocking based on video completion.
    """
    student_id = str(current_user.id)

    # 1. Fetch student's real Learning Roadmap from MongoDB
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
    roadmap_topics: List[dict] = []

    # Get student's assessment results history
    results = (
        await AssessmentResult.find(AssessmentResult.student_id == student_id)
        .sort(-AssessmentResult.taken_at)
        .to_list()
    )
    result_map: dict = {}
    attempt_counts: dict = {}
    for r in results:
        attempt_counts[r.topic_id] = attempt_counts.get(r.topic_id, 0) + 1
        if r.topic_id not in result_map:
            result_map[r.topic_id] = r

    now = datetime.now(timezone.utc)

    if roadmap and roadmap.phases:
        for phase_idx, phase in enumerate(roadmap.phases):
            phase_dict = phase if isinstance(phase, dict) else (phase.dict() if hasattr(phase, "dict") else {})
            phase_num = phase_idx + 1
            items = phase_dict.get("items") or phase_dict.get("skills") or []

            diff_level = "Beginner" if phase_num == 1 else ("Intermediate" if phase_num == 2 else "Advanced")

            for item_idx, item in enumerate(items):
                skill_name = None
                subtopics = []
                item_status = "locked"
                progress_pct = 0

                if isinstance(item, dict):
                    if item.get("type") == "project" or "project" in str(item.get("skill", "")).lower():
                        continue
                    skill_name = item.get("skill") or item.get("name") or item.get("title")
                    subtopics = item.get("subtopics") or item.get("topics") or []
                    item_status = item.get("status", "locked")
                    progress_pct = item.get("progress_pct", 0)
                elif isinstance(item, str):
                    if "project" in item.lower():
                        continue
                    skill_name = item

                if skill_name and skill_name.strip():
                    clean_skill = skill_name.strip()
                    base_slug = clean_skill.lower().replace(' ', '-').replace('.', '')
                    base_topic_id = f"roadmap-{base_slug}"

                    # Check video completion for this skill
                    watched_list = roadmap.watched_videos.get(clean_skill.lower(), []) if roadmap.watched_videos else []
                    
                    # Skill-level unlock condition:
                    # 1. Very first concept in Phase 1
                    # 2. Or completed videos / progress >= 50%
                    # 3. Or at least 1 video watched
                    is_skill_unlocked = (
                        (phase_idx == 0 and item_idx == 0)
                        or (item_status == "completed")
                        or (progress_pct >= 50)
                        or (len(watched_list) >= 1)
                    )

                    # 5 Progressive 10-Question Test Sets per SkillGap = 50 Questions total
                    set_definitions = [
                        {"num": 1, "name": "Set 1: Core Fundamentals", "diff": "Beginner", "mins": 15},
                        {"num": 2, "name": "Set 2: Data Handling & Logic", "diff": "Beginner", "mins": 15},
                        {"num": 3, "name": "Set 3: Functions, OOP & Patterns", "diff": "Intermediate", "mins": 15},
                        {"num": 4, "name": "Set 4: Database, APIs & Errors", "diff": "Intermediate", "mins": 15},
                        {"num": 5, "name": "Set 5: Advanced Optimization & Concurrency", "diff": "Advanced", "mins": 15},
                    ]

                    prev_set_attempted = True
                    for s_def in set_definitions:
                        set_topic_id = f"{base_topic_id}-set-{s_def['num']}"
                        set_title = f"{clean_skill} — {s_def['name']}"

                        # Progressive unlocking across sets:
                        # If roadmap skill is locked -> set is locked
                        # Set 1 unlocked immediately upon skill unlock
                        # Set 2-5 unlock if previous set attempted or sufficient roadmap progress
                        if not is_skill_unlocked:
                            set_is_unlocked = False
                            set_lock_reason = f"Watch video tutorials on your Learning Roadmap for {clean_skill} to unlock."
                        elif s_def["num"] == 1:
                            set_is_unlocked = True
                            set_lock_reason = None
                        else:
                            req_progress = (s_def["num"] - 1) * 20
                            set_is_unlocked = prev_set_attempted or (progress_pct >= req_progress)
                            set_lock_reason = None if set_is_unlocked else f"Attempt Set {s_def['num'] - 1} for {clean_skill} to unlock {s_def['name']}."

                        # Ensure topic exists in DB with 10 questions & 15 mins
                        existing = await AssessmentTopic.find_one(AssessmentTopic.topic_id == set_topic_id)
                        if not existing:
                            existing = AssessmentTopic(
                                topic_id=set_topic_id,
                                title=set_title,
                                role=role,
                                skill_tags=[clean_skill] + subtopics,
                                difficulty=s_def["diff"],
                                question_count=10,
                                time_limit_mins=s_def["mins"],
                                is_active=True,
                            )
                            await existing.insert()
                        else:
                            if existing.question_count != 10 or existing.time_limit_mins != s_def["mins"]:
                                existing.question_count = 10
                                existing.time_limit_mins = s_def["mins"]
                                await existing.save()

                        last = result_map.get(set_topic_id)
                        attempts = attempt_counts.get(set_topic_id, 0)
                        prev_set_attempted = attempts > 0
                        is_completed_100 = (last is not None and last.score_pct == 100.0)

                        can_retake = True
                        cooldown_until = None
                        if last and not is_completed_100:
                            retake_at = last.next_retake_allowed_at
                            if retake_at.tzinfo is None:
                                retake_at = retake_at.replace(tzinfo=timezone.utc)
                            if retake_at > now:
                                can_retake = False
                                cooldown_until = retake_at.isoformat()

                        roadmap_topics.append({
                            "topic_id": set_topic_id,
                            "title": existing.title,
                            "role": existing.role,
                            "difficulty": existing.difficulty,
                            "skill_tags": existing.skill_tags,
                            "question_count": 10,
                            "time_limit_mins": s_def["mins"],
                            "last_score_pct": last.score_pct if last else None,
                            "last_taken_at": last.taken_at.isoformat() if last else None,
                            "is_completed": is_completed_100,
                            "can_retake": can_retake,
                            "cooldown_until": cooldown_until,
                            "attempt_count": attempts,
                            "is_unlocked": set_is_unlocked,
                            "lock_reason": set_lock_reason,
                            "roadmap_progress_pct": progress_pct or (100 if item_status == "completed" else (len(watched_list) * 33)),
                        })

    # Strictly return student's roadmap skill gap topics. If no roadmap exists yet, return empty list.
    return roadmap_topics


def _get_default_topics(role: str) -> list:
    """Auto-create default topics per role if none exist in DB."""
    defaults = {
        "backend": [
            {"topic_id": "backend-python-basics", "title": "Python Fundamentals",
             "role": "backend", "skill_tags": ["Python", "OOP", "Data Types"],
             "quizapi_tags": ["python"], "difficulty": "Beginner",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "backend-sql-queries", "title": "SQL & Databases",
             "role": "backend", "skill_tags": ["SQL", "MySQL", "Joins", "Indexing"],
             "quizapi_tags": ["sql", "mysql"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "backend-docker", "title": "Docker & Containers",
             "role": "backend", "skill_tags": ["Docker", "DevOps", "Containers"],
             "quizapi_tags": ["docker"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "backend-linux", "title": "Linux & Shell Scripting",
             "role": "backend", "skill_tags": ["Linux", "Bash", "CLI"],
             "quizapi_tags": ["linux", "bash"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
        ],
        "fullstack": [
            {"topic_id": "fs-javascript", "title": "JavaScript Essentials",
             "role": "fullstack", "skill_tags": ["JavaScript", "ES6", "DOM"],
             "quizapi_tags": ["javascript"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "fs-react", "title": "React & Frontend",
             "role": "fullstack", "skill_tags": ["React", "Hooks", "Components"],
             "quizapi_tags": ["react"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "fs-html-css", "title": "HTML & CSS",
             "role": "fullstack", "skill_tags": ["HTML", "CSS", "Flexbox"],
             "quizapi_tags": ["html", "css"], "difficulty": "Beginner",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
        ],
        "data": [
            {"topic_id": "data-python", "title": "Python for Data",
             "role": "data", "skill_tags": ["Python", "Pandas", "NumPy"],
             "quizapi_tags": ["python"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "data-sql", "title": "SQL for Analytics",
             "role": "data", "skill_tags": ["SQL", "Aggregations", "Window Functions"],
             "quizapi_tags": ["sql", "mysql"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
        ],
        "devops": [
            {"topic_id": "devops-docker", "title": "Docker & Kubernetes",
             "role": "devops", "skill_tags": ["Docker", "Kubernetes", "Containers"],
             "quizapi_tags": ["docker", "devops"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
            {"topic_id": "devops-linux", "title": "Linux & Networking",
             "role": "devops", "skill_tags": ["Linux", "Bash", "Networking"],
             "quizapi_tags": ["linux", "bash"], "difficulty": "Advanced",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
        ],
        "ai": [
            {"topic_id": "ai-python", "title": "Python for ML",
             "role": "ai", "skill_tags": ["Python", "NumPy", "Algorithms"],
             "quizapi_tags": ["python"], "difficulty": "Intermediate",
             "question_count": 50, "time_limit_mins": 45, "is_active": True},
        ],
    }
    return defaults.get(role, defaults["backend"])


@router.post("/start/{topic_id}")
async def start_assessment(
    topic_id: str,
    current_user: User = Depends(get_current_user),
):
    
    student_id = str(current_user.id)

    topic = await AssessmentTopic.find_one(AssessmentTopic.topic_id == topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found.")
    if not topic.is_active:
        raise HTTPException(
            status_code=400, detail="Topic is currently inactive.")

    # Enforce progressive roadmap video completion check
    if topic_id.startswith("roadmap-"):
        roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
        if roadmap and roadmap.phases:
            skill_clean = topic.skill_tags[0] if topic.skill_tags else topic.title
            item_found = False
            is_unlocked = False

            for phase_idx, phase in enumerate(roadmap.phases):
                phase_dict = phase if isinstance(phase, dict) else (phase.dict() if hasattr(phase, "dict") else {})
                items = phase_dict.get("items") or phase_dict.get("skills") or []
                for item_idx, item in enumerate(items):
                    if isinstance(item, dict):
                        s_name = item.get("skill") or item.get("name") or item.get("title") or ""
                        s_status = item.get("status", "locked")
                        s_pct = item.get("progress_pct", 0)
                    else:
                        s_name = str(item)
                        s_status = "locked"
                        s_pct = 0

                    if s_name.strip().lower() == skill_clean.strip().lower() or topic_id.endswith(s_name.strip().lower().replace(" ", "-")):
                        item_found = True
                        watched_list = roadmap.watched_videos.get(s_name.lower().strip(), []) if roadmap.watched_videos else []
                        if (phase_idx == 0 and item_idx == 0) or s_status == "completed" or s_pct >= 50 or len(watched_list) >= 1:
                            is_unlocked = True
                        break
                if item_found:
                    break

            if item_found and not is_unlocked:
                raise HTTPException(
                    status_code=403,
                    detail=f"🔒 This skill test is locked. Please complete the video tutorials in your Learning Roadmap for '{skill_clean}' to unlock it."
                )

    now = datetime.now(timezone.utc)

    # Enforce 24h cooldown
    last = await AssessmentResult.find(
        AssessmentResult.student_id == student_id,
        AssessmentResult.topic_id == topic_id,
    ).sort(-AssessmentResult.taken_at).first_or_none()

    if last:
        retake_at = last.next_retake_allowed_at
        if retake_at.tzinfo is None:
            retake_at = retake_at.replace(tzinfo=timezone.utc)
        if retake_at > now:
            ttl = retake_at - now
            hours = int(ttl.total_seconds() // 3600)
            mins = int((ttl.total_seconds() % 3600) // 60)
            raise HTTPException(
                status_code=429,
                detail=f"Cooldown active. You can retake this in {hours}h {mins}m."
            )

    # Kill any stale in-progress session
    stale = await AssessmentSession.find_one(
        AssessmentSession.student_id == student_id,
        AssessmentSession.topic_id == topic_id,
        AssessmentSession.status == "in_progress",
    )
    if stale:
        stale.status = "timed_out"
        await stale.save()

    # Fetch LIVE questions from QuizAPI / OpenTDB / Admin DB
    questions = await get_questions_for_topic(topic)
    if not questions:
        raise HTTPException(
            status_code=503,
            detail="Could not fetch questions right now. Please try again in a moment."
        )

    expires_at = now + timedelta(minutes=topic.time_limit_mins, seconds=60)
    session = AssessmentSession(
        session_id=str(uuid.uuid4()),
        student_id=student_id,
        topic_id=topic_id,
        topic_title=topic.title,
        role=topic.role,
        questions=questions,
        expires_at=expires_at,
    )
    await session.insert()

    # Send questions to frontend WITHOUT correct_key
    questions_out = [
        {
            "question_id": q.question_id,
            "question": q.question,
            "options": [{"key": o.key, "text": o.text} for o in q.options],
        }
        for q in questions
    ]

    return {
        "session_id": session.session_id,
        "topic_title": topic.title,
        "time_limit_mins": topic.time_limit_mins,
        "expires_at": session.expires_at.isoformat(),
        "questions": questions_out,
    }


@router.get("/session/active")
async def get_active_session(
    topic_id: str = Query(...),
    current_user: User = Depends(get_current_user),
):
   
    student_id = str(current_user.id)
    session = await AssessmentSession.find_one(
        AssessmentSession.student_id == student_id,
        AssessmentSession.topic_id == topic_id,
        AssessmentSession.status == "in_progress",
    )
    if not session:
        return {"session": None}

    now = datetime.now(timezone.utc)
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if expires <= now:
        session.status = "timed_out"
        await session.save()
        return {"session": None, "reason": "timed_out"}

    seconds_remaining = int((expires - now).total_seconds())

    questions_out = [
        {
            "question_id": q.question_id,
            "question": q.question,
            "options": [{"key": o.key, "text": o.text} for o in q.options],
        }
        for q in session.questions
    ]

    return {
        "session": {
            "session_id": session.session_id,
            "topic_title": session.topic_title,
            "seconds_remaining": seconds_remaining,
            "answers_so_far": session.answers,
            "questions": questions_out,
        }
    }


@router.post("/submit/{session_id}")
async def submit_assessment(
    session_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
):
    
    student_id = str(current_user.id)
    session = await AssessmentSession.find_one(
        AssessmentSession.session_id == session_id,
        AssessmentSession.student_id == student_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Session already ended.")

    answers: dict = body.get("answers", {})
    now = datetime.now(timezone.utc)

    # Auto time-out check
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        session.status = "timed_out"
        await session.save()
        raise HTTPException(status_code=400, detail="Session has timed out.")

    # Score calculation
    correct = 0
    skills_verified: set = set()
    explanations = []

    for q in session.questions:
        selected = answers.get(q.question_id)
        is_correct = selected == q.correct_key
        if is_correct:
            correct += 1
            skills_verified.add(q.skill_tag)
        explanations.append({
            "question_id": q.question_id,
            "question": q.question,
            "selected": selected,
            "correct_key": q.correct_key,
            "is_correct": is_correct,
            "explanation": q.explanation,
        })

    total = len(session.questions)
    score_pct = round((correct / total) * 100, 1) if total else 0.0
    score_raw = round((correct / total) * 10, 2) if total else 0.0

    # Update session
    session.status = "submitted"
    session.answers = answers
    session.score = score_raw
    session.score_pct = score_pct
    session.correct_count = correct
    session.skills_verified = list(skills_verified)
    session.submitted_at = now
    await session.save()

    # Persist permanent result
    is_completed_100 = (score_pct == 100.0)
    next_retake = now if is_completed_100 else (now + timedelta(hours=24))

    result = AssessmentResult(
        student_id=student_id,
        topic_id=session.topic_id,
        topic_title=session.topic_title,
        role=session.role,
        score=score_raw,
        score_pct=score_pct,
        correct_count=correct,
        total_questions=total,
        skills_verified=list(skills_verified),
        skill_tags=list({q.skill_tag for q in session.questions}),
        next_retake_allowed_at=next_retake,
    )
    await result.insert()

    # Log to ActivityLog feed (counts toward streak heatmap)
    try:
        from app.models.activity_log import ActivityLog
        from app.api.routes.students import sync_student_streak, compute_realtime_score
        
        if is_completed_100:
            log_title = f"Completed 100%: {session.topic_title}"
            log_detail = f"Perfect 100% Score · All {total}/{total} questions correct · Mastered skills: {', '.join(list(skills_verified)[:4])}"
        else:
            log_title = f"Attempted: {session.topic_title}"
            log_detail = f"Scored {score_pct}% ({correct}/{total} correct) · 100% needed to pass · Next retake in 24h"

        await ActivityLog(
            student_id=student_id,
            type="assessment",
            title=log_title,
            detail=log_detail,
        ).insert()

        await sync_student_streak(student_id)
        await compute_realtime_score(student_id)
    except Exception as e:
        logger.warning(f"Could not log assessment activity: {e}")

    # Publish event for other consumers (notifications, activity log etc.)
    await event_bus.publish("assessment.completed", {
        "student_id": student_id,
        "topic_id": session.topic_id,
        "topic_title": session.topic_title,
        "score_pct": score_pct,
        "skills_verified": list(skills_verified),
        "role": session.role,
    })

    return {
        "score_pct": score_pct,
        "correct": correct,
        "total": total,
        "skills_verified": list(skills_verified),
        "explanations": explanations,
        "next_retake_allowed_at": result.next_retake_allowed_at.isoformat(),
    }


@router.get("/history")
async def get_assessment_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Student's completed assessment history, latest first."""
    student_id = str(current_user.id)
    results = (
        await AssessmentResult.find(AssessmentResult.student_id == student_id)
        .sort(-AssessmentResult.taken_at)
        .limit(limit)
        .to_list()
    )
    return [
        {
            "topic_id": r.topic_id,
            "topic_title": r.topic_title,
            "score_pct": r.score_pct,
            "correct_count": r.correct_count,
            "total_questions": r.total_questions,
            "skills_verified": r.skills_verified,
            "taken_at": r.taken_at.isoformat(),
            "next_retake_allowed_at": r.next_retake_allowed_at.isoformat(),
        }
        for r in results
    ]


# Admin Endpoints 

@router.post("/admin/upload-questions")
async def admin_upload_questions(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """
    Admin uploads custom questions as JSON.
    These take priority over QuizAPI/OpenTDB.

    Body:
    {
      "topic_id": "backend-docker",
      "topic_title": "Docker Basics",
      "role": "backend",
      "difficulty": "Intermediate",
      "skill_tag": "Docker",
      "questions": [
        {
          "question": "What command lists running containers?",
          "options": [
            {"key": "A", "text": "docker ps"},
            {"key": "B", "text": "docker list"},
            {"key": "C", "text": "docker show"},
            {"key": "D", "text": "docker containers"}
          ],
          "correct_key": "A",
          "explanation": "docker ps shows all running containers."
        }
      ]
    }
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")

    questions_data = body.get("questions", [])
    if not questions_data:
        raise HTTPException(status_code=400, detail="No questions provided.")

    inserted = 0
    for q in questions_data:
        doc = AssessmentQuestion(
            role=body["role"],
            topic_id=body["topic_id"],
            topic_title=body.get("topic_title", body["topic_id"]),
            difficulty=body.get("difficulty", "Intermediate"),
            skill_tag=body.get("skill_tag", "General"),
            question=q["question"],
            options=[MCQOption(**o) for o in q["options"]],
            correct_key=q["correct_key"],
            explanation=q.get("explanation"),
        )
        await doc.insert()
        inserted += 1

    return {
        "message": f"Uploaded {inserted} questions.",
        "topic_id": body["topic_id"],
    }


@router.post("/admin/create-topic")
async def admin_create_topic(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")

    existing = await AssessmentTopic.find_one(
        AssessmentTopic.topic_id == body["topic_id"]
    )
    if existing:
        raise HTTPException(status_code=400, detail="Topic ID already exists.")

    topic = AssessmentTopic(
        topic_id=body["topic_id"],
        title=body["title"],
        role=body["role"],
        skill_tags=body.get("skill_tags", []),
        quizapi_tags=body.get("quizapi_tags", []),
        difficulty=body.get("difficulty", "Intermediate"),
        question_count=body.get("question_count", 10),
        time_limit_mins=body.get("time_limit_mins", 15),
    )
    await topic.insert()
    return {"message": "Topic created.", "topic_id": topic.topic_id}
