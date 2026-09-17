"use client";
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function HealthChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('http://localhost:8000/api/v1/vitals/history?limit=30')
      .then(res => res.json())
      .then(result => {
        if (result.status === "success") {
          const formattedData = result.data.map((item: any) => ({
            ...item,
            time: new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }));
          setData(formattedData);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="w-full h-[350px] bg-[#09090b] p-6 flex flex-col relative">
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-3">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.8)] animate-pulse"></span>
            Vital Signs Analytics
          </h2>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-2 py-1 text-[10px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition flex items-center gap-1"
          >
            {loading ? "..." : "↻ REFRESH"}
          </button>
        </div>
        <span className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded text-gray-400">
          LAST 30 LOGS
        </span>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#52525b" 
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              stroke="#52525b" 
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px',
                color: '#e5e5e5',
                fontSize: '12px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              }}
              itemStyle={{ color: '#e5e5e5' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#a1a1aa' }}
              iconType="circle"
              iconSize={8}
            />
            <Line 
              type="monotone" 
              dataKey="bpm" 
              name="HEART RATE (BPM)" 
              stroke="#e11d48" 
              strokeWidth={2} 
              dot={{ r: 3, fill: '#09090b', stroke: '#e11d48', strokeWidth: 2 }} 
              activeDot={{ r: 6, fill: '#e11d48', stroke: 'rgba(225,29,72,0.3)', strokeWidth: 4 }} 
            />
            <Line 
              type="monotone" 
              dataKey="breath" 
              name="RESPIRATORY RATE" 
              stroke="#0ea5e9" 
              strokeWidth={2} 
              dot={{ r: 3, fill: '#09090b', stroke: '#0ea5e9', strokeWidth: 2 }} 
              activeDot={{ r: 6, fill: '#0ea5e9', stroke: 'rgba(14,165,233,0.3)', strokeWidth: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}