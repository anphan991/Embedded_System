"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldAlert, Settings, Camera, Radar, Moon, Sun, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "./context/LanguageContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false); // For mobile drawer

  // Close sidebar on mobile when navigating
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  
  const navItems = [
    { name: t("nav.liveView"), href: "/", icon: Camera },
    { name: t("nav.radarAnalytics"), href: "/analytics", icon: Radar },
    { name: t("nav.incidentLogs"), href: "/logs", icon: ShieldAlert },
    { name: t("nav.systemSettings"), href: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-sm relative z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/50">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="font-semibold text-slate-900 dark:text-slate-100 text-base">FallGuard</h1>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container (Fixed sliding drawer on mobile, static flex item on desktop) */}
      <div className={`fixed inset-y-0 left-0 transform ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 w-64 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex flex-col h-full shrink-0 shadow-sm z-50 transition-transform duration-300 ease-in-out`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 h-[72px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/50">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight text-lg">FallGuard</h1>
          </div>
          
          {(
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center font-bold text-[10px]"
                title="Toggle Language"
              >
                {language.toUpperCase()}
              </button>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
        
        <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-3 mt-2">
            {t("sidebar.monitoring")}
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3.5 flex flex-col gap-2 border border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("sidebar.systemStatus")}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{t("sidebar.online")}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
              v2.2.0-stable
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
