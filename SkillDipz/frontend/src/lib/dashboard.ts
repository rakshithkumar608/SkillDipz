import { ActivityItem, EmployabilityScore, NotificationItem, RoadmapSummary, StreakData } from "@/store/dashboardStore";
import api from "./api";


interface NotificationsResponse {
    unread_count: number;
    items: NotificationItem[];
}

export async function fetchScore():
Promise<EmployabilityScore> {
    const {data} = await api.get<EmployabilityScore>("/students/me/score");
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

/**
 * Upload a student's resume (PDF / DOC / DOCX).
 * The backend endpoint is POST /students/me/resume (multipart/form-data).
 * Throws an Error with a human-readable message on failure.
 */
export async function uploadResume(file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  await api.post("/students/me/resume", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}