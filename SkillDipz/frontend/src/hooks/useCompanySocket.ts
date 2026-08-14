import { useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

export interface NewCandidateEvent {
  type: "new_candidate";
  payload: {
    student_id: string;
    student_name: string;
    skill_match_pct: number;
    company_id: string;
  };
}

export type CompanyWsEvent = NewCandidateEvent;

export function useCompanySocket(
  userId: string | undefined,
  token: string | null,
  onEvent: (e: CompanyWsEvent) => void,
) {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef     = useRef(true);

  const connect = useCallback(() => {
    if (!userId || !token || !mountedRef.current) return;

    const url = `${WS_BASE}/ws/student/${userId}?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
      (ws as WebSocket & { _ping?: ReturnType<typeof setInterval> })._ping = ping;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as CompanyWsEvent;
        onEvent(data);
      } catch { /* ignore non-JSON (pong etc.) */ }
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
