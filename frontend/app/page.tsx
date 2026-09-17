"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface AlertPayload {
  timestamp: string;
  message: string;
  eventCode: string;
}

export default function SurveillanceDashboard() {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    // Initialize WebSocket connection to AI Backend Server
    const initializeWebSocket = () => {
      if (!isMounted) return;

      wsRef.current = new WebSocket("ws://localhost:8000/api/v1/ws/alerts");

      wsRef.current.onopen = () => {
        if (isMounted) setIsConnected(true);
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Xử lý báo lỗi phần cứng từ Watchdog
          if (data.type === "SYSTEM_ERROR" && isMounted) {
            setIsConnected(false);
            console.warn(data.message);
            return;
          }
          
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
          setIsConnected(false);
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
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-200 font-sans selection:bg-red-500/30">
      
      {/* Header Minimalist */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Status Indicator (Glowing Orb) */}
          <div 
            className={`w-2.5 h-2.5 rounded-full shadow-lg transition-colors duration-500 ${
              isConnected 
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' 
                : 'bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.6)] animate-pulse'
            }`} 
          />
          <h1 className="text-sm font-semibold tracking-widest text-gray-100 uppercase">
            Surveillance AI
          </h1>
        </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/vitals"
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded transition"
            >
              MEDICAL DASHBOARD ↗
            </Link>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              {isConnected ? "SYSTEM ONLINE" : "RECONNECTING..."}
            </div>
          </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-[1800px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left/Main Column: Video Feed */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl">
            {/* Fallback "No Signal" background */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-800 font-mono text-sm tracking-widest">NO SIGNAL DETECTED</span>
            </div>
            
            {/* Live MJPEG Stream */}
            <img 
              src="http://localhost:8000/api/v1/video/stream" 
              alt="Live Camera Feed"
              className="relative z-10 w-full h-full object-contain"
              onError={(e) => (e.currentTarget.style.opacity = '0')}
              onLoad={(e) => (e.currentTarget.style.opacity = '1')}
              style={{ transition: 'opacity 0.3s ease-in-out' }}
            />
          </div>
        </div>

        {/* Right Column: Event Logs */}
        <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Incident Logs</h2>
            <span className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded text-gray-400">
              {alerts.length} EVENTS
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-32 border border-dashed border-white/5 rounded-lg text-gray-600 text-xs tracking-wide">
                No anomalies detected.
              </div>
            ) : (
              alerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className="bg-rose-950/10 border border-rose-500/20 rounded-lg p-3 hover:bg-rose-950/20 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-rose-400 font-mono text-[11px]">{alert.timestamp}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded">
                      {alert.eventCode}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 font-medium leading-relaxed">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
        
      </main>
    </div>
  );
}
