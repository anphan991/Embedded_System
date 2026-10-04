"use client";
import React, { useState, useEffect, useRef } from "react";
import CameraControlPanel from "./CameraControlPanel";
import { AlertCircle, Clock, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Maximize, Minimize } from "lucide-react";
import { useAlerts, type AlertPayload } from "./context/AlertsContext";
import { useTranslation } from "./context/LanguageContext";
import { getBackendBaseUrl } from "./backendUrl";

type VideoDiagnostics = {
  raw_fps: number;
  ai_fps: number;
  ai_decode_fps: number;
  ai_target_fps: number;
  ai_limit_fps: number;
  ai_work_ms: number;
  raw_kBps: number;
  jpeg_kB: number;
  decode_ms: number;
  inference_ms: number;
  encode_ms: number;
  pipeline_ms: number;
  preview_dropped: number;
  ai_input_dropped: number;
  ai_output_dropped: number;
  camera_reconnects: number;
  radar_age_seconds: number | null;
  preview_frame_version: number;
  ai_frame_version: number;
  live_viewers: number;
  ai_viewers: number;
  camera_worker_alive: boolean;
  ai_worker_alive: boolean;
};

export default function SurveillanceDashboard() {
  const { alerts, isConnected, acknowledgeAlert } = useAlerts();
  const { t } = useTranslation();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTime, setLiveTime] = useState("");
  const [backendBaseUrl, setBackendBaseUrl] = useState("");
  const [streamRetry, setStreamRetry] = useState(0);
  const [streamError, setStreamError] = useState(false);
  const [videoOnline, setVideoOnline] = useState<boolean | null>(null);
  const [videoDiagnostics, setVideoDiagnostics] = useState<VideoDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamUrl = backendBaseUrl
    ? `${backendBaseUrl}/api/v1/video/stream`
    : "";

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

    const frame = requestAnimationFrame(() => setBackendBaseUrl(getBackendBaseUrl()));

    return () => { clearInterval(timer); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!backendBaseUrl) return;
    let active = true;
    let previouslyOnline: boolean | null = null;
    const checkVideo = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(`${backendBaseUrl}/api/v1/video/status`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        const online = response.ok && data.status === "success" && data.online === true &&
          data.ai_online === true;
        if (!active) return;
        setVideoDiagnostics(response.ok && data.status === "success" ? data : null);
        setVideoOnline(online);
        if (online && previouslyOnline === false) setStreamRetry((value) => value + 1);
        previouslyOnline = online;
      } catch {
        if (!active) return;
        setVideoOnline(false);
        setVideoDiagnostics(null);
        previouslyOnline = false;
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void checkVideo();
    const timer = setInterval(checkVideo, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [backendBaseUrl]);

  // Some browsers/proxies can leave an MJPEG <img> open but frozen without an
  // error event. A periodic reconnect bounds that silent failure to one minute.
  useEffect(() => {
    if (!backendBaseUrl || videoOnline !== true) return;
    const timer = window.setInterval(() => setStreamRetry((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, [backendBaseUrl, videoOnline]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleStreamError = () => {
    setStreamError(true);
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setStreamRetry((value) => value + 1);
    }, 2000);
  };

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

  const getAlertMessage = (alert: AlertPayload) => {
    const key = `alert.${alert.eventCode}`;
    const translated = t(key);
    return translated !== key ? translated : alert.message;
  };

  return (
    <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-[#f4f5f7] dark:bg-[#0b0f19] transition-colors duration-300`}>
      
      {/* Center: Video Feed (Top on Mobile) */}
      <div className={`flex-none lg:flex-1 h-[40vh] lg:h-full flex flex-col transition-all duration-300 relative ${isPanelOpen && !isFullscreen ? 'lg:mr-96' : 'lg:mr-0'}`}>
        
        {/* Connection Status Indicator - Floating */}
        {!isFullscreen && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-colors scale-90 lg:scale-100 origin-top-left">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tracking-wide">
              {isConnected ? t("live.connected") : t("live.reconnecting")}
            </span>
          </div>
        )}

        {/* Video Area */}
        <div className={`relative w-full h-full overflow-hidden flex items-center justify-center ${!isFullscreen ? 'p-0 lg:p-6' : 'p-0'}`}>
          <div ref={containerRef} className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center lg:shadow-sm lg:rounded-xl">
            
            {/* Fallback "No Signal" background */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f4f5f7] dark:bg-[#111827] transition-colors">
               <AlertCircle className="w-8 h-8 lg:w-10 lg:h-10 text-slate-300 dark:text-slate-600 mb-2" />
               <span className="text-slate-400 dark:text-slate-500 text-[10px] lg:text-xs font-medium">{t("live.noSignal")}</span>
            </div>
            
            {/* Live MJPEG Stream */}
            {streamUrl && (
              <img 
                key={streamRetry}
                src={streamUrl} 
                alt="Camera feed with AI tracking"
                className="relative z-10 w-full h-full object-contain"
                onLoad={() => setStreamError(false)}
                onError={handleStreamError}
              />
            )}

            {(videoOnline === false || streamError) && (
              <div className="absolute inset-0 z-[15] flex items-center justify-center bg-slate-900/85 text-xs font-semibold text-white">
                {t("live.streamWaiting")}
              </div>
            )}

            
            {/* OSD: Overlay Camera Info & Live Timestamp */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1 pointer-events-none scale-90 lg:scale-100 origin-top-right">
              <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded text-[11px] lg:text-[13px] font-mono text-white/95 tracking-wider shadow-md border border-white/10">
                {liveTime || "0000-00-00 00:00:00"}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 z-20 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded text-[10px] lg:text-[11px] font-mono text-white/90 border border-white/10 scale-90 lg:scale-100 origin-bottom-left max-w-[85%]">
              <button onClick={() => setShowDiagnostics((value) => !value)} className="text-left hover:text-white" title="Video diagnostics">
                CAM_01 · RAW {videoDiagnostics?.raw_fps ?? "--"} FPS · AI overlay {videoDiagnostics?.ai_fps ?? "--"} FPS (target {videoDiagnostics?.ai_target_fps ?? "--"}) · {videoDiagnostics?.raw_kBps ?? "--"} KB/s · DIAG {showDiagnostics ? "−" : "+"}
              </button>
              {showDiagnostics && videoDiagnostics && (
                <div className="mt-1 border-t border-white/20 pt-1 leading-4 whitespace-normal">
                  RAW received {videoDiagnostics.raw_fps} FPS · AI decoded {videoDiagnostics.ai_decode_fps} FPS<br />
                  AI output {videoDiagnostics.ai_fps} FPS · target {videoDiagnostics.ai_target_fps} / ceiling {videoDiagnostics.ai_limit_fps} FPS<br />
                  JPEG {videoDiagnostics.jpeg_kB} KB · JPEG decode {videoDiagnostics.decode_ms} ms · AI work {videoDiagnostics.ai_work_ms} ms/frame<br />
                  infer {videoDiagnostics.inference_ms} ms · encode {videoDiagnostics.encode_ms} ms · pipeline {videoDiagnostics.pipeline_ms} ms<br />
                  drops {videoDiagnostics.preview_dropped}/{videoDiagnostics.ai_input_dropped}/{videoDiagnostics.ai_output_dropped} · reconnect {videoDiagnostics.camera_reconnects}<br />
                  frame {videoDiagnostics.preview_frame_version}/{videoDiagnostics.ai_frame_version} · viewers {videoDiagnostics.live_viewers}/{videoDiagnostics.ai_viewers}<br />
                  radar age {videoDiagnostics.radar_age_seconds ?? "--"} s · workers {videoDiagnostics.camera_worker_alive ? "CAM OK" : "CAM DOWN"}/{videoDiagnostics.ai_worker_alive ? "AI OK" : "AI DOWN"}
                </div>
              )}
            </div>
            
            <button 
              onClick={toggleFullscreen}
              className="absolute bottom-4 right-4 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 rounded text-white/90 transition-colors border border-white/10 scale-90 lg:scale-100 origin-bottom-right"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel Toggle Button (Desktop Only) */}
      {!isFullscreen && (
        <button 
           onClick={() => setIsPanelOpen(!isPanelOpen)}
           className="hidden lg:flex absolute top-1/2 -translate-y-1/2 bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 shadow-md p-1.5 z-30 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800 items-center justify-center"
           style={{ 
             right: isPanelOpen ? '24rem' : '0', 
             borderRightWidth: isPanelOpen ? '0' : '1px',
             borderRadius: '8px 0 0 8px'
           }}
        >
          {isPanelOpen ? <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
        </button>
      )}

      {/* Right Sidebar (Controls & Logs - Bottom on Mobile) */}
      <div 
        className={`flex-1 lg:flex-none relative lg:absolute lg:right-0 lg:top-0 lg:bottom-0 w-full lg:w-96 bg-[#fdfdfe] dark:bg-[#111827] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl lg:transition-transform lg:duration-300 z-20 ${
          isPanelOpen && !isFullscreen ? 'lg:translate-x-0' : 'lg:translate-x-full'
        }`}
      >
        <div className="flex-none border-b border-slate-100 dark:border-slate-800 p-3 lg:p-4 shrink-0">
          <CameraControlPanel />
        </div>
        
        <div className="hidden lg:flex px-4 lg:px-5 py-2.5 lg:py-3 border-b border-slate-100 dark:border-slate-800 items-center justify-between bg-slate-50 dark:bg-[#0b0f19] transition-colors shrink-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("live.incidentLogs")}</h3>
          <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded font-bold">
            {alerts.length}
          </span>
        </div>
        
        <div className="hidden lg:block flex-1 overflow-y-auto p-3 lg:p-4 space-y-2.5 lg:space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 pb-8 lg:pb-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 lg:h-32 text-slate-400 dark:text-slate-600 gap-2 mt-4 lg:mt-8">
              <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-[13px] font-medium text-center">{t("live.noAnomalies")}</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div 
                key={idx} 
                className={`border rounded-xl p-3 lg:p-3.5 transition-all ${
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
                <p className={`text-[12px] lg:text-[13px] mb-3 leading-relaxed ${alert.acknowledged ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>
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
