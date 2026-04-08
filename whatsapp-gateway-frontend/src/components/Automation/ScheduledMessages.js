import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { automationAPI, contactAPI } from "../../services/api";

const ScheduledMessages = () => {
  const { availableSessions, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [contacts, setContacts] = useState([]);
  const [scheduledList, setScheduledList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchScheduled();
    fetchGroups();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await contactAPI.getContacts();
      if (res.data.success) {
        setContacts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  };

  const [formData, setFormData] = useState({
    session: "",
    recipientType: "individual",
    recipient: "",
    message: "",
    media_url: "",
    scheduled_at: "",
    schedule_type: "once",
  });
  const [editingId, setEditingId] = useState(null);

  const formatDateTimeLocal = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const parseDateTimeLocal = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isValidScheduleDay = (scheduleType, date) => {
    const day = date.getDay();
    if (scheduleType === "working_days") {
      return day >= 1 && day <= 5;
    }
    if (scheduleType === "holidays") {
      return day === 0 || day === 6;
    }
    return true;
  };

  const getNextValidScheduleDate = (scheduleType, date) => {
    if (!date || scheduleType === "every_day") return date;
    const nextDate = new Date(date.getTime());
    if (scheduleType === "working_days") {
      while (!isValidScheduleDay(scheduleType, nextDate)) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
    if (scheduleType === "holidays") {
      while (!isValidScheduleDay(scheduleType, nextDate)) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
    return nextDate;
  };

  const adjustScheduledAt = (value, scheduleType) => {
    const date = parseDateTimeLocal(value);
    if (!date) return value;
    const adjusted = getNextValidScheduleDate(scheduleType, date);
    return formatDateTimeLocal(adjusted);
  };

  const normalizeScheduleType = (type) => {
    if (!type) return "every_day";
    if (type === "all") return "every_day";
    return type;
  };

  const fetchScheduled = async () => {
    try {
      const res = await automationAPI.getScheduled();
      if (res.data.success) {
        const normalized = res.data.data.map((item) => ({
          ...item,
          schedule_type: normalizeScheduleType(item.schedule_type),
        }));
        console.log("📋 Scheduled messages from API:", JSON.stringify(normalized, null, 2));
        setScheduledList(normalized);
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

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      session: "",
      recipientType: "individual",
      recipient: "",
      message: "",
      media_url: "",
      scheduled_at: "",
      schedule_type: "once",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : "",
        type: formData.recipientType,
        schedule_type: formData.schedule_type,
      };
      console.log("📤 Sending payload:", JSON.stringify(payload, null, 2));
      const res = editingId
        ? await automationAPI.updateScheduled(editingId, payload)
        : await automationAPI.addScheduled(payload);
      if (res.data.success) {
        showStatus(editingId ? "✅ Jadwal diperbarui" : "✅ Berhasil menjadwalkan pesan", "success");
        console.log("✅ Response data:", JSON.stringify(res.data.data, null, 2));
        resetForm();
        fetchScheduled();
      }
    } catch (err) {
      showStatus("❌ Gagal menjadwalkan pesan: " + (err.response?.data?.error || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      session: item.session || "",
      recipientType: item.type || "individual",
      recipient: item.recipient || "",
      message: item.message || "",
      media_url: item.media_url || "",
      scheduled_at: item.scheduled_at ? formatDateTimeLocal(new Date(item.scheduled_at)) : "",
      schedule_type: item.schedule_type || "once",
    });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus jadwal ini?")) return;
    try {
      await automationAPI.deleteScheduled(id);
      showStatus("✅ Jadwal dihapus", "success");
      if (editingId === id) {
        resetForm();
      }
      fetchScheduled();
    } catch (err) {
      showStatus("❌ Gagal menghapus jadwal", "error");
    }
  };

  const getDayName = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
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
                <select
                  className="form-input w-full"
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  required
                >
                  <option value="">Pilih Kontak</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.phone}>{c.name} ({c.phone})</option>
                  ))}
                </select>
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
                  Mulai kirim pada tanggal dan waktu kapan
                </label>
                <input
                  type="datetime-local"
                  className="form-input w-full"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: adjustScheduledAt(e.target.value, formData.schedule_type) })}
                  required
                />
                {formData.scheduled_at && (
                  <p className="text-xs text-indigo-500 font-bold mt-1">Hari: {getDayName(formData.scheduled_at)}</p>
                )}
                {/* Schedule Type */}
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2">
                  Tipe Jadwal
                </label>
                <select
                  className="form-input w-full"
                  value={formData.schedule_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    console.log("📋 Schedule type changed to:", nextType);
                    setFormData({
                      ...formData,
                      schedule_type: nextType,
                      scheduled_at: formData.scheduled_at
                        ? adjustScheduledAt(formData.scheduled_at, nextType)
                        : "",
                    });
                  }}
                >
                  <option value="once">Sekali Kirim</option>
                  <option value="every_day">Setiap Hari</option>
                  <option value="working_days">Hari Kerja (Senin‑Jumat)</option>
                  <option value="holidays">Hari Libur</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.schedule_type === "working_days"
                    ? "Tanggal akan disesuaikan ke hari kerja terdekat."
                    : formData.schedule_type === "holidays"
                    ? "Tanggal akan disesuaikan ke akhir pekan terdekat."
                    : formData.schedule_type === "once"
                    ? "Pesan akan dikirim satu kali pada tanggal dan waktu yang dipilih."
                    : "Pesan akan dikirim setiap hari pada waktu yang dipilih."}
                </p>
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary w-full py-4 text-lg ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "Memproses..." : editingId ? "Update Jadwal" : "Jadwalkan Pesan"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary w-full py-4 text-lg border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-100"
              >
                Batal Edit
              </button>
            )}
          </div>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Waktu & Hari</th>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{getDayName(item.scheduled_at)}</div>
                      <div className="text-xs text-gray-500">{new Date(item.scheduled_at).toLocaleString()}</div>
                      <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                        {(() => {
                          const type = item.schedule_type ?? "every_day";
                          switch(type) {
                            case "once":
                              return "Sekali Kirim";
                            case "every_day":
                              return "Setiap Hari";
                            case "working_days":
                              return "Hari Kerja";
                            case "holidays":
                              return "Hari Libur";
                            default:
                              return `Tidak Diketahui (${type})`;
                          }
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                        ${item.status === 'sent' ? 'bg-green-50 text-green-700 border border-green-100' : 
                          item.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 
                          'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-y-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all w-full"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-600 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all w-full"
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
