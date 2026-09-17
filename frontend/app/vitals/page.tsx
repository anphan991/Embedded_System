"use client";
import React from "react";
import Link from "next/link";
import HealthChart from "../HealthChart";

export default function VitalsDashboard() {
  return (
    <div className="min-h-screen bg-[#09090b] text-gray-200 font-sans selection:bg-rose-500/30">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.6)] animate-pulse" />
          <h1 className="text-sm font-semibold tracking-widest text-gray-100 uppercase">
            Medical Telemetry
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-300 rounded transition border border-white/10"
          >
            BACK TO CAMERA
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8">
        
        {/* Intro/Summary section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Status</h3>
            <div className="text-2xl font-bold text-emerald-400">STABLE</div>
          </div>
          <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Current Target</h3>
            <div className="text-2xl font-bold text-gray-200">Patient #0</div>
          </div>
          <div className="p-6 bg-white/5 border border-white/5 rounded-xl flex flex-col justify-center">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Radar Sensor</h3>
            <div className="text-2xl font-bold text-blue-400">LD2410 ONLINE</div>
          </div>
        </div>

        {/* The Chart */}
        <div className="w-full bg-[#121214] border border-white/5 rounded-xl shadow-2xl overflow-hidden">
          <HealthChart />
        </div>
        
        {/* Placeholder for future features */}
        <div className="w-full h-48 border border-dashed border-white/10 rounded-xl flex items-center justify-center bg-white/[0.02]">
          <span className="text-gray-600 font-mono text-xs uppercase tracking-widest">
            Future Module Workspace (e.g., Sleep Analysis, ECG)
          </span>
        </div>

      </main>
    </div>
  );
}

