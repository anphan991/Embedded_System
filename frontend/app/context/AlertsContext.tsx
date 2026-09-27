"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export interface AlertPayload {
  id: string;
  timestamp: string;
  message: string;
  eventCode: string;
  acknowledged?: boolean;
}

interface AlertsContextType {
  alerts: AlertPayload[];
  isConnected: boolean;
  acknowledgeAlert: (id: string) => void;
  acknowledgeMultiple: (ids: string[]) => void;
  clearAlerts: () => void;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    const initializeWebSocket = () => {
      if (!isMounted) return;
      
      // Dynamically determine WebSocket URL for Tailscale support
      let backendHost = "";
      const saved = localStorage.getItem('fallguard_settings');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.serverUrl) {
            backendHost = data.serverUrl.replace(/^https?:\/\//, "").replace(/\/api\/v1\/?$/, "");
          }
        } catch (e) {}
      }
      if (!backendHost) {
        backendHost = `${window.location.hostname}:8000`;
      }

      wsRef.current = new WebSocket(`ws://${backendHost}/api/v1/ws/alerts`);
      
      wsRef.current.onopen = () => { if (isMounted) setIsConnected(true); };
      
      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "SYSTEM_ERROR" && isMounted) {
            setIsConnected(false);
            return;
          }
          if (data.type === "CRITICAL_ALERT" && isMounted) {
            const formattedTime = new Date(data.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false });
            const newAlert: AlertPayload = {
              id: Math.random().toString(36).substr(2, 9) + Date.now(),
              timestamp: formattedTime,
              message: data.message,
              eventCode: data.event_code,
              acknowledged: false,
            };
            setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
          }
        } catch (error) {}
      };
      
      wsRef.current.onclose = () => {
        if (isMounted) {
          setIsConnected(false);
          reconnectTimeout = setTimeout(initializeWebSocket, 3000);
        }
      };
    };

    initializeWebSocket();
    
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const acknowledgeMultiple = (ids: string[]) => {
    const idSet = new Set(ids);
    setAlerts(prev => prev.map(a => idSet.has(a.id) ? { ...a, acknowledged: true } : a));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  return (
    <AlertsContext.Provider value={{ alerts, isConnected, acknowledgeAlert, acknowledgeMultiple, clearAlerts }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error("useAlerts must be used within an AlertsProvider");
  }
  return context;
}
