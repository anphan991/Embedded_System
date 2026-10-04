"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "./context/LanguageContext";

const CALIBRATION_KEYS = [
  "PAN_MIN", "PAN_MAX", "PAN_CENTER", "PAN_OFFSET", "PAN_DIR",
  "TILT_MIN", "TILT_MAX", "TILT_CENTER", "TILT_OFFSET", "TILT_DIR",
  "SPEED_DPS", "RADAR_ALPHA", "CAMERA_HEIGHT_MM", "TARGET_HEIGHT_MM", "LOST_ACTION",
] as const;

type CalibrationKey = typeof CALIBRATION_KEYS[number];
type ServoDiag = {
  status: string;
  online: boolean | null;
  capabilities?: { config: boolean };
  fresh: boolean;
  hardware_mode: string | null;
  config: Record<string, string | number> | null;
  last_config_result: string | null;
};

function apiBaseFromSetting(serverUrl: string): string {
  const fallback = `http://${window.location.hostname}:8000/api/v1`;
  try {
    const url = new URL(serverUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    if (["localhost", "127.0.0.1"].includes(url.hostname) &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname)) return fallback;
    return `${url.origin}/api/v1`;
  } catch {
    return fallback;
  }
}

export default function ServoCalibrationPanel({ serverUrl }: { serverUrl: string }) {
  const { t } = useTranslation();
  const [diag, setDiag] = useState<ServoDiag | null>(null);
  const [keyName, setKeyName] = useState<CalibrationKey>("RADAR_ALPHA");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "pending" | "error"; text: string } | null>(null);
  const ready = Boolean(diag?.online && diag.fresh && diag.hardware_mode === "MANUAL");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${apiBaseFromSetting(serverUrl)}/servo/diag`, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok || data.status !== "success") throw new Error("Servo diagnostics unavailable");
    setDiag(data);
  }, [serverUrl]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(`${apiBaseFromSetting(serverUrl)}/servo/diag`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (active) setDiag(response.ok && data.status === "success" ? data : null);
      } catch {
        if (active) setDiag(null);
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [serverUrl]);

  const send = async (commandKey: string, commandValue?: string) => {
    setBusy(true);
    setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`${apiBaseFromSetting(serverUrl)}/servo/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandValue === undefined ? { key: commandKey } : { key: commandKey, value: commandValue }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.status === "error") {
        setResult({ kind: "error", text: data.message ?? t("servo.commandFailed") });
      } else if (data.status === "pending") {
        setResult({ kind: "pending", text: data.message ?? t("servo.pending") });
      } else {
        setResult({ kind: "success", text: data.device_result ?? data.command ?? t("servo.applied") });
        if (commandValue !== undefined) setValue("");
      }
      // Diagnostics refresh is independent of the command result. Do not
      // keep the controls busy if a later GET stalls on a broken network.
      const refreshController = new AbortController();
      const refreshTimeout = window.setTimeout(() => refreshController.abort(), 1500);
      void refresh(refreshController.signal).catch(() => {}).finally(() => window.clearTimeout(refreshTimeout));
    } catch {
      setResult({ kind: "error", text: t("servo.backendUnavailable") });
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  const currentValue = diag?.config?.[keyName.toLowerCase()];

  if (diag?.capabilities?.config === false) {
    return <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-2">
      <h2 className="text-sm font-semibold">{t("servo.calibrationTitle")}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("servo.legacyUnsupported")}</p>
    </section>;
  }

  return (
    <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden transition-colors">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-[#0f141e]">
        <SlidersHorizontal className="w-5 h-5 text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("servo.calibrationTitle")}</h2>
        <span className={`ml-auto text-xs font-semibold ${ready ? "text-emerald-600" : "text-amber-600"}`}>
          {diag?.online ? `ESP32 ${diag.hardware_mode ?? "MODE?"} · ${diag.fresh ? "LIVE" : "STALE"}` : "ESP32 OFFLINE"}
        </span>
      </div>
      <div className="p-6 space-y-4 text-sm">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t("servo.calibrationHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void send("STATUS")} disabled={busy}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            STATUS
          </button>
          <button type="button" onClick={() => void send("TEST_PAN")} disabled={busy || !ready}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            TEST PAN ±8°
          </button>
          <button type="button" onClick={() => void send("TEST_TILT")} disabled={busy || !ready}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            TEST TILT ±8°
          </button>
          <button type="button" onClick={() => void send("CENTER")} disabled={busy || !ready}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            CENTER
          </button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (!busy && ready && value.trim()) void send(keyName, value.trim()); }}
          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="servo-config-key" className="block text-xs font-medium mb-1">{t("servo.parameter")}</label>
            <select id="servo-config-key" value={keyName} onChange={(event) => { setKeyName(event.target.value as CalibrationKey); setValue(""); }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f19] px-3 py-2 font-mono text-xs">
              {CALIBRATION_KEYS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="servo-config-value" className="block text-xs font-medium mb-1">
              {t("servo.newValue")} · {t("servo.currentValue")}: {currentValue ?? "--"}
            </label>
            {keyName === "PAN_DIR" || keyName === "TILT_DIR" || keyName === "LOST_ACTION" ? (
              <select id="servo-config-value" value={value} onChange={(event) => setValue(event.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f19] px-3 py-2 font-mono text-xs">
                <option value="">--</option>
                {(keyName === "LOST_ACTION" ? ["HOLD", "CENTER"] : ["-1", "1"]).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : (
              <input id="servo-config-value" type="number" inputMode="decimal" step="any" value={value}
                onChange={(event) => setValue(event.target.value)} placeholder={currentValue === undefined ? "" : String(currentValue)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f19] px-3 py-2 font-mono text-xs" />
            )}
          </div>
          <button type="submit" disabled={busy || !ready || !value.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "..." : t("servo.apply")}
          </button>
        </form>
        {result && <p role="status" className={`rounded-lg px-3 py-2 text-xs break-words ${
          result.kind === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" :
          result.kind === "pending" ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" :
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
        }`}>{result.text}</p>}
        {diag?.last_config_result && <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {t("servo.lastAck")}: {diag.last_config_result}
        </p>}
      </div>
    </section>
  );
}
