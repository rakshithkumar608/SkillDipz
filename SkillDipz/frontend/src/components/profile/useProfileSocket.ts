import { useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

export type WsEvent =
  | { type: "score_update";    payload: { overall_score: number; components: Record<string, number> } }
  | { type: "profile_updated"; payload: { completeness_pct: number; avatar_url?: string } }
  | { type: "resume_analyzed"; payload: { skills_extracted: string[]; completeness_pct: number; parse_summary: string } };

export function useProfileSocket(
  userId: string | undefined,
  token: string | null,
  onEvent: (e: WsEvent) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!userId || !token || !mountedRef.current) return;

    const url = `${WS_BASE}/ws/student/${userId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
      (ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = ping;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as WsEvent;
        onEvent(data);
      } catch { /* ignore non-JSON */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [userId, token, onEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}