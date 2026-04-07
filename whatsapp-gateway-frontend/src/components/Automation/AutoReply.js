import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { automationAPI } from "../../services/api";

const AutoReply = () => {
  const { sessions, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [autoreplyList, setAutoreplyList] = useState([]);
  const [formData, setFormData] = useState({
    session: "",
    keyword: "",
    response: "",
    persona: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAutoreply();
  }, []);

  const fetchAutoreply = async () => {
    try {
      const res = await automationAPI.getAutoreply();
      if (res.data.success) {
        setAutoreplyList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch auto replies", err);
      addDebugInfo(`❌ Fetch autoreply error: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData, is_active: true };
      const res = await automationAPI.addAutoreply(payload);
      if (res.data.success) {
        showStatus("✅ Berhasil membuat auto-reply", "success");
        setFormData({
          session: "",
          keyword: "",
          response: "",
          persona: "",
        });
        fetchAutoreply();
      }
    } catch (err) {
      showStatus("❌ Gagal membuat auto-reply: " + (err.response?.data?.error || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus auto-reply ini?")) return;
    try {
      await automationAPI.deleteAutoreply(id);
      showStatus("✅ Auto-reply dihapus", "success");
      fetchAutoreply();
    } catch (err) {
      showStatus("❌ Gagal menghapus auto-reply", "error");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="main-card">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <span className="mr-3">🤖</span> Buat Auto Reply Baru
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
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Kata Kunci (Keyword)
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="Contoh: 'harga', 'info', 'tanya'"
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Jawaban Otomatis
            </label>
            <textarea
              className="form-input w-full min-h-[120px]"
              rows="4"
              value={formData.response}
              onChange={(e) => setFormData({ ...formData, response: e.target.value })}
              placeholder="Tulis jawaban otomatis Anda di sini..."
              required
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Karakter / Persona (Opsional)
            </label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="Contoh: 'Customer Service yang ramah', 'Asisten Pintar'"
              value={formData.persona}
              onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
            />
            <p className="text-sm text-gray-400 mt-2">💡 Tips: Menentukan karakter agar jawaban terasa lebih luwes.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full py-4 text-lg ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loading ? "Memproses..." : "Aktifkan Auto Reply"}
          </button>
        </form>
      </div>

      <div className="main-card">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <span className="mr-3">🚀</span> Daftar Auto Reply Aktif
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Kata Kunci</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tanggapan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Persona</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Sesi</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {autoreplyList.length > 0 ? (
                autoreplyList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-indigo-600 bg-indigo-50/50 inline-block px-3 py-1 rounded-xl">
                        {item.keyword}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 italic">
                        "{item.response}"
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 font-medium">
                        {item.persona || <span className="text-gray-300">Default</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.session}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                    Belum ada auto reply terdaftar
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

export default AutoReply;
