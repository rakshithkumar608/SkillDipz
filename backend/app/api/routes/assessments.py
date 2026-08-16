import uuid
import random
import logging
import json
import html
import httpx
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
GROQ_MODEL = "llama-3.3-70b-versatile"


async def fetch_mcq_from_groq(
    topic_title: str, skill_tags: List[str], difficulty: str, count: int = 10
) -> List[MCQQuestion]:
    """
    Generate concept-wise MCQ questions for a student's skill gap using Groq AI.
    """
    if not settings.GROQ_API_KEY:
        return []

    tags_str = ", ".join(skill_tags) if skill_tags else topic_title
    prompt = f"""Generate exactly {count} multiple-choice technical questions for testing skill gap: "{topic_title}".
Target skills / concepts: {tags_str}.
Difficulty: {difficulty}.

STRICT RULES:
1. Questions must test practical technical concepts, code syntax, architectural trade-offs, or best practices.
2. Provide exactly 4 options per question: A, B, C, D.
3. correct_key MUST be one of "A", "B", "C", "D".
4. Provide a 1-2 sentence explanation of why the correct_key is right.
5. Return ONLY valid JSON, no markdown.

JSON SHAPE:
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

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a tech assessment engineer. "
                    "You create precise, concept-focused multiple choice questions for software developers. "
                    "Respond ONLY with valid JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"].strip()
            parsed = json.loads(content)
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
            logger.info(f"⚡ Groq generated {len(out)} MCQ questions for topic '{topic_title}'")
            return out
    except Exception as e:
        logger.error(f"Groq MCQ fetch failed for topic '{topic_title}': {e}")
        return []


async def get_questions_for_topic(topic: AssessmentTopic) -> List[MCQQuestion]:
    """
    Priority:
      1. Admin-uploaded questions from MongoDB
      2. Groq AI concept questions generated for skill gaps
      3. QuizAPI.io (live tech questions)
      4. OpenTDB fallback (general CS)
    """
    # 1. Check admin-uploaded questions
    admin_qs = await AssessmentQuestion.find(
        AssessmentQuestion.topic_id == topic.topic_id,
        AssessmentQuestion.is_active == True,  # noqa: E712
    ).to_list()

    if len(admin_qs) >= topic.question_count:
        chosen = random.sample(admin_qs, topic.question_count)
        return [
            MCQQuestion(
                question_id=str(q.id),
                question=q.question,
                options=q.options,
                correct_key=q.correct_key,
                explanation=q.explanation,
                skill_tag=q.skill_tag,
                source="admin",
            )
            for q in chosen
        ]

    # 2. Try Groq AI first for dynamic concept-focused questions
    groq_qs = await fetch_mcq_from_groq(
        topic_title=topic.title,
        skill_tags=topic.skill_tags,
        difficulty=topic.difficulty,
        count=topic.question_count,
    )
    if len(groq_qs) >= topic.question_count:
        return groq_qs[:topic.question_count]

    # 3. QuizAPI
    tags = topic.quizapi_tags or ROLE_TO_QUIZAPI_TAGS.get(topic.role, ["python"])
    quizapi_qs = await fetch_questions_from_quizapi(tags, topic.difficulty, count=15)
    combined = (groq_qs + quizapi_qs)[:topic.question_count]
    if len(combined) >= topic.question_count:
        return combined[:topic.question_count]

    # 4. OpenTDB fallback
    opentdb_qs = await fetch_questions_from_opentdb(topic.difficulty, count=topic.question_count)
    res = (combined + opentdb_qs)[:topic.question_count]
    return res if res else opentdb_qs[:topic.question_count]



#  Endpoints 

@router.get("/available")
async def get_available_assessments(
    role: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """List active assessment topics for a role with completion status."""
    student_id = str(current_user.id)

    topics = await AssessmentTopic.find(
        AssessmentTopic.role == role,
        AssessmentTopic.is_active == True,  # noqa: E712
    ).to_list()

    # Auto-generate default role topics if none exist
    if not topics:
        default_topics = _get_default_topics(role)
        for t in default_topics:
            existing = await AssessmentTopic.find_one(AssessmentTopic.topic_id == t["topic_id"])
            if not existing:
                await AssessmentTopic(**t).insert()

    # Dynamically ensure AssessmentTopics exist for all student's Roadmap Skill Gaps
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
    if roadmap and roadmap.phases:
        for phase in roadmap.phases:
            items = phase.get("items", []) if isinstance(phase, dict) else getattr(phase, "items", [])
            for item in items:
                if isinstance(item, dict) and item.get("type") != "project":
                    skill = item.get("skill", "").strip()
                    gap = item.get("gap", 0)
                    status = item.get("status", "")
                    if skill and (status != "completed" or gap > 0):
                        topic_id = f"gap-{role}-{skill.lower().replace(' ', '-')}"
                        existing = await AssessmentTopic.find_one(AssessmentTopic.topic_id == topic_id)
                        if not existing:
                            new_t = AssessmentTopic(
                                topic_id=topic_id,
                                title=f"{skill} Concept Assessment",
                                role=role,
                                skill_tags=[skill],
                                quizapi_tags=[skill.lower()],
                                difficulty="Intermediate",
                                question_count=10,
                                time_limit_mins=15,
                                is_active=True,
                            )
                            await new_t.insert()

    # Fetch updated topics list
    topics = await AssessmentTopic.find(
        AssessmentTopic.role == role,
        AssessmentTopic.is_active == True,  # noqa: E712
    ).to_list()

    # Get all results for this student
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
    out = []
    for t in topics:
        last = result_map.get(t.topic_id)
        can_retake = True
        cooldown_until = None
        if last:
            retake_at = last.next_retake_allowed_at
            if retake_at.tzinfo is None:
                retake_at = retake_at.replace(tzinfo=timezone.utc)
            if retake_at > now:
                can_retake = False
                cooldown_until = retake_at.isoformat()

        out.append({
            "topic_id": t.topic_id,
            "title": t.title,
            "role": t.role,
            "difficulty": t.difficulty,
            "skill_tags": t.skill_tags,
            "question_count": t.question_count,
            "time_limit_mins": t.time_limit_mins,
            "last_score_pct": last.score_pct if last else None,
            "last_taken_at": last.taken_at.isoformat() if last else None,
            "can_retake": can_retake,
            "cooldown_until": cooldown_until,
            "attempt_count": attempt_counts.get(t.topic_id, 0),
        })
    return out


def _get_default_topics(role: str) -> list:
    """Auto-create default topics per role if none exist in DB."""
    defaults = {
        "backend": [
            {"topic_id": "backend-python-basics", "title": "Python Fundamentals",
             "role": "backend", "skill_tags": ["Python", "OOP", "Data Types"],
             "quizapi_tags": ["python"], "difficulty": "Beginner",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "backend-sql-queries", "title": "SQL & Databases",
             "role": "backend", "skill_tags": ["SQL", "MySQL", "Joins", "Indexing"],
             "quizapi_tags": ["sql", "mysql"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "backend-docker", "title": "Docker & Containers",
             "role": "backend", "skill_tags": ["Docker", "DevOps", "Containers"],
             "quizapi_tags": ["docker"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "backend-linux", "title": "Linux & Shell Scripting",
             "role": "backend", "skill_tags": ["Linux", "Bash", "CLI"],
             "quizapi_tags": ["linux", "bash"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
        ],
        "fullstack": [
            {"topic_id": "fs-javascript", "title": "JavaScript Essentials",
             "role": "fullstack", "skill_tags": ["JavaScript", "ES6", "DOM"],
             "quizapi_tags": ["javascript"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "fs-react", "title": "React & Frontend",
             "role": "fullstack", "skill_tags": ["React", "Hooks", "Components"],
             "quizapi_tags": ["react"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "fs-html-css", "title": "HTML & CSS",
             "role": "fullstack", "skill_tags": ["HTML", "CSS", "Flexbox"],
             "quizapi_tags": ["html", "css"], "difficulty": "Beginner",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
        ],
        "data": [
            {"topic_id": "data-python", "title": "Python for Data",
             "role": "data", "skill_tags": ["Python", "Pandas", "NumPy"],
             "quizapi_tags": ["python"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "data-sql", "title": "SQL for Analytics",
             "role": "data", "skill_tags": ["SQL", "Aggregations", "Window Functions"],
             "quizapi_tags": ["sql", "mysql"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
        ],
        "devops": [
            {"topic_id": "devops-docker", "title": "Docker & Kubernetes",
             "role": "devops", "skill_tags": ["Docker", "Kubernetes", "Containers"],
             "quizapi_tags": ["docker", "devops"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
            {"topic_id": "devops-linux", "title": "Linux & Networking",
             "role": "devops", "skill_tags": ["Linux", "Bash", "Networking"],
             "quizapi_tags": ["linux", "bash"], "difficulty": "Advanced",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
        ],
        "ai": [
            {"topic_id": "ai-python", "title": "Python for ML",
             "role": "ai", "skill_tags": ["Python", "NumPy", "Algorithms"],
             "quizapi_tags": ["python"], "difficulty": "Intermediate",
             "question_count": 10, "time_limit_mins": 15, "is_active": True},
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
        next_retake_allowed_at=now + timedelta(hours=24),
    )
    await result.insert()

    # Log to activity feed (counts toward streak heatmap)
    try:
        await ActivityLog(
            student_id=student_id,
            type="assessment",
            title=f"Completed: {session.topic_title}",
            detail=f"{score_pct}% · {correct}/{total} correct · Skills: {', '.join(list(skills_verified)[:4])}",
        ).insert()
    except Exception as e:
        logger.warning(f"Could not log assessment activity: {e}")

    # Update EmployabilityScore.assessment_score directly (no separate consumer needed)
    try:
        emp = await EmployabilityScore.get_or_create(student_id)
        # Weighted rolling average: new = old * 0.7 + new_score * 0.3
        old_assessment = emp.components.assessment_score
        emp.components.assessment_score = round(
            old_assessment * 0.7 + (score_pct / 100 * 100) * 0.3, 2
        )
        emp.overall_score = emp.compute_overall()
        emp.last_updated = now
        await emp.save()
    except Exception as e:
        logger.warning(f"Could not update employability score: {e}")

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
