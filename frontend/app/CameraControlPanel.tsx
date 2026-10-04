"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Settings2, Radio, RotateCcw, Crosshair } from "lucide-react";
import { useTranslation } from "./context/LanguageContext";

type ServoDiagnostics = {
  online: boolean | null;
  fresh: boolean;
  age_seconds: number | null;
  last_config_result: string | null;
  device_health?: {
    state?: string;
    boot_reset_reason?: string | null;
    boot_reset_stage?: string | null;
    task_wdt_count?: number | null;
    slow_loop_stage?: string | null;
    slow_loop_stage_ms?: number | null;
    mqtt_connect_ms?: number | null;
    mqtt_reconnect_failures?: number | null;
  };
  data: {
    fw?: string;
    uptime_ms?: number;
    free_heap?: number;
    min_free_heap?: number;
    largest_free_block?: number;
    loop_stack_free?: number;
    network_stack_free?: number;
    rx_dropped?: number;
    tx_dropped?: number;
    log_dropped?: number;
    boot_network_stage?: string;
    mode?: string;
    target_pan?: number;
    target_tilt?: number;
    command_pan?: number;
    command_tilt?: number;
    pulse_pan_us?: number;
    pulse_tilt_us?: number;
    pan_attached?: boolean;
    tilt_attached?: boolean;
    pan_at_limit?: boolean;
    tilt_at_limit?: boolean;
    radar_age_ms?: number;
    manual_age_ms?: number;
    wifi_rssi?: number;
    loop_gap_ms?: number;
    manual_count?: number;
    hold_heartbeats?: number;
    boot_reset_reason?: string;
    boot_reset_stage?: string;
    task_wdt_count?: number;
    slow_loop_stage?: string;
    slow_loop_stage_ms?: number;
    mqtt_connect_ms?: number;
    mqtt_reconnect_failures?: number;
  } | null;
};

type ApiError = {
  kind: "backend" | "request";
  source: "sync" | "command";
  detail?: string;
  httpStatus?: number;
  apiStatus?: string;
  errorCode?: string;
};

function requestError(response: Response, data: unknown, source: ApiError["source"]): ApiError {
  const payload = data !== null && typeof data === "object" ? data as Record<string, unknown> : null;
  const detail = typeof payload?.message === "string" ? payload.message
    : typeof payload?.detail === "string" ? payload.detail : undefined;
  return {
    kind: "request",
    source,
    detail,
    httpStatus: response.status,
    apiStatus: typeof payload?.status === "string" && payload.status !== "success" ? payload.status : undefined,
    errorCode: typeof payload?.error_code === "string" ? payload.error_code : undefined,
  };
}

function getCameraApiBaseUrl() {
  const fallback = `http://${window.location.hostname}:8000/api/v1`;
  try {
    const saved = localStorage.getItem("fallguard_settings");
    const configured = saved ? JSON.parse(saved).serverUrl : null;
    if (typeof configured === "string" && /^https?:\/\//i.test(configured.trim())) {
      const base = configured.trim().replace(/\/+$/, "");
      const host = new URL(base).hostname;
      if (["localhost", "127.0.0.1"].includes(host) && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        return fallback;
      }
      return /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
    }
  } catch {
    // Invalid browser settings: use the host that serves the dashboard.
  }
  return fallback;
}

export default function CameraControlPanel() {
  const [autoTracking, setAutoTracking] = useState(false);
  const [modeKnown, setModeKnown] = useState(false);
  const [hardwareMode, setHardwareMode] = useState<string | null>(null);
  const [modeLoading, setModeLoading] = useState(false);
  const [controlProtocol, setControlProtocol] = useState("sequenced_hold");
  const [stepBusy, setStepBusy] = useState(false);
  const legacyStep = controlProtocol === "legacy_step";
  const stepInFlightRef = useRef(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [stopUnconfirmed, setStopUnconfirmed] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [servoDiagnostics, setServoDiagnostics] = useState<ServoDiagnostics | null>(null);
  const [showServoDiagnostics, setShowServoDiagnostics] = useState(false);
  const { t } = useTranslation();
  const moveTimerRef = useRef<number | null>(null);
  const moveInFlightRef = useRef(false);
  const activeDirectionRef = useRef<string | null>(null);
  const queuedMoveRef = useRef<string | null>(null);
  const moveSessionRef = useRef("");
  const moveSequenceRef = useRef(0);
  const moveGenerationRef = useRef(0);
  const activePointerRef = useRef<number | null>(null);
  const moveAbortRef = useRef<AbortController | null>(null);
  const stopGenerationRef = useRef(0);
  const modeGenerationRef = useRef(0);
  const modeRequestInFlightRef = useRef(false);
  const syncInFlightRef = useRef(false);

  const syncMode = useCallback(async () => {
    if (modeRequestInFlightRef.current || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    const generation = modeGenerationRef.current;
    const baseUrl = getCameraApiBaseUrl();
    setApiBaseUrl(baseUrl);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`${baseUrl}/camera/mode`, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (modeRequestInFlightRef.current || generation !== modeGenerationRef.current) return;
      if (!response.ok || data?.status !== "success" || !["AUTO", "MANUAL"].includes(data.mode)) {
        setApiError((current) => current?.source === "command" ? current : requestError(response, data, "sync"));
        setModeKnown(false);
        return;
      }
      setAutoTracking(data.mode === "AUTO");
      setControlProtocol(data.control_protocol ?? "sequenced_hold");
      setHardwareMode(["AUTO", "MANUAL"].includes(data.hardware_mode) ? data.hardware_mode : null);
      setModeKnown(true);
      setApiError((current) => current?.source === "sync" ? null : current);
    } catch {
      if (modeRequestInFlightRef.current || generation !== modeGenerationRef.current) return;
      setModeKnown(false);
      setHardwareMode(null);
      setApiError((current) => current?.source === "command" ? current : { kind: "backend", source: "sync" });
    } finally {
      syncInFlightRef.current = false;
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    void syncMode();
    const timer = window.setInterval(() => void syncMode(), 2000);
    return () => window.clearInterval(timer);
  }, [syncMode]);

  useEffect(() => {
    if (legacyStep) return;
    let active = true;
    let busy = false;
    const checkServo = async () => {
      if (busy) return;
      busy = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(`${getCameraApiBaseUrl()}/servo/diag`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (active) setServoDiagnostics(response.ok && data.status === "success" ? data : null);
      } catch {
        if (active) setServoDiagnostics(null);
      } finally {
        busy = false;
        window.clearTimeout(timeout);
      }
    };
    void checkServo();
    const timer = window.setInterval(() => void checkServo(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [legacyStep]);

  const handleModeChange = async (isAuto: boolean) => {
    if (modeRequestInFlightRef.current || stepInFlightRef.current) return;
    stopMove();
    moveGenerationRef.current += 1;
    stopGenerationRef.current += 1;
    setStopUnconfirmed(false);
    modeGenerationRef.current += 1;
    modeRequestInFlightRef.current = true;
    if (isAuto) {
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = null;
      activeDirectionRef.current = null;
      queuedMoveRef.current = null;
    }
    setModeLoading(true);
    const baseUrl = getCameraApiBaseUrl();
    setApiBaseUrl(baseUrl);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${baseUrl}/camera/mode?mode=${isAuto ? "AUTO" : "MANUAL"}`, {
        method: "POST",
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status !== "success" || data.mode !== (isAuto ? "AUTO" : "MANUAL")) {
        setApiError(requestError(response, data, "command"));
        return;
      }
      setAutoTracking(isAuto);
      setControlProtocol(data.control_protocol ?? "sequenced_hold");
      setHardwareMode(["AUTO", "MANUAL"].includes(data.hardware_mode) ? data.hardware_mode : null);
      setModeKnown(true);
      setApiError(null);
    } catch {
      setModeKnown(false);
      setHardwareMode(null);
      setApiError({ kind: "backend", source: "command" });
    } finally {
      modeRequestInFlightRef.current = false;
      setModeLoading(false);
      window.clearTimeout(timeoutId);
    }
  };

  const sendMove = useCallback(async (dir: string): Promise<boolean> => {
    const generation = moveGenerationRef.current;
    const baseUrl = getCameraApiBaseUrl();
    setApiBaseUrl(baseUrl);
    if (!moveSessionRef.current) {
      moveSessionRef.current = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const seq = ++moveSequenceRef.current;
    const controller = new AbortController();
    if (dir !== "STOP") moveAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch(`${baseUrl}/camera/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: dir, session_id: moveSessionRef.current, seq }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status !== "success") {
        if (generation === moveGenerationRef.current) setApiError(requestError(response, data, "command"));
        return false;
      }
      if (dir !== "STOP" && generation === moveGenerationRef.current) setApiError(null);
      return true;
    } catch {
      if (generation === moveGenerationRef.current) {
        setModeKnown(false);
        setApiError({ kind: "backend", source: "command" });
      }
      return false;
    } finally {
      window.clearTimeout(timeoutId);
      if (moveAbortRef.current === controller) moveAbortRef.current = null;
    }
  }, []);

  // The supplied firmware has finite steps, no hold lease and no STOP.
  // Never simulate a hold with repeated steps or retry an ambiguous timeout.
  const sendStep = useCallback(async (direction: string) => {
    if (stepInFlightRef.current || modeRequestInFlightRef.current || !modeKnown || autoTracking) return;
    stepInFlightRef.current = true;
    setStepBusy(true);
    const startedAt = performance.now();
    try {
      await sendMove(direction);
      // Also bound rapid clicks after a fast local HTTP response (server: 150 ms).
      const remaining = 200 - (performance.now() - startedAt);
      if (remaining > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
    } finally {
      stepInFlightRef.current = false;
      setStepBusy(false);
    }
  }, [sendMove, modeKnown, autoTracking]);

  // Keep at most one HTTP request in flight. A new direction replaces an old
  // queued direction, so slow network responses cannot build up stale moves.
  const dispatchMove = useCallback(async function flushMove(): Promise<void> {
    if (moveInFlightRef.current || !queuedMoveRef.current) return;

    const direction = queuedMoveRef.current;
    const generation = moveGenerationRef.current;
    queuedMoveRef.current = null;
    moveInFlightRef.current = true;
    const startedAt = performance.now();
    const sent = await sendMove(direction);
    moveInFlightRef.current = false;

    // A late failure from a released gesture must not cancel the next press.
    if (generation !== moveGenerationRef.current) {
      if (queuedMoveRef.current) void flushMove();
      return;
    }

    if (!sent) {
      activeDirectionRef.current = null;
      activePointerRef.current = null;
      queuedMoveRef.current = null;
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = null;
      return;
    }

    if (queuedMoveRef.current) {
      void flushMove();
    } else if (activeDirectionRef.current) {
      moveTimerRef.current = window.setTimeout(() => {
        moveTimerRef.current = null;
        queuedMoveRef.current = activeDirectionRef.current;
        void flushMove();
      }, Math.max(0, 100 - (performance.now() - startedAt)));
    }
  }, [sendMove]);

  const startMove = useCallback((dir: string) => {
    moveGenerationRef.current += 1;
    stopGenerationRef.current += 1;
    setStopUnconfirmed(false);
    if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
    moveTimerRef.current = null;
    // The ESP32 drives the MG996R while these refreshes arrive and stops
    // itself if the browser/network disappears (r5 lease: 400 ms).
    activeDirectionRef.current = `HOLD_${dir}`;
    queuedMoveRef.current = `HOLD_${dir}`;
    void dispatchMove();
  }, [dispatchMove]);

  const stopMove = useCallback(() => {
    if (legacyStep) return;
    const wasMoving = activeDirectionRef.current !== null;
    moveGenerationRef.current += 1;
    // Free the HTTP slot immediately on release; an old two-second timeout
    // must not delay the next press. Backend sequence checks still reject any
    // old request that reached the server before abort took effect.
    moveAbortRef.current?.abort();
    moveAbortRef.current = null;
    activePointerRef.current = null;
    if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
    moveTimerRef.current = null;
    activeDirectionRef.current = null;
    queuedMoveRef.current = null;
    if (wasMoving) {
      const generation = ++stopGenerationRef.current;
      void sendMove("STOP").then((sent) => {
        if (stopGenerationRef.current === generation) setStopUnconfirmed(!sent);
      });
    }
  }, [sendMove, legacyStep]);

  const resetMove = useCallback(() => {
    if (legacyStep) { void sendStep("RESET"); return; }
    stopMove();
    moveGenerationRef.current += 1;
    stopGenerationRef.current += 1;
    setStopUnconfirmed(false);
    queuedMoveRef.current = "RESET";
    void dispatchMove();
  }, [dispatchMove, stopMove, legacyStep, sendStep]);

  const holdButtonProps = (direction: string) => legacyStep ? ({
    "aria-label": direction,
    disabled: modeLoading || stepBusy,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      void sendStep(direction);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (!event.repeat) void sendStep(direction);
    },
    // Assistive technology can activate a button without a pointer event.
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) void sendStep(direction);
    },
  }) : ({
    "aria-label": direction,
    disabled: modeLoading,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!event.isPrimary || activeDirectionRef.current !== null) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerRef.current = event.pointerId;
      startMove(direction);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerRef.current === event.pointerId) stopMove();
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerRef.current === event.pointerId) stopMove();
    },
    onLostPointerCapture: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerRef.current === event.pointerId) stopMove();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (!event.repeat && activeDirectionRef.current === null) startMove(direction);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (activePointerRef.current === null) stopMove();
    },
    onBlur: () => { if (activePointerRef.current === null) stopMove(); }
  });

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.visibilityState === "hidden") stopMove();
    };
    window.addEventListener("blur", stopMove);
    document.addEventListener("visibilitychange", stopOnHidden);
    return () => {
      window.removeEventListener("blur", stopMove);
      document.removeEventListener("visibilitychange", stopOnHidden);
      stopMove();
    };
  }, [stopMove]);

  return (
    <div className="bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm transition-colors">
      <div className="bg-slate-50 dark:bg-[#111827] px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
        <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-500" />
          {t("cam.ptzControls")}
        </h3>
        {/* Badge trạng thái chế độ hiện tại */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modeKnown && autoTracking ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
          {modeKnown ? (autoTracking ? "● AUTO" : "● MANUAL") : "● ?"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Thanh chuyển chế độ */}
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-500 dark:text-slate-400">{t("cam.mode")}</span>
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => handleModeChange(false)}
              disabled={modeLoading || stepBusy}
              className={`px-3 py-1.5 rounded-md transition-colors ${modeKnown && !autoTracking ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t("cam.manualMode")}
            </button>
            <button
              onClick={() => handleModeChange(true)}
              disabled={modeLoading || stepBusy}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${modeKnown && autoTracking ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Radio className="w-3 h-3" />
              {t("cam.autoTracking")}
            </button>
          </div>
        </div>

        {apiError && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300 break-words">
            {apiError.detail ?? t(apiError.kind === "backend" ? "cam.backendUnavailable" : "cam.requestFailed")}
            {(apiError.errorCode || apiError.httpStatus !== undefined) && <span>{apiError.errorCode ? ` · ${apiError.errorCode}` : ""}{apiError.httpStatus !== undefined ? ` · HTTP ${apiError.httpStatus}` : ""}{apiError.apiStatus ? ` · API ${apiError.apiStatus}` : ""}</span>}
            <span className="block mt-1 font-mono">{apiBaseUrl}</span>
          </p>
        )}

        {stopUnconfirmed && (
          <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {t("cam.stopUnconfirmed")}
          </p>
        )}

        {!legacyStep && servoDiagnostics?.fresh && (servoDiagnostics.data?.pan_at_limit || servoDiagnostics.data?.tilt_at_limit) && (
          <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
            {servoDiagnostics.data.pan_at_limit ? "PAN " : ""}{servoDiagnostics.data.tilt_at_limit ? "TILT " : ""}
            {t("cam.angleLimit")}
          </p>
        )}

        {!modeKnown ? (
          <div className="text-center py-5 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("cam.modeUnknown")}</p>
            <button onClick={() => void syncMode()} className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2">
              {t("cam.retry")}
            </button>
          </div>
        ) : autoTracking ? (
          /* ---- GIAO DIỆN CHẾ ĐỘ TỰ ĐỘNG ---- */
          <div className="flex flex-col items-center justify-center py-5 gap-3">
            <div className="relative flex items-center justify-center w-16 h-16">
              <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 dark:bg-green-500 opacity-20 animate-ping" />
              <span className="absolute inline-flex w-10 h-10 rounded-full bg-green-400 dark:bg-green-500 opacity-30 animate-ping" style={{ animationDelay: "0.3s" }} />
              <Crosshair className="w-8 h-8 text-green-600 dark:text-green-400 relative z-10" />
            </div>
            <span className="text-sm font-bold text-green-700 dark:text-green-300">
              {t(legacyStep ? "cam.legacyAuto" : hardwareMode === "AUTO" ? "cam.autoActive" : "cam.autoPending")}
            </span>
            {!legacyStep && <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center px-4 leading-relaxed">
              {t(hardwareMode === "AUTO" ? "cam.autoDesc" : "cam.autoPendingDesc")}
            </p>}
            <button
              onClick={() => handleModeChange(false)}
              disabled={modeLoading}
              className="mt-1 text-[11px] text-blue-500 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700"
            >
              Chuyển sang điều khiển tay →
            </button>
          </div>
        ) : (
          /* ---- GIAO DIỆN JOYSTICK THỦ CÔNG ---- */
          <div className="flex flex-col items-center gap-2">
            <button
              {...holdButtonProps("UP")}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm cursor-pointer select-none touch-none">
              <ArrowUp className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <button
                {...holdButtonProps("LEFT")}
                className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm cursor-pointer select-none touch-none">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={resetMove}
                disabled={modeLoading || stepBusy}
                className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors shadow-sm cursor-pointer select-none" title="Reset về giữa">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                {...holdButtonProps("RIGHT")}
                className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm cursor-pointer select-none touch-none">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <button
              {...holdButtonProps("DOWN")}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm cursor-pointer select-none touch-none">
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>
        )}

        {!legacyStep && <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2 text-[10px] font-mono text-slate-600 dark:text-slate-300">
          <button onClick={() => setShowServoDiagnostics((value) => !value)} className="flex w-full items-center justify-between text-left">
            <span>SERVO DIAG · {servoDiagnostics?.fresh ? "LIVE" : servoDiagnostics?.online ? "STALE" : "OFFLINE"}</span>
            <span>{showServoDiagnostics ? "−" : "+"}</span>
          </button>
          {showServoDiagnostics && (
            <div className="mt-1 space-y-0.5 border-t border-slate-200 dark:border-slate-700 pt-1 break-words">
              {servoDiagnostics?.data ? (
                <>
                  <div>mode {servoDiagnostics.data.mode ?? "--"} · PWM {servoDiagnostics.data.pan_attached ? "P" : "p"}/{servoDiagnostics.data.tilt_attached ? "T" : "t"} · limit {servoDiagnostics.data.pan_at_limit ? "P" : "-"}/{servoDiagnostics.data.tilt_at_limit ? "T" : "-"}</div>
                  <div>target {servoDiagnostics.data.target_pan ?? "--"}/{servoDiagnostics.data.target_tilt ?? "--"}° · command {servoDiagnostics.data.command_pan ?? "--"}/{servoDiagnostics.data.command_tilt ?? "--"}°</div>
                  <div>pulse {servoDiagnostics.data.pulse_pan_us ?? "--"}/{servoDiagnostics.data.pulse_tilt_us ?? "--"} µs · Wi‑Fi {servoDiagnostics.data.wifi_rssi ?? "--"} dBm</div>
                  <div>radar {servoDiagnostics.data.radar_age_ms ?? "--"} ms · joystick {servoDiagnostics.data.manual_age_ms ?? "--"} ms · loop gap {servoDiagnostics.data.loop_gap_ms ?? "--"} ms</div>
                  <div>move count {servoDiagnostics.data.manual_count ?? "--"} · hold count {servoDiagnostics.data.hold_heartbeats ?? "--"} · age {servoDiagnostics.age_seconds ?? "--"} s</div>
                  <div>boot {servoDiagnostics.device_health?.boot_reset_reason ?? servoDiagnostics.data.boot_reset_reason ?? "--"} @ {servoDiagnostics.device_health?.boot_reset_stage ?? servoDiagnostics.data.boot_reset_stage ?? "--"} · task WDT {servoDiagnostics.device_health?.task_wdt_count ?? servoDiagnostics.data.task_wdt_count ?? "--"}</div>
                  <div>slow stage {servoDiagnostics.device_health?.slow_loop_stage ?? servoDiagnostics.data.slow_loop_stage ?? "--"} · {servoDiagnostics.device_health?.slow_loop_stage_ms ?? servoDiagnostics.data.slow_loop_stage_ms ?? "--"} ms · MQTT connect {servoDiagnostics.device_health?.mqtt_connect_ms ?? servoDiagnostics.data.mqtt_connect_ms ?? "--"} ms</div>
                  <div>heap {servoDiagnostics.data.free_heap ?? "--"} · min {servoDiagnostics.data.min_free_heap ?? "--"} · largest {servoDiagnostics.data.largest_free_block ?? "--"} bytes</div>
                  <div>stack loop/net {servoDiagnostics.data.loop_stack_free ?? "--"}/{servoDiagnostics.data.network_stack_free ?? "--"} bytes · drop RX/TX/log {servoDiagnostics.data.rx_dropped ?? "--"}/{servoDiagnostics.data.tx_dropped ?? "--"}/{servoDiagnostics.data.log_dropped ?? "--"}</div>
                  <div>{servoDiagnostics.data.fw ?? "--"} · uptime {servoDiagnostics.data.uptime_ms === undefined ? "--" : Math.floor(servoDiagnostics.data.uptime_ms / 1000)} s · boot net {servoDiagnostics.data.boot_network_stage ?? "--"}</div>
                  {servoDiagnostics.last_config_result && <div>config: {servoDiagnostics.last_config_result}</div>}
                </>
              ) : <div>ESP32 chưa gửi telemetry.</div>}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
