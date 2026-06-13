import { useEffect, useRef, useCallback } from 'react';
import { getStoredUser } from '../api/client';

/**
 * WebSocket hook for real-time pharmacy/lab queue updates.
 *
 * Usage:
 *   useQueueWebSocket('pharmacy', (data) => {
 *     // data = { action: 'new'|'cancelled'|'amended'|'medication_cancelled', prescription_id, ... }
 *     queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
 *   });
 */
export function useQueueWebSocket(queueType: 'pharmacy' | 'lab', onMessage: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const user = getStoredUser();
    const hospitalId = user?.hospital_id || user?.hospital;

    if (!hospitalId || isUnmountedRef.current) return;

    // Close existing socket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${queueType}-queue/${hospitalId}/`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch (err) {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        // Exponential backoff reconnect (max 30s)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, will retry
    }
  }, [queueType]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);
}
