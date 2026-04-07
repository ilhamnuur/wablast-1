import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { sessionAPI } from "../../services/api";

const SessionManagement = () => {
  const { sessionName, setSessionName, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(null);
  const sessionCheckInterval = useRef(null);
  const qrFrameRef = useRef(null);
  const qrRefreshInterval = useRef(null);

  // Load sessions on mount
  useEffect(() => {
    refreshSessionsList();
    return () => {
        stopSessionMonitoring();
        stopQRAutoRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSessionsList = async () => {
    setLoading(true);
    try {
      const response = await sessionAPI.getSessions();
      addDebugInfo(`📊 Get sessions response: ${JSON.stringify(response.data)}`);

      let sessionList = [];
      const data = response.data.data || response.data;

      if (Array.isArray(data)) {
        sessionList = data;
      } else if (typeof data === "object" && data !== null) {
        sessionList = Object.keys(data);
      }

      setSessions(sessionList);
      if (sessionList.length > 0 && !sessionName) {
        setSessionName(sessionList[0]);
      }
    } catch (error) {
      console.error("Refresh sessions error:", error);
      addDebugInfo(`❌ Refresh sessions error: ${error.message}`);
      showStatus("Gagal memuat daftar sesi dari server", "error");
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    if (!sessionName.trim()) {
      showStatus("❌ Harap masukkan nama sesi", "error");
      return;
    }

    setLoading(true);
    try {
      await sessionAPI.startSession(sessionName);
      showStatus(`🚀 Memulai sesi "${sessionName}". Silakan scan QR code.`, "success");
      
      setQrVisible(true);
      setSessionStatus(`Menunggu scan QR code untuk sesi "${sessionName}"...`);
      
      // Give it a moment to initialize before showing QR
      setTimeout(() => {
        loadQRCode();
        startQRAutoRefresh();
        startSessionMonitoring(sessionName);
      }, 1000);
      
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      if (msg.includes("already exist")) {
        showStatus(`ℹ️ Sesi "${sessionName}" sudah ada. Memperbarui QR...`, "info");
        setQrVisible(true);
        loadQRCode();
        startQRAutoRefresh();
        startSessionMonitoring(sessionName);
      } else {
        showStatus(`❌ Gagal memulai sesi: ${msg}`, "error");
      }
    } finally {
      setLoading(false);
      refreshSessionsList();
    }
  };

  const loadQRCode = () => {
    const apiKey = process.env.REACT_APP_API_KEY || "your-secret-key";
    const qrUrl = `${process.env.REACT_APP_API_URL || "http://10.10.10.195:5001"}/session/start?session=${sessionName}&key=${apiKey}&t=${Date.now()}`;
    
    if (qrFrameRef.current) {
        qrFrameRef.current.src = qrUrl;
        addDebugInfo(`📱 QR Code Loaded: ${qrUrl}`);
    }
  };

  const startQRAutoRefresh = () => {
    stopQRAutoRefresh();
    // Refresh QR inside iframe every 20 seconds to prevent timeout/expiry
    qrRefreshInterval.current = setInterval(() => {
        if (qrVisible) {
            loadQRCode();
            addDebugInfo("🔄 Auto-refreshing QR code...");
        }
    }, 20000);
  };

  const stopQRAutoRefresh = () => {
    if (qrRefreshInterval.current) {
        clearInterval(qrRefreshInterval.current);
        qrRefreshInterval.current = null;
    }
  };

  const handleLogout = async (targetSession) => {
    const sessionToLogout = targetSession || sessionName;
    if (!sessionToLogout) return;

    if (!window.confirm(`Apakah Anda yakin ingin mengeluarkan sesi "${sessionToLogout}"?`)) {
        return;
    }

    setLoading(true);
    try {
      await sessionAPI.logoutSession(sessionToLogout);
      showStatus(`✅ Sesi "${sessionToLogout}" berhasil dikeluarkan`, "success");
      
      if (sessionToLogout === sessionName) {
        setQrVisible(false);
        setSessionStatus(null);
        stopSessionMonitoring();
        stopQRAutoRefresh();
      }
      
      refreshSessionsList();
    } catch (error) {
      showStatus(`❌ Gagal logout: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const startSessionMonitoring = (name) => {
    stopSessionMonitoring();
    sessionCheckInterval.current = setInterval(async () => {
      try {
        const response = await sessionAPI.getSessions();
        const data = response.data.data || response.data;
        let active = [];
        if (Array.isArray(data)) active = data;
        else if (data && typeof data === 'object') active = Object.keys(data);

        if (active.includes(name)) {
          showStatus(`🎉 Sesi "${name}" terhubung!`, "success");
          setSessionStatus(`✅ TERHUBUNG: Sesi "${name}" sudah aktif!`);
          
          stopSessionMonitoring();
          stopQRAutoRefresh();
          
          // Don't close immediately, let the user see the success status for 3 seconds
          setTimeout(() => {
            setQrVisible(false);
            setSessionStatus(null);
            refreshSessionsList();
          }, 3000);
        }
      } catch (e) {}
    }, 4000);
  };

  const stopSessionMonitoring = () => {
    if (sessionCheckInterval.current) {
      clearInterval(sessionCheckInterval.current);
      sessionCheckInterval.current = null;
    }
  };

  useEffect(() => () => stopSessionMonitoring(), []);

  return (
    <div className="main-card p-8 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manajemen Sesi WhatsApp
        </h2>
        <button 
          onClick={refreshSessionsList} 
          disabled={loading}
          className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
          title="Refresh Daftar"
        >
          <svg className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom 1 & 2: Form & QR */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Tambah atau Pilih Sesi
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="cth: mysession"
                className="form-input flex-1"
              />
              <button
                onClick={startNewSession}
                disabled={loading}
                className="btn-primary whitespace-nowrap"
              >
                🚀 Hubungkan
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Masukkan nama unik untuk device baru atau pilih dari daftar di samping.</p>
          </div>

          {sessionStatus && (
            <div className="p-4 rounded-xl border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 flex items-center">
              <div className="pulse-dot w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              <span className="text-blue-800 dark:text-blue-200 text-sm font-semibold">{sessionStatus}</span>
            </div>
          )}

          {qrVisible && (
            <div className="bg-white dark:bg-gray-700 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">📱 Scan untuk Sesi: {sessionName}</h3>
                <button onClick={() => setQrVisible(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden aspect-square max-w-[400px] mx-auto border-4 border-white dark:border-gray-600 shadow-inner">
                <iframe
                  ref={qrFrameRef}
                  className="w-full h-full border-0"
                  title="QR Code"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
              <div className="mt-6 text-center text-sm text-gray-500">
                Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat
              </div>
            </div>
          )}
        </div>

        {/* Kolom 3: Daftar Sesi */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 dark:text-gray-300 px-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Sesi Aktif di Server ({sessions.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {sessions.length > 0 ? (
              sessions.map((s) => (
                <div 
                  key={s} 
                  className={`p-4 rounded-xl border transition-all flex justify-between items-center group ${
                    s === sessionName 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary/50'
                  }`}
                >
                  <div className="cursor-pointer flex-1" onClick={() => setSessionName(s)}>
                    <div className="font-bold text-gray-900 dark:text-white">{s}</div>
                    <div className="text-xs text-green-500 font-medium">● Connected</div>
                  </div>
                  <button 
                    onClick={() => handleLogout(s)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Logout Sesi"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                Tidak ada sesi aktif
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManagement;
