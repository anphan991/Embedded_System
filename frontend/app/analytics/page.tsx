"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import RadarMap, { ZoneConfig, RoomConfig } from "../RadarMap";
import ReIdPanel from "../ReIdPanel";

export default function AnalyticsDashboard() {
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ width: 6, length: 6, radar_x: 3, radar_y: 0, radar_angle: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/config/zones')
      .then(res => res.json())
      .then(data => { if (data.status === 'success') setZones(data.data); });
      
    fetch('http://localhost:8000/api/v1/config/room')
      .then(res => res.json())
      .then(data => { if (data.status === 'success') setRoomConfig(data.data); });
  }, []);

  const handleZoneChange = (index: number, field: keyof ZoneConfig, value: string) => {
    const newZones = [...zones];
    newZones[index] = { ...newZones[index], [field]: value };
    setZones(newZones);
  };

  const handleRoomChange = (field: keyof RoomConfig, value: string) => {
    setRoomConfig({ ...roomConfig, [field]: value });
  };

  const saveZones = async () => {
    setSaving(true);
    try {
      const payloadZones = zones.map(z => ({
        ...z,
        x_min: parseFloat(z.x_min as any) || 0,
        x_max: parseFloat(z.x_max as any) || 0,
        y_min: parseFloat(z.y_min as any) || 0,
        y_max: parseFloat(z.y_max as any) || 0,
      }));
      await fetch('http://localhost:8000/api/v1/config/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones: payloadZones })
      });
      
      const payloadRoom = {
        width: parseFloat(roomConfig.width as any) || 6,
        length: parseFloat(roomConfig.length as any) || 6,
        radar_x: parseFloat(roomConfig.radar_x as any) || 0,
        radar_y: parseFloat(roomConfig.radar_y as any) || 0,
        radar_angle: parseFloat(roomConfig.radar_angle as any) || 0,
      };
      await fetch('http://localhost:8000/api/v1/config/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadRoom)
      });
      
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-200 font-sans selection:bg-rose-500/30">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
          <h1 className="text-sm font-semibold tracking-widest text-gray-100 uppercase">
            Radar Spatial Analytics
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => isEditing ? saveZones() : setIsEditing(true)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition border ${isEditing ? 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'}`}
          >
            {saving ? "SAVING..." : isEditing ? "SAVE CONFIG" : "⚙️ CONFIGURE MAP"}
          </button>
          <Link 
            href="/"
            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-300 rounded transition border border-white/10"
          >
            ← BACK TO CAMERA
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8">
        
        {isEditing && (
          <div className="p-6 bg-[#121214] border border-blue-500/30 rounded-xl flex flex-col gap-6">
            <h2 className="text-sm font-mono text-blue-400 uppercase tracking-widest border-b border-white/10 pb-2">1. Room Dimensions & Radar Placement</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-black/40 border border-white/5 rounded-lg">
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">ROOM WIDTH (X)</label><input type="number" step="0.1" value={roomConfig.width} onChange={e => handleRoomChange('width', e.target.value)} className="bg-white/5 p-2 text-sm rounded border border-white/10" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">ROOM LENGTH (Y)</label><input type="number" step="0.1" value={roomConfig.length} onChange={e => handleRoomChange('length', e.target.value)} className="bg-white/5 p-2 text-sm rounded border border-white/10" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-blue-500">RADAR POS X</label><input type="number" step="0.1" value={roomConfig.radar_x} onChange={e => handleRoomChange('radar_x', e.target.value)} className="bg-blue-900/20 p-2 text-sm rounded border border-blue-500/30 text-blue-100" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-blue-500">RADAR POS Y</label><input type="number" step="0.1" value={roomConfig.radar_y} onChange={e => handleRoomChange('radar_y', e.target.value)} className="bg-blue-900/20 p-2 text-sm rounded border border-blue-500/30 text-blue-100" /></div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-blue-500">RADAR YAW (ROTATE)</label>
                <select value={roomConfig.radar_angle} onChange={e => handleRoomChange('radar_angle', e.target.value)} className="bg-blue-900/20 p-2 text-sm rounded border border-blue-500/30 text-blue-100 h-[38px] outline-none">
                  <option value="0" className="bg-[#121214] text-blue-100">0° (Facing Up)</option>
                  <option value="90" className="bg-[#121214] text-blue-100">90° (Facing Right)</option>
                  <option value="180" className="bg-[#121214] text-blue-100">180° (Facing Down)</option>
                  <option value="270" className="bg-[#121214] text-blue-100">270° (Facing Left)</option>
                </select>
              </div>
            </div>

            <h2 className="text-sm font-mono text-blue-400 uppercase tracking-widest border-b border-white/10 pb-2">2. Zone Constraints (Positive coordinates only)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {zones.map((zone, idx) => (
                <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${zone.type === 'SAFE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {zone.type}
                    </span>
                    <input 
                      value={zone.name}
                      onChange={(e) => handleZoneChange(idx, 'name', e.target.value)}
                      className="bg-transparent border-b border-white/20 text-sm focus:outline-none focus:border-blue-500 text-right"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">X MIN</label><input type="number" step="0.1" value={zone.x_min} onChange={e => handleZoneChange(idx, 'x_min', e.target.value)} className="bg-white/5 p-1 text-sm rounded border border-white/10" /></div>
                    <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">X MAX</label><input type="number" step="0.1" value={zone.x_max} onChange={e => handleZoneChange(idx, 'x_max', e.target.value)} className="bg-white/5 p-1 text-sm rounded border border-white/10" /></div>
                    <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">Y MIN</label><input type="number" step="0.1" value={zone.y_min} onChange={e => handleZoneChange(idx, 'y_min', e.target.value)} className="bg-white/5 p-1 text-sm rounded border border-white/10" /></div>
                    <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500">Y MAX</label><input type="number" step="0.1" value={zone.y_max} onChange={e => handleZoneChange(idx, 'y_max', e.target.value)} className="bg-white/5 p-1 text-sm rounded border border-white/10" /></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 italic">Adjust values above and watch the live minimap preview update instantly. Check if the Radar coverage arc covers your zones!</p>
          </div>
        )}

        {/* Intro/Summary section */}
        {!isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Dementia / Wandering</h3>
              <div className="text-2xl font-bold text-emerald-400">NO WANDERING</div>
              <div className="text-xs text-gray-500 mt-2">Time in Bed: 6h 30m</div>
            </div>
            <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Room Environment</h3>
              <div className="text-2xl font-bold text-purple-400">{roomConfig.width}m x {roomConfig.length}m</div>
              <div className="text-xs text-gray-500 mt-2">Radar at X={roomConfig.radar_x}, Y={roomConfig.radar_y} ({roomConfig.radar_angle}°)</div>
            </div>
            <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Radar Sensor</h3>
              <div className="text-2xl font-bold text-blue-400">LD2450 (2D) ONLINE</div>
              <div className="text-xs text-gray-500 mt-2">Multi-target tracking active</div>
            </div>
          </div>
        )}

        {/* The Maps */}
        <div className="w-full bg-[#121214] border border-white/5 rounded-xl shadow-2xl overflow-hidden">
          <RadarMap zones={zones} roomConfig={roomConfig} />
          <ReIdPanel />
        </div>

      </main>
    </div>
  );
}
