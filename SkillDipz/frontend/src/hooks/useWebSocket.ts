"use client";

import { useAuthStore } from "@/store/authStore";
import {
  EmployabilityScore,
  NotificationItem,
  useDashboardStore,
} from "@/store/dashboardStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1").replace(/^http/, "ws");

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
              overall_score:
                updatedScore.overall_score ?? current.overall_score,
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
            s.unreadCount + 1,
          );

          // Show prominent toast for company interview schedules & alerts
          if (
            newNotif.type === "interview_scheduled" ||
            (newNotif as any).notification_type === "interview_scheduled"
          ) {
            toast.success(`🎯 ${newNotif.title}`, {
              description: newNotif.body,
              duration: 8000,
              action: {
                label: "View Interview",
                onClick: () =>
                  (window.location.href =
                    newNotif.action_url || "/student/mock-interview"),
              },
            });
          } else if (
            newNotif.type === "interview_terminated" ||
            (newNotif as any).notification_type === "interview_terminated"
          ) {
            toast.error(`⚠️ ${newNotif.title}`, {
              description: newNotif.body,
              duration: 8000,
            });
          } else {
            toast.info(newNotif.title, {
              description: newNotif.body,
              duration: 5000,
            });
          }
        }

        if (msg.type === "new_project_group") {
          const { creator_name, title } = msg.payload as {
            creator_name: string;
            title: string;
            project_id: string;
          };
          toast.info(`🚀 ${creator_name} just created a project group: "${title}"`, {
            description: "Head to Projects to collaborate!",
            duration: 6000,
            action: {
              label: "View",
              onClick: () => window.location.href = "/student/projects",
            },
          });
        }

        if (msg.type === "member_joined_project") {
          const { joiner_name, title } = msg.payload as {
            joiner_name: string;
            title: string;
            project_id: string;
          };
          toast.success(`👋 ${joiner_name} joined your project "${title}"`, {
            duration: 5000,
          });
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

  return {
    isConnected,
  };
}
