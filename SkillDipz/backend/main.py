from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path


from app.core.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.core.config import settings

from app.api.routes.auth import router as auth_router
from app.api.routes.students import router as students_router
from app.api.routes.student_profile import router as student_profile_router
from app.api.routes.ws import router as ws_router
from app.api.routes.roadmap import router as roadmap_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directories exist before serving
    Path("uploads/photos").mkdir(parents=True, exist_ok=True)
    Path("uploads/resumes").mkdir(parents=True, exist_ok=True)
    await connect_db()
    await connect_redis()
    yield
    await close_db()
    await close_redis()

app = FastAPI(
    title="SkillDipz API",
    version="0.0.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/v1")
app.include_router(students_router, prefix="/v1")
app.include_router(student_profile_router, prefix="/v1")
app.include_router(roadmap_router, prefix="/v1")
# WebSocket router — path: /v1/ws/student/{id}
app.include_router(ws_router, prefix="/v1")

# Serve uploaded files (photos, resumes) as static
# Path must include /v1 because the frontend baseURL already contains /v1
app.mount("/v1/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="[IP_ADDRESS]", port=settings.PORT, reload=True)