

import logging
import random
import json
import httpx
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from app.models.daily_assignment import (
    DailyAssignment,
    AssignmentTask,
    SponsoredTask,
    CompanySponsoredChallenge,
)
from app.models.student_profile import StudentProfile
from app.models.student_streak import StudentStreak
from app.models.skill_gap import StudentSkillLevel, RoleSkillBenchmark
from app.models.roadmap import StudentRoadmap
from app.models.assessment import AssessmentTopic
from app.core.youtube import fetch_youtube_videos
from app.core.redis_client import get_redis
from app.core.groq_service import generate_flashcards_for_skill, generate_explain_prompts_for_skill

logger = logging.getLogger(__name__)

CF_BASE = "https://codeforces.com/api"
CF_PROBLEM_TTL = 86400  # 24 h Redis cache for CF problems


# Role → Codeforces tag mapping

ROLE_TO_CF_TAGS = {
    "backend":   ["implementation", "data structures", "sorting", "binary search", "two pointers"],
    "fullstack": ["implementation", "strings", "greedy", "math"],
    "data":      ["math", "combinatorics", "implementation", "dp"],
    "devops":    ["implementation", "greedy", "math"],
    "ai":        ["math", "probability", "greedy", "dp"],
}

# CF rating ranges per difficulty tier
CF_DIFFICULTY_RANGES = {
    "EASY":   (800, 1100),
    "MEDIUM": (1200, 1700),
    "BOSS":   (1800, 2500),
}





# HELPER: Determine difficulty tier from streak + completion rate

def _determine_difficulty(streak: int, completion_rate: float) -> str:
   
    if streak >= 7:
        return "BOSS"
    if completion_rate < 0.6:
        return "EASY"
    return "MEDIUM"


# HELPER: Compute streak tier label and bonus text

def _streak_tier_info(streak: int) -> tuple[str, Optional[str]]:
    if streak >= 30:
        return "elite", "+15 bonus XP • Elite badge on leaderboard + priority in Jobs Hub"
    if streak >= 14:
        return "company_tasks", "+10 bonus XP for 14+ day streak"
    if streak >= 7:
        return "unlocked_boss", "+5 bonus XP for 7+ day streak"
    return "standard", None


# HELPER: Compute 7-day completion rate
async def _compute_completion_rate(student_id: str) -> float:
    
    cutoff = (date.today() - timedelta(days=7)).isoformat()
    past = await DailyAssignment.find(
        DailyAssignment.student_id == student_id,
        DailyAssignment.date >= cutoff,
    ).to_list()

    if not past:
        return 0.0

    fully_completed = sum(
        1 for a in past
        if a.tasks and all(t.status == "completed" for t in a.tasks)
    )
    return fully_completed / len(past)



# HELPER: Find worst skill gap

async def _get_worst_skill(student_id: str, role: str) -> Optional[str]:
    benchmarks = await RoleSkillBenchmark.find(
        RoleSkillBenchmark.role == role
    ).sort("+priority").to_list()

    skill_levels = {
        sl.skill: sl.current_level
        async for sl in StudentSkillLevel.find(StudentSkillLevel.student_id == student_id)
    }

    worst_skill = None
    worst_gap = 0
    for bm in benchmarks:
        gap = bm.required_level - skill_levels.get(bm.skill, 0)
        if gap > worst_gap:
            worst_gap = gap
            worst_skill = bm.skill

    return worst_skill



# TASK PICKERS (all live / real-time — zero mock data)


async def _pick_quiz_task(student_id: str, role: str, points: int = 10) -> Optional[AssignmentTask]:
    
    worst_skill = await _get_worst_skill(student_id, role)

    all_topics = await AssessmentTopic.find(
        AssessmentTopic.role == role,
        AssessmentTopic.is_active == True,  # noqa: E712
    ).to_list()

    if not all_topics:
        return None

    topic = None
    if worst_skill:
        skill_lower = worst_skill.lower()
        matched = [t for t in all_topics if any(skill_lower in tag.lower() for tag in t.skill_tags)]
        if matched:
            topic = random.choice(matched)

    if not topic:
        topic = random.choice(all_topics)

    return AssignmentTask(
        type="quiz",
        title=f"{topic.title} Quiz",
        points=points,
        topic_id=topic.topic_id,
        skill_tag=worst_skill or (topic.skill_tags[0] if topic.skill_tags else ""),
    )


async def _pick_code_task(student_id: str, role: str, difficulty: str = "MEDIUM", points: int = 15) -> Optional[AssignmentTask]:
    
    redis = get_redis()
    role_key = role.lower().split()[0]
    tags = ROLE_TO_CF_TAGS.get(role_key, ["implementation"])
    primary_tag = tags[0]

    lo, hi = CF_DIFFICULTY_RANGES.get(difficulty, (1200, 1700))
    cache_key = f"cf_problems:{primary_tag}:{difficulty}"

    problems = None
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                problems = json.loads(cached)
        except Exception:
            pass

    if not problems:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(f"{CF_BASE}/problemset.problems", params={"tags": primary_tag})
                resp.raise_for_status()
                data = resp.json()

            if data.get("status") != "OK":
                return None

            problems = [
                p for p in data["result"]["problems"]
                if isinstance(p.get("rating"), int) and lo <= p["rating"] <= hi
                and p.get("contestId") and p.get("index") and p.get("name")
            ]

            if redis and problems:
                await redis.setex(cache_key, CF_PROBLEM_TTL, json.dumps(problems))

        except Exception as e:
            logger.warning(f"CF API error for daily assignment code task: {e}")
            return None

    if not problems:
        return None

    pick = random.choice(problems[:200])
    contest_id = pick["contestId"]
    index = pick["index"]

    return AssignmentTask(
        type="code",
        title=f"CF {contest_id}{index} — {pick['name']}",
        points=points,
        cf_contest_id=contest_id,
        cf_index=index,
        cf_url=f"https://codeforces.com/problemset/problem/{contest_id}/{index}",
        cf_rating=pick.get("rating"),
    )


async def _pick_video_task(student_id: str, role: str, points: int = 5) -> Optional[AssignmentTask]:
    
    roadmap = await StudentRoadmap.find_one(StudentRoadmap.student_id == student_id)
    skill = None

    if roadmap and roadmap.next_skill:
        skill = roadmap.next_skill
    elif roadmap and roadmap.phases:
        for phase in roadmap.phases:
            for week in phase.get("weeks", []):
                for s in week.get("skills", []):
                    if not s.get("completed", False):
                        skill = s.get("name") or s.get("skill")
                        break
                if skill:
                    break
            if skill:
                break

    if not skill:
        skill = await _get_worst_skill(student_id, role) or role

    videos = await fetch_youtube_videos(skill=skill, role=role)
    if not videos:
        return None

    watched: set = set()
    if roadmap:
        watched = set(roadmap.watched_videos.get(skill.lower(), []))

    unwatched = [v for v in videos if v["youtube_id"] not in watched]
    pick = random.choice(unwatched) if unwatched else random.choice(videos)

    return AssignmentTask(
        type="video",
        title=pick["title"],
        points=points,
        skill_tag=skill,
        youtube_id=pick["youtube_id"],
        channel=pick.get("channel", ""),
        duration_label=pick.get("duration_label", ""),
    )


async def _pick_flashcard_task(student_id: str, role: str, points: int = 5) -> Optional[AssignmentTask]:
    
    worst_skill = await _get_worst_skill(student_id, role)
    skill = worst_skill or role

    redis = get_redis()
    cards = await generate_flashcards_for_skill(skill=skill, role=role, redis=redis)

    if not cards:
        logger.warning(f"Groq flashcards unavailable for '{skill}' — skipping flashcard task.")
        return None

    return AssignmentTask(
        type="flashcard",
        title=f"Flashcards: {skill} Concepts",
        points=points,
        skill_tag=worst_skill,
        flashcards=cards,
    )


async def _pick_explain_task(student_id: str, role: str, points: int = 10) -> Optional[AssignmentTask]:
    
    worst_skill = await _get_worst_skill(student_id, role)
    skill = worst_skill or role

    redis = get_redis()
    prompts = await generate_explain_prompts_for_skill(skill=skill, role=role, redis=redis)

    if not prompts:
        logger.warning(f"Groq explain prompts unavailable for '{skill}' — skipping explain task.")
        return None

    prompt = random.choice(prompts)

    return AssignmentTask(
        type="explain",
        title=prompt,
        explain_prompt=prompt,
        points=points,
        skill_tag=worst_skill,
    )


async def _pick_resume_tweak_task(student_id: str, profile: StudentProfile, points: int = 5) -> Optional[AssignmentTask]:
    
    skills = profile.skills or []
    if not skills:
        return None

    # Pick a skill that is likely underrepresented (short, generic, or vague)
    vague_markers = ["python", "java", "sql", "html", "css", "git"]
    target_skill = None
    for s in skills:
        if s.lower() in vague_markers:
            target_skill = s
            break

    if not target_skill:
        target_skill = random.choice(skills)

    instruction = (
        f"Your resume lists '{target_skill}' as a skill. "
        f"Improve it: add context (e.g. years of experience, specific framework, or project used in). "
        f"Example: 'Python' → 'Python 3.12 (FastAPI, async, pytest — 2 years)'."
    )

    return AssignmentTask(
        type="resume_tweak",
        title=f"Resume Tweak: Strengthen '{target_skill}'",
        resume_skill=target_skill,
        tweak_instruction=instruction,
        points=points,
        skill_tag=target_skill,
    )


async def _pick_wildcard_task(student_id: str, role: str, profile: StudentProfile, difficulty: str = "MEDIUM") -> Optional[AssignmentTask]:
    
    # Available types and their base points
    candidates = ["quiz", "code", "video", "flashcard", "explain", "resume_tweak"]
    chosen_type = random.choice(candidates)

    base_points_map = {
        "quiz": 10, "code": 15, "video": 5,
        "flashcard": 5, "explain": 10, "resume_tweak": 5,
    }
    base = base_points_map.get(chosen_type, 10)
    wildcard_points = int(base * 1.5)

    picker_map = {
        "quiz":         lambda: _pick_quiz_task(student_id, role, points=wildcard_points),
        "code":         lambda: _pick_code_task(student_id, role, difficulty=difficulty, points=wildcard_points),
        "video":        lambda: _pick_video_task(student_id, role, points=wildcard_points),
        "flashcard":    lambda: _pick_flashcard_task(student_id, role, points=wildcard_points),
        "explain":      lambda: _pick_explain_task(student_id, role, points=wildcard_points),
        "resume_tweak": lambda: _pick_resume_tweak_task(student_id, profile, points=wildcard_points),
    }

    task = await picker_map[chosen_type]()
    if task:
        task.subtype = task.type   # store resolved type before overwriting
        task.type = "wildcard"

    return task



# HELPER: Pull company-sponsored challenge for tomorrow (if available)

async def _get_sponsored_task(role: str, today: str) -> Optional[SponsoredTask]:
    
    challenge = await CompanySponsoredChallenge.find_one(
        CompanySponsoredChallenge.is_active == True,  # noqa: E712
        {
            "$or": [
                {"scheduled_date": today},
                {"scheduled_date": None},
            ]
        },
    )

    if not challenge:
        return None

    # Mark used so it doesn't repeat
    challenge.is_active = False
    await challenge.save()

    return SponsoredTask(
        company_id=challenge.company_id,
        company_name=challenge.company_name,
        type=challenge.type,
        title=challenge.title,
        content_ref=challenge.content_ref,
        target_role=challenge.target_role,
        points=challenge.points,
    )



# MAIN GENERATION FUNCTION


async def generate_assignment_for_student(student_id: str) -> Optional[DailyAssignment]:

    today = date.today().isoformat()

    # Idempotency check
    existing = await DailyAssignment.get_for_student(student_id, today)
    if existing:
        return existing

    # Load student profile
    profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not profile:
        return None

    role = (profile.target_roles or "backend").lower().split()[0]

    # Load streak
    streak_doc = await StudentStreak.get_or_create(student_id)
    current_streak = streak_doc.current_streak

    # Compute 7-day completion rate
    completion_rate = await _compute_completion_rate(student_id)

    # Determine difficulty
    difficulty = _determine_difficulty(current_streak, completion_rate)

    # Streak tier + bonus text
    streak_tier, streak_bonus = _streak_tier_info(current_streak)

    # Build task list based on difficulty 
    tasks: list[AssignmentTask] = []

    if difficulty == "EASY":
        # 4 lightweight tasks
        for picker, kwargs in [
            (_pick_flashcard_task, {"student_id": student_id, "role": role, "points": 5}),
            (_pick_video_task,     {"student_id": student_id, "role": role, "points": 5}),
            (_pick_quiz_task,      {"student_id": student_id, "role": role, "points": 10}),
            (_pick_wildcard_task,  {"student_id": student_id, "role": role, "profile": profile, "difficulty": difficulty}),
        ]:
            try:
                task = await picker(**kwargs)
                if task:
                    tasks.append(task)
            except Exception as e:
                logger.error(f"[EASY] picker {picker.__name__} failed for {student_id}: {e}")

    elif difficulty == "BOSS":
        # 1-2 hard tasks
        for picker, kwargs in [
            (_pick_code_task,    {"student_id": student_id, "role": role, "difficulty": "BOSS", "points": 25}),
            (_pick_explain_task, {"student_id": student_id, "role": role, "points": 30}),
        ]:
            try:
                task = await picker(**kwargs)
                if task:
                    tasks.append(task)
            except Exception as e:
                logger.error(f"[BOSS] picker {picker.__name__} failed for {student_id}: {e}")

    else:  # MEDIUM (default)
        # 3 mixed tasks
        for picker, kwargs in [
            (_pick_quiz_task,  {"student_id": student_id, "role": role, "points": 10}),
            (_pick_code_task,  {"student_id": student_id, "role": role, "difficulty": "MEDIUM", "points": 15}),
            (_pick_video_task, {"student_id": student_id, "role": role, "points": 5}),
        ]:
            try:
                task = await picker(**kwargs)
                if task:
                    tasks.append(task)
            except Exception as e:
                logger.error(f"[MEDIUM] picker {picker.__name__} failed for {student_id}: {e}")

    if not tasks:
        logger.warning(f"No tasks generated for student {student_id}")
        return None

    #  Company-sponsored task (only for streak >= 14) 
    sponsored = None
    if current_streak >= 14:
        try:
            sponsored = await _get_sponsored_task(role, today)
        except Exception as e:
            logger.warning(f"Sponsored task fetch failed for {student_id}: {e}")

    #  Persist
    assignment = DailyAssignment(
        student_id=student_id,
        date=today,
        difficulty=difficulty,
        tasks=tasks,
        sponsored_task=sponsored,
        streak=current_streak,
        streak_tier=streak_tier,
        streak_bonus=streak_bonus,
        completion_rate_7d=round(completion_rate, 2),
    )
    await assignment.insert()
    return assignment
