import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI } from "../../services/api";
import { processTemplate } from "../../utils/template";
import {
  checkSessionBeforeSend,
  validateFileSize,
  formatFileSize,
  formatPhoneNumber,
  getFileIcon,
} from "../../utils/helpers";
import { uploadWithWorkingServices } from "../../services/upload";
import SessionSelector from "../Common/SessionSelector";

const TextMessage = ({ initialMode = "text" }) => {
  const {
    sessionName,
    contacts,
    uploadService,
    addDebugInfo,
    prefilledContactData,
    clearPrefilledData,
  } = useApp();
  const { showStatus } = useNotification();
  const [messageMode, setMessageMode] = useState(initialMode);
  const [phoneNumber, setPhoneNumber] = useState("628123456789");
  const [messageText, setMessageText] = useState("Hello World!");
  const [caption, setCaption] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMessageMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (prefilledContactData?.phoneNumber) {
      setMessageMode(prefilledContactData.messageType || initialMode || "text");
      setPhoneNumber(prefilledContactData.phoneNumber);
      if (prefilledContactData.contactId) {
        setSelectedContact(prefilledContactData.contactId);
      }
      clearPrefilledData();
    }
  }, [prefilledContactData, initialMode, clearPrefilledData]);

  const handleModeChange = (mode) => {
    if (mode === messageMode) return;
    setMessageMode(mode);
    resetUpload();
  };

  const handleContactChange = (e) => {
    const contactId = e.target.value;
    setSelectedContact(contactId);

    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        setPhoneNumber(contact.phone);
        if (messageMode === "text" && messageText) {
          setMessageText(processTemplate(messageText, contactId, contacts));
        }
        if ((messageMode === "image" || messageMode === "document") && caption) {
          setCaption(processTemplate(caption, contactId, contacts));
        }
      }
    }
  };

  const resetUpload = () => {
    setImageFile(null);
    setImagePreview(null);
    setDocumentFile(null);
    setDocumentInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (messageMode === "image") {
      if (!validateFileSize(file, 10)) {
        showStatus("❌ Ukuran gambar terlalu besar. Maksimal 10MB.", "error");
        resetUpload();
        return;
      }
      if (!file.type.startsWith("image/")) {
        showStatus("❌ File yang dipilih bukan gambar.", "error");
        resetUpload();
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview({
          src: e.target.result,
          name: file.name,
          size: formatFileSize(file.size),
        });
      };
      reader.readAsDataURL(file);
      setDocumentFile(null);
      setDocumentInfo(null);
    }

    if (messageMode === "document") {
      if (!validateFileSize(file, 20)) {
        showStatus("❌ Ukuran dokumen terlalu besar. Maksimal 20MB.", "error");
        resetUpload();
        return;
      }
      setDocumentFile(file);
      setDocumentInfo({
        icon: getFileIcon(file.name),
        name: file.name,
        size: formatFileSize(file.size),
      });
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const getActionLabel = () => {
    if (messageMode === "image") return "Kirim Gambar";
    if (messageMode === "document") return "Kirim Dokumen";
    return "Kirim Pesan";
  };

  const uploadAccept = () => {
    if (messageMode === "image") return "image/*";
    return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneNumber) {
      showStatus("❌ Nomor telepon harus diisi", "error");
      return;
    }

    if (messageMode === "text" && !messageText) {
      showStatus("❌ Pesan teks harus diisi", "error");
      return;
    }

    if (messageMode === "image" && !imageFile) {
      showStatus("❌ File gambar harus dipilih", "error");
      return;
    }

    if (messageMode === "document" && !documentFile) {
      showStatus("❌ File dokumen harus dipilih", "error");
      return;
    }

    setLoading(true);
    const targetPhone = formatPhoneNumber(phoneNumber);
    let processedMessage = messageText;
    let processedCaption = caption;

    if (selectedContact) {
      if (messageMode === "text") {
        processedMessage = processTemplate(messageText, selectedContact, contacts);
      } else {
        processedCaption = processTemplate(caption, selectedContact, contacts);
      }
    }

    try {
      const sessionValid = await checkSessionBeforeSend(sessionName, addDebugInfo);
      if (!sessionValid) {
        setLoading(false);
        return;
      }

      if (messageMode === "text") {
        const payload = {
          session: sessionName,
          to: targetPhone,
          text: processedMessage,
          is_group: false,
        };

        const response = await messageAPI.sendText(payload);
        addDebugInfo(`📊 Send message response: ${JSON.stringify(response.data)}`);
        showStatus(`✅ Pesan berhasil dikirim ke ${phoneNumber}`, "success");
      } else {
        const fileToUpload = messageMode === "image" ? imageFile : documentFile;
        const uploadLabel = messageMode === "image" ? "Gambar" : "Dokumen";
        addDebugInfo(`📤 Upload ${uploadLabel}: ${fileToUpload.name} (${formatFileSize(fileToUpload.size)})`);

        const fileUrl = await uploadWithWorkingServices(fileToUpload, uploadService, addDebugInfo);
        addDebugInfo(`✅ File ${uploadLabel} uploaded: ${fileUrl}`);

        const payload = {
          session: sessionName,
          to: targetPhone,
          text: processedCaption || "",
          is_group: false,
        };

        if (messageMode === "image") {
          payload.image_url = fileUrl;
          const response = await messageAPI.sendImage(payload);
          addDebugInfo(`📊 Send image response: ${JSON.stringify(response.data)}`);
          showStatus(`🎉 Gambar berhasil dikirim ke ${phoneNumber}`, "success");
          resetUpload();
          setCaption("");
        } else {
          payload.document_url = fileUrl;
          payload.document_name = documentFile.name;
          const response = await messageAPI.sendDocument(payload);
          addDebugInfo(`📊 Send document response: ${JSON.stringify(response.data)}`);
          showStatus(`🎉 Dokumen berhasil dikirim ke ${phoneNumber}`, "success");
          resetUpload();
          setCaption("");
        }
      }
    } catch (error) {
      console.error(`Send ${messageMode} error:`, error);
      addDebugInfo(`❌ Send ${messageMode} error: ${error.message}`);

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        showStatus(`❌ Timeout saat mengirim. Silakan coba lagi.`, "error");
      } else {
        showStatus(`❌ Gagal mengirim pesan: ${error.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        {messageMode === "text"
          ? "Kirim Pesan"
          : messageMode === "image"
          ? "Kirim Gambar"
          : "Kirim Dokumen"}
      </h2>

      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { id: "text", label: "Teks Saja" },
          { id: "image", label: "Gambar" },
          { id: "document", label: "Dokumen" },
        ].map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => handleModeChange(mode.id)}
            className={`px-4 py-2 rounded-2xl border transition-all text-sm font-semibold ${
              messageMode === mode.id
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

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
              {messageMode === "text"
                ? "💡 Gunakan template dengan kontak untuk personalisasi otomatis."
                : "💡 Pilih file lalu tambahkan caption jika perlu."}
            </span>
          </div>
        </div>

        {messageMode === "text" ? (
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
        ) : (
          <>
            <div>
              <label
                htmlFor="messageCaption"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
              >
                Caption (Opsional)
              </label>
              <textarea
                id="messageCaption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows="3"
                placeholder={
                  messageMode === "image"
                    ? "Tulis caption untuk gambar..."
                    : "Tulis caption untuk dokumen..."
                }
                className="form-input w-full resize-vertical"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {messageMode === "image" ? "Pilih atau Drag & Drop Gambar" : "Pilih atau Drag & Drop Dokumen"}
              </label>
              <div
                className="upload-zone p-10 text-center cursor-pointer"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("dragover");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("dragover");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("dragover");
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    handleFileChange(files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={uploadAccept()}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                {!imagePreview && !documentInfo ? (
                  <div>
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400 mb-4"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 16v-3a3 3 0 013-3h18a3 3 0 013 3v3M8 24l8 8 6-6 8 8"
                      ></path>
                    </svg>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Klik atau taruh file di sini
                    </p>
                    <p className="text-sm text-gray-500">
                      {messageMode === "image"
                        ? "Format gambar: JPG, PNG, WEBP. Maks 10MB."
                        : "Format dokumen: PDF, DOCX, XLSX, PPTX, TXT, ZIP. Maks 20MB."}
                    </p>
                  </div>
                ) : messageMode === "image" && imagePreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={imagePreview.src}
                      alt={imagePreview.name}
                      className="max-h-56 rounded-2xl shadow-sm"
                    />
                    <div className="text-sm text-gray-500">
                      {imagePreview.name} • {imagePreview.size}
                    </div>
                    <button
                      type="button"
                      onClick={resetUpload}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Hapus file
                    </button>
                  </div>
                ) : documentInfo ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-6xl">{documentInfo.icon}</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {documentInfo.name}
                    </div>
                    <div className="text-sm text-gray-500">{documentInfo.size}</div>
                    <button
                      type="button"
                      onClick={resetUpload}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Hapus file
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-success w-full"
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              Mengirim...
            </>
          ) : (
            getActionLabel()
          )}
        </button>
      </form>
    </div>
  );
};

export default TextMessage;
