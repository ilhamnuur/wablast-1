import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI } from "../../services/api";
import { processTemplate } from "../../utils/template";
import { checkSessionBeforeSend, formatPhoneNumber } from "../../utils/helpers";
import SessionSelector from "../Common/SessionSelector";

const TextMessage = () => {
  const { sessionName, contacts, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [phoneNumber, setPhoneNumber] = useState("628123456789");
  const [messageText, setMessageText] = useState("Hello World!");
  const [selectedContact, setSelectedContact] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContactChange = (e) => {
    const contactId = e.target.value;
    setSelectedContact(contactId);

    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        setPhoneNumber(contact.phone);
        // Apply template processing if message field has content
        if (messageText) {
          setMessageText(processTemplate(messageText, contactId, contacts));
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneNumber || !messageText) {
      showStatus("❌ Nomor telepon dan pesan harus diisi", "error");
      return;
    }

    setLoading(true);
    const targetPhone = formatPhoneNumber(phoneNumber);
    
    // Process template variables if contact is selected
    let processedMessage = messageText;
    if (selectedContact) {
      processedMessage = processTemplate(
        messageText,
        selectedContact,
        contacts
      );
    }

    try {
      // Check session before sending
      const sessionValid = await checkSessionBeforeSend(
        sessionName,
        addDebugInfo
      );
      if (!sessionValid) {
        setLoading(false);
        return;
      }

      const payload = {
        session: sessionName,
        to: targetPhone,
        text: processedMessage,
        is_group: false,
      };

      const response = await messageAPI.sendText(payload);
      addDebugInfo(
        `📊 Send message response: ${JSON.stringify(response.data)}`
      );

      const contact = selectedContact
        ? contacts.find((c) => c.id === selectedContact)
        : null;
      const contactName = contact ? ` (${contact.name})` : "";
      showStatus(
        `✅ Pesan teks berhasil dikirim ke ${phoneNumber}${contactName}`,
        "success"
      );
    } catch (error) {
      console.error("Send text error:", error);
      addDebugInfo(`❌ Send text error: ${error.message}`);

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        showStatus(
          `❌ Timeout saat mengirim pesan. Silakan coba lagi.`,
          "error"
        );
      } else {
        showStatus(`❌ Gagal mengirim pesan: ${error.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Kirim Pesan Teks
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SessionSelector />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Nomor Telepon / Group ID
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="628123456789"
                className="form-input flex-1"
                required
              />
              <select
                value={selectedContact}
                onChange={handleContactChange}
                className="form-input"
              >
                <option value="">Pilih Kontak</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} ({contact.phone})
                    {contact.category ? ` - ${contact.category}` : ""}
                    {contact.group ? ` [${contact.group}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              💡 Tip: Gunakan kontak yang sudah disimpan untuk personalisasi
              otomatis
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="messageText"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
          >
            Pesan
          </label>
          <textarea
            id="messageText"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows="4"
            placeholder="Tulis pesan Anda di sini..."
            className="form-input w-full resize-vertical"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-success w-full">
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              Mengirim...
            </>
          ) : (
            "Kirim Pesan Teks"
          )}
        </button>
      </form>
    </div>
  );
};

export default TextMessage;
