import json
import logging
import re
import httpx
from app.core.config import settings
from app.models.skill_gap import RoleSkillBenchmark

logger = logging.getLogger(__name__)

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"


SYSTEM_PROMPT = (
    "You are a senior software engineering tech lead and career coach with 15+ years of experience. "
    "You provide structured, accurate, and actionable learning roadmaps for tech roles. "
    "Always respond with strictly valid JSON only — no markdown, no explanation, no code blocks."
)


def _build_benchmark_prompt(role: str) -> str:
    return f"""
Analyze the role "{role}" and return the top 10-12 essential technical skills needed to get hired.

Rules:
1. Order skills from most foundational to most advanced (the student must learn them in this order).
2. Use exact, well-known technology names (e.g. "React", "Node.js", "PostgreSQL", "Docker", "TypeScript").
3. Do NOT include soft skills, communication, or vague terms like "problem solving".
4. "required_level" must be an integer 1-5 representing how deeply the skill must be mastered:
   - 1 = basic awareness
   - 3 = working proficiency (can use in real projects)
   - 5 = expert level
5. "priority" is the learning order rank: 1 = learn first, 10 = learn last.

Respond ONLY with a JSON object in this exact format:
{{
  "skills": [
    {{"skill": "HTML", "required_level": 3, "priority": 1}},
    {{"skill": "CSS", "required_level": 3, "priority": 2}},
    {{"skill": "JavaScript", "required_level": 4, "priority": 3}}
  ]
}}
""".strip()


async def fetch_realtime_benchmarks_from_groq(role: str) -> list[dict]:
   
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — cannot generate real-time benchmarks.")
        return []

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_benchmark_prompt(role)},
        ],
        "temperature": 0.1,          # Low temp → consistent, factual output
        "response_format": {"type": "json_object"},  # Groq enforces valid JSON object
        "max_tokens": 1024,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"].strip()

            parsed = json.loads(content)

            # Groq json_object mode returns {"skills": [...]}
            skills_list = parsed.get("skills") or parsed.get("items") or parsed
            if not isinstance(skills_list, list):
                logger.error(f"Groq returned unexpected shape for role '{role}': {content[:200]}")
                return []

            role_lower = role.lower().strip()
            results = []
            for i, item in enumerate(skills_list):
                if not isinstance(item, dict) or "skill" not in item:
                    continue
                results.append({
                    "role": role_lower,
                    "skill": str(item["skill"]).strip(),
                    "required_level": max(1, min(5, int(item.get("required_level", 3)))),
                    "priority": int(item.get("priority", i + 1)),
                })

            logger.info(f"⚡ Groq generated {len(results)} benchmarks for '{role}'")
            return results

    except httpx.HTTPStatusError as e:
        logger.error(f"Groq API HTTP error for role '{role}': {e.response.status_code} — {e.response.text[:200]}")
        return []
    except Exception as e:
        logger.error(f"Groq benchmark fetch failed for role '{role}': {e}")
        return []


async def get_or_generate_benchmarks(role: str) -> list[RoleSkillBenchmark]:
    role_clean = role.lower().strip()

    #  DB cache hit 
    existing = await RoleSkillBenchmark.find(
        {"role": {"$regex": f"^{re.escape(role_clean)}$", "$options": "i"}}
    ).sort(RoleSkillBenchmark.priority).to_list()

    if existing:
        logger.debug(f"Cache hit: {len(existing)} benchmarks for '{role_clean}'")
        return existing

    #2. Cache miss → Groq AI 
    raw = await fetch_realtime_benchmarks_from_groq(role_clean)

    if raw:
        docs = [RoleSkillBenchmark(**b) for b in raw]
        await RoleSkillBenchmark.insert_many(docs)
        logger.info(f"Cached {len(docs)} Groq benchmarks for '{role_clean}'")
        return docs

    #  3. Groq unavailable → return nothing 
    logger.warning(f"No benchmarks available for '{role_clean}' — GROQ_API_KEY may not be set.")
    return []


# FLASHCARD GENERATION

_FLASHCARD_SYSTEM = (
    "You are a senior software engineer and technical educator. "
    "Generate concise, accurate flashcards for a technical concept. "
    "Always respond with strictly valid JSON only — no markdown, no explanation, no code blocks."
)


def _build_flashcard_prompt(skill: str, role: str) -> str:
    return f"""
Generate exactly 5 flashcard question-answer pairs for the skill "{skill}" targeted at a "{role}" developer.

Rules:
1. Each question must be specific, practical, and interview-relevant.
2. Each answer must be clear and concise (1-3 sentences max).
3. Cover different sub-topics within "{skill}" — do not repeat the same concept.
4. Use real technical terminology — no vague or beginner platitudes.

Respond ONLY with this exact JSON format:
{{
  "flashcards": [
    {{"front": "Question here?", "back": "Answer here."}},
    {{"front": "Question here?", "back": "Answer here."}},
    {{"front": "Question here?", "back": "Answer here."}},
    {{"front": "Question here?", "back": "Answer here."}},
    {{"front": "Question here?", "back": "Answer here."}}
  ]
}}
""".strip()


async def generate_flashcards_for_skill(
    skill: str,
    role: str,
    redis=None,
    ttl: int = 6 * 3600,
) -> list[dict[str, str]]:
    
    cache_key = f"groq_flashcards:{skill.lower().replace(' ', '_')}:{role.lower()}"

    # Redis cache hit
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis read failed for flashcard cache: {e}")

    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — cannot generate flashcards.")
        return []

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": _FLASHCARD_SYSTEM},
            {"role": "user", "content": _build_flashcard_prompt(skill, role)},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "max_tokens": 1024,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"].strip()
            parsed = json.loads(content)

        cards = parsed.get("flashcards", [])
        if not isinstance(cards, list) or not cards:
            logger.error(f"Groq flashcard response malformed for '{skill}': {content[:200]}")
            return []

        # Validate shape
        valid = [
            c for c in cards
            if isinstance(c, dict) and "front" in c and "back" in c
        ]

        if redis and valid:
            try:
                await redis.setex(cache_key, ttl, json.dumps(valid))
            except Exception as e:
                logger.warning(f"Redis write failed for flashcard cache: {e}")

        logger.info(f"⚡ Groq generated {len(valid)} flashcards for '{skill}'")
        return valid

    except httpx.HTTPStatusError as e:
        logger.error(f"Groq flashcard HTTP error for '{skill}': {e.response.status_code}")
        return []
    except Exception as e:
        logger.error(f"Groq flashcard generation failed for '{skill}': {e}")
        return []


#  EXPLAIN PROMPT GENERATION

_EXPLAIN_SYSTEM = (
    "You are a senior software engineer and technical interviewer. "
    "Generate deep, thought-provoking 'Explain this concept' prompts that would be asked in real senior-level technical interviews. "
    "Always respond with strictly valid JSON only — no markdown, no explanation, no code blocks."
)


def _build_explain_prompt(skill: str, role: str) -> str:
    return f"""
Generate exactly 3 "Explain this concept" prompts for the skill "{skill}" targeted at a "{role}" developer.

Rules:
1. Each prompt must start with "Explain:" followed by a specific technical question.
2. Questions must target understanding and reasoning — not just definition recall.
3. Cover different aspects of "{skill}" — architecture, trade-offs, internals, or real-world usage.
4. The student should be able to answer in 60 seconds (spoken or written).

Respond ONLY with this exact JSON format:
{{
  "prompts": [
    "Explain: ...",
    "Explain: ...",
    "Explain: ..."
  ]
}}
""".strip()


async def generate_explain_prompts_for_skill(
    skill: str,
    role: str,
    redis=None,
    ttl: int = 6 * 3600,
) -> list[str]:
    
    cache_key = f"groq_explain:{skill.lower().replace(' ', '_')}:{role.lower()}"

    # Redis cache hit
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis read failed for explain cache: {e}")

    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — cannot generate explain prompts.")
        return []

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": _EXPLAIN_SYSTEM},
            {"role": "user", "content": _build_explain_prompt(skill, role)},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "max_tokens": 512,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(GROQ_COMPLETIONS_URL, json=payload, headers=headers)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"].strip()
            parsed = json.loads(content)

        prompts = parsed.get("prompts", [])
        if not isinstance(prompts, list) or not prompts:
            logger.error(f"Groq explain response malformed for '{skill}': {content[:200]}")
            return []

        valid = [p for p in prompts if isinstance(p, str) and p.startswith("Explain:")]

        if redis and valid:
            try:
                await redis.setex(cache_key, ttl, json.dumps(valid))
            except Exception as e:
                logger.warning(f"Redis write failed for explain cache: {e}")

        logger.info(f"⚡ Groq generated {len(valid)} explain prompts for '{skill}'")
        return valid

    except httpx.HTTPStatusError as e:
        logger.error(f"Groq explain HTTP error for '{skill}': {e.response.status_code}")
        return []
    except Exception as e:
        logger.error(f"Groq explain prompt generation failed for '{skill}': {e}")
        return []
