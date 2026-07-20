from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.core.config import settings

client: AsyncIOMotorClient | None = None





async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(
        database=client.skilldipz,
        document_models=[User]
    )
    
    # Create indexes manually
    await User.get_motor_collection().create_index("email", unique=True)
    await User.get_motor_collection().create_index("google_id", sparse=True)

    print("🚀 Database Succesffuly Connected")

async def close_db():
    if client:
        client.close()
        print("❌ Database Connection Closed")


