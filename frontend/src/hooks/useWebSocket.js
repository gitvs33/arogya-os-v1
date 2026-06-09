import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Generic WebSocket hook with automatic reconnection.
 * Pass null/empty url to skip connecting (e.g. when not authenticated).
 */
export function useWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    // Don't connect if url is null/empty or component unmounted
    if (!url || isUnmountedRef.current) return;

    // Close existing socket cleanly
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on intentional close
      wsRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Get auth token from sessionStorage
    const token = sessionStorage.getItem('medos_token');

    // Build WebSocket URL with auth token as query param
    const wsUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        setLastMessage(event);
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);

        // Exponential backoff reconnect (max 30s)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [url]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  /** Send a string or JSON-serialisable object through the socket. */
  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
}
