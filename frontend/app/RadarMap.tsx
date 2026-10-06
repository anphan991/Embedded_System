"use client";
import { useEffect, useState, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Map, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from './context/LanguageContext';
import { getBackendBaseUrl } from './backendUrl';

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

interface RadarMapProps {
  zones: ZoneConfig[];
  roomConfig: RoomConfig;
}

type RadarCoverageProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radarX: number;
  radarY: number;
  radarAngle: number;
  rWidth: number;
  rLength: number;
  isDark: boolean;
};

type RadarHistoryItem = { timestamp: number; pos_x: number; pos_y: number; speed: number };
type RadarPoint = RadarHistoryItem & { time: string };
type RadarHistoryResponse = { status: string; data?: RadarHistoryItem[] };
type RadarDataStatus = "loading" | "live" | "stale" | "empty" | "error";

function formatRadarAge(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

const RadarCoverageShape = (props: RadarCoverageProps) => {
  const { x, y, width, height, radarX, radarY, radarAngle, rWidth, rLength, isDark } = props;
  
  if (typeof x !== 'number' || typeof y !== 'number' ||
      typeof width !== 'number' || typeof height !== 'number' ||
      ![x, y, width, height].every(Number.isFinite)) return null;

  const R = 6;

  const leftAngle = ((radarAngle - 60) * Math.PI) / 180;
  const rightAngle = ((radarAngle + 60) * Math.PI) / 180;

  const toPixelX = (roomX: number) => x + (roomX / rWidth) * width;
  const toPixelY = (roomY: number) => y + height - (roomY / rLength) * height;

  const cx = toPixelX(radarX);
  const cy = toPixelY(radarY);
  
  const startX = toPixelX(radarX + R * Math.sin(leftAngle));
  const startY = toPixelY(radarY + R * Math.cos(leftAngle));
  const endX = toPixelX(radarX + R * Math.sin(rightAngle));
  const endY = toPixelY(radarY + R * Math.cos(rightAngle));

  const rx = (R / rWidth) * width;
  const ry = (R / rLength) * height;

  return (
    <g>
      <path 
        d={`M ${cx} ${cy} L ${startX} ${startY} A ${rx} ${ry} 0 0 1 ${endX} ${endY} Z`} 
        fill={isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.15)"} 
        stroke={isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.7)"} 
        strokeDasharray="4 4"
      />
      <circle cx={cx} cy={cy} r={5} fill="#2563eb" stroke={isDark ? "#111827" : "#fff"} strokeWidth={2} />
      <text x={cx} y={cy + 16} textAnchor="middle" fill={isDark ? "#60a5fa" : "#2563eb"} fontSize={10} fontWeight="700" fontFamily="sans-serif">RADAR</text>
    </g>
  );
};

export default function RadarMap({ zones, roomConfig }: RadarMapProps) {
  const [data, setData] = useState<RadarPoint[]>([]);
  const [latestPoint, setLatestPoint] = useState<RadarPoint | null>(null);
  const [radarStatus, setRadarStatus] = useState<RadarDataStatus>("loading");
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  
  const [isRecording, setIsRecording] = useState(false);
  const [trail, setTrail] = useState<RadarPoint[]>([]);
  const isRecordingRef = useRef(isRecording);
  const fetchInFlightRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const fetchData = async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setLoading(true);
    try {
      const response = await fetch(`${getBackendBaseUrl()}/api/v1/radar/history?limit=1`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Radar history request failed: HTTP ${response.status}`);

      const result: RadarHistoryResponse = await response.json();
      if (result.status !== "success") throw new Error("Radar history API returned an error");

      const latest = result.data?.[result.data.length - 1];
      if (!latest) {
        setData([]);
        setLatestPoint(null);
        setRadarStatus("empty");
        return;
      }

      const point = {
        timestamp: Number(latest.timestamp),
        pos_x: Number(latest.pos_x),
        pos_y: Number(latest.pos_y),
        speed: Number(latest.speed),
        time: new Date(Number(latest.timestamp) * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      if (![point.timestamp, point.pos_x, point.pos_y, point.speed].every(Number.isFinite)) {
        throw new Error("Radar history returned invalid coordinates");
      }

      setLatestPoint(point);
      // Do not plot old DB records as if they were live. Keep the last values
      // visible in the status readout so a disconnected radar is diagnosable.
      const ageSeconds = Date.now() / 1000 - point.timestamp;
      if (ageSeconds >= -1 && ageSeconds <= 6) {
        setData([point]);
        setRadarStatus("live");

        if (isRecordingRef.current) {
          setTrail(prev => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.pos_x === point.pos_x && last.pos_y === point.pos_y) return prev;
            }
            return [...prev, point].slice(-200);
          });
        }
      } else {
        setData([]);
        setRadarStatus("stale");
      }
    } catch {
      setData([]);
      setRadarStatus("error");
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const rWidth = Math.max(1, Number(roomConfig.width) || 6);
  const rLength = Math.max(1, Number(roomConfig.length) || 6);
  const rRadarX = Number(roomConfig.radar_x) || 0;
  const rRadarY = Number(roomConfig.radar_y) || 0;
  const rRadarAngle = Number(roomConfig.radar_angle) || 0;
  const latestAgeSeconds = latestPoint
    ? Math.max(0, Date.now() / 1000 - latestPoint.timestamp)
    : null;
  const latestPointInRoom = latestPoint !== null &&
    latestPoint.pos_x >= 0 && latestPoint.pos_x <= rWidth &&
    latestPoint.pos_y >= 0 && latestPoint.pos_y <= rLength;
  const statusLabel: Record<RadarDataStatus, string> = {
    loading: "radar.waiting",
    live: "radar.live",
    stale: "radar.stale",
    empty: "radar.noTelemetry",
    error: "radar.backendError",
  };

  const xTicks = [];
  for (let i = 0; i <= rWidth; i++) xTicks.push(i);
  const yTicks = [];
  for (let i = 0; i <= rLength; i++) yTicks.push(i);

  return (
    <div className="w-full flex flex-col h-full p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Map className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t("radar.liveMap")}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${radarStatus === "live" ? "bg-emerald-500" : radarStatus === "error" ? "bg-red-500" : "bg-amber-500"}`} />
            <span>{t(statusLabel[radarStatus])}</span>
            {latestPoint && (
              <>
                <span className="font-mono">X {latestPoint.pos_x.toFixed(2)} m · Y {latestPoint.pos_y.toFixed(2)} m · V {latestPoint.speed.toFixed(2)} m/s</span>
                {radarStatus === "stale" && latestAgeSeconds !== null && (
                  <span className="text-amber-600 dark:text-amber-400">· {t("radar.lastSeen")} {formatRadarAge(latestAgeSeconds)}</span>
                )}
                {!latestPointInRoom && (
                  <span className="text-red-600 dark:text-red-400">· {t("radar.outsideRoom")}</span>
                )}
              </>
            )}
          </div>
          {trail.length > 0 && (
            <button 
              onClick={() => setTrail([])}
              className="px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition shadow-sm"
            >
              {t("radar.clearTrail")}
            </button>
          )}
          <button 
            onClick={() => setIsRecording(!isRecording)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition border shadow-sm flex items-center gap-2 ${
              isRecording 
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50' 
                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {isRecording ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {t("radar.recording")}
              </>
            ) : (
              t("radar.recordTrail")
            )}
          </button>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition shadow-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            {t("radar.refresh")}
          </button>
        </div>
      </div>
      
      <div className="flex-1 w-full flex items-center justify-center transition-colors min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#cbd5e1"} />
            
            <ReferenceArea 
              x1={0} x2={rWidth} 
              y1={0} y2={rLength} 
              shape={<RadarCoverageShape radarX={rRadarX} radarY={rRadarY} radarAngle={rRadarAngle} rWidth={rWidth} rLength={rLength} isDark={isDark} />} 
            />

            {zones.map((z, idx) => {
              const isSafe = z.type === 'SAFE';
              const color = isSafe ? '#10b981' : '#ef4444';
              return (
                <ReferenceArea 
                  key={idx} 
                  x1={Number(z.x_min)} x2={Number(z.x_max)} 
                  y1={Number(z.y_min)} y2={Number(z.y_max)} 
                  fill={color} 
                  fillOpacity={isDark ? 0.15 : 0.15} 
                  stroke={color}
                  strokeOpacity={isDark ? 0.6 : 0.8}
                  strokeDasharray="4 4"
                  label={{ position: 'inside', value: z.name, fill: color, fontSize: 12, fontWeight: 700 }}
                />
              );
            })}

            <XAxis type="number" dataKey="pos_x" name="X" domain={[0, rWidth]} ticks={xTicks} tickFormatter={(v) => v === 0 ? '' : v} stroke={isDark ? "#475569" : "#94a3b8"} tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 500 }} />
            <YAxis type="number" dataKey="pos_y" name="Y" domain={[0, rLength]} ticks={yTicks} tickFormatter={(v) => v === 0 ? '' : v} stroke={isDark ? "#475569" : "#94a3b8"} tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 500 }} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3', stroke: isDark ? '#64748b' : '#94a3b8' }}
              contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', color: isDark ? '#f8fafc' : '#1e293b', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              itemStyle={{ color: isDark ? '#60a5fa' : '#2563eb', fontWeight: 500 }}
            />
            
            {trail.length > 0 && (
              <Scatter 
                name="Footsteps" 
                data={trail} 
                fill="#d97706" 
                shape="cross" 
                line={{ stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 4' }} 
              />
            )}

            <Scatter name="Target" data={data} fill={isDark ? "#3b82f6" : "#2563eb"} shape="circle" />
          </ScatterChart>
        </ResponsiveContainer>
        {radarStatus !== "live" && (
          <div className="pointer-events-none absolute inset-4 flex items-center justify-center">
            <div className="max-w-md rounded-lg border border-slate-300/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-950/85 px-4 py-3 text-center shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(statusLabel[radarStatus])}</p>
              {latestPoint ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {t("radar.lastKnown")}: X {latestPoint.pos_x.toFixed(2)} m · Y {latestPoint.pos_y.toFixed(2)} m
                  {latestAgeSeconds !== null && ` · ${formatRadarAge(latestAgeSeconds)}`}
                  {!latestPointInRoom && ` · ${t("radar.outsideRoom")}`}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("radar.checkRadarLink")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
