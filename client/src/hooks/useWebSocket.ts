import { useState, useEffect, useRef, useCallback } from 'react';
import { WSMessage } from '../game/types';

interface UseWebSocketReturn {
  send: (message: WSMessage) => void;
  connected: boolean;
  lastMessage: WSMessage | null;
  messageHistory: WSMessage[];
}

export function useWebSocket(url?: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [messageHistory, setMessageHistory] = useState<WSMessage[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const urlRef = useRef<string>(url || '');

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Determine WebSocket URL
    const wsUrl = urlRef.current
      || (typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
        : 'ws://localhost:3001/ws');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          console.log('[WS] Connected');
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          setMessageHistory(prev => [...prev.slice(-99), message]);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        if (mountedRef.current) {
          setConnected(false);
          console.log('[WS] Disconnected:', event.code, event.reason);
          // Auto-reconnect after 2 seconds
          if (!event.wasClean) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                console.log('[WS] Reconnecting...');
                connect();
              }
            }, 2000);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      // Retry after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, 2000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    urlRef.current = url || '';
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, connect]);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send, socket not open');
    }
  }, []);

  return { send, connected, lastMessage, messageHistory };
}
