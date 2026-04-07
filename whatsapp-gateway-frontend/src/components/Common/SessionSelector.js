import React from "react";
import { useApp } from "../../context/AppContext";

const SessionSelector = () => {
  const { sessionName, setSessionName, availableSessions, sessionsLoading, refreshSessions } = useApp();

  return (
    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <label
          htmlFor="sessionSelect"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          📱 Pilih Sesi WhatsApp (Pengirim)
        </label>
        <button 
          type="button"
          onClick={refreshSessions}
          disabled={sessionsLoading}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <svg className={`w-3 h-3 ${sessionsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Sesi
        </button>
      </div>
      
      <div className="relative">
        <select
          id="sessionSelect"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          className="form-input w-full appearance-none pr-10"
          disabled={sessionsLoading}
        >
          {availableSessions.length > 0 ? (
            availableSessions.map((s) => (
              <option key={s} value={s}>
                🟩 {s} (Terhubung)
              </option>
            ))
          ) : (
            <option value="">Tidak ada sesi aktif. Harap hubungkan di Dashboard.</option>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {availableSessions.length === 0 && (
        <p className="mt-2 text-xs text-red-500">
          ⚠️ Anda belum memiliki sesi aktif. Silakan kembali ke menu <b>Dashboard</b> untuk scan QR Code.
        </p>
      )}
    </div>
  );
};

export default SessionSelector;
