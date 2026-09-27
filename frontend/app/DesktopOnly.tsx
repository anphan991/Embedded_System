"use client";

import React, { useState, useEffect } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { useTranslation } from "./context/LanguageContext";

export default function DesktopOnly({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f4f5f7] dark:bg-[#0b0f19] h-full">
        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 border-8 border-white dark:border-[#111827] shadow-sm">
          <Monitor className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t("common.desktopRequired")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-8">
          {t("common.desktopRequiredDesc")}
        </p>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <Smartphone className="w-4 h-4 line-through opacity-70" />
          <span>{t("common.desktopRequired")}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
