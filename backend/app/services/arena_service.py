
import json
import logging
import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple

from app.core.config import settings
from app.models.arena import (
    ArenaQuestion,
    SpotBugCard, SpotBugPayload,
    OrderItItem, OrderItPayload,
    StackItZone, StackItComponent, StackItPayload,
    ArenaSession,
)

logger = logging.getLogger(__name__)

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound-mini",
    "groq/compound",
]

# Cold-start skill list for users with no SkillScore history yet
COLD_START_SKILLS = ["JavaScript Fundamentals", "React Hooks", "API Design"]

# Weak-skill threshold: accuracy below this (and ≥3 attempts) = weak
WEAK_SKILL_THRESHOLD = 65.0

# Session buffer: extra seconds beyond question time_limit
SESSION_BUFFER_S = 120


# ─── Groq API Caller ──────────────────────────────────────────────────────────

def _strip_json_fences(text: str) -> str:
    """Strip markdown code fences, think tags, and extract the JSON object."""
    import re
    text = text.strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if text.startswith("```"):
        text = text[text.index("\n") + 1:] if "\n" in text else text[3:]
    if "```" in text:
        text = text[: text.rfind("```")]
    text = text.strip()
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace:last_brace+1]
    return text.strip()


async def _call_groq(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
) -> Optional[dict]:
    """Call Groq API, trying each model in order until one succeeds."""
    import httpx

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
            "temperature": 0.4,
            "max_tokens": max_tokens,
            # response_format intentionally omitted — not universally supported;
            # system prompt instructs the model to return raw JSON only.
        }
        try:
            async with httpx.AsyncClient(timeout=40.0) as client:
                res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                content = _strip_json_fences(data["choices"][0]["message"]["content"])
                parsed = json.loads(content)
                logger.info(f"Groq success with model '{model}'")
                return parsed, model  # return both parsed data and the model used
        except json.JSONDecodeError as e:
            logger.warning(f"Groq model '{model}' returned non-JSON: {e}")
        except Exception as e:
            logger.warning(f"Groq API call failed for model '{model}': {e}")

    logger.error("All Groq models failed.")
    return None


async def _call_groq_with_model(system_prompt: str, user_prompt: str, max_tokens: int = 4096):
    """Returns (parsed_dict, model_name) or (None, None) on total failure."""
    result = await _call_groq(system_prompt, user_prompt, max_tokens)
    if result is None:
        return None, None
    if isinstance(result, tuple):
        return result
    return result, GROQ_MODELS[0]


#  Validation helpers 

def _validate_spotbug_payload(data: dict) -> Tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    cards = data.get("cards", [])
    if not isinstance(cards, list):
        return False, "cards must be a list"
    if len(cards) < 8:
        return False, f"Need ≥8 cards, got {len(cards)}"
    for i, card in enumerate(cards):
        if not isinstance(card.get("is_buggy"), bool):
            return False, f"card[{i}] missing is_buggy (bool)"
        if not card.get("id"):
            return False, f"card[{i}] missing id"
        if not card.get("snippet"):
            return False, f"card[{i}] missing snippet"
    return True, ""


def _validate_orderit_payload(data: dict) -> Tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    items = data.get("items", [])
    correct_order = data.get("correct_order", [])
    if not isinstance(items, list) or len(items) < 3:
        return False, f"Need 3–8 items, got {len(items) if isinstance(items, list) else 'invalid'}"
    if len(items) > 8:
        return False, f"Too many items: {len(items)}"
    item_ids = {item.get("id") for item in items if isinstance(item, dict)}
    if len(item_ids) != len(items):
        return False, "Duplicate or missing item ids"
    if set(correct_order) != item_ids:
        return False, "correct_order ids don't match items ids"
    return True, ""


def _validate_stackit_payload(data: dict) -> Tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    zones = data.get("zones", [])
    components = data.get("components", [])
    scenario = data.get("scenario", "")
    if not scenario:
        return False, "Missing scenario"
    if not isinstance(zones, list) or len(zones) < 2:
        return False, f"Need ≥2 zones, got {len(zones)}"
    if not isinstance(components, list) or len(components) < 4:
        return False, f"Need 4–6 components, got {len(components)}"
    if len(components) > 6:
        return False, f"Too many components: {len(components)}"
    zone_ids = {z.get("id") for z in zones}
    for i, comp in enumerate(components):
        if not comp.get("id"):
            return False, f"component[{i}] missing id"
        if comp.get("correct_zone_id") not in zone_ids:
            return False, f"component[{i}] correct_zone_id '{comp.get('correct_zone_id')}' not in zones"
    return True, ""


#  1. Spot the Bug Generator 

_SPOTBUG_SYSTEM = (
    "You are a senior software engineer creating a reflex-style code review game. "
    "Generate a queue of ~12 short code snippets (single lines or 2-3 line statements) "
    "where roughly half are correct and half contain realistic bugs. "
    "Always return valid JSON only, no prose, no markdown fences."
)

def _build_spotbug_prompt(skill_gap: str, difficulty: str) -> str:
    return f"""Generate a Spot the Bug game question targeting the skill: "{skill_gap}".
Difficulty: {difficulty}.

Return ONLY valid JSON matching exactly:
{{
  "question": "Can you spot which of these {skill_gap} snippets have bugs?",
  "skill": "{skill_gap}",
  "difficulty": "{difficulty}",
  "time_limit": 90,
  "xp_reward": 20,
  "explanation": "Overall explanation of the common bugs tested",
  "spotbug_payload": {{
    "cards": [
      {{
        "id": "c1",
        "snippet": "const result = arr.map(x => x * 2",
        "is_buggy": true,
        "fix_explanation": "Missing closing parenthesis for .map() call"
      }},
      {{
        "id": "c2",
        "snippet": "const doubled = arr.map(x => x * 2)",
        "is_buggy": false,
        "fix_explanation": ""
      }}
    ]
  }}
}}

Rules:
- Generate exactly 12 cards: approximately 6 buggy and 6 clean. Mix them up.
- Each snippet must test real understanding of {skill_gap}, not trivia.
- Buggy snippets must have realistic bugs: missing semicolons/brackets, off-by-one errors, wrong method names, incorrect async/await, type errors, mutation bugs, etc.
- fix_explanation is required for buggy cards; set to "" for clean cards.
- All card ids must be unique (c1, c2, ... c12).
- Snippets should be SHORT (1–3 lines) so they can be read quickly.
- difficulty "{difficulty}" means: easy = obvious bugs, medium = subtle bugs, hard = tricky edge cases.
"""


async def generate_spotbug_question(
    skill_gap: str,
    difficulty: str = "medium",
    student_id: Optional[str] = None,
) -> Optional[ArenaQuestion]:
    """Generate one Spot the Bug question. Returns None on failure (after 1 retry)."""
    for attempt in range(2):
        data, model = await _call_groq_with_model(_SPOTBUG_SYSTEM, _build_spotbug_prompt(skill_gap, difficulty))
        if not data:
            logger.warning(f"Groq returned no data for spotbug (attempt {attempt+1})")
            continue

        payload_data = data.get("spotbug_payload", {})
        is_valid, error = _validate_spotbug_payload(payload_data)
        if not is_valid:
            logger.warning(f"Spotbug payload validation failed (attempt {attempt+1}): {error}. Raw: {json.dumps(payload_data)[:500]}")
            continue

        try:
            cards = [
                SpotBugCard(
                    id=c["id"],
                    snippet=c["snippet"],
                    is_buggy=c["is_buggy"],
                    fix_explanation=c.get("fix_explanation", ""),
                )
                for c in payload_data["cards"]
            ]
            q = ArenaQuestion(
                game_type="spotbug",
                skill=skill_gap,
                difficulty=difficulty,
                question=data.get("question", f"Spot the bugs in these {skill_gap} snippets"),
                explanation=data.get("explanation", ""),
                xp_reward=data.get("xp_reward", 20),
                time_limit=data.get("time_limit", 90),
                spotbug_payload=SpotBugPayload(cards=cards),
                generated_for=student_id,
                targeted_skill_gap=skill_gap,
                generated_at=datetime.now(timezone.utc),
                generation_model=model,
            )
            await q.insert()
            logger.info(f"✅ Spotbug question generated for skill '{skill_gap}' using {model}")
            return q
        except Exception as e:
            logger.warning(f"Error building spotbug question (attempt {attempt+1}): {e}")

    logger.error(f"Failed to generate spotbug question for '{skill_gap}' after 2 attempts")
    return None


#  2. Order the Steps Generator 

_ORDERIT_SYSTEM = (
    "You are a Staff Software Engineer creating a drag-to-reorder sequence game. "
    "Generate code reordering puzzles or system process sequence puzzles. "
    "Always return valid JSON only, no prose, no markdown fences."
)

def _build_orderit_prompt(skill_gap: str, difficulty: str, is_code_focused: bool = True) -> str:
    if is_code_focused:
        return f"""Generate one "Order the Steps" CODE REORDERING puzzle targeting the skill: "{skill_gap}".
Difficulty: {difficulty}.

The user must arrange shuffled lines/blocks of CODE into the correct working sequence to implement a specific function, algorithm, or pattern in {skill_gap} (e.g. React hook/component, algorithm, async pipeline, SQL query, state handler, data structure operation).

Return ONLY valid JSON matching exactly:
{{
  "question": "Arrange these lines of code to implement a [specific task in {skill_gap}]",
  "skill": "{skill_gap}",
  "difficulty": "{difficulty}",
  "time_limit": 60,
  "xp_reward": 20,
  "explanation": "Why this code sequence is correct and how the execution flows step by step",
  "orderit_payload": {{
    "items": [
      {{"id": "i1", "label": "const [count, setCount] = useState(0);"}},
      {{"id": "i2", "label": "const increment = useCallback(() => {{"}},
      {{"id": "i3", "label": "  setCount(prev => prev + 1);"}},
      {{"id": "i4", "label": "}}, []);"}},
      {{"id": "i5", "label": "return <button onClick={{increment}}>{{count}}</button>;"}}
    ],
    "correct_order": ["i1", "i2", "i3", "i4", "i5"]
  }}
}}

Rules:
- Generate 4 to 6 lines/blocks of code (easy=4, medium=5, hard=6).
- Each label must be a clear line/block of real code.
- "correct_order" must be an array of ALL item ids in the exact order needed to produce valid, working code.
- All item ids must be unique (i1, i2, ...).
- Do NOT include trivial numbers or line numbers in the labels.
"""
    else:
        return f"""Generate one "Order the Steps" engineering workflow sequence puzzle targeting the skill: "{skill_gap}".
Difficulty: {difficulty}.

The user must arrange shuffled steps/stages of an engineering process or execution lifecycle into the correct sequence.

Return ONLY valid JSON matching exactly:
{{
  "question": "Arrange these {skill_gap} steps in the correct order",
  "skill": "{skill_gap}",
  "difficulty": "{difficulty}",
  "time_limit": 60,
  "xp_reward": 20,
  "explanation": "The correct order and why each step follows the previous",
  "orderit_payload": {{
    "items": [
      {{"id": "i1", "label": "Initialize the database connection pool"}},
      {{"id": "i2", "label": "Execute the transaction with read isolation"}},
      {{"id": "i3", "label": "Commit changes and update audit log"}},
      {{"id": "i4", "label": "Release connection back to the pool"}}
    ],
    "correct_order": ["i1", "i2", "i3", "i4"]
  }}
}}

Rules:
- Generate 4 to 6 items (inclusive).
- "correct_order" must be an array of ALL item ids in the correct sequence.
- All item ids must be unique (i1, i2, ...).
- Items must test real sequential understanding of {skill_gap}: steps of a process, lifecycle stages, execution order, request/response flow, etc.
- Labels must be concise (5–10 words) but unambiguous.
"""


async def generate_orderit_question(
    skill_gap: str,
    difficulty: str = "medium",
    student_id: Optional[str] = None,
    is_code_focused: bool = True,
) -> Optional[ArenaQuestion]:
    """Generate one Order the Steps question. Returns None on failure (after 1 retry)."""
    for attempt in range(2):
        data, model = await _call_groq_with_model(_ORDERIT_SYSTEM, _build_orderit_prompt(skill_gap, difficulty, is_code_focused))
        if not data:
            logger.warning(f"Groq returned no data for orderit (attempt {attempt+1})")
            continue

        payload_data = data.get("orderit_payload", {})
        is_valid, error = _validate_orderit_payload(payload_data)
        if not is_valid:
            logger.warning(f"OrderIt payload validation failed (attempt {attempt+1}): {error}. Raw: {json.dumps(payload_data)[:500]}")
            continue

        try:
            items = [OrderItItem(id=item["id"], label=item["label"]) for item in payload_data["items"]]
            q = ArenaQuestion(
                game_type="orderit",
                skill=skill_gap,
                difficulty=difficulty,
                question=data.get("question", f"Order the {skill_gap} steps correctly"),
                explanation=data.get("explanation", ""),
                xp_reward=data.get("xp_reward", 20),
                time_limit=data.get("time_limit", 60),
                orderit_payload=OrderItPayload(
                    items=items,
                    correct_order=payload_data["correct_order"],
                ),
                generated_for=student_id,
                targeted_skill_gap=skill_gap,
                generated_at=datetime.now(timezone.utc),
                generation_model=model,
            )
            await q.insert()
            logger.info(f"✅ OrderIt question generated for skill '{skill_gap}' (code_focused={is_code_focused}) using {model}")
            return q
        except Exception as e:
            logger.warning(f"Error building orderit question (attempt {attempt+1}): {e}")

    logger.error(f"Failed to generate orderit question for '{skill_gap}' after 2 attempts")
    return None


async def generate_multiple_orderit_questions(
    skill_gap: str,
    difficulty: str = "medium",
    count: int = 5,
    student_id: Optional[str] = None,
) -> List[ArenaQuestion]:
    """Generate multiple Order the Steps questions with a mix of coding and system puzzles."""
    questions: List[ArenaQuestion] = []
    for i in range(count):
        # 3 out of 5 are code focused
        is_code = (i % 2 == 0) or (i < 3)
        try:
            q = await generate_orderit_question(skill_gap, difficulty, student_id, is_code_focused=is_code)
            if q:
                questions.append(q)
            # Brief stagger to prevent Groq burst rate limits
            if i < count - 1:
                await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"Error generating question {i+1}/{count} for {skill_gap}: {e}")

    return questions


#  3. Stack It Generator 

_STACKIT_SYSTEM = (
    "You are a Staff Software Architect creating a drag-to-zone architecture puzzle game. "
    "Generate one scenario where players place component chips into correct zones based on engineering judgment. "
    "Always return valid JSON only, no prose, no markdown fences."
)

def _build_stackit_prompt(skill_gap: str, difficulty: str) -> str:
    return f"""Generate one "Stack It" architecture puzzle question targeting the skill: "{skill_gap}".
Difficulty: {difficulty}.

Return ONLY valid JSON matching exactly:
{{
  "question": "Place each component into the correct zone",
  "skill": "{skill_gap}",
  "difficulty": "{difficulty}",
  "time_limit": 75,
  "xp_reward": 20,
  "explanation": "Why each component belongs in its zone",
  "stackit_payload": {{
    "scenario": "Your API response times have spiked to 4 seconds under load. You need to fix this.",
    "zones": [
      {{"id": "z_correct", "label": "Correct Action"}},
      {{"id": "z_harmful", "label": "Harmful / Irrelevant"}}
    ],
    "components": [
      {{"id": "comp1", "label": "Add Redis Cache", "correct_zone_id": "z_correct"}},
      {{"id": "comp2", "label": "Change Button Color", "correct_zone_id": "z_harmful"}},
      {{"id": "comp3", "label": "Add Read Replicas", "correct_zone_id": "z_correct"}},
      {{"id": "comp4", "label": "Disable Logging", "correct_zone_id": "z_harmful"}},
      {{"id": "comp5", "label": "Set up Load Balancer", "correct_zone_id": "z_correct"}}
    ]
  }}
}}

Rules:
- Generate 4 to 6 components (inclusive). difficulty "{difficulty}": easy=4, medium=5, hard=6.
- Generate exactly 2 zones (correct zone and incorrect/harmful zone). Zone labels should match the scenario.
- every component's correct_zone_id must match an id from the zones array.
- The scenario must test real engineering judgment for {skill_gap}.
- Mix obviously correct and plausibly wrong actions — don't make all wrong actions ridiculous.
- Component labels must be concise action phrases (3–6 words).
- scenario must be 2–3 sentences describing a real production situation.
"""


async def generate_stackit_question(
    skill_gap: str,
    difficulty: str = "medium",
    student_id: Optional[str] = None,
) -> Optional[ArenaQuestion]:
    """Generate one Stack It question. Returns None on failure (after 1 retry)."""
    for attempt in range(2):
        data, model = await _call_groq_with_model(_STACKIT_SYSTEM, _build_stackit_prompt(skill_gap, difficulty))
        if not data:
            logger.warning(f"Groq returned no data for stackit (attempt {attempt+1})")
            continue

        payload_data = data.get("stackit_payload", {})
        is_valid, error = _validate_stackit_payload(payload_data)
        if not is_valid:
            logger.warning(f"StackIt payload validation failed (attempt {attempt+1}): {error}. Raw: {json.dumps(payload_data)[:500]}")
            continue

        try:
            zones = [StackItZone(id=z["id"], label=z["label"]) for z in payload_data["zones"]]
            components = [
                StackItComponent(
                    id=c["id"],
                    label=c["label"],
                    correct_zone_id=c["correct_zone_id"],
                )
                for c in payload_data["components"]
            ]
            q = ArenaQuestion(
                game_type="stackit",
                skill=skill_gap,
                difficulty=difficulty,
                question=data.get("question", "Place each component into the correct zone"),
                explanation=data.get("explanation", ""),
                xp_reward=data.get("xp_reward", 20),
                time_limit=data.get("time_limit", 75),
                stackit_payload=StackItPayload(
                    scenario=payload_data["scenario"],
                    zones=zones,
                    components=components,
                ),
                generated_for=student_id,
                targeted_skill_gap=skill_gap,
                generated_at=datetime.now(timezone.utc),
                generation_model=model,
            )
            await q.insert()
            logger.info(f"✅ StackIt question generated for skill '{skill_gap}' using {model}")
            return q
        except Exception as e:
            logger.warning(f"Error building stackit question (attempt {attempt+1}): {e}")

    logger.error(f"Failed to generate stackit question for '{skill_gap}' after 2 attempts")
    return None


async def generate_multiple_stackit_questions(
    skill_gap: str,
    difficulty: str = "medium",
    count: int = 5,
    student_id: Optional[str] = None,
) -> List[ArenaQuestion]:
    """Generate multiple Stack It scenario questions with brief staggering."""
    questions: List[ArenaQuestion] = []
    for i in range(count):
        try:
            q = await generate_stackit_question(skill_gap, difficulty, student_id)
            if q:
                questions.append(q)
            # Brief stagger to prevent Groq burst rate limits
            if i < count - 1:
                await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"Error generating StackIt question {i+1}/{count} for {skill_gap}: {e}")

    return questions


#  Weak-skill detection 

def _pick_weak_skills(skill_scores: Dict[str, Any], count: int = 3) -> List[str]:
    """
    From ArenaUserStats.skill_scores dict, return up to `count` weak skills
    (accuracy < WEAK_SKILL_THRESHOLD with ≥3 attempts), sorted by score ascending.
    Falls back to cold-start list if fewer than `count` weak skills found.
    """
    WEAK_SKILL_THRESHOLD = 65.0
    weak = []
    for skill, v in skill_scores.items():
        if isinstance(v, dict) and v.get("total", 0) >= 3 and v.get("score", 100) < WEAK_SKILL_THRESHOLD:
            weak.append((skill, v.get("score", 0)))
    weak.sort(key=lambda x: x[1])  # lowest score first
    result = [s for s, _ in weak[:count]]

    if len(result) < count:
        fallback = [s for s in COLD_START_SKILLS if s not in result]
        result.extend(fallback[: count - len(result)])

    return result


#  Per-user Daily Arena generation 

_generation_locks: Dict[str, asyncio.Lock] = {}
_generation_locks_meta: asyncio.Lock = asyncio.Lock()


async def _get_user_lock(student_id: str) -> asyncio.Lock:
    async with _generation_locks_meta:
        if student_id not in _generation_locks:
            _generation_locks[student_id] = asyncio.Lock()
        return _generation_locks[student_id]


async def get_or_create_daily_arena_v2(
    student_id: str,
    date_str: str,
    skill_scores: Optional[Dict[str, Any]] = None,
    difficulty: str = "medium",
) -> Tuple[Optional[ArenaSession], Optional[str]]:
    """
    Returns (ArenaSession, error_message).
    error_message is None on success, set to a user-facing message on failure.

    Checks for an existing daily session for this student+date before generating.
    Per-user: each student gets questions targeting their own weak skills.
    """
    # Fast path: existing session for today
    existing = await ArenaSession.find_one(
        ArenaSession.student_id == student_id,
        ArenaSession.game_type == "daily",
        ArenaSession.daily_date == date_str,
    )
    if existing:
        return existing, None

    # Acquire per-user lock to prevent duplicate concurrent generation
    lock = await _get_user_lock(student_id)
    async with lock:
        # Re-check inside lock
        existing = await ArenaSession.find_one(
            ArenaSession.student_id == student_id,
            ArenaSession.game_type == "daily",
            ArenaSession.daily_date == date_str,
        )
        if existing:
            return existing, None

        logger.info(f"⚡ Generating daily arena for student {student_id} on {date_str}")

        # Pick weak skills to target
        weak_skills = _pick_weak_skills(skill_scores or {}, count=3)
        logger.info(f"Targeting weak skills: {weak_skills}")

        # Shuffle difficulty slightly for variety
        difficulties = ["easy", "medium", "hard"]
        chosen_difficulties = [difficulty] * 3
        if difficulty == "medium":
            chosen_difficulties = ["easy", "medium", "hard"]
            random.shuffle(chosen_difficulties)

        # Generate all three questions concurrently
        spotbug_task = generate_spotbug_question(
            weak_skills[0] if len(weak_skills) > 0 else COLD_START_SKILLS[0],
            chosen_difficulties[0],
            student_id,
        )
        orderit_task = generate_orderit_question(
            weak_skills[1] if len(weak_skills) > 1 else COLD_START_SKILLS[1],
            chosen_difficulties[1],
            student_id,
        )
        stackit_task = generate_stackit_question(
            weak_skills[2] if len(weak_skills) > 2 else COLD_START_SKILLS[2],
            chosen_difficulties[2],
            student_id,
        )

        spotbug_q, orderit_q, stackit_q = await asyncio.gather(
            spotbug_task, orderit_task, stackit_task, return_exceptions=False
        )

        # All three must succeed — no silent fallback to generic content
        failed = []
        if spotbug_q is None:
            failed.append("Spot the Bug")
        if orderit_q is None:
            failed.append("Order the Steps")
        if stackit_q is None:
            failed.append("Stack It")

        if failed:
            error_msg = (
                "Today's Arena is taking longer than usual — try again shortly. "
                f"(Generation failed for: {', '.join(failed)})"
            )
            logger.error(f"Daily arena generation failed for {student_id}: {failed}")
            return None, error_msg

        # Create the daily session
        import uuid
        question_ids = [str(spotbug_q.id), str(orderit_q.id), str(stackit_q.id)]
        total_time = (
            (spotbug_q.time_limit or 90)
            + (orderit_q.time_limit or 60)
            + (stackit_q.time_limit or 75)
            + SESSION_BUFFER_S
        )
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=total_time)

        session = ArenaSession(
            session_id=str(uuid.uuid4()),
            student_id=student_id,
            game_type="daily",
            question_ids=question_ids,
            daily_date=date_str,
            expires_at=expires_at,
        )
        try:
            await session.insert()
            logger.info(
                f"✅ Daily arena created for {student_id} on {date_str}: "
                f"spotbug={str(spotbug_q.id)[:8]}, orderit={str(orderit_q.id)[:8]}, stackit={str(stackit_q.id)[:8]}"
            )
            return session, None
        except Exception as e:
            logger.warning(f"Session insert exception (likely concurrent): {e}")
            existing = await ArenaSession.find_one(
                ArenaSession.student_id == student_id,
                ArenaSession.game_type == "daily",
                ArenaSession.daily_date == date_str,
            )
            return existing, None


#  Legacy generators (kept for existing /start endpoint backward compat)   

async def generate_quick_fire_questions(
    count: int = 10,
    difficulty: str = "medium",
    skills: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> List[ArenaQuestion]:
    """Legacy — generates MCQ quick fire questions. Kept for backward compatibility."""
    import httpx

    if not settings.GROQ_API_KEY:
        return []

    target_skills = skills if skills else ["JavaScript", "TypeScript", "Python", "React", "SQL"]
    skills_str = ", ".join(random.sample(target_skills, min(5, len(target_skills))))
    role_str = f" for a {role} candidate" if role else ""

    system = (
        "You are a principal software engineer. "
        "Create fast technical MCQ questions. Return valid JSON only."
    )
    prompt = f"""Generate exactly {count} Multiple Choice Questions{role_str}.
Difficulty: {difficulty}. Skills: {skills_str}.
Each question has 4 options A-D. Return JSON:
{{"questions": [{{"skill": "javascript", "difficulty": "medium", "question": "...", "options": [{{"key": "A", "text": "..."}}], "correct_key": "B", "explanation": "...", "time_limit": 25, "xp_reward": 10}}]}}"""

    result = await _call_groq(system, prompt)
    if not result:
        return []
    data = result[0] if isinstance(result, tuple) else result
    if not data or "questions" not in data:
        return []

    created = []
    for q_data in data["questions"]:
        try:
            from app.models.arena import ArenaOption
            options = [ArenaOption(key=o["key"], text=o["text"]) for o in q_data.get("options", [])[:4]]
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
            logger.warning(f"Error parsing quick_fire question: {e}")
    return created


async def generate_debug_rush_questions(
    count: int = 10,
    difficulty: str = "medium",
    skills: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> List[ArenaQuestion]:
    """Legacy — kept for backward compatibility."""
    return []


async def generate_tech_decision_questions(
    count: int = 10,
    difficulty: str = "medium",
    skills: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> List[ArenaQuestion]:
    """Legacy — kept for backward compatibility."""
    return []


async def get_or_create_daily_arena(
    date_str: str,
    skills: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> None:
    """Legacy — superseded by get_or_create_daily_arena_v2(). Returns None."""
    return None
