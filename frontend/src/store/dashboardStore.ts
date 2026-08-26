import { create } from "zustand";

export interface ScoreComponents {
  resume_quality: number;
  skill_tests: number;
  practice: number;
  learning_roadmap: number;
  project_strength: number;
  activity_consistency: number;
  assessment_score?: number;
  interview_readiness?: number;
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
  type?: string;
  notification_type?: string;
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