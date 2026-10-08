"use client";
import React, { useState, useEffect, useRef } from "react";
import CameraControlPanel from "./CameraControlPanel";
import { AlertCircle, Clock, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Maximize, Minimize } from "lucide-react";
import { useAlerts, type AlertPayload } from "./context/AlertsContext";
import { useTranslation } from "./context/LanguageContext";
import { getBackendBaseUrl } from "./backendUrl";

type VideoDiagnostics = {
  ai_model?: string;
  ai_overlay_fresh?: boolean;
  ai_overlay_age_ms?: number | null;
  ai_detection_count?: number;
  ai_fall_states?: string[];
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

type TrackingDetection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  track_id: number | null;
  confidence: number;
  fall_state?: string;
  fall_confirmed?: boolean;
  keypoints?: { x: number; y: number; confidence: number }[];
};

type AiOverlaySnapshot = {
  fresh: boolean;
  timestamp: number | null;
  width: number;
  height: number;
  message?: string;
  radar?: { x: number; y: number; speed: number } | null;
  detections: TrackingDetection[];
};

const POSE_CONNECTIONS = [
  [15, 13], [13, 11], [16, 14], [14, 12], [11, 12],
  [5, 11], [6, 12], [5, 7], [6, 8], [7, 9], [8, 10],
  [1, 2], [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6],
] as const;

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
  const [aiOverlay, setAiOverlay] = useState<AiOverlaySnapshot | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimestampRef = useRef<number | null>(null);
  const streamUrl = backendBaseUrl
    // Keep the dashboard responsive by displaying the latest camera frames.
    // AI inference continues independently in the backend for tracking/alerts.
    ? `${backendBaseUrl}/api/v1/video/live`
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

  // Keep video pixels on the high-rate RAW MJPEG path. Fetch only the compact
  // AI boxes separately, so inference cadence never throttles camera playback.
  useEffect(() => {
    if (!backendBaseUrl) {
      overlayTimestampRef.current = null;
      return;
    }

    let active = true;
    let requestInFlight = false;
    let activeController: AbortController | null = null;

    const pollDetections = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), 800);
      try {
        const response = await fetch(`${backendBaseUrl}/api/v1/video/detections`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const snapshot = await response.json() as AiOverlaySnapshot & { status?: string };
        if (!active) return;

        if (response.ok && snapshot.status === "success" && snapshot.fresh && snapshot.timestamp) {
          if (snapshot.timestamp !== overlayTimestampRef.current) {
            overlayTimestampRef.current = snapshot.timestamp;
            setAiOverlay(snapshot);
          }
        } else if (overlayTimestampRef.current !== null) {
          overlayTimestampRef.current = null;
          setAiOverlay(null);
        }
      } catch {
        if (active && overlayTimestampRef.current !== null) {
          overlayTimestampRef.current = null;
          setAiOverlay(null);
        }
      } finally {
        window.clearTimeout(timeout);
        requestInFlight = false;
        if (activeController === controller) activeController = null;
      }
    };

    void pollDetections();
    const timer = window.setInterval(() => void pollDetections(), 120);
    return () => {
      active = false;
      window.clearInterval(timer);
      activeController?.abort();
    };
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
                alt="Live camera feed; AI tracking continues in the backend"
                className="relative z-10 w-full h-full object-contain"
                onLoad={() => setStreamError(false)}
                onError={handleStreamError}
              />
            )}

            {aiOverlay?.fresh && aiOverlay.width > 0 && aiOverlay.height > 0 && (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[12] h-full w-full"
                viewBox={`0 0 ${aiOverlay.width} ${aiOverlay.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {aiOverlay.detections.map((detection, index) => {
                  // AI inference uses a mirrored image; map its coordinates
                  // back onto the unmirrored RAW preview shown underneath.
                  const x1 = Math.max(0, Math.min(aiOverlay.width, aiOverlay.width - detection.x2));
                  const x2 = Math.max(0, Math.min(aiOverlay.width, aiOverlay.width - detection.x1));
                  const y1 = Math.max(0, Math.min(aiOverlay.height, detection.y1));
                  const y2 = Math.max(0, Math.min(aiOverlay.height, detection.y2));
                  const boxWidth = Math.max(0, x2 - x1);
                  const boxHeight = Math.max(0, y2 - y1);
                  const confirmed = detection.fall_confirmed === true;
                  const candidate = detection.fall_state === "CANDIDATE";
                  const color = confirmed ? "#ef4444" : candidate ? "#f59e0b" : "#22c55e";
                  const trackLabel = detection.track_id === null ? "Person" : `ID ${detection.track_id}`;
                  const stateLabel = detection.fall_state && detection.fall_state !== "TRACKING"
                    ? ` · ${detection.fall_state}`
                    : "";
                  const label = `${trackLabel}${stateLabel} · ${Math.round(detection.confidence * 100)}%`;
                  const fontSize = Math.max(7, Math.min(14, aiOverlay.width * 0.02));
                  const points = detection.keypoints ?? [];

                  return (
                    <g key={`${detection.track_id ?? "person"}-${index}`}>
                      {POSE_CONNECTIONS.map(([from, to]) => {
                        const a = points[from];
                        const b = points[to];
                        if (!a || !b || a.confidence < 0.25 || b.confidence < 0.25) return null;
                        return (
                          <line
                            key={`pose-${from}-${to}`}
                            x1={aiOverlay.width - a.x}
                            y1={a.y}
                            x2={aiOverlay.width - b.x}
                            y2={b.y}
                            stroke={color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                      {points.map((point, pointIndex) => point.confidence >= 0.25 ? (
                        <circle
                          key={`joint-${pointIndex}`}
                          cx={aiOverlay.width - point.x}
                          cy={point.y}
                          r="2.5"
                          fill={color}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null)}
                      <rect
                        x={x1}
                        y={y1}
                        width={boxWidth}
                        height={boxHeight}
                        fill={color}
                        fillOpacity="0.06"
                        stroke={color}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={x1 + 4}
                        y={Math.max(fontSize + 4, y1 - 6)}
                        fill={color}
                        fontSize={fontSize}
                        fontWeight="700"
                        paintOrder="stroke"
                        stroke="#052e16"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
                {aiOverlay.message && (
                  <text
                    x={aiOverlay.width / 2}
                    y={Math.max(20, aiOverlay.height * 0.06)}
                    textAnchor="middle"
                    fill="#facc15"
                    fontSize={Math.max(8, Math.min(16, aiOverlay.width * 0.025))}
                    fontWeight="700"
                    paintOrder="stroke"
                    stroke="#111827"
                    strokeWidth="4"
                  >
                    {aiOverlay.message}
                  </text>
                )}
                {aiOverlay.radar && (aiOverlay.radar.x !== 0 || aiOverlay.radar.y !== 0) && (
                  <text
                    x={aiOverlay.width - 12}
                    y={Math.max(22, aiOverlay.height * 0.06)}
                    textAnchor="end"
                    fill="#facc15"
                    fontSize={Math.max(7, Math.min(12, aiOverlay.width * 0.018))}
                    fontWeight="600"
                    paintOrder="stroke"
                    stroke="#111827"
                    strokeWidth="4"
                  >
                    {`RADAR X:${aiOverlay.radar.x.toFixed(1)}m Y:${aiOverlay.radar.y.toFixed(1)}m V:${aiOverlay.radar.speed.toFixed(2)}m/s`}
                  </text>
                )}
              </svg>
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
                CAM_01 · RAW {videoDiagnostics?.raw_fps ?? "--"} FPS · AI {videoDiagnostics?.ai_fps ?? "--"} FPS · TARGET {videoDiagnostics?.ai_detection_count ?? "--"} · {videoDiagnostics?.raw_kBps ?? "--"} KB/s · DIAG {showDiagnostics ? "−" : "+"}
              </button>
              {showDiagnostics && videoDiagnostics && (
                <div className="mt-1 border-t border-white/20 pt-1 leading-4 whitespace-normal">
                  RAW received {videoDiagnostics.raw_fps} FPS · AI decoded {videoDiagnostics.ai_decode_fps} FPS<br />
                  AI output {videoDiagnostics.ai_fps} FPS · target {videoDiagnostics.ai_target_fps} / ceiling {videoDiagnostics.ai_limit_fps} FPS<br />
                  Model {videoDiagnostics.ai_model ?? "unknown"} · overlay {videoDiagnostics.ai_overlay_fresh ? "fresh" : "stale"} ({videoDiagnostics.ai_overlay_age_ms ?? "--"} ms) · detections {videoDiagnostics.ai_detection_count ?? "--"}<br />
                  Fall states {videoDiagnostics.ai_fall_states?.length ? videoDiagnostics.ai_fall_states.join(", ") : "none"}<br />
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
