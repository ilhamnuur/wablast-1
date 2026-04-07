import React, { useState, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI } from "../../services/api";
import { processTemplate } from "../../utils/template";
import {
  checkSessionBeforeSend,
  validateFileSize,
  formatFileSize,
  getFileIcon,
  formatPhoneNumber,
} from "../../utils/helpers";
import { uploadWithWorkingServices } from "../../services/upload";
import SessionSelector from "../Common/SessionSelector";

const DocumentMessage = () => {
  const { sessionName, contacts, uploadService, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [phoneNumber, setPhoneNumber] = useState("628123456789");
  const [caption, setCaption] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const fileInputRef = useRef(null);

  const handleContactChange = (e) => {
    const contactId = e.target.value;
    setSelectedContact(contactId);

    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        setPhoneNumber(contact.phone);
        // Apply template processing if caption has content
        if (caption) {
          setCaption(processTemplate(caption, contactId, contacts));
        }
      }
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (!validateFileSize(file, 20)) {
      showStatus("❌ Ukuran dokumen terlalu besar. Maksimal 20MB.", "error");
      resetDocumentUpload();
      return;
    }

    setDocumentFile(file);
    setDocumentInfo({
      icon: getFileIcon(file.name),
      name: file.name,
      size: formatFileSize(file.size),
    });
  };

  const resetDocumentUpload = () => {
    setDocumentFile(null);
    setDocumentInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("dragover");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneNumber || !documentFile) {
      showStatus("❌ Nomor telepon dan file dokumen harus diisi", "error");
      return;
    }

    setLoading(true);
    const targetPhone = formatPhoneNumber(phoneNumber);

    // Process template variables if contact is selected
    let processedCaption = caption;
    if (selectedContact && caption) {
      processedCaption = processTemplate(caption, selectedContact, contacts);
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

      // Upload document
      addDebugInfo(
        `📄 BREAKTHROUGH: Processing DOCUMENT for WhatsApp: ${
          documentFile.name
        } (${formatFileSize(documentFile.size)})`
      );

      const documentUrl = await uploadWithWorkingServices(
        documentFile,
        uploadService,
        addDebugInfo
      );
      addDebugInfo(
        `✅ BREAKTHROUGH: Document uploaded successfully with direct access: ${documentUrl}`
      );

      // Send document message
      const payload = {
        session: sessionName,
        to: targetPhone,
        text: processedCaption || "",
        is_group: false,
        document_url: documentUrl,
        document_name: documentFile.name,
      };

      addDebugInfo(
        `📋 BREAKTHROUGH: Document payload: ${JSON.stringify(payload)}`
      );

      const response = await messageAPI.sendDocument(payload);
      addDebugInfo(
        `📊 BREAKTHROUGH: Send document response: ${JSON.stringify(
          response.data
        )}`
      );

      const contact = selectedContact
        ? contacts.find((c) => c.id === selectedContact)
        : null;
      const contactName = contact ? ` (${contact.name})` : "";
      showStatus(
        `🎉 BREAKTHROUGH: Dokumen berhasil dikirim ke ${phoneNumber}${contactName} dengan working services!`,
        "success"
      );

      resetDocumentUpload();
      setCaption("");
    } catch (error) {
      console.error("Send document error:", error);
      addDebugInfo(`❌ BREAKTHROUGH: Send document error: ${error.message}`);

      if (
        error.message.includes("All") &&
        error.message.includes("working upload services failed")
      ) {
        showStatus(
          `❌ BREAKTHROUGH: Semua working services gagal. Coba gunakan file yang lebih kecil atau periksa koneksi internet.`,
          "error"
        );
      } else if (
        error.code === "ECONNABORTED" ||
        error.message.includes("timeout")
      ) {
        showStatus(
          `❌ BREAKTHROUGH: Timeout saat mengirim dokumen. File mungkin terlalu besar atau koneksi lambat.`,
          "error"
        );
      } else {
        showStatus(
          `❌ BREAKTHROUGH: Gagal mengirim dokumen: ${error.message}`,
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>


      <div className="main-card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <SessionSelector />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="documentPhoneNumber"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
              >
                Nomor Telepon / Group ID
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  id="documentPhoneNumber"
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
                💡 Tip: Dokumen akan diupload dengan working services terpilih
              </span>
            </div>
          </div>

          {/* Upload Zone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Pilih atau Drag & Drop Dokumen
            </label>
            <div
              className="upload-zone p-10 text-center cursor-pointer"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                onChange={(e) => handleFileChange(e.target.files[0])}
                className="hidden"
              />

              {!documentInfo ? (
                <div>
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    <span className="text-primary cursor-pointer">
                      Klik untuk pilih dokumen
                    </span>{" "}
                    atau drag & drop di sini
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    PDF, DOC, XLS, PPT, TXT, ZIP, RAR hingga 20MB
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center mb-3">
                    <span className="text-5xl mr-4">{documentInfo.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {documentInfo.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {documentInfo.size}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetDocumentUpload();
                    }}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Hapus Dokumen
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="documentCaption"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Caption
            </label>
            <textarea
              id="documentCaption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows="3"
              placeholder="Caption untuk dokumen..."
              className="form-input w-full resize-vertical"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !documentFile}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                {loading && documentFile
                  ? "🎯 BREAKTHROUGH: Mengupload dokumen..."
                  : "Mengirim..."}
              </>
            ) : (
              " KIRIM DOKUMEN "
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default DocumentMessage;
