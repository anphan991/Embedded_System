"use client";
import { useEffect, useState, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

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

const RadarCoverageShape = (props: any) => {
  const { x, y, width, height, radarX, radarY, radarAngle, rWidth, rLength } = props;
  
  if (typeof x !== 'number' || isNaN(x) || isNaN(width) || isNaN(y) || isNaN(height)) return null;

  const R = 6; // 6m radius

  // Convert angles to radians (0 = facing +Y, 90 = facing +X)
  const leftAngle = ((radarAngle - 60) * Math.PI) / 180;
  const rightAngle = ((radarAngle + 60) * Math.PI) / 180;

  // Conversion functions from Room Coordinates to SVG Pixel Coordinates
  const toPixelX = (roomX: number) => x + (roomX / rWidth) * width;
  const toPixelY = (roomY: number) => y + height - (roomY / rLength) * height; // SVG Y is inverted

  // Center point
  const cx = toPixelX(radarX);
  const cy = toPixelY(radarY);
  
  // Left and Right edge points of the arc
  const startX = toPixelX(radarX + R * Math.sin(leftAngle));
  const startY = toPixelY(radarY + R * Math.cos(leftAngle));
  const endX = toPixelX(radarX + R * Math.sin(rightAngle));
  const endY = toPixelY(radarY + R * Math.cos(rightAngle));

  // Ellipse radii in pixels (in case the grid is not perfectly square due to margins)
  const rx = (R / rWidth) * width;
  const ry = (R / rLength) * height;

  return (
    <g>
      <path 
        d={`M ${cx} ${cy} L ${startX} ${startY} A ${rx} ${ry} 0 0 1 ${endX} ${endY} Z`} 
        fill="rgba(59, 130, 246, 0.15)" 
        stroke="rgba(59, 130, 246, 0.6)" 
        strokeDasharray="4 4"
      />
      <circle cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#60a5fa" fontSize={11} fontWeight="bold" fontFamily="monospace">RADAR</text>
    </g>
  );
};

export default function RadarMap({ zones, roomConfig }: RadarMapProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Footstep Trail Mapping states
  const [isRecording, setIsRecording] = useState(false);
  const [trail, setTrail] = useState<any[]>([]);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const fetchData = () => {
    fetch(`http://localhost:8000/api/v1/radar/history?limit=30&_t=${Date.now()}`, { cache: "no-store" })
      .then(res => res.json())
      .then(result => {
        if (result.status === "success" && result.data && result.data.length > 0) {
          const formattedData = result.data.map((item: any) => ({
            ...item,
            time: new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }));
          
          // Lấy điểm mới nhất
          const latestPoint = formattedData[formattedData.length - 1];
          setData([latestPoint]);

          // Nếu đang bật chế độ vẽ bản đồ, lưu vết chân
          if (isRecordingRef.current) {
            setTrail(prev => {
              // Tránh lưu 2 điểm trùng nhau liên tiếp
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                if (last.id === latestPoint.id || (last.pos_x === latestPoint.pos_x && last.pos_y === latestPoint.pos_y)) {
                  return prev;
                }
              }
              return [...prev, latestPoint];
            });
          }
        }
      });
  };

  useEffect(() => {
    fetchData(); // Fetch initial data
    const interval = setInterval(fetchData, 1000); // Poll faster (1s) to get smooth trail
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const rWidth = Math.max(1, Number(roomConfig.width) || 6);
  const rLength = Math.max(1, Number(roomConfig.length) || 6);
  const rRadarX = Number(roomConfig.radar_x) || 0;
  const rRadarY = Number(roomConfig.radar_y) || 0;
  const rRadarAngle = Number(roomConfig.radar_angle) || 0;

  // Generate ticks
  const xTicks = [];
  for (let i = 0; i <= rWidth; i++) xTicks.push(i);
  const yTicks = [];
  for (let i = 0; i <= rLength; i++) yTicks.push(i);

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 p-6 bg-[#09090b]">
      {/* 2D Minimap Section */}
      <div className="flex-1 min-h-[400px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></span>
            Live Spatial Map (Radar 2D)
          </h2>
          <div className="flex gap-2">
            {trail.length > 0 && (
              <button 
                onClick={() => setTrail([])}
                className="px-2 py-1 text-[10px] font-mono bg-red-900/30 hover:bg-red-900/60 border border-red-500/30 rounded text-red-300 transition"
              >
                ✖ CLEAR TRAIL
              </button>
            )}
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className={`px-3 py-1 text-[10px] font-mono rounded transition border flex items-center gap-2 ${isRecording ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'}`}
            >
              {isRecording ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  RECORDING TRAIL...
                </>
              ) : (
                "RECORD TRAIL"
              )}
            </button>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="px-2 py-1 text-[10px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition"
            >
              ↻ REFRESH
            </button>
          </div>
        </div>
        
        <div className="flex-1 w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" aspect={rWidth / rLength} maxHeight={600}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} />
              
              {/* Radar Coverage Arc */}
              <ReferenceArea 
                x1={0} x2={rWidth} 
                y1={0} y2={rLength} 
                shape={<RadarCoverageShape radarX={rRadarX} radarY={rRadarY} radarAngle={rRadarAngle} rWidth={rWidth} rLength={rLength} />} 
              />

              {/* Vùng động */}
              {zones.map((z, idx) => {
                const isSafe = z.type === 'SAFE';
                const color = isSafe ? '#22c55e' : '#ef4444';
                return (
                  <ReferenceArea 
                    key={idx} 
                    x1={Number(z.x_min)} x2={Number(z.x_max)} 
                    y1={Number(z.y_min)} y2={Number(z.y_max)} 
                    fill={color} 
                    fillOpacity={0.15} 
                    stroke={color}
                    strokeOpacity={0.6}
                    strokeDasharray="4 4"
                    label={{ position: 'inside', value: `[${z.type}] ${z.name}`, fill: color, fontSize: 11, fontWeight: 'bold' }}
                  />
                );
              })}

              <XAxis type="number" dataKey="pos_x" name="X" domain={[0, rWidth]} ticks={xTicks} tickFormatter={(v) => v === 0 ? '' : v} stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis type="number" dataKey="pos_y" name="Y" domain={[0, rLength]} ticks={yTicks} tickFormatter={(v) => v === 0 ? '' : v} stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10 }} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              
              {/* Footstep Trail */}
              {trail.length > 0 && (
                <Scatter 
                  name="Footsteps" 
                  data={trail} 
                  fill="#f59e0b" 
                  shape="cross" 
                  line={{ stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5' }} 
                />
              )}

              {/* Current Target */}
              <Scatter name="Target" data={data} fill="#3b82f6" shape="circle" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
