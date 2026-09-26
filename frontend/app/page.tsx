"use client";
import React, { useState, useEffect, useRef } from "react";
import CameraControlPanel from "./CameraControlPanel";
import { AlertCircle, Clock, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Maximize, Minimize } from "lucide-react";
import { useAlerts } from "./context/AlertsContext";
import { useTranslation } from "./context/LanguageContext";

export default function SurveillanceDashboard() {
  const { alerts, isConnected, acknowledgeAlert } = useAlerts();
  const { t } = useTranslation();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTime, setLiveTime] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const formatted = now.getFullYear() + "-" + 
        String(now.getMonth() + 1).padStart(2, '0') + "-" + 
        String(now.getDate()).padStart(2, '0') + " " + 
        String(now.getHours()).padStart(2, '0') + ":" + 
        String(now.getMinutes()).padStart(2, '0') + ":" + 
        String(now.getSeconds()).padStart(2, '0');
      setLiveTime(formatted);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err.message);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const getAlertMessage = (alert: any) => {
    const key = `alert.${alert.eventCode}`;
    const translated = t(key);
    return translated !== key ? translated : alert.message;
  };

  return (
    <div className={`flex-1 flex overflow-hidden relative bg-[#f4f5f7] dark:bg-[#0b0f19] transition-colors duration-300`}>
      
      {/* Center: Video Feed */}
      <div className={`flex-1 flex flex-col transition-all duration-300 relative ${isPanelOpen && !isFullscreen ? 'mr-96' : 'mr-0'}`}>
        
        {/* Connection Status Indicator - Floating */}
        {!isFullscreen && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tracking-wide">
              {isConnected ? t("live.connected") : t("live.reconnecting")}
            </span>
          </div>
        )}

        {/* Video Area */}
        <div className={`relative w-full h-full overflow-hidden flex items-center justify-center ${!isFullscreen ? 'p-2 md:p-6' : 'p-0'}`}>
          <div ref={containerRef} className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center shadow-sm">
            
            {/* Fallback "No Signal" background */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f4f5f7] dark:bg-[#111827] transition-colors">
               <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
               <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">{t("live.noSignal")}</span>
            </div>
            
            {/* Live MJPEG Stream */}
            <img 
              src="http://localhost:8000/api/v1/video/stream" 
              alt="Live Camera Feed"
              className="relative z-10 w-full h-full object-contain bg-black"
              onError={(e) => (e.currentTarget.style.opacity = '0')}
              onLoad={(e) => (e.currentTarget.style.opacity = '1')}
              style={{ transition: 'opacity 0.3s ease-in-out' }}
            />
            
            {/* OSD: Overlay Camera Info & Live Timestamp */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded text-[13px] font-mono text-white/95 tracking-wider shadow-md border border-white/10">
                {liveTime || "0000-00-00 00:00:00"}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded text-[11px] font-mono text-white/90 border border-white/10 pointer-events-none">
              CAM_01 / BED_A
            </div>
            
            <button 
              onClick={toggleFullscreen}
              className="absolute bottom-4 right-4 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 rounded text-white/90 transition-colors border border-white/10"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel Toggle Button */}
      {!isFullscreen && (
        <button 
           onClick={() => setIsPanelOpen(!isPanelOpen)}
           className="absolute top-1/2 -translate-y-1/2 bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 shadow-md p-1.5 z-30 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center"
           style={{ 
             right: isPanelOpen ? '24rem' : '0', 
             borderRightWidth: isPanelOpen ? '0' : '1px',
             borderRadius: isPanelOpen ? '8px 0 0 8px' : '8px 0 0 8px'
           }}
        >
          {isPanelOpen ? <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
        </button>
      )}

      {/* Right Sidebar (Logs & Controls) */}
      <div 
        className={`absolute right-0 top-0 bottom-0 w-96 bg-[#fdfdfe] dark:bg-[#111827] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 z-20 ${
          isPanelOpen && !isFullscreen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex-none border-b border-slate-100 dark:border-slate-800 p-4">
          <CameraControlPanel />
        </div>
        
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0b0f19] transition-colors">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("live.incidentLogs")}</h3>
          <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded font-bold">
            {alerts.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-600 gap-2 mt-8">
              <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-[13px] font-medium text-center">{t("live.noAnomalies")}</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div 
                key={idx} 
                className={`border rounded-xl p-3.5 transition-all ${
                  alert.acknowledged 
                    ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60" 
                    : "bg-white dark:bg-[#1f2937] border-red-200 dark:border-red-900/50 shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                    <Clock className="w-3 h-3" />
                    {alert.timestamp}
                  </div>
                  <span className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded ${
                    alert.acknowledged 
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400' 
                      : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                  }`}>
                    {alert.eventCode}
                  </span>
                </div>
                <p className={`text-[13px] mb-3 leading-relaxed ${alert.acknowledged ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>
                  {getAlertMessage(alert)}
                </p>
                
                {!alert.acknowledged && (
                  <button 
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="w-full flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold py-1.5 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("live.acknowledge")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
