"""
Arena Service — Dynamic Question Generation via Groq AI.
Generates 10 real-world, high-quality questions for Quick Fire, Debug Rush, Tech Decision, and Daily Arena.
"""
import json
import logging
import random
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from app.core.config import settings
from app.models.arena import ArenaQuestion, ArenaOption, DailyArena, ArenaSession

logger = logging.getLogger(__name__)

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = [
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-120b",
]

SKILLS_POOL = [
    "javascript",
    "typescript",
    "python",
    "react",
    "sql",
    "backend",
    "system_design",
    "security",
    "devops",
]


# ─── Groq API Caller ─────────────────────────────────────────────────────────

async def _call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> Optional[dict]:
    if not settings.GROQ_API_KEY:
        logger.error("GROQ_API_KEY not set — cannot generate questions.")
        return None

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in GROQ_MODELS:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                content = data["choices"][0]["message"]["content"].strip()
                return json.loads(content)
        except Exception as e:
            logger.warning(f"Groq API call failed for model '{model}': {e}")

    logger.error("All Groq models failed.")
    return None


# 1. Quick Fire Generator 

_QUICK_FIRE_SYSTEM = (
    "You are a principal software engineer and technical assessment designer. "
    "Create fast, challenging, practical technical multiple choice questions tailored to the student's technical skills. "
    "Focus on real concepts, modern syntax, runtime behavior, and edge cases. "
    "Always return valid JSON only."
)

def _build_quick_fire_prompt(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> str:
    target_skills = skills if skills and len(skills) > 0 else SKILLS_POOL
    skills_sample = random.sample(target_skills, min(5, len(target_skills)))
    skills_str = ", ".join(skills_sample)
    role_str = f" for a {role} candidate" if role else ""
    return f"""
Generate exactly {count} technical Multiple Choice Questions (Quick Fire mode){role_str}.
Difficulty level: {difficulty}.
Strictly test concepts from these skills / technologies: {skills_str}.

Each question must test practical understanding of real technical concepts (no trivia, no memorization of minor facts).
Each question must have exactly 4 options labeled A, B, C, D.
One option is correct.

Respond ONLY with a JSON object in this exact schema:
{{
  "questions": [
    {{
      "skill": "javascript",
      "difficulty": "medium",
      "question": "What is the result of...",
      "options": [
        {{"key": "A", "text": "First option text"}},
        {{"key": "B", "text": "Second option text"}},
        {{"key": "C", "text": "Third option text"}},
        {{"key": "D", "text": "Fourth option text"}}
      ],
      "correct_key": "B",
      "explanation": "Clear explanation why B is correct and others are incorrect.",
      "time_limit": 25,
      "xp_reward": 10
    }}
  ]
}}
""".strip()


async def generate_quick_fire_questions(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> List[ArenaQuestion]:
    data = await _call_groq(_QUICK_FIRE_SYSTEM, _build_quick_fire_prompt(count, difficulty, skills, role))
    if not data or "questions" not in data or not isinstance(data["questions"], list):
        logger.warning("Groq failed to generate Quick Fire questions.")
        return []

    created = []
    for q_data in data["questions"]:
        try:
            options = [ArenaOption(key=o["key"], text=o["text"]) for o in q_data["options"][:4]]
            if len(options) < 4:
                continue
            aq = ArenaQuestion(
                game_type="quick_fire",
                skill=q_data.get("skill", "javascript").lower(),
                difficulty=q_data.get("difficulty", difficulty),
                question=q_data["question"],
                options=options,
                correct_key=q_data["correct_key"].upper(),
                explanation=q_data.get("explanation", ""),
                xp_reward=10,
                time_limit=q_data.get("time_limit", 25),
            )
            await aq.insert()
            created.append(aq)
        except Exception as e:
            logger.warning(f"Error parsing quick fire question: {e}")

    logger.info(f"⚡ Groq generated {len(created)} Quick Fire questions for skills: {skills}")
    return created


#  2. Debug Rush Generator 

_DEBUG_RUSH_SYSTEM = (
    "You are an expert senior code reviewer and bug hunter. "
    "Create realistic code snippets with real-world bugs (syntax errors, logical bugs, async issues, mutation bugs, SQL errors, memory/concurrency issues). "
    "Always return valid JSON only."
)

def _build_debug_rush_prompt(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> str:
    target_skills = skills if skills and len(skills) > 0 else ["JavaScript", "TypeScript", "Python", "React", "SQL"]
    skills_str = ", ".join(target_skills[:5])
    role_str = f" for a {role} developer" if role else ""
    return f"""
Generate exactly {count} code debugging challenges (Debug Rush mode){role_str}.
Difficulty level: {difficulty}.
Languages/frameworks to include: {skills_str}.

For each challenge:
1. Provide a realistic 4-10 line code snippet that contains ONE specific bug.
2. Ask a clear question like "Find the bug in this function" or "What is wrong with this code?".
3. Provide 4 distinct answer options (A, B, C, D) describing the bug / fix.
4. Indicate the correct key and 1-indexed bug line.

Respond ONLY with a JSON object in this exact schema:
{{
  "questions": [
    {{
      "skill": "python",
      "difficulty": "medium",
      "question": "Find the bug in this function.",
      "code_snippet": "def calculate_discount(price, rate):\\n    if rate > 1:\\n        return price * rate\\n    return price - (price * rate)",
      "bug_line": 3,
      "options": [
        {{"key": "A", "text": "Line 3 should calculate the discount, not multiply price by rate directly"}},
        {{"key": "B", "text": "price is immutable"}},
        {{"key": "C", "text": "Syntax error in if statement"}},
        {{"key": "D", "text": "Missing return statement"}}
      ],
      "correct_key": "A",
      "bug_explanation": "Multiplying price by rate directly when rate > 1 results in an inflated price instead of a discounted one.",
      "explanation": "Fix: line 3 should apply the percentage calculation or throw a ValueError for invalid rate format.",
      "time_limit": 45,
      "xp_reward": 20
    }}
  ]
}}
""".strip()


async def generate_debug_rush_questions(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> List[ArenaQuestion]:
    data = await _call_groq(_DEBUG_RUSH_SYSTEM, _build_debug_rush_prompt(count, difficulty, skills, role))
    if not data or "questions" not in data or not isinstance(data["questions"], list):
        logger.warning("Groq failed to generate Debug Rush questions.")
        return []

    created = []
    for q_data in data["questions"]:
        try:
            options = [ArenaOption(key=o["key"], text=o["text"]) for o in q_data["options"][:4]]
            if len(options) < 4 or not q_data.get("code_snippet"):
                continue
            aq = ArenaQuestion(
                game_type="debug_rush",
                skill=q_data.get("skill", "javascript").lower(),
                difficulty=q_data.get("difficulty", difficulty),
                question=q_data["question"],
                code_snippet=q_data["code_snippet"],
                bug_line=q_data.get("bug_line"),
                bug_explanation=q_data.get("bug_explanation", ""),
                options=options,
                correct_key=q_data["correct_key"].upper(),
                explanation=q_data.get("explanation", ""),
                xp_reward=20,
                time_limit=q_data.get("time_limit", 45),
            )
            await aq.insert()
            created.append(aq)
        except Exception as e:
            logger.warning(f"Error parsing debug rush question: {e}")

    logger.info(f"⚡ Groq generated {len(created)} Debug Rush questions for skills: {skills}")
    return created


# 3. Tech Decision Generator 

_TECH_DECISION_SYSTEM = (
    "You are a Staff Software Architect and Tech Lead. "
    "Create realistic production scenarios and system architecture decisions with real trade-offs tailored to software engineering skills. "
    "Scenarios must test engineering judgment, scaling, databases, security, performance, and caching. "
    "Always return valid JSON only."
)

def _build_tech_decision_prompt(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> str:
    target_skills = skills if skills and len(skills) > 0 else ["Backend", "System Design", "Database", "Security", "DevOps"]
    skills_str = ", ".join(target_skills[:5])
    role_str = f" for a {role} role" if role else ""
    return f"""
Generate exactly {count} technical decision / architectural scenario challenges (Tech Decision mode){role_str}.
Difficulty level: {difficulty}.
Topics / Skills to cover: {skills_str}.

For each challenge:
1. Provide a realistic 2-4 sentence engineering scenario (e.g. high traffic spike, database bottleneck, security breach, microservice latency).
2. Ask a precise technical question on the best architecture decision or troubleshooting step.
3. Provide 4 options (A, B, C, D) representing potential architectural choices or remedies.
4. One option represents the industry standard / optimal engineering decision.

Respond ONLY with a JSON object in this exact schema:
{{
  "questions": [
    {{
      "skill": "system_design",
      "difficulty": "medium",
      "scenario": "Your e-commerce application experiences a 10x traffic spike during a flash sale. The database read latency spikes to 4 seconds, causing checkout timeouts.",
      "question": "What is the most effective immediate architectural solution to relieve read pressure?",
      "options": [
        {{"key": "A", "text": "Migrate the primary relational database to MongoDB overnight"}},
        {{"key": "B", "text": "Implement a distributed Redis caching layer for product catalog reads and add read replicas"}},
        {{"key": "C", "text": "Increase client-side retry timeouts to 30 seconds"}},
        {{"key": "D", "text": "Disable user authentication during peak hours"}}
      ],
      "correct_key": "B",
      "explanation": "Redis caching drastically reduces read queries hitting the primary database, while read replicas distribute queries. This is the fastest, safest pattern for flash-sale traffic spikes.",
      "time_limit": 50,
      "xp_reward": 20
    }}
  ]
}}
""".strip()


async def generate_tech_decision_questions(count: int = 10, difficulty: str = "medium", skills: Optional[List[str]] = None, role: Optional[str] = None) -> List[ArenaQuestion]:
    data = await _call_groq(_TECH_DECISION_SYSTEM, _build_tech_decision_prompt(count, difficulty, skills, role))
    if not data or "questions" not in data or not isinstance(data["questions"], list):
        logger.warning("Groq failed to generate Tech Decision questions.")
        return []

    created = []
    for q_data in data["questions"]:
        try:
            options = [ArenaOption(key=o["key"], text=o["text"]) for o in q_data["options"][:4]]
            if len(options) < 4:
                continue
            aq = ArenaQuestion(
                game_type="tech_decision",
                skill=q_data.get("skill", "system_design").lower(),
                difficulty=q_data.get("difficulty", difficulty),
                scenario=q_data.get("scenario", ""),
                question=q_data["question"],
                options=options,
                correct_key=q_data["correct_key"].upper(),
                explanation=q_data.get("explanation", ""),
                xp_reward=20,
                time_limit=q_data.get("time_limit", 50),
            )
            await aq.insert()
            created.append(aq)
        except Exception as e:
            logger.warning(f"Error parsing tech decision question: {e}")

    logger.info(f"⚡ Groq generated {len(created)} Tech Decision questions for skills: {skills}")
    return created


# ─── 4. Daily Arena Generator (10 Questions: 4 QF + 3 DR + 3 TD) ─────────────

_daily_generation_lock = None

def _get_daily_lock():
    global _daily_generation_lock
    if _daily_generation_lock is None:
        import asyncio
        _daily_generation_lock = asyncio.Lock()
    return _daily_generation_lock


async def get_or_create_daily_arena(date_str: str, skills: Optional[List[str]] = None, role: Optional[str] = None) -> Optional[DailyArena]:
    # 1. Quick check without lock
    existing = await DailyArena.find_one(DailyArena.date_str == date_str, DailyArena.is_active == True)
    if existing:
        return existing

    # 2. Acquire lock to prevent duplicate concurrent generation
    lock = _get_daily_lock()
    async with lock:
        # Re-check inside lock
        existing = await DailyArena.find_one(DailyArena.date_str == date_str, DailyArena.is_active == True)
        if existing:
            return existing

        logger.info(f"⚡ Generating fresh Groq Daily Arena for date: {date_str} with skills: {skills}...")

        # Generate 4 Quick Fire, 3 Debug Rush, 3 Tech Decision = 10 questions tailored to skills
        qf = await generate_quick_fire_questions(count=4, skills=skills, role=role)
        dr = await generate_debug_rush_questions(count=3, skills=skills, role=role)
        td = await generate_tech_decision_questions(count=3, skills=skills, role=role)

        qf_ids = [str(q.id) for q in qf]
        dr_ids = [str(q.id) for q in dr]
        td_ids = [str(q.id) for q in td]

        total_xp = (len(qf_ids) * 10) + (len(dr_ids) * 20) + (len(td_ids) * 20) + 50  # 190 XP

        daily = DailyArena(
            date_str=date_str,
            quick_fire_ids=qf_ids,
            debug_rush_ids=dr_ids,
            tech_decision_ids=td_ids,
            total_xp=total_xp,
            is_active=True,
        )
        try:
            await daily.insert()
            logger.info(f"✅ Daily Arena created for {date_str} with {len(qf_ids) + len(dr_ids) + len(td_ids)} questions ({total_xp} XP)")
            return daily
        except Exception as e:
            logger.warning(f"DailyArena insert exception (likely concurrent insert): {e}")
            existing = await DailyArena.find_one(DailyArena.date_str == date_str)
            if existing:
                return existing
            return daily
