"use client";
import React, { useEffect, useState } from "react";

export default function ReIdPanel() {
  const [enabled, setEnabled] = useState(false);
  const [persons, setPersons] = useState<any[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (enabled) {
      interval = setInterval(() => {
        fetch('http://localhost:8000/api/v1/tracking/persons')
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success') {
              setPersons(data.data);
            }
          })
          .catch(() => {});
      }, 1000);
    } else {
      setPersons([]);
    }
    return () => clearInterval(interval);
  }, [enabled]);

  const lockPatient = (id: number) => {
    fetch('http://localhost:8000/api/v1/tracking/lock_patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: id })
    });
  };

  const unlockPatient = () => {
    fetch('http://localhost:8000/api/v1/tracking/unlock_patient', {
      method: 'POST'
    });
  };

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col mt-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse"></span>
          Smart Lock-On Re-ID
        </h2>
        <button 
          onClick={() => { setEnabled(!enabled); if(enabled) unlockPatient(); }}
          className={`px-3 py-1 text-[10px] font-mono rounded transition border ${enabled ? 'bg-purple-900/30 text-purple-300 border-purple-500/50' : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'}`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      {!enabled && (
        <div className="text-sm text-gray-500 italic text-center py-4">
          Turn ON to detect and lock patients vs caregivers.
        </div>
      )}

      {enabled && persons.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4 animate-pulse">
          Scanning for people in the room...
        </div>
      )}

      {enabled && persons.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-gray-400 mb-2">Select the patient to suppress caregiver alarms:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {persons.map(p => (
              <div key={p.id} className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${p.is_patient ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/10'}`}>
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className="text-sm font-bold text-gray-200 mb-1">
                  {p.is_patient ? "PATIENT" : "Person"} #{p.id}
                </div>
                {p.is_patient ? (
                  <button onClick={unlockPatient} className="mt-2 px-3 py-1 text-xs bg-red-900/30 text-red-300 border border-red-500/30 rounded hover:bg-red-900/50 transition">
                    Unlock
                  </button>
                ) : (
                  <button onClick={() => lockPatient(p.id)} className="mt-2 px-3 py-1 text-xs bg-purple-900/30 text-purple-300 border border-purple-500/30 rounded hover:bg-purple-900/50 transition">
                    Lock as Patient
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
