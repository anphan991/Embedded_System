"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Map, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "./context/LanguageContext";
import { getBackendBaseUrl } from "./backendUrl";

export type ZoneConfig = {
  type: string;
  name: string;
  x_min: number | string;
  x_max: number | string;
  y_min: number | string;
  y_max: number | string;
};

export type RoomConfig = {
  width: number | string;
  length: number | string;
  radar_x: number | string;
  radar_y: number | string;
  radar_angle?: number | string;
};

type RadarHistoryItem = { timestamp: number; pos_x: number; pos_y: number; speed: number };
type RadarPoint = RadarHistoryItem & { time: string };
type RadarStatusResponse = {
  status: string;
  online?: boolean;
  age_seconds?: number | null;
  zone_state?: string;
  zone_name?: string | null;
  safe_zone_count?: number;
  danger_zone_count?: number;
  data?: RadarHistoryItem | null;
};
type ZoneBounds = { x_min: number; x_max: number; y_min: number; y_max: number };
type MapStatus = "loading" | "live" | "waiting" | "stale" | "offline";

interface RadarMapProps {
  zones: ZoneConfig[];
  roomConfig: RoomConfig;
  onZoneChange?: (index: number, bounds: ZoneBounds) => void;
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 700;
const PLOT = { x: 92, y: 34, width: 850, height: 560 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toFinite(value: number | string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function svgPointForPointer(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse());
}

export default function RadarMap({ zones, roomConfig, onZoneChange }: RadarMapProps) {
  const [data, setData] = useState<RadarPoint[]>([]);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [backendZoneState, setBackendZoneState] = useState<{ state: string; name: string | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [trail, setTrail] = useState<RadarPoint[]>([]);
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [themeReady, setThemeReady] = useState(false);
  const isDark = themeReady && resolvedTheme === "dark";
  const isRecordingRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
    bounds: ZoneBounds;
  } | null>(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setThemeReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const fetchData = useCallback(async (manual = false) => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (manual) setRefreshing(true);

    try {
      const response = await fetch(`${getBackendBaseUrl()}/api/v1/radar/status`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Radar API returned HTTP ${response.status}`);
      const result = await response.json() as RadarStatusResponse;
      if (result.status === "success") {
        setBackendZoneState({ state: result.zone_state || "WAITING", name: result.zone_name || null });
      }
      const latest = result.status === "success" ? result.data : null;

      if (!latest) {
        setData([]);
        setStatus(result.status === "success" ? "waiting" : "offline");
        return;
      }

      const values = [latest.timestamp, latest.pos_x, latest.pos_y, latest.speed].map(Number);
      if (!values.every(Number.isFinite)) {
        setData([]);
        setStatus("waiting");
        return;
      }
      // The backend evaluates freshness using its own clock. Comparing the
      // timestamp with the browser clock can hide a valid live point.
      if (!result.online) {
        setData([]);
        setStatus("stale");
        return;
      }

      const latestPoint: RadarPoint = {
        timestamp: values[0],
        pos_x: values[1],
        pos_y: values[2],
        speed: values[3],
        time: new Date(values[0] * 1000).toLocaleTimeString(),
      };
      setData([latestPoint]);
      setStatus("live");

      if (isRecordingRef.current) {
        setTrail((previous) => {
          const last = previous[previous.length - 1];
          if (last && last.pos_x === latestPoint.pos_x && last.pos_y === latestPoint.pos_y) return previous;
          return [...previous, latestPoint].slice(-200);
        });
      }
    } catch {
      setData([]);
      setStatus("offline");
      setBackendZoneState(null);
    } finally {
      fetchInFlightRef.current = false;
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchData(), 0);
    const interval = window.setInterval(() => void fetchData(), 500);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [fetchData]);

  const roomWidth = Math.max(0.1, toFinite(roomConfig.width, 6));
  const roomLength = Math.max(0.1, toFinite(roomConfig.length, 6));
  const radarX = toFinite(roomConfig.radar_x, 0);
  const radarY = toFinite(roomConfig.radar_y, 0);
  const radarAngle = toFinite(roomConfig.radar_angle, 0);
  const xToSvg = (value: number) => PLOT.x + (value / roomWidth) * PLOT.width;
  const yToSvg = (value: number) => PLOT.y + PLOT.height - (value / roomLength) * PLOT.height;
  const xStep = roomWidth <= 4 ? 0.5 : 1;
  const yStep = roomLength <= 4 ? 0.5 : 1;
  const xTicks = Array.from({ length: Math.floor(roomWidth / xStep) + 1 }, (_, index) => index * xStep);
  const yTicks = Array.from({ length: Math.floor(roomLength / yStep) + 1 }, (_, index) => index * yStep);
  const latest = data[0];
  const zonesOutsideRoom = zones.filter((zone) => {
    const xMin = toFinite(zone.x_min, Number.NaN);
    const xMax = toFinite(zone.x_max, Number.NaN);
    const yMin = toFinite(zone.y_min, Number.NaN);
    const yMax = toFinite(zone.y_max, Number.NaN);
    return ![xMin, xMax, yMin, yMax].every(Number.isFinite) ||
      xMin < 0 || xMax > roomWidth || yMin < 0 || yMax > roomLength;
  }).length;
  const dangerAtPoint = latest && zones.find((zone) =>
    zone.type === "DANGER" &&
    latest.pos_x >= toFinite(zone.x_min, Number.NaN) && latest.pos_x <= toFinite(zone.x_max, Number.NaN) &&
    latest.pos_y >= toFinite(zone.y_min, Number.NaN) && latest.pos_y <= toFinite(zone.y_max, Number.NaN));
  const safeAtPoint = latest && zones.find((zone) =>
    zone.type === "SAFE" &&
    latest.pos_x >= toFinite(zone.x_min, Number.NaN) && latest.pos_x <= toFinite(zone.x_max, Number.NaN) &&
    latest.pos_y >= toFinite(zone.y_min, Number.NaN) && latest.pos_y <= toFinite(zone.y_max, Number.NaN));
  const targetOutsideRoom = Boolean(latest && (
    latest.pos_x < 0 || latest.pos_x > roomWidth || latest.pos_y < 0 || latest.pos_y > roomLength
  ));
  const targetColor = targetOutsideRoom ? "#f97316" : dangerAtPoint ? "#ef4444" : safeAtPoint ? "#10b981" : "#f59e0b";

  const statusText = latest
    ? `${t("radar.mapLiveStatus")} · X ${latest.pos_x.toFixed(2)} m · Y ${latest.pos_y.toFixed(2)} m`
    : t(`radar.mapStatus.${status}`);
  const zoneStatus = !latest
    ? null
    : dangerAtPoint
      ? { label: t("radar.pointInDangerZone").replace("{zone}", dangerAtPoint.name || "DANGER"), className: "text-rose-600 dark:text-rose-400" }
      : safeAtPoint
        ? { label: t("radar.pointInSafeZone").replace("{zone}", safeAtPoint.name || "SAFE"), className: "text-emerald-600 dark:text-emerald-400" }
        : { label: t("radar.pointOutsideZones"), className: "text-amber-600 dark:text-amber-400" };

  const onPointerDown = (event: ReactPointerEvent<SVGRectElement>, index: number, zone: ZoneConfig) => {
    if (!onZoneChange) return;
    const point = svgPointForPointer(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      index,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      bounds: {
        x_min: toFinite(zone.x_min, 0),
        x_max: toFinite(zone.x_max, 0),
        y_min: toFinite(zone.y_min, 0),
        y_max: toFinite(zone.y_max, 0),
      },
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onZoneChange) return;
    const point = svgPointForPointer(svgRef.current, event.clientX, event.clientY);
    if (!point) return;

    const zoneWidth = drag.bounds.x_max - drag.bounds.x_min;
    const zoneLength = drag.bounds.y_max - drag.bounds.y_min;
    if (zoneWidth <= 0 || zoneLength <= 0) return;
    const deltaX = ((point.x - drag.startX) / PLOT.width) * roomWidth;
    const deltaY = -((point.y - drag.startY) / PLOT.height) * roomLength;
    const xMin = clamp(drag.bounds.x_min + deltaX, 0, Math.max(0, roomWidth - zoneWidth));
    const yMin = clamp(drag.bounds.y_min + deltaY, 0, Math.max(0, roomLength - zoneLength));
    onZoneChange(drag.index, {
      x_min: xMin,
      x_max: xMin + zoneWidth,
      y_min: yMin,
      y_max: yMin + zoneLength,
    });
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const radarRange = Math.hypot(roomWidth, roomLength) * 1.5;
  const coveragePoints = Array.from({ length: 25 }, (_, index) => {
    const angle = (radarAngle - 60 + index * 5) * Math.PI / 180;
    return `${xToSvg(clamp(radarX + radarRange * Math.sin(angle), 0, roomWidth))},${yToSvg(clamp(radarY + radarRange * Math.cos(angle), 0, roomLength))}`;
  });
  const coveragePath = `M ${xToSvg(clamp(radarX, 0, roomWidth))} ${yToSvg(clamp(radarY, 0, roomLength))} L ${coveragePoints.join(" L ")} Z`;
  const gridColor = isDark ? "#334155" : "#dbe3ee";
  const axisColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <div className="flex h-full min-h-0 w-full flex-col p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 transition-colors dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <Map className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {t("radar.liveMap")}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${status === "live" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-amber-500"}`} />
            <span>{statusText}</span>
            {zoneStatus && <span className={`font-semibold ${zoneStatus.className}`}>· {zoneStatus.label}</span>}
            {latest && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: targetColor }} />
                {t("radar.targetMarker")}
              </span>
            )}
            {backendZoneState && (
              <span className="font-medium text-slate-400 dark:text-slate-500">
                · {t("radar.backendZoneState")}: {backendZoneState.state}{backendZoneState.name ? ` — ${backendZoneState.name}` : ""}
              </span>
            )}
          </div>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {latest && zoneStatus ? zoneStatus.label : t(`radar.mapStatus.${status}`)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {trail.length > 0 && (
            <button
              onClick={() => setTrail([])}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t("radar.clearTrail")}
            </button>
          )}
          <button
            onClick={() => setIsRecording((recording) => !recording)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition ${isRecording
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}
          >
            {isRecording && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            {isRecording ? t("radar.recording") : t("radar.recordTrail")}
          </button>
          <button
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {t("radar.refresh")}
          </button>
        </div>
      </div>

      {zonesOutsideRoom > 0 && (
        <p className="mt-3 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          {t("radar.zoneOutsideRoom").replace("{count}", String(zonesOutsideRoom))}
        </p>
      )}

      <div className="min-h-0 flex-1 pt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full select-none"
          role="img"
          aria-label={t("radar.mapAccessibleLabel")}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <defs>
            <clipPath id="radar-room-clip">
              <rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height} />
            </clipPath>
          </defs>

          <rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height} rx="4" fill={isDark ? "#0b1220" : "#f8fafc"} stroke={isDark ? "#475569" : "#94a3b8"} strokeDasharray="5 4" />

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line x1={xToSvg(tick)} y1={PLOT.y} x2={xToSvg(tick)} y2={PLOT.y + PLOT.height} stroke={gridColor} strokeDasharray="3 5" />
              <text x={xToSvg(tick)} y={PLOT.y + PLOT.height + 22} textAnchor="middle" fill={axisColor} fontSize="12">{tick.toFixed(tick % 1 ? 1 : 0)}</text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line x1={PLOT.x} y1={yToSvg(tick)} x2={PLOT.x + PLOT.width} y2={yToSvg(tick)} stroke={gridColor} strokeDasharray="3 5" />
              <text x={PLOT.x - 14} y={yToSvg(tick) + 4} textAnchor="end" fill={axisColor} fontSize="12">{tick.toFixed(tick % 1 ? 1 : 0)}</text>
            </g>
          ))}
          <text x={PLOT.x + PLOT.width / 2} y={VIEW_HEIGHT - 18} textAnchor="middle" fill={axisColor} fontSize="12" fontWeight="600">X (m)</text>
          <text x="20" y={PLOT.y + PLOT.height / 2} textAnchor="middle" fill={axisColor} fontSize="12" fontWeight="600" transform={`rotate(-90 20 ${PLOT.y + PLOT.height / 2})`}>Y (m)</text>

          <g clipPath="url(#radar-room-clip)">
            <path d={coveragePath} fill="rgba(59, 130, 246, 0.10)" stroke="rgba(59, 130, 246, 0.36)" strokeDasharray="5 5" />

            {zones.map((zone, index) => {
              const rawXMin = toFinite(zone.x_min, Number.NaN);
              const rawXMax = toFinite(zone.x_max, Number.NaN);
              const rawYMin = toFinite(zone.y_min, Number.NaN);
              const rawYMax = toFinite(zone.y_max, Number.NaN);
              if (![rawXMin, rawXMax, rawYMin, rawYMax].every(Number.isFinite) || rawXMin >= rawXMax || rawYMin >= rawYMax) return null;

              const xMin = clamp(rawXMin, 0, roomWidth);
              const xMax = clamp(rawXMax, 0, roomWidth);
              const yMin = clamp(rawYMin, 0, roomLength);
              const yMax = clamp(rawYMax, 0, roomLength);
              if (xMin >= xMax || yMin >= yMax) return null;

              const color = zone.type === "SAFE" ? "#10b981" : "#ef4444";
              const x = xToSvg(xMin);
              const y = yToSvg(yMax);
              const width = xToSvg(xMax) - x;
              const height = yToSvg(yMin) - y;
              return (
                <g key={`${zone.type}-${index}`}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="4"
                    fill={color}
                    fillOpacity="0.16"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    style={{ cursor: onZoneChange ? "grab" : "default", touchAction: "none" }}
                    onPointerDown={(event) => onPointerDown(event, index, zone)}
                  />
                  <text x={x + 8} y={y + 17} fill={color} fontSize="12" fontWeight="700" pointerEvents="none">
                    {zone.name || (zone.type === "SAFE" ? "SAFE" : "DANGER")}
                  </text>
                </g>
              );
            })}

            {trail.length > 1 && (
              <polyline
                points={trail.map((point) => `${xToSvg(clamp(point.pos_x, 0, roomWidth))},${yToSvg(clamp(point.pos_y, 0, roomLength))}`).join(" ")}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
            )}

            <circle cx={xToSvg(clamp(radarX, 0, roomWidth))} cy={yToSvg(clamp(radarY, 0, roomLength))} r="6" fill="#2563eb" stroke={isDark ? "#0b1220" : "#fff"} strokeWidth="2" />
            <text x={xToSvg(clamp(radarX, 0, roomWidth)) + 9} y={yToSvg(clamp(radarY, 0, roomLength)) - 9} fill={isDark ? "#93c5fd" : "#1d4ed8"} fontSize="11" fontWeight="700">RADAR</text>

            {latest && (
              <g>
                <circle
                  cx={xToSvg(clamp(latest.pos_x, 0, roomWidth))}
                  cy={yToSvg(clamp(latest.pos_y, 0, roomLength))}
                  r="9"
                  fill={targetColor}
                  stroke="white"
                  strokeWidth="3"
                />
                <circle cx={xToSvg(clamp(latest.pos_x, 0, roomWidth))} cy={yToSvg(clamp(latest.pos_y, 0, roomLength))} r="15" fill="none" stroke={targetColor} strokeOpacity="0.55" strokeWidth="2">
                  <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.55;0.05;0.55" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </g>
        </svg>
      </div>
      <p className="pt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
        {onZoneChange ? t("radar.mapEditHint") : t("radar.mapStatusHint")}
      </p>
    </div>
  );
}
