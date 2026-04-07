import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { automationAPI, contactAPI } from "../../services/api";

const ScheduledMessages = () => {
  const { availableSessions, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [scheduledList, setScheduledList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [formData, setFormData] = useState({
    session: "",
    recipientType: "individual",
    recipient: "",
    message: "",
    media_url: "",
    scheduled_at: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchScheduled();
    fetchGroups();
  }, []);

  const fetchScheduled = async () => {
    try {
      const res = await automationAPI.getScheduled();
      if (res.data.success) {
        setScheduledList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch scheduled messages", err);
      addDebugInfo(`❌ Fetch scheduled error: ${err.message}`);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await contactAPI.getGroups();
      if (res.data.success) {
        setGroups(res.data.data.groups);
      }
    } catch (err) {
      console.error("Failed to fetch groups", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        type: formData.recipientType,
      };
      const res = await automationAPI.addScheduled(payload);
      if (res.data.success) {
        showStatus("✅ Berhasil menjadwalkan pesan", "success");
        setFormData({
          session: "",
          recipientType: "individual",
          recipient: "",
          message: "",
          media_url: "",
          scheduled_at: "",
        });
        fetchScheduled();
      }
    } catch (err) {
      showStatus("❌ Gagal menjadwalkan pesan: " + (err.response?.data?.error || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus jadwal ini?")) return;
    try {
      await automationAPI.deleteScheduled(id);
      showStatus("✅ Jadwal dihapus", "success");
      fetchScheduled();
    } catch (err) {
      showStatus("❌ Gagal menghapus jadwal", "error");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="main-card">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <span className="mr-3">⏰</span> Jadwalkan Pesan Baru
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Sesi WhatsApp
              </label>
              <select
                className="form-input w-full"
                value={formData.session}
                onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                required
              >
                <option value="">Pilih Sesi</option>
                {availableSessions && availableSessions.map((s) => (
                  <option key={typeof s === 'string' ? s : s.sessionId} value={typeof s === 'string' ? s : s.sessionId}>
                    {typeof s === 'string' ? s : s.sessionId}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Tipe Penerima
              </label>
              <select
                className="form-input w-full"
                value={formData.recipientType}
                onChange={(e) => setFormData({ ...formData, recipientType: e.target.value, recipient: "" })}
              >
                <option value="individual">Individu (Nomor HP)</option>
                <option value="blast">Blast (Grup)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Penerima
              </label>
              {formData.recipientType === "individual" ? (
                <input
                  type="text"
                  className="form-input w-full"
                  placeholder="628xxx"
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  required
                />
              ) : (
                <select
                  className="form-input w-full"
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  required
                >
                  <option value="">Pilih Grup</option>
                  {groups.map((g) => (
                    <option key={g.group_name} value={g.group_name}>{g.group_name} ({g.contact_count} kontak)</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Waktu Kirim
              </label>
              <input
                type="datetime-local"
                className="form-input w-full"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Pesan
            </label>
            <textarea
              className="form-input w-full min-h-[120px]"
              rows="4"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tulis pesan Anda di sini..."
              required
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              URL Media (Opsional)
            </label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="https://example.com/image.jpg"
              value={formData.media_url}
              onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full py-4 text-lg ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loading ? "Memproses..." : "Jadwalkan Pesan"}
          </button>
        </form>
      </div>

      <div className="main-card">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <span className="mr-3">📋</span> Daftar Jadwal Pesan
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Penerima</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Pesan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {scheduledList.length > 0 ? (
                scheduledList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{item.recipient}</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 mt-1 uppercase">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 truncate max-w-[200px]">{item.message}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {new Date(item.scheduled_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                        ${item.status === 'sent' ? 'bg-green-50 text-green-700 border border-green-100' : 
                          item.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 
                          'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-600 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-medium">
                    Belum ada pesan yang dijadwalkan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScheduledMessages;
