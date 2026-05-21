/**
 * lib/ws.ts – WebSocket client hook with auto-reconnect and event dispatch.
 */
"use client";
import { useEffect, useRef } from "react";
import { WSMessage } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

type EventHandler = (payload: Record<string, unknown>) => void;

export function useRoomWebSocket(
  roomId: string | null,
  handlers: Record<string, EventHandler>,
  onOpen?: () => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectCount = useRef(0);
  const unmounted = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = () => {
    if (!roomId || unmounted.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;

    try {
      const url = `${WS_URL}/ws/${roomId}?token=${token}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          const handler = handlersRef.current[msg.event];
          if (handler) handler(msg.payload);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmounted.current) return;
        if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectCount.current++;
          timeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCount.current++;
        timeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    }
  };

  useEffect(() => {
    unmounted.current = false;
    if (roomId) {
      connect();
    }
    return () => {
      unmounted.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId]);

  return wsRef;
}
