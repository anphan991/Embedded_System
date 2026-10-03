"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getBackendBaseUrl, SETTINGS_CHANGED_EVENT } from "../backendUrl";

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
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const initializeWebSocket = () => {
      if (!isMounted) return;
      
      const backendUrl = new URL(getBackendBaseUrl());
      const wsProtocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${wsProtocol}//${backendUrl.host}/api/v1/ws/alerts`);
      wsRef.current = socket;
      
      socket.onopen = () => { if (isMounted && wsRef.current === socket) setIsConnected(true); };
      
      socket.onmessage = (event: MessageEvent) => {
        if (!isMounted || wsRef.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "SYSTEM_ERROR" && isMounted) {
            setIsConnected(false);
            return;
          }
          if (data.type === "SYSTEM_OK" && isMounted) {
            setIsConnected(true);
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
        } catch {}
      };
      
      socket.onclose = () => {
        if (isMounted && wsRef.current === socket) {
          setIsConnected(false);
          reconnectTimeout = setTimeout(initializeWebSocket, 3000);
        }
      };
    };

    const reconnectForSettings = () => {
      clearTimeout(reconnectTimeout);
      const oldSocket = wsRef.current;
      wsRef.current = null;
      oldSocket?.close();
      setIsConnected(false);
      initializeWebSocket();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "fallguard_settings") reconnectForSettings();
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, reconnectForSettings);
    window.addEventListener("storage", onStorage);
    initializeWebSocket();
    
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, reconnectForSettings);
      window.removeEventListener("storage", onStorage);
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
