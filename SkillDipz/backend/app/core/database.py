from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.core.config import settings
from app.models.employability_score import EmployabilityScore
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.models.skill_gap import StudentSkillLevel, RoleSkillBenchmark
from app.models.student_profile import StudentProfile

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
        ]
    )

    # Create indexes manually
    await User.get_motor_collection().create_index("email", unique=True)
    await User.get_motor_collection().create_index("google_id", sparse=True)
    await EmployabilityScore.get_motor_collection().create_index("student_id", unique=True)
    await StudentRoadmap.get_motor_collection().create_index("student_id", unique=True)
    await Notification.get_motor_collection().create_index([("student_id", 1), ("created_at", -1)])
    await ActivityLog.get_motor_collection().create_index([("student_id", 1), ("created_at", -1)])
    await StudentStreak.get_motor_collection().create_index("student_id", unique=True)
    await StudentSkillLevel.get_motor_collection().create_index([("student_id", 1), ("skill", 1)])
    await RoleSkillBenchmark.get_motor_collection().create_index([("role", 1), ("skill", 1)])
    await StudentProfile.get_motor_collection().create_index("student_id", unique=True)

    print("🚀 Database Succesffuly Connected")


async def close_db():
    if client:
        client.close()
        print("❌ Database Connection Closed")
