"use client";
import React, { useState } from "react";
import { Settings, Info, Save, Cpu, Camera, Database, BellRing, DatabaseBackup, Trash2, Smartphone } from "lucide-react";
import { useTranslation } from "../context/LanguageContext";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  
  // 1. AI Thresholds
  const [aiSensitivity, setAiSensitivity] = useState(75);
  const [multiTarget, setMultiTarget] = useState(true);

  // 2. Camera & Server
  const [camIp, setCamIp] = useState("192.168.1.100");
  const [serverUrl, setServerUrl] = useState("http://localhost:8000/api/v1");

  // 4. Integrations
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [zaloToken, setZaloToken] = useState("");

  // Load saved settings on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('fallguard_settings');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.aiSensitivity !== undefined) setAiSensitivity(data.aiSensitivity);
        if (data.multiTarget !== undefined) setMultiTarget(data.multiTarget);
        if (data.camIp) setCamIp(data.camIp);
        if (data.serverUrl) setServerUrl(data.serverUrl);
        if (data.telegramToken) setTelegramToken(data.telegramToken);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
        if (data.zaloToken) setZaloToken(data.zaloToken);
      } catch (e) {}
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    
    // Persist to browser storage
    const data = { aiSensitivity, multiTarget, camIp, serverUrl, telegramToken, telegramChatId, zaloToken };
    localStorage.setItem('fallguard_settings', JSON.stringify(data));

    // Simulate API call to backend
    setTimeout(() => {
      setSaving(false);
      alert("Settings saved successfully!");
    }, 600);
  };

  const handleClearDatabase = () => {
    if (confirm("Are you sure you want to clear all historical logs in the database? This action cannot be undone.")) {
      // Simulate API call
      alert("Database cleared successfully!");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f5f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-y-auto transition-colors duration-300">
      <header className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-[#fdfdfe] dark:bg-[#111827] flex justify-between items-center shrink-0 sticky top-0 z-10 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t("settings.title")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("settings.subtitle")}</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors shadow-sm ${
            saving 
              ? 'bg-blue-400 text-white cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? "..." : t("settings.saveChanges")}
        </button>
      </header>

      <main className="max-w-[1000px] mx-auto w-full p-6 md:p-8 space-y-6">
        
        {/* Section 1: AI Settings */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-[#0f141e]">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("settings.aiAlgo")}</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.sensitivity")}</label>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">{aiSensitivity}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={aiSensitivity} 
                onChange={(e) => setAiSensitivity(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {t("settings.sensitivityDesc")}
              </p>
            </div>
            
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.multiTarget")}</h3>
                <p className="text-xs text-slate-500 mt-1">{t("settings.multiTargetDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={multiTarget} onChange={(e) => setMultiTarget(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Section 2: Connectivity */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-[#0f141e]">
            <Camera className="w-5 h-5 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("settings.camServer")}</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.camIp")}</label>
              <input 
                type="text" 
                value={camIp}
                onChange={(e) => setCamIp(e.target.value)}
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="192.168.x.x"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.backendUrl")}</label>
              <input 
                type="text" 
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="http://..."
              />
            </div>
          </div>
        </section>

        {/* Section 3: Integrations */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-[#0f141e]">
            <BellRing className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("settings.integrations")}</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 mt-1">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.teleToken")}</label>
                  <input 
                    type="password" 
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  />
                  <p className="text-xs text-slate-500 mt-2">{t("settings.teleTokenDesc")}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.teleChatId")}</label>
                  <input 
                    type="text" 
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="e.g. -1001234567890 or 987654321"
                  />
                  <p className="text-xs text-slate-500 mt-2">{t("settings.teleChatIdDesc")}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 mt-1">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("settings.zaloToken")}</label>
                <input 
                  type="password" 
                  value={zaloToken}
                  onChange={(e) => setZaloToken(e.target.value)}
                  className="w-full bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Paste Zalo API Key for ZNS messages"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Storage Management */}
        <section className="bg-white dark:bg-[#111827] border border-red-200 dark:border-red-900/30 shadow-sm rounded-xl overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3 bg-red-50/50 dark:bg-red-900/10">
            <Database className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-400">{t("settings.storage")}</h2>
          </div>
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{t("settings.clearDb")}</h3>
              <p className="text-xs text-slate-500 mt-1">{t("settings.clearDbDesc")}</p>
            </div>
            <button 
              onClick={handleClearDatabase}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {t("settings.clearDbBtn")}
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
