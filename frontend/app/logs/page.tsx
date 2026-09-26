"use client";
import React, { useState } from "react";
import { useAlerts } from "../context/AlertsContext";
import { useTranslation } from "../context/LanguageContext";
import { Clock, ShieldAlert, CheckCircle2, Trash2, Search, Filter, CheckSquare } from "lucide-react";

export default function LogsPage() {
  const { alerts, acknowledgeAlert, acknowledgeMultiple, clearAlerts } = useAlerts();
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNACK" | "ACK">("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const getAlertMessage = (alert: any) => {
    const key = `alert.${alert.eventCode}`;
    const translated = t(key);
    return translated !== key ? translated : alert.message;
  };

  const filteredAlerts = alerts.filter(alert => {
    const query = searchQuery.toLowerCase();
    const msg = getAlertMessage(alert).toLowerCase();
    const matchesSearch = 
      msg.includes(query) || 
      alert.eventCode.toLowerCase().includes(query) ||
      alert.timestamp.toLowerCase().includes(query);
    
    if (statusFilter === "ACK") return matchesSearch && alert.acknowledged;
    if (statusFilter === "UNACK") return matchesSearch && !alert.acknowledged;
    return matchesSearch;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleAcknowledgeSelected = () => {
    acknowledgeMultiple(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f5f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-y-auto transition-colors duration-300">
      <header className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-[#fdfdfe] dark:bg-[#111827] flex flex-col md:flex-row md:justify-between md:items-center gap-4 shrink-0 sticky top-0 z-10 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t("logs.title")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("logs.subtitle")}</p>
          </div>
        </div>
        
        <div className="flex flex-1 md:max-w-xl items-center justify-end gap-3 w-full">
          {selectedIds.size > 0 && (
            <button
              onClick={handleAcknowledgeSelected}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm font-semibold shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              <CheckSquare className="w-4 h-4" />
              {t("logs.ackSelected")} ({selectedIds.size})
            </button>
          )}

          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={t("logs.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-700 dark:text-slate-300 transition-colors"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <option value="ALL">{t("logs.allStatus")}</option>
            <option value="UNACK">{t("logs.unack")}</option>
            <option value="ACK">{t("logs.ack")}</option>
          </select>
          
          <button
            onClick={clearAlerts}
            disabled={alerts.length === 0}
            className={`flex items-center justify-center p-2 rounded-lg transition-colors border shadow-sm ${
              alerts.length > 0
                ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border-slate-200 dark:border-slate-700'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
            }`}
            title={t("logs.clearLogs")}
          >
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto w-full p-6 md:p-8">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden transition-colors">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-600 gap-3">
              <Filter className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">{t("logs.noMatch")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#0b0f19] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                  <tr>
                    <th className="px-4 py-4 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="px-2 py-4 font-semibold uppercase tracking-wider text-[11px]">{t("logs.time")}</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">{t("logs.eventType")}</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] w-full">{t("logs.message")}</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">{t("logs.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredAlerts.map((alert) => (
                    <tr key={alert.id} className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${alert.acknowledged ? 'opacity-60' : ''} ${selectedIds.has(alert.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedIds.has(alert.id)}
                          onChange={() => toggleSelect(alert.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-2 py-4">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {alert.timestamp}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded ${
                          alert.acknowledged 
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400' 
                            : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                        }`}>
                          {alert.eventCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${alert.acknowledged ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {getAlertMessage(alert)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {alert.acknowledged ? (
                          <span className="inline-flex items-center justify-end gap-1.5 text-slate-400 dark:text-slate-500 text-xs font-semibold w-full">
                            <CheckCircle2 className="w-4 h-4" />
                            {t("live.acknowledged")}
                          </span>
                        ) : (
                          <button 
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t("live.acknowledge")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
