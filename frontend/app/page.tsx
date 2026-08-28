"use client";

import { useEffect, useState, useRef } from "react";

// Strict Typing for Alert Payload
interface AlertPayload {
  timestamp: string;
  message: string;
  eventCode: string;
}

export default function SurveillanceDashboard() {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Establishing connection...");
  
  // WebSocket Reference Management
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    // Initialize WebSocket connection to AI Backend Server
    const initializeWebSocket = () => {
      if (!isMounted) return;

      wsRef.current = new WebSocket("ws://localhost:8000/api/v1/ws/alerts");

      wsRef.current.onopen = () => {
        if (isMounted) setConnectionStatus("Connected to AI Server");
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "CRITICAL_ALERT" && isMounted) {
            const formattedTime = new Date(data.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false });
            
            const newAlert: AlertPayload = {
              timestamp: formattedTime,
              message: data.message,
              eventCode: data.event_code,
            };
            
            setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
          }
        } catch (error) {
          console.error("WebSocket data parsing error:", error);
        }
      };

      wsRef.current.onclose = () => {
        if (isMounted) {
          setConnectionStatus("Connection lost. Reconnecting...");
          reconnectTimeout = setTimeout(initializeWebSocket, 3000);
        }
      };
      
      wsRef.current.onerror = (error) => {
        if (isMounted) console.error("WebSocket protocol error:", error);
      };
    };

    initializeWebSocket();

    // Cleanup function to prevent memory leaks and strict-mode loops
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Vô hiệu hóa tính năng tự động kết nối lại khi component bị hủy
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-cyan-400">
          Surveillance & Target Tracking System
        </h1>
        <div className="flex items-center gap-3">
          <span 
            className={`h-3 w-3 rounded-full ${
              connectionStatus.includes("Connected") ? "bg-emerald-500" : "bg-rose-500"
            }`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium tracking-wide">
            {connectionStatus}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Live Video Feed Section */}
        <section className="lg:col-span-2 bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700">
          <h2 className="text-lg font-medium mb-4 text-slate-300 border-b border-slate-700 pb-2">
            Live Video Feed
          </h2>
          <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-900 shadow-inner">
            {/* MJPEG Stream Integration */}
            <img 
              src="http://127.0.0.1:8000/api/v1/video/stream" 
              alt="Live Surveillance Feed"
              className="w-full h-full object-contain"
            />
          </div>
        </section>

        {/* Security Event Logs Section */}
        <section className="bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700 h-[600px] flex flex-col">
          <h2 className="text-lg font-medium mb-4 text-rose-400 border-b border-slate-700 pb-2">
            Security Event Logs
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-600">
            {alerts.length === 0 ? (
              <p className="text-slate-400 text-center mt-10 text-sm">
                System operating normally. No events recorded.
              </p>
            ) : (
              alerts.map((alert, idx) => (
                <article 
                  key={idx} 
                  className="bg-slate-700/40 p-4 rounded-lg border-l-4 border-rose-500 flex justify-between items-start shadow-sm"
                >
                  <div>
                    <p className="font-semibold text-rose-300 text-sm">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{alert.timestamp}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider bg-rose-500/10 text-rose-400 px-2 py-1 rounded border border-rose-500/20">
                    Severity: High
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
