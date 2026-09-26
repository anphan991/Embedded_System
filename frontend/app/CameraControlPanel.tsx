"use client";
import React, { useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Settings2, ScanFace, RotateCcw } from "lucide-react";
import { useTranslation } from "./context/LanguageContext";

export default function CameraControlPanel() {
  const [autoTracking, setAutoTracking] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm transition-colors">
      <div className="bg-slate-50 dark:bg-[#111827] px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
        <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-500" />
          {t("cam.ptzControls")}
        </h3>
      </div>
      
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-500 dark:text-slate-400">{t("cam.mode")}</span>
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setAutoTracking(false)}
              className={`px-3 py-1.5 rounded-md transition-colors ${!autoTracking ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t("cam.manualMode")}
            </button>
            <button 
              onClick={() => setAutoTracking(true)}
              className={`px-3 py-1.5 rounded-md transition-colors ${autoTracking ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t("cam.autoTracking")}
            </button>
          </div>
        </div>

        {autoTracking ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-blue-600 dark:text-blue-400">
            <ScanFace className="w-8 h-8 animate-pulse" />
            <span className="text-xs font-semibold">{t("cam.autoActive")}</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center px-4">
              {t("cam.autoDesc")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm">
              <ArrowUp className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <button className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors shadow-sm" title="Reset Position">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <button className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors shadow-sm">
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
