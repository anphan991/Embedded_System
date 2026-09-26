"use client";
import React, { useState } from "react";
import { Radar, Activity, Maximize2, Save, Map as MapIcon, Crosshair } from "lucide-react";
import RadarMap from "../RadarMap";
import { useTranslation } from "../context/LanguageContext";

export type ZoneConfig = {
  type: string;
  name: string;
  x_min: number | string;
  x_max: number | string;
  y_min: number | string;
  y_max: number | string;
};

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    roomWidth: 4000,
    roomLength: 5000,
    radarPosX: 2000,
    radarPosY: 0,
    radarYaw: 0
  });

  const [zones, setZones] = useState<ZoneConfig[]>([
    { type: 'SAFE', name: '', x_min: 0, x_max: 2000, y_min: 0, y_max: 2000 },
    { type: 'DANGER', name: '', x_min: 3000, x_max: 5000, y_min: 4000, y_max: 5000 },
  ]);

  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
    }, 600);
  };

  const handleZoneChange = (index: number, field: keyof ZoneConfig, value: string) => {
    const newZones = [...zones];
    newZones[index] = { ...newZones[index], [field]: field === 'name' ? value : Number(value) };
    setZones(newZones);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f5f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      {/* Header */}
      <header className="px-8 py-4 border-b border-slate-200 dark:border-slate-800 bg-[#fdfdfe] dark:bg-[#111827] flex justify-between items-center shrink-0 shadow-sm transition-colors z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t("radar.title")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("radar.subtitle")}</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors shadow-sm ${
            saving 
              ? 'bg-indigo-400 text-white cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? t("radar.saving") : t("radar.saveConfig")}
        </button>
      </header>

      {/* Main Content - Full Height Flex */}
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full p-4 md:p-6 gap-6">
        
        {/* Left Column: Configuration Controls (Scrollable) */}
        <div className="w-full lg:w-96 flex flex-col gap-6 shrink-0 h-full overflow-y-auto pr-1 pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors shrink-0">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-[#0f141e]">
              <MapIcon className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("radar.configureMap")}</h2>
            </div>
            
            <div className="p-5 space-y-6">
              {/* Dimensions Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">{t("radar.roomDims")}</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label className="font-medium text-slate-700 dark:text-slate-300">{t("radar.roomWidth")} (mm)</label>
                      <span className="text-slate-500">{config.roomWidth}</span>
                    </div>
                    <input 
                      type="range" min="2000" max="8000" step="100"
                      value={config.roomWidth} 
                      onChange={(e) => setConfig({...config, roomWidth: Number(e.target.value)})}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label className="font-medium text-slate-700 dark:text-slate-300">{t("radar.roomLength")} (mm)</label>
                      <span className="text-slate-500">{config.roomLength}</span>
                    </div>
                    <input 
                      type="range" min="2000" max="8000" step="100"
                      value={config.roomLength} 
                      onChange={(e) => setConfig({...config, roomLength: Number(e.target.value)})}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5 mt-2">
                      <label className="font-medium text-slate-700 dark:text-slate-300">{t("radar.radarPosX")} (mm)</label>
                      <span className="text-slate-500">{config.radarPosX}</span>
                    </div>
                    <input 
                      type="range" min="0" max={config.roomWidth} step="100"
                      value={config.radarPosX} 
                      onChange={(e) => setConfig({...config, radarPosX: Number(e.target.value)})}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label className="font-medium text-slate-700 dark:text-slate-300">{t("radar.radarPosY")} (mm)</label>
                      <span className="text-slate-500">{config.radarPosY}</span>
                    </div>
                    <input 
                      type="range" min="0" max={config.roomLength} step="100"
                      value={config.radarPosY} 
                      onChange={(e) => setConfig({...config, radarPosY: Number(e.target.value)})}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label className="font-medium text-slate-700 dark:text-slate-300">{t("radar.radarYaw")} (°)</label>
                      <span className="text-slate-500">{config.radarYaw}°</span>
                    </div>
                    <input 
                      type="range" min="-180" max="180" step="5"
                      value={config.radarYaw} 
                      onChange={(e) => setConfig({...config, radarYaw: Number(e.target.value)})}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Zones Section */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                  {t("radar.zoneConstraints")}
                </h3>
                <div className="space-y-4">
                  {zones.map((zone, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${zone.type === 'SAFE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                          {zone.type}
                        </span>
                        <input 
                          value={zone.name}
                          onChange={(e) => handleZoneChange(idx, 'name', e.target.value)}
                          className="bg-transparent border-b border-slate-300 dark:border-slate-600 text-xs font-medium focus:outline-none focus:border-indigo-500 text-right w-24 text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500">X MIN (mm)</label>
                          <input type="number" step="100" value={zone.x_min} onChange={e => handleZoneChange(idx, 'x_min', e.target.value)} className="bg-white dark:bg-[#0b0f19] p-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500">X MAX (mm)</label>
                          <input type="number" step="100" value={zone.x_max} onChange={e => handleZoneChange(idx, 'x_max', e.target.value)} className="bg-white dark:bg-[#0b0f19] p-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500">Y MIN (mm)</label>
                          <input type="number" step="100" value={zone.y_min} onChange={e => handleZoneChange(idx, 'y_min', e.target.value)} className="bg-white dark:bg-[#0b0f19] p-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500">Y MAX (mm)</label>
                          <input type="number" step="100" value={zone.y_max} onChange={e => handleZoneChange(idx, 'y_max', e.target.value)} className="bg-white dark:bg-[#0b0f19] p-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed text-center">
                    {t("radar.infoText")}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-[11px] font-medium uppercase tracking-wider">{t("radar.patientStatus")}</span>
              </div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t("radar.stable")}</div>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Maximize2 className="w-4 h-4" />
                <span className="text-[11px] font-medium uppercase tracking-wider">{t("radar.roomEnv")}</span>
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{config.roomWidth/1000}m x {config.roomLength/1000}m</div>
            </div>
          </div>
          


        </div>

        {/* Right Column: Interactive Map */}
        <div className="flex-1 h-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors relative">
          <RadarMap 
            zones={zones.map(z => ({
              ...z,
              x_min: Number(z.x_min) / 1000,
              x_max: Number(z.x_max) / 1000,
              y_min: Number(z.y_min) / 1000,
              y_max: Number(z.y_max) / 1000
            }))} 
            roomConfig={{
              width: config.roomWidth / 1000,
              length: config.roomLength / 1000,
              radar_x: config.radarPosX / 1000,
              radar_y: config.radarPosY / 1000,
              radar_angle: config.radarYaw
            }} 
          />
        </div>

      </main>
    </div>
  );
}
