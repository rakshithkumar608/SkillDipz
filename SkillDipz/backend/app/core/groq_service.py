import json
import logging
import re
import httpx
from app.core.config import settings
from app.models.skill_gap import RoleSkillBenchmark

logger = logging.getLogger(__name__)

GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


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
    """
    Calls Groq AI to generate real-time industry benchmark skills for a given role.
    Returns list of dicts: [{'role', 'skill', 'required_level', 'priority'}]
    Returns [] if API key not set or request fails.
    """
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
    """
    Primary entry point for benchmark data.
    1. Check MongoDB cache (fast path).
    2. If not cached → call Groq AI → save to MongoDB.
    3. If Groq fails or key not set → return [] (zero mock/hardcoded data).
    """
    role_clean = role.lower().strip()

    # ── 1. DB cache hit ──────────────────────────────────────────────────────
    existing = await RoleSkillBenchmark.find(
        {"role": {"$regex": f"^{re.escape(role_clean)}$", "$options": "i"}}
    ).sort(RoleSkillBenchmark.priority).to_list()

    if existing:
        logger.debug(f"Cache hit: {len(existing)} benchmarks for '{role_clean}'")
        return existing

    # ── 2. Cache miss → Groq AI ──────────────────────────────────────────────
    raw = await fetch_realtime_benchmarks_from_groq(role_clean)

    if raw:
        docs = [RoleSkillBenchmark(**b) for b in raw]
        await RoleSkillBenchmark.insert_many(docs)
        logger.info(f"Cached {len(docs)} Groq benchmarks for '{role_clean}'")
        return docs

    # ── 3. Groq unavailable → return nothing (no mock data) ──────────────────
    logger.warning(f"No benchmarks available for '{role_clean}' — GROQ_API_KEY may not be set.")
    return []
