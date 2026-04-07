import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { automationAPI } from "../../services/api";

const AutoReply = () => {
  const { availableSessions, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [autoreplyList, setAutoreplyList] = useState([]);
  const [formData, setFormData] = useState({
    session: "",
    keyword: "",
    response: "",
    persona: "",
    schedule_type: "all",
    custom_days: "",
    start_time: "07:30",
    end_time: "16:00",
  });
  const [loading, setLoading] = useState(false);

  const daysOptions = [
    { value: "monday", label: "Senin" },
    { value: "tuesday", label: "Selasa" },
    { value: "wednesday", label: "Rabu" },
    { value: "thursday", label: "Kamis" },
    { value: "friday", label: "Jumat" },
    { value: "saturday", label: "Sabtu" },
    { value: "sunday", label: "Minggu" },
  ];

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
          schedule_type: "all",
          custom_days: "",
          start_time: "07:30",
          end_time: "16:00",
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

  const handleDayToggle = (day) => {
    const currentDays = formData.custom_days ? formData.custom_days.split(",") : [];
    let newDays;
    if (currentDays.includes(day)) {
      newDays = currentDays.filter(d => d !== day);
    } else {
      newDays = [...currentDays, day];
    }
    setFormData({ ...formData, custom_days: newDays.join(",") });
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
                {availableSessions && availableSessions.map((s) => (
                  <option key={typeof s === 'string' ? s : s.sessionId} value={typeof s === 'string' ? s : s.sessionId}>
                    {typeof s === 'string' ? s : s.sessionId}
                  </option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Jadwal Aktif
              </label>
              <select
                className="form-input w-full"
                value={formData.schedule_type}
                onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
              >
                <option value="all">Setiap Saat (24 Jam)</option>
                <option value="working_hours">Jam Kerja (Senin-Jumat, 07:30-16:00)</option>
                <option value="outside_working_hours">Diluar Jam Kerja</option>
                <option value="custom">Kustom Hari & Jam</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Persona (Opsional)
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="Contoh: 'Asisten Ramah'"
                value={formData.persona}
                onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
              />
            </div>
          </div>

          {formData.schedule_type === "custom" && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-slide-up">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-600">Pilih Hari</label>
                <div className="flex flex-wrap gap-2">
                  {daysOptions.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDayToggle(day.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        formData.custom_days?.includes(day.value)
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "bg-white text-gray-500 border border-gray-100 hover:border-indigo-300"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-600">Jam Mulai</label>
                  <input
                    type="time"
                    className="form-input w-full"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-600">Jam Selesai</label>
                  <input
                    type="time"
                    className="form-input w-full"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Keyword</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tanggapan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Jadwal</th>
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
                      <div className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
                        Sesi: {item.session} | Persona: {item.persona || 'Default'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase
                        ${item.schedule_type === 'working_hours' ? 'bg-green-50 text-green-700' : 
                          item.schedule_type === 'outside_working_hours' ? 'bg-orange-50 text-orange-700' : 
                          item.schedule_type === 'custom' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'}`}>
                        {item.schedule_type === 'working_hours' ? 'Jam Kerja' : 
                         item.schedule_type === 'outside_working_hours' ? 'Luar Jam Kerja' : 
                         item.schedule_type === 'custom' ? 'Kustom' : '24 Jam'}
                      </span>
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
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-medium">
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
