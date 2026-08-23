import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)


from app.models.employability_score import EmployabilityScore
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.models.skill_gap import StudentSkillLevel, RoleSkillBenchmark
from app.models.student_profile import StudentProfile
from app.models.target_company import CompanyProfile, StudentTargetCompany
from app.models.job_requirement import JobRequirement
from app.models.job_application import JobApplication
from app.models.interview import InterviewSession

from app.models.project import (
    CompanyProject,
    ProjectGroup,
    ProjectAcceptance,
    StudentProjectSubmission,
    ProjectComment,
    StudentProject,
)

from app.models.assessment import (
    AssessmentTopic,
    AssessmentSession,
    AssessmentResult,
    AssessmentQuestion,
    CFBookmark,
    CFSolvedProblem,
    CodingQuestion,
    CodingSolvedProblem,
)

from app.models.daily_assignment import DailyAssignment, CompanySponsoredChallenge

from app.models.arena import (
    ArenaQuestion,
    ArenaSession,
    DailyArena,
    ArenaAttempt,
    ArenaUserStats,
    ArenaBadge,
    UserBadge,
)

client: AsyncIOMotorClient | None = None


async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(
        database=client.skilldipz,
        document_models=[
            User,
            EmployabilityScore,
            StudentRoadmap,
            Notification,
            ActivityLog,
            StudentStreak,
            StudentSkillLevel,
            RoleSkillBenchmark,
            StudentProfile,
            CompanyProfile,
            StudentTargetCompany,
            JobRequirement,
            JobApplication,
            CompanyProject,
            ProjectGroup,
            ProjectAcceptance,
            StudentProjectSubmission,
            ProjectComment,
            StudentProject,
            AssessmentTopic,
            AssessmentSession,
            AssessmentResult,
            AssessmentQuestion,
            CFBookmark,
            CFSolvedProblem,
            CodingQuestion,
            CodingSolvedProblem,
            InterviewSession,
            DailyAssignment,
            CompanySponsoredChallenge,
            # Arena — Game Arena
            ArenaQuestion,
            ArenaSession,
            DailyArena,
            ArenaAttempt,
            ArenaUserStats,
            ArenaBadge,
            UserBadge,
        ],
    )

    # Create indexes manually
    await User.get_motor_collection().create_index("email", unique=True)
    await User.get_motor_collection().create_index("google_id", sparse=True)
    await EmployabilityScore.get_motor_collection().create_index("student_id", unique=True)
    await EmployabilityScore.get_motor_collection().create_index(
        [("overall_score", -1)], name="leaderboard_rank_sort"
    )  # Leaderboard — sorts all students by score DESC on every request
    await EmployabilityScore.get_motor_collection().create_index(
        [("target_role", 1), ("overall_score", -1)], name="leaderboard_role_rank_sort"
    )  # Leaderboard — role-filtered ranking (role + score compound)
    await StudentRoadmap.get_motor_collection().create_index("student_id", unique=True)
    await Notification.get_motor_collection().create_index([("student_id", 1), ("created_at", -1)])
    await ActivityLog.get_motor_collection().create_index([("student_id", 1), ("created_at", -1)])
    
    # Jobs Hubs
    await StudentStreak.get_motor_collection().create_index("student_id", unique=True)
    await StudentSkillLevel.get_motor_collection().create_index([("student_id", 1), ("skill", 1)])
    await RoleSkillBenchmark.get_motor_collection().create_index([("role", 1), ("skill", 1)])
    await StudentProfile.get_motor_collection().create_index("student_id", unique=True)
    await StudentProfile.get_motor_collection().create_index(
        "college", name="leaderboard_college_filter"
    )  # Leaderboard — college-scope filter queries students by college name
    await CompanyProfile.get_motor_collection().create_index("company_id", unique=True)
    await StudentTargetCompany.get_motor_collection().create_index([("student_id", 1), ("company_id", 1)], unique=True)
    await JobRequirement.get_motor_collection().create_index("company_id")
    await JobApplication.get_motor_collection().create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await JobApplication.get_motor_collection().create_index("job_id")
    await JobApplication.get_motor_collection().create_index("company_id")
    
    # Projects Section
    await CompanyProject.get_motor_collection().create_index([("target_roles", 1), ("is_active", 1)])
    await ProjectGroup.get_motor_collection().create_index("invite_code", unique=True)
    await StudentProjectSubmission.get_motor_collection().create_index([("student_id", 1), ("project_id", 1)], unique=True)
    await StudentProjectSubmission.get_motor_collection().create_index([("is_public", 1), ("submitted_at", -1)])
    await ProjectComment.get_motor_collection().create_index([("submission_id", 1), ("created_at", 1)])
    await StudentProject.get_motor_collection().create_index([("created_by", 1), ("created_at", -1)])
    await StudentProject.get_motor_collection().create_index("invite_code", unique=True)
    await StudentProject.get_motor_collection().create_index([("is_public", 1), ("created_at", -1)])
    await ProjectAcceptance.get_motor_collection().create_index([("project_id", 1), ("student_id", 1)], unique=True)
    
    # Sill Test Section
    await AssessmentTopic.get_motor_collection().create_index("topic_id", unique=True)
    await AssessmentTopic.get_motor_collection().create_index([("role", 1), ("is_active", 1)])
    await AssessmentSession.get_motor_collection().create_index("session_id", unique=True)
    await AssessmentSession.get_motor_collection().create_index([("student_id", 1), ("topic_id", 1), ("status", 1)])
    await AssessmentResult.get_motor_collection().create_index([("student_id", 1), ("taken_at", -1)])
    await AssessmentResult.get_motor_collection().create_index([("student_id", 1), ("topic_id", 1)])
    await AssessmentQuestion.get_motor_collection().create_index([("role", 1), ("topic_id", 1), ("is_active", 1)])
    await CFBookmark.get_motor_collection().create_index([("student_id", 1), ("cf_problem_id", 1)], unique=True)
    await CFSolvedProblem.get_motor_collection().create_index([("student_id", 1), ("cf_problem_id", 1)], unique=True)
    await CodingQuestion.get_motor_collection().create_index("question_id", unique=True)
    await CodingQuestion.get_motor_collection().create_index([("is_active", 1)])

    # Interview
    await InterviewSession.get_motor_collection().create_index("session_id", unique=True)
    await InterviewSession.get_motor_collection().create_index([("student_id", 1), ("status", 1), ("scheduled_at", -1)])
    await InterviewSession.get_motor_collection().create_index([("company_id", 1), ("status", 1)])

    # Arena — Game Arena indexes
    await ArenaQuestion.get_motor_collection().create_index([("game_type", 1), ("is_active", 1)])
    await ArenaQuestion.get_motor_collection().create_index([("skill", 1), ("game_type", 1)])
    await ArenaSession.get_motor_collection().create_index("session_id", unique=True)
    await ArenaSession.get_motor_collection().create_index([("student_id", 1), ("status", 1), ("completed_at", -1)])
    await DailyArena.get_motor_collection().create_index("date_str", unique=True)
    await ArenaAttempt.get_motor_collection().create_index([("student_id", 1), ("date_str", 1)], unique=True)
    await ArenaUserStats.get_motor_collection().create_index("student_id", unique=True)
    await ArenaUserStats.get_motor_collection().create_index([("weekly_xp", -1)])
    await ArenaUserStats.get_motor_collection().create_index([("total_xp", -1)])
    await ArenaBadge.get_motor_collection().create_index("badge_id", unique=True)
    await UserBadge.get_motor_collection().create_index([("student_id", 1), ("badge_id", 1)], unique=True)

    logger.info("Database Successfully Connected")


async def close_db():
    if client:
        client.close()
        logger.info("Database Connection Closed")
