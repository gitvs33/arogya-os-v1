import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Derive the WebSocket URL from the current page origin so that the Vite
 * dev-server proxy can forward it to the Django backend.
 */
function getAlertWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/alerts/`;
}

/**
 * Subscribe to the real-time alerts WebSocket.
 * Returns the most recently received alert plus helpers.
 *
 * Automatically reconnects on disconnect (handled by useWebSocket).
 */
export function useAlertWebSocket() {
  // Only connect when a token exists – avoids spurious connections on login page
  const token = sessionStorage.getItem('medos_token');
  const wsUrl = token ? getAlertWsUrl() : null;

  const { isConnected, lastMessage, sendMessage } = useWebSocket(wsUrl);
  const [latestAlert, setLatestAlert] = useState(null);

  // Parse every incoming message as an alert
  useEffect(() => {
    if (!lastMessage?.data) return;
    try {
      const alert = JSON.parse(lastMessage.data);
      setLatestAlert(alert);
    } catch (err) {
      console.error('Failed to parse alert WebSocket message:', err, lastMessage.data);
    }
  }, [lastMessage]);

  const clearAlert = useCallback(() => setLatestAlert(null), []);

  /** Acknowledge an alert remotely (optional, if the WS supports it). */
  const acknowledgeAlert = useCallback(
    (alertId) => {
      sendMessage(JSON.stringify({ type: 'acknowledge', alert_id: alertId }));
    },
    [sendMessage],
  );

  return { isConnected, latestAlert, clearAlert, acknowledgeAlert };
}
