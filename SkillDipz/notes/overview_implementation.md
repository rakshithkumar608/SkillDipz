# SkillDipz — Student Overview (Dashboard) Implementation

**Feature:** Student Overview — Step 1 after Authentication
**Date:** 2026-07-20
**Status:** Ready to implement

---

## Decisions locked in

| Question | Decision |
|----------|----------|
| Score for new student | Show 0 + empty state "Start activities to build your score" — **never seed** |
| Unbuilt sidebar items | "Coming Soon" page with icon |
| No roadmap yet | Show "Upload your resume to generate your roadmap" CTA card |
| Sidebar items | All 13 items from spec |

---

## Files Changed / Created

### Backend — New Files
1. `backend/app/models/employability_score.py`
2. `backend/app/models/roadmap.py`
3. `backend/app/models/notification.py`
4. `backend/app/models/activity_log.py`
5. `backend/app/models/student_streak.py`
6. `backend/app/api/routes/students.py`
7. `backend/app/api/routes/ws.py`
8. `backend/app/core/ws_manager.py`

### Backend — Modified Files
- `backend/app/core/database.py`
- `backend/main.py`

### Frontend — New Files
1. `frontend/src/app/student/layout.tsx`
2. `frontend/src/app/student/overview/page.tsx`
3. `frontend/src/app/student/skill-gap/page.tsx`
4. `frontend/src/app/student/roadmap/page.tsx`
5. `frontend/src/app/student/target-company/page.tsx`
6. `frontend/src/app/student/activity/page.tsx`
7. `frontend/src/app/student/jobs/page.tsx`
8. `frontend/src/app/student/notifications/page.tsx`
9. `frontend/src/app/student/projects/page.tsx`
10. `frontend/src/app/student/skill-tests/page.tsx`
11. `frontend/src/app/student/mock-interview/page.tsx`
12. `frontend/src/app/student/daily-assignments/page.tsx`
13. `frontend/src/app/student/leaderboard/page.tsx`
14. `frontend/src/app/student/profile/page.tsx`
15. `frontend/src/lib/dashboard.ts`
16. `frontend/src/hooks/useWebSocket.ts`
17. `frontend/src/store/dashboardStore.ts`
18. `frontend/src/components/student/ScoreGauge.tsx`
19. `frontend/src/components/student/ComingSoon.tsx`

### Frontend — Modified Files
- `frontend/src/hooks/useAuth.ts` — fix `next/router` → `next/navigation` bug
- `frontend/.env` — add `NEXT_PUBLIC_WS_URL`

---

## BACKEND

---

### `backend/app/models/employability_score.py`

```python
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class ScoreHistory(BaseModel):
    score: float
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScoreComponents(BaseModel):
    resume_quality: float = 0.0           # 20% weight
    assessment_score: float = 0.0         # 30% weight
    project_strength: float = 0.0         # 15% weight
    interview_readiness: float = 0.0      # 20% weight
    activity_consistency: float = 0.0     # 15% weight


class EmployabilityScore(Document):
    student_id: str
    overall_score: float = 0.0
    components: ScoreComponents = Field(default_factory=ScoreComponents)
    target_role: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    history: List[ScoreHistory] = []       # last 7 readings for sparkline

    class Settings:
        name = "employability_scores"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "EmployabilityScore":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc

    def compute_overall(self) -> float:
        c = self.components
        return round(
            c.resume_quality * 0.20 +
            c.assessment_score * 0.30 +
            c.project_strength * 0.15 +
            c.interview_readiness * 0.20 +
            c.activity_consistency * 0.15,
            2
        )
```

---

### `backend/app/models/roadmap.py`

```python
from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class StudentRoadmap(Document):
    student_id: str
    role: Optional[str] = None
    progress_pct: int = 0
    total_skills: int = 0
    completed_skills: int = 0
    next_skill: Optional[str] = None
    last_regenerated: Optional[datetime] = None
    resume_uploaded: bool = False

    class Settings:
        name = "student_roadmaps"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "StudentRoadmap":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc
```

---

### `backend/app/models/notification.py`

```python
from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class Notification(Document):
    student_id: str
    title: str
    body: str
    action_url: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"
```

---

### `backend/app/models/activity_log.py`

```python
from beanie import Document
from pydantic import Field
from typing import Literal
from datetime import datetime, timezone


class ActivityLog(Document):
    student_id: str
    type: Literal[
        "submission", "assessment", "shortlist",
        "module", "interview", "project"
    ]
    title: str
    detail: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "activity_logs"
```

---

### `backend/app/models/student_streak.py`

```python
from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import date, datetime, timezone


class StudentStreak(Document):
    student_id: str
    current_streak: int = 0
    longest_streak: int = 0
    last_active: Optional[date] = None

    class Settings:
        name = "student_streaks"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "StudentStreak":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc
```

---

### `backend/app/core/ws_manager.py`

```python
"""
In-process WebSocket connection manager.
Stores one WebSocket per student_id.
"""
import json
import logging
from typing import Any, Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections[student_id] = websocket
        logger.info(f"WS connected: {student_id}")

    def disconnect(self, student_id: str):
        self._connections.pop(student_id, None)
        logger.info(f"WS disconnected: {student_id}")

    async def broadcast(self, student_id: str, event_type: str, payload: Any):
        ws = self._connections.get(student_id)
        if ws:
            try:
                await ws.send_text(json.dumps({
                    "type": event_type,
                    "payload": payload
                }))
            except Exception as e:
                logger.warning(f"WS send error for {student_id}: {e}")
                self.disconnect(student_id)


# Singleton — import this in routes that need to push events
ws_manager = WebSocketManager()
```

---

### `backend/app/api/routes/ws.py`

```python
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import ws_manager
from app.core.security import decode_token
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/student/{user_id}")
async def student_ws(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(..., description="JWT access token"),
):
    """
    WebSocket endpoint for real-time student updates.
    Connect: ws://host/ws/student/{userId}?token=<accessToken>
    Events pushed: score_update, notification
    """
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if payload.get("sub") != user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await User.get(user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
```

---

### `backend/app/api/routes/students.py`

```python
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["Students"])


# ─── Response schemas ────────────────────────────────────────────────────────

class ScoreHistoryItem(BaseModel):
    score: float
    recorded_at: datetime


class ScoreComponentsOut(BaseModel):
    resume_quality: float
    assessment_score: float
    project_strength: float
    interview_readiness: float
    activity_consistency: float


class ScoreOut(BaseModel):
    student_id: str
    overall_score: float
    components: ScoreComponentsOut
    target_role: Optional[str]
    last_updated: datetime
    history: List[ScoreHistoryItem]
    is_empty: bool


class RoadmapSummaryOut(BaseModel):
    student_id: str
    resume_uploaded: bool
    role: Optional[str]
    progress_pct: int
    total_skills: int
    completed_skills: int
    next_skill: Optional[str]
    last_regenerated: Optional[datetime]


class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    action_url: Optional[str]
    is_read: bool
    created_at: datetime


class NotificationsOut(BaseModel):
    unread_count: int
    items: List[NotificationItem]


class ActivityItem(BaseModel):
    id: str
    type: str
    title: str
    detail: str
    created_at: datetime


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_active: Optional[str]


# ─── Score ───────────────────────────────────────────────────────────────────

@router.get("/me/score", response_model=ScoreOut)
async def get_my_score(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await EmployabilityScore.get_or_create(student_id)

    overall = doc.compute_overall()
    if overall != doc.overall_score:
        doc.overall_score = overall
        doc.last_updated = datetime.now(timezone.utc)
        await doc.save()

    return ScoreOut(
        student_id=student_id,
        overall_score=overall,
        components=ScoreComponentsOut(
            resume_quality=doc.components.resume_quality,
            assessment_score=doc.components.assessment_score,
            project_strength=doc.components.project_strength,
            interview_readiness=doc.components.interview_readiness,
            activity_consistency=doc.components.activity_consistency,
        ),
        target_role=doc.target_role,
        last_updated=doc.last_updated,
        history=[
            ScoreHistoryItem(score=h.score, recorded_at=h.recorded_at)
            for h in doc.history[-7:]
        ],
        is_empty=overall == 0.0,
    )


class ScoreUpdatePayload(BaseModel):
    resume_quality: Optional[float] = None
    assessment_score: Optional[float] = None
    project_strength: Optional[float] = None
    interview_readiness: Optional[float] = None
    activity_consistency: Optional[float] = None
    target_role: Optional[str] = None


@router.patch("/me/score", response_model=ScoreOut)
async def update_score(
    body: ScoreUpdatePayload,
    current_user: User = Depends(get_current_user),
):
    """
    Called by AI scoring workers when a component changes.
    Recalculates overall and pushes real-time WS event.
    """
    student_id = str(current_user.id)
    doc = await EmployabilityScore.get_or_create(student_id)

    if body.resume_quality is not None:
        doc.components.resume_quality = body.resume_quality
    if body.assessment_score is not None:
        doc.components.assessment_score = body.assessment_score
    if body.project_strength is not None:
        doc.components.project_strength = body.project_strength
    if body.interview_readiness is not None:
        doc.components.interview_readiness = body.interview_readiness
    if body.activity_consistency is not None:
        doc.components.activity_consistency = body.activity_consistency
    if body.target_role is not None:
        doc.target_role = body.target_role

    new_overall = doc.compute_overall()
    doc.overall_score = new_overall
    doc.last_updated = datetime.now(timezone.utc)
    doc.history.append(ScoreHistory(score=new_overall))
    doc.history = doc.history[-7:]
    await doc.save()

    # Push real-time WS event
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": doc.components.model_dump(),
            "last_updated": doc.last_updated.isoformat(),
        },
    )

    return await get_my_score(current_user)


# ─── Roadmap Summary ─────────────────────────────────────────────────────────

@router.get("/me/roadmap-summary", response_model=RoadmapSummaryOut)
async def get_roadmap_summary(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await StudentRoadmap.get_or_create(student_id)
    return RoadmapSummaryOut(
        student_id=student_id,
        resume_uploaded=doc.resume_uploaded,
        role=doc.role,
        progress_pct=doc.progress_pct,
        total_skills=doc.total_skills,
        completed_skills=doc.completed_skills,
        next_skill=doc.next_skill,
        last_regenerated=doc.last_regenerated,
    )


# ─── Notifications ───────────────────────────────────────────────────────────

@router.get("/me/notifications", response_model=NotificationsOut)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    items = (
        await Notification.find(Notification.student_id == student_id)
        .sort(-Notification.created_at)
        .limit(limit)
        .to_list()
    )
    unread = sum(1 for n in items if not n.is_read)
    return NotificationsOut(
        unread_count=unread,
        items=[
            NotificationItem(
                id=str(n.id),
                title=n.title,
                body=n.body,
                action_url=n.action_url,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in items
        ],
    )


@router.patch("/me/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    from beanie import PydanticObjectId
    notif = await Notification.get(PydanticObjectId(notification_id))
    if not notif or str(notif.student_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    await notif.save()
    return {"message": "Marked as read."}


@router.patch("/me/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    unread = await Notification.find(
        Notification.student_id == student_id,
        Notification.is_read == False,  # noqa: E712
    ).to_list()
    for n in unread:
        n.is_read = True
        await n.save()
    return {"message": f"Marked {len(unread)} notifications as read."}


# ─── Activity ────────────────────────────────────────────────────────────────

@router.get("/me/activity", response_model=List[ActivityItem])
async def get_activity(
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    student_id = str(current_user.id)
    logs = (
        await ActivityLog.find(ActivityLog.student_id == student_id)
        .sort(-ActivityLog.created_at)
        .limit(limit)
        .to_list()
    )
    return [
        ActivityItem(
            id=str(l.id),
            type=l.type,
            title=l.title,
            detail=l.detail,
            created_at=l.created_at,
        )
        for l in logs
    ]


# ─── Streak ──────────────────────────────────────────────────────────────────

@router.get("/me/streak", response_model=StreakOut)
async def get_streak(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    doc = await StudentStreak.get_or_create(student_id)
    return StreakOut(
        current_streak=doc.current_streak,
        longest_streak=doc.longest_streak,
        last_active=str(doc.last_active) if doc.last_active else None,
    )
```

---

### MODIFIED: `backend/app/core/database.py`

```python
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.models.employability_score import EmployabilityScore
from app.models.roadmap import StudentRoadmap
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.student_streak import StudentStreak
from app.core.config import settings

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
        ]
    )

    # Indexes
    await User.get_motor_collection().create_index("email", unique=True)
    await User.get_motor_collection().create_index("google_id", sparse=True)
    await EmployabilityScore.get_motor_collection().create_index("student_id", unique=True)
    await StudentRoadmap.get_motor_collection().create_index("student_id", unique=True)
    await Notification.get_motor_collection().create_index(
        [("student_id", 1), ("created_at", -1)]
    )
    await ActivityLog.get_motor_collection().create_index(
        [("student_id", 1), ("created_at", -1)]
    )
    await StudentStreak.get_motor_collection().create_index("student_id", unique=True)

    print("🚀 Database Successfully Connected")


async def close_db():
    if client:
        client.close()
        print("❌ Database Connection Closed")
```

---

### MODIFIED: `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.core.config import settings

from app.api.routes.auth import router as auth_router
from app.api.routes.students import router as students_router
from app.api.routes.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
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

# REST routers
app.include_router(auth_router, prefix="/v1")
app.include_router(students_router, prefix="/v1")

# WebSocket router (no /v1 prefix — path: /ws/student/{id})
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
```

---

## FRONTEND

---

### `frontend/src/store/dashboardStore.ts`

```typescript
import { create } from "zustand";

export interface ScoreComponents {
  resume_quality: number;
  assessment_score: number;
  project_strength: number;
  interview_readiness: number;
  activity_consistency: number;
}

export interface ScoreHistoryItem {
  score: number;
  recorded_at: string;
}

export interface EmployabilityScore {
  student_id: string;
  overall_score: number;
  components: ScoreComponents;
  target_role: string | null;
  last_updated: string;
  history: ScoreHistoryItem[];
  is_empty: boolean;
}

export interface RoadmapSummary {
  student_id: string;
  resume_uploaded: boolean;
  role: string | null;
  progress_pct: number;
  total_skills: number;
  completed_skills: number;
  next_skill: string | null;
  last_regenerated: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active: string | null;
}

interface DashboardState {
  score: EmployabilityScore | null;
  roadmapSummary: RoadmapSummary | null;
  notifications: NotificationItem[];
  unreadCount: number;
  activity: ActivityItem[];
  streak: StreakData | null;
  isLoading: boolean;
  error: string | null;

  setScore: (s: EmployabilityScore) => void;
  setRoadmapSummary: (r: RoadmapSummary) => void;
  setNotifications: (items: NotificationItem[], unreadCount: number) => void;
  setActivity: (a: ActivityItem[]) => void;
  setStreak: (s: StreakData) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  markAllRead: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  score: null,
  roadmapSummary: null,
  notifications: [],
  unreadCount: 0,
  activity: [],
  streak: null,
  isLoading: false,
  error: null,

  setScore: (score) => set({ score }),
  setRoadmapSummary: (roadmapSummary) => set({ roadmapSummary }),
  setNotifications: (notifications, unreadCount) =>
    set({ notifications, unreadCount }),
  setActivity: (activity) => set({ activity }),
  setStreak: (streak) => set({ streak }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}));
```

---

### `frontend/src/lib/dashboard.ts`

```typescript
import api from "./api";
import type {
  EmployabilityScore,
  RoadmapSummary,
  NotificationItem,
  ActivityItem,
  StreakData,
} from "@/store/dashboardStore";

interface NotificationsResponse {
  unread_count: number;
  items: NotificationItem[];
}

export async function fetchScore(): Promise<EmployabilityScore> {
  const { data } = await api.get<EmployabilityScore>("/students/me/score");
  return data;
}

export async function fetchRoadmapSummary(): Promise<RoadmapSummary> {
  const { data } = await api.get<RoadmapSummary>("/students/me/roadmap-summary");
  return data;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>(
    "/students/me/notifications?limit=20"
  );
  return data;
}

export async function fetchActivity(limit = 5): Promise<ActivityItem[]> {
  const { data } = await api.get<ActivityItem[]>(
    `/students/me/activity?limit=${limit}`
  );
  return data;
}

export async function fetchStreak(): Promise<StreakData> {
  const { data } = await api.get<StreakData>("/students/me/streak");
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/students/me/notifications/mark-all-read");
}
```

---

### `frontend/src/hooks/useWebSocket.ts`

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import type { EmployabilityScore, NotificationItem } from "@/store/dashboardStore";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

interface WsState {
  isConnected: boolean;
}

export function useWebSocket(userId: string | undefined): WsState {
  const { accessToken } = useAuthStore();
  const { setScore, setNotifications } = useDashboardStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!userId || !accessToken) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE}/ws/student/${userId}?token=${accessToken}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      retryRef.current = 0;
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
      ws.addEventListener("close", () => clearInterval(ping));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "score_update") {
          const updatedScore = msg.payload as Partial<EmployabilityScore>;
          const current = useDashboardStore.getState().score;
          if (current) {
            setScore({
              ...current,
              overall_score: updatedScore.overall_score ?? current.overall_score,
              components: updatedScore.components ?? current.components,
              last_updated: updatedScore.last_updated ?? current.last_updated,
              is_empty: (updatedScore.overall_score ?? 0) === 0,
            });
          }
        }

        if (msg.type === "notification") {
          const newNotif = msg.payload as NotificationItem;
          const s = useDashboardStore.getState();
          setNotifications(
            [newNotif, ...s.notifications].slice(0, 20),
            s.unreadCount + 1
          );
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (retryRef.current < 5) {
        const delay = Math.pow(2, retryRef.current) * 1000;
        retryRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => ws.close();
  }, [userId, accessToken, setScore, setNotifications]);

  useEffect(() => {
    connect();
    return () => {
      retryTimerRef.current && clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected };
}
```

---

### `frontend/src/components/student/ScoreGauge.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  isLoading?: boolean;
}

function getColor(score: number): string {
  if (score >= 75) return "#0ea5e9"; // sky-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#f87171";                   // red-400
}

function getLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Average";
  if (score > 0)  return "Needs Work";
  return "No Score Yet";
}

export function ScoreGauge({ score, isLoading = false }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    let frame: number;
    let current = 0;
    const step = () => {
      current = Math.min(current + 1, score);
      setDisplayScore(current);
      if (current < score) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score, isLoading]);

  const SIZE = 200;
  const STROKE = 14;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const ARC = CIRCUMFERENCE * 0.75;        // 270° sweep
  const filled = (displayScore / 100) * ARC;
  const color = getColor(displayScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-[135deg]"
        >
          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="#e2e8f0" strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE - ARC}`}
          />
          {/* Fill */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke={color} strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            style={{ transition: "stroke-dasharray 0.05s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
          ) : (
            <>
              <span className="text-5xl font-bold tabular-nums" style={{ color }}>
                {displayScore}
              </span>
              <span className="text-sm text-slate-400 mt-1">/ 100</span>
            </>
          )}
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600">
        {isLoading ? "Loading..." : getLabel(displayScore)}
      </span>
    </div>
  );
}
```

---

### `frontend/src/components/student/ComingSoon.tsx`

```tsx
"use client";

import { Clock, LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function ComingSoon({ title, description, icon: Icon = Clock }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
        <Icon className="w-10 h-10 text-sky-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        <p className="text-slate-500 max-w-md">
          {description ?? "This feature is actively being built. Check back soon!"}
        </p>
      </div>
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
        <Clock className="w-4 h-4" />
        Coming Soon
      </span>
    </div>
  );
}
```

---

### `frontend/src/app/student/layout.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { logout } from "@/lib/auth";
import {
  LayoutDashboard,
  TrendingUp,
  Map,
  Building2,
  Activity,
  Briefcase,
  Bell,
  FolderOpen,
  FlaskConical,
  Video,
  CalendarCheck,
  Trophy,
  UserCircle,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Overview",           href: "/student/overview",           icon: LayoutDashboard },
  { label: "Skill Gap",          href: "/student/skill-gap",          icon: TrendingUp },
  { label: "Learning Roadmap",   href: "/student/roadmap",            icon: Map },
  { label: "Target Company",     href: "/student/target-company",     icon: Building2 },
  { label: "My Activity",        href: "/student/activity",           icon: Activity },
  { label: "Jobs Hub",           href: "/student/jobs",               icon: Briefcase },
  { label: "Notifications",      href: "/student/notifications",      icon: Bell, showBadge: true },
  { label: "Projects",           href: "/student/projects",           icon: FolderOpen },
  { label: "Skill Tests",        href: "/student/skill-tests",        icon: FlaskConical },
  { label: "Mock Interview",     href: "/student/mock-interview",     icon: Video },
  { label: "Daily Assignments",  href: "/student/daily-assignments",  icon: CalendarCheck },
  { label: "Leaderboard",        href: "/student/leaderboard",        icon: Trophy },
  { label: "My Profile",         href: "/student/profile",            icon: UserCircle },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount } = useDashboardStore();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("") ?? "S";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-slate-200 flex flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            Skill<span className="text-sky-600">Dipz</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
          <ul className="space-y-0.5 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const badge = item.showBadge && unreadCount > 0 ? unreadCount : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                      ${isActive
                        ? "bg-sky-50 text-sky-700 border-l-[3px] border-sky-500 pl-[9px]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }
                    `}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge !== undefined && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-sky-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {user?.full_name ?? "Student"}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 flex-1 min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
```

---

### `frontend/src/app/student/overview/page.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  fetchScore,
  fetchRoadmapSummary,
  fetchNotifications,
  fetchActivity,
  fetchStreak,
  markAllNotificationsRead,
  uploadResume,
} from "@/lib/dashboard";
import { ScoreGauge } from "@/components/student/ScoreGauge";
import {
  Activity,
  Bell,
  BellOff,
  BookOpen,
  Building2,
  ChevronRight,
  Circle,
  ClipboardList,
  CheckCircle2,
  Code2,
  Flame,
  Loader2,
  Map,
  Upload,
  UserCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  switch (type) {
    case "submission":  return <Code2        className={`${cls} text-emerald-500`} />;
    case "assessment":  return <ClipboardList className={`${cls} text-sky-500`} />;
    case "shortlist":   return <Building2    className={`${cls} text-purple-500`} />;
    case "module":      return <BookOpen     className={`${cls} text-amber-500`} />;
    case "interview":   return <UserCircle   className={`${cls} text-rose-500`} />;
    case "project":     return <CheckCircle2 className={`${cls} text-teal-500`} />;
    default:            return <Circle       className={`${cls} text-slate-400`} />;
  }
}

const SCORE_LABELS: Record<string, { label: string; weight: string }> = {
  resume_quality:       { label: "Resume Quality",  weight: "20%" },
  assessment_score:     { label: "Assessments",     weight: "30%" },
  project_strength:     { label: "Projects",        weight: "15%" },
  interview_readiness:  { label: "Mock Interviews", weight: "20%" },
  activity_consistency: { label: "Consistency",     weight: "15%" },
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

// ─── Upload state ─────────────────────────────────────────────────────────────

type UploadStatus = "idle" | "uploading" | "success" | "error";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { user } = useAuthStore();
  const {
    score, roadmapSummary, notifications, unreadCount,
    activity, streak, isLoading, error,
    setScore, setRoadmapSummary, setNotifications,
    setActivity, setStreak, setLoading, setError, markAllRead,
  } = useDashboardStore();

  const { isConnected } = useWebSocket(user?.id);

  // ─── Resume upload state ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, r, n, a, st] = await Promise.all([
          fetchScore(),
          fetchRoadmapSummary(),
          fetchNotifications(),
          fetchActivity(5),
          fetchStreak(),
        ]);
        setScore(s);
        setRoadmapSummary(r);
        setNotifications(n.items, n.unread_count);
        setActivity(a);
        setStreak(st);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllRead = async () => {
    markAllRead();
    await markAllNotificationsRead();
  };

  // ─── Resume upload handlers ───────────────────────────────────────────────
  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF or Word documents are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5 MB.");
      return;
    }

    setUploadStatus("uploading");
    setUploadError(null);
    try {
      await uploadResume(file);
      const r = await fetchRoadmapSummary();
      setRoadmapSummary(r);
      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 3000);
    } catch (err: unknown) {
      setUploadStatus("error");
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setTimeout(() => setUploadStatus("idle"), 4000);
    }
  };

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const uploadBtnLabel: Record<UploadStatus, string> = {
    idle:      "Upload Resume",
    uploading: "Uploading…",
    success:   "Uploaded ✓",
    error:     "Try Again",
  };

  const uploadBtnClass = [
    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border",
    "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1",
    uploadStatus === "success"
      ? "bg-emerald-50 border-emerald-300 text-emerald-700 focus:ring-emerald-400"
      : uploadStatus === "error"
      ? "bg-red-50 border-red-300 text-red-700 focus:ring-red-400"
      : "bg-sky-600 border-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 focus:ring-sky-500",
  ].join(" ");

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric",
              month: "long", day: "numeric",
            })}
          </p>
        </div>

        {/* Right-side header actions */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {/* Streak badge */}
            {streak && streak.current_streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">
                  {streak.current_streak}-day streak
                </span>
              </div>
            )}

            {/* Live / Offline badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                isConnected
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? "Live" : "Offline"}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Upload Resume button */}
            <button
              id="upload-resume-btn"
              onClick={handleUploadClick}
              disabled={uploadStatus === "uploading"}
              className={uploadBtnClass}
            >
              {uploadStatus === "uploading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploadBtnLabel[uploadStatus]}
            </button>
          </div>

          {/* Inline feedback */}
          {uploadError && (
            <p className="text-xs text-red-600 max-w-[260px] text-right leading-tight">
              {uploadError}
            </p>
          )}
          {!uploadError && roadmapSummary && !roadmapSummary.resume_uploaded && uploadStatus === "idle" && (
            <p className="text-xs text-slate-400">Upload to generate your roadmap</p>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-12 gap-6">

        {/* ── Score Column (4 cols) ───────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          {/* Gauge Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Employability Score</h2>
                {score?.target_role && (
                  <p className="text-xs text-slate-400 mt-0.5">Target: {score.target_role}</p>
                )}
              </div>
              {score?.last_updated && (
                <span className="text-xs text-slate-400">
                  Updated {timeAgo(score.last_updated)}
                </span>
              )}
            </div>

            <div className="flex justify-center">
              <ScoreGauge score={score?.overall_score ?? 0} isLoading={isLoading} />
            </div>

            {!isLoading && score?.is_empty && (
              <div className="mt-4 p-3 bg-sky-50 border border-sky-100 rounded-xl text-center">
                <p className="text-xs text-sky-700 font-medium">
                  Complete activities to build your score
                </p>
                <p className="text-xs text-sky-500 mt-1">
                  Take an assessment, submit a project, or do a mock interview
                </p>
              </div>
            )}
          </div>

          {/* Breakdown Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Score Breakdown</h2>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-28 mb-1.5" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : score ? (
              <div className="space-y-4">
                {Object.entries(SCORE_LABELS).map(([key, meta]) => {
                  const val = score.components[key as keyof typeof score.components];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700">{meta.label}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            {meta.weight}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {val.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-700"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Middle Column (5 cols) ──────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-5 space-y-6">

          {/* Roadmap Summary Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-semibold text-slate-800">Learning Roadmap</h2>
              </div>
              <Link
                href="/student/roadmap"
                className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ) : !roadmapSummary?.resume_uploaded ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-sky-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Upload your resume first</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Your personalised roadmap is generated from your resume skills vs. your target role requirements.
                  </p>
                </div>
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Resume
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {/* Progress ring */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="-rotate-90 w-16 h-16" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r="26" fill="none" stroke="#0ea5e9" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(roadmapSummary.progress_pct / 100) * 163.4} 163.4`}
                        style={{ transition: "stroke-dasharray 0.8s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-slate-800">
                        {roadmapSummary.progress_pct}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {roadmapSummary.completed_skills} / {roadmapSummary.total_skills} skills
                    </p>
                    {roadmapSummary.role && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Role: <span className="font-medium text-slate-700">{roadmapSummary.role}</span>
                      </p>
                    )}
                    {roadmapSummary.next_skill && (
                      <p className="text-xs text-sky-600 mt-1 font-medium">
                        Up next: {roadmapSummary.next_skill}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href="/student/roadmap"
                  className="block w-full py-2.5 text-center text-sm font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
                >
                  Continue Learning →
                </Link>
              </div>
            )}
          </div>

          {/* Notifications Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-slate-500 hover:text-sky-600 font-medium flex items-center gap-1 transition-colors"
                >
                  <BellOff className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bell className="w-8 h-8 text-slate-300" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <li
                    key={notif.id}
                    className={`flex gap-3 p-2 rounded-lg transition-colors ${!notif.is_read ? "bg-sky-50" : ""}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        !notif.is_read ? "bg-sky-500" : "bg-slate-300"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{notif.title}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{notif.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {notifications.length > 5 && (
              <Link
                href="/student/notifications"
                className="mt-3 block text-center text-xs text-sky-600 hover:text-sky-700 font-medium"
              >
                View all notifications →
              </Link>
            )}
          </div>
        </div>

        {/* ── Activity Column (3 cols) ────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
              <Link
                href="/student/activity"
                className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Activity className="w-8 h-8 text-slate-300" />
                <p className="text-sm text-slate-400">No activity yet</p>
                <p className="text-xs text-slate-400 max-w-[160px]">
                  Take a test, submit a project, or practice coding to start
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                      <ActivityIcon type={item.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 leading-snug">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.detail}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(item.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Coming Soon Pages (all 12)

**`frontend/src/app/student/skill-gap/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { TrendingUp } from "lucide-react";
export default function SkillGapPage() {
  return <ComingSoon title="Skill Gap Analysis" icon={TrendingUp}
    description="See exactly which skills you're missing for your target role — with personalised suggestions to close each gap." />;
}
```

**`frontend/src/app/student/roadmap/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Map } from "lucide-react";
export default function RoadmapPage() {
  return <ComingSoon title="Learning Roadmap" icon={Map}
    description="Your AI-generated, week-by-week personalised learning plan based on your skill gaps and target role." />;
}
```

**`frontend/src/app/student/target-company/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Building2 } from "lucide-react";
export default function TargetCompanyPage() {
  return <ComingSoon title="Target Company" icon={Building2}
    description="Auto-matched companies based on your skills, score, and target role — with interview round details." />;
}
```

**`frontend/src/app/student/activity/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Activity } from "lucide-react";
export default function ActivityPage() {
  return <ComingSoon title="My Activity" icon={Activity}
    description="Your full history of submissions, test scores, projects, shortlists, and streak calendar." />;
}
```

**`frontend/src/app/student/jobs/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Briefcase } from "lucide-react";
export default function JobsPage() {
  return <ComingSoon title="Jobs Hub" icon={Briefcase}
    description="Active job listings from verified companies, auto-matched to your profile with a match percentage." />;
}
```

**`frontend/src/app/student/notifications/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Bell } from "lucide-react";
export default function NotificationsPage() {
  return <ComingSoon title="Notifications" icon={Bell}
    description="All your alerts — shortlists, score updates, new job openings, and platform messages." />;
}
```

**`frontend/src/app/student/projects/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { FolderOpen } from "lucide-react";
export default function ProjectsPage() {
  return <ComingSoon title="Projects" icon={FolderOpen}
    description="Company-assigned project briefs. Submit your GitHub repo and get NLP-evaluated scores." />;
}
```

**`frontend/src/app/student/skill-tests/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { FlaskConical } from "lucide-react";
export default function SkillTestsPage() {
  return <ComingSoon title="Skill Tests & Code Practice" icon={FlaskConical}
    description="MCQ assessments for your role + Codeforces-powered coding problems, all in one tab." />;
}
```

**`frontend/src/app/student/mock-interview/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Video } from "lucide-react";
export default function MockInterviewPage() {
  return <ComingSoon title="Mock Interview" icon={Video}
    description="AI-powered webcam interview sessions with real-time feedback on your answers and communication." />;
}
```

**`frontend/src/app/student/daily-assignments/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { CalendarCheck } from "lucide-react";
export default function DailyAssignmentsPage() {
  return <ComingSoon title="Daily Assignments" icon={CalendarCheck}
    description="Platform-assigned daily tasks to keep your streak alive and push your score forward." />;
}
```

**`frontend/src/app/student/leaderboard/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { Trophy } from "lucide-react";
export default function LeaderboardPage() {
  return <ComingSoon title="Leaderboard" icon={Trophy}
    description="See how you rank among peers targeting the same role — filtered by score, college, and more." />;
}
```

**`frontend/src/app/student/profile/page.tsx`**
```tsx
import { ComingSoon } from "@/components/student/ComingSoon";
import { UserCircle } from "lucide-react";
export default function ProfilePage() {
  return <ComingSoon title="My Profile" icon={UserCircle}
    description="Manage your resume, skills, target role, visibility to companies, and certificates." />;
}
```

---

### MODIFIED: `frontend/src/hooks/useAuth.ts`

Bug fix — `next/router` → `next/navigation` (App Router):

```typescript
import { getRedirectPath, logout } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";   // ← FIXED: was "next/router"

export function useAuth() {
    const { user, accessToken, isLoading, clearAuth } = useAuthStore();
    const router = useRouter();

    const isAuthenticated = !!accessToken && !!user;

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const redirectAfterLogin = (role: string) => {
        router.push(getRedirectPath(role));
    };

    return {
        user,
        isAuthenticated,
        isLoading,
        handleLogout,
        redirectAfterLogin,
    };
}
```

---

### `frontend/.env` — Add WebSocket URL

```
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Summary table

| File | Status |
|------|--------|
| `backend/app/models/employability_score.py` | NEW |
| `backend/app/models/roadmap.py` | NEW |
| `backend/app/models/notification.py` | NEW |
| `backend/app/models/activity_log.py` | NEW |
| `backend/app/models/student_streak.py` | NEW |
| `backend/app/core/ws_manager.py` | NEW |
| `backend/app/api/routes/students.py` | NEW |
| `backend/app/api/routes/ws.py` | NEW |
| `backend/app/core/database.py` | MODIFIED |
| `backend/main.py` | MODIFIED |
| `frontend/src/store/dashboardStore.ts` | NEW |
| `frontend/src/lib/dashboard.ts` | NEW |
| `frontend/src/hooks/useWebSocket.ts` | NEW |
| `frontend/src/components/student/ScoreGauge.tsx` | NEW |
| `frontend/src/components/student/ComingSoon.tsx` | NEW |
| `frontend/src/app/student/layout.tsx` | NEW |
| `frontend/src/app/student/overview/page.tsx` | MODIFIED (was empty) |
| `frontend/src/app/student/skill-gap/page.tsx` | NEW |
| `frontend/src/app/student/roadmap/page.tsx` | NEW |
| `frontend/src/app/student/target-company/page.tsx` | NEW |
| `frontend/src/app/student/activity/page.tsx` | NEW |
| `frontend/src/app/student/jobs/page.tsx` | NEW |
| `frontend/src/app/student/notifications/page.tsx` | NEW |
| `frontend/src/app/student/projects/page.tsx` | NEW |
| `frontend/src/app/student/skill-tests/page.tsx` | NEW |
| `frontend/src/app/student/mock-interview/page.tsx` | NEW |
| `frontend/src/app/student/daily-assignments/page.tsx` | NEW |
| `frontend/src/app/student/leaderboard/page.tsx` | NEW |
| `frontend/src/app/student/profile/page.tsx` | NEW |
| `frontend/src/hooks/useAuth.ts` | MODIFIED (bug fix) |
| `frontend/.env` | MODIFIED (add WS URL) |

---
