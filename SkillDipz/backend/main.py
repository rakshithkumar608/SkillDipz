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
from app.api.routes.target_company import router as target_company_router
from app.api.routes.target_company import companies_router
from app.api.routes.company_admin import router as company_admin_router, admin_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.projects import student_router as projects_student_router
from app.api.routes.projects import company_router as projects_company_router


from app.core.event_bus import register_target_company_handlers

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directories exist before serving
    Path("uploads/photos").mkdir(parents=True, exist_ok=True)
    Path("uploads/resumes").mkdir(parents=True, exist_ok=True)
    await connect_db()
    await connect_redis()
    register_target_company_handlers()
    yield
    await close_db()
    await close_redis()

app = FastAPI(
    title="SkillDipz API",
    version="0.0.1",
    lifespan=lifespan,
)

cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
# Target companies — /v1/students/me/target-companies
app.include_router(target_company_router, prefix="/v1")
# Company public profiles — /v1/companies/{id}/profile
app.include_router(companies_router, prefix="/v1")
# Company admin portal & job posting — /v1/companies/me/*
app.include_router(company_admin_router, prefix="/v1")
# Platform admin company verification — /v1/admin/companies/*
app.include_router(admin_router, prefix="/v1")
# Jobs Hub — /v1/jobs
app.include_router(jobs_router, prefix="/v1")
# Projects — /v1/projects
app.include_router(projects_student_router, prefix="/v1/projects/student")
app.include_router(projects_company_router, prefix="/v1/projects/company")

# Serve uploaded files (photos, resumes) as static
# Path must include /v1 because the frontend baseURL already contains /v1
app.mount("/v1/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="[IP_ADDRESS]", port=settings.PORT, reload=True)