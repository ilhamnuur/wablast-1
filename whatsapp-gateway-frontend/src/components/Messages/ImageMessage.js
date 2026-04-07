import React, { useState, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI } from "../../services/api";
import { processTemplate } from "../../utils/template";
import {
  checkSessionBeforeSend,
  validateFileSize,
  formatFileSize,
  formatPhoneNumber,
} from "../../utils/helpers";
import { uploadWithWorkingServices } from "../../services/upload";
import SessionSelector from "../Common/SessionSelector";

const ImageMessage = () => {
  const { sessionName, contacts, uploadService, addDebugInfo } = useApp();
  const { showStatus } = useNotification();
  const [phoneNumber, setPhoneNumber] = useState("628123456789");
  const [caption, setCaption] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
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

    if (!validateFileSize(file, 10)) {
      showStatus("❌ Ukuran gambar terlalu besar. Maksimal 10MB.", "error");
      resetImageUpload();
      return;
    }

    if (!file.type.startsWith("image/")) {
      showStatus("❌ File yang dipilih bukan gambar.", "error");
      resetImageUpload();
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onload = function (e) {
      setImagePreview({
        src: e.target.result,
        name: file.name,
        size: formatFileSize(file.size),
      });
    };
    reader.readAsDataURL(file);
  };

  const resetImageUpload = () => {
    setImageFile(null);
    setImagePreview(null);
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

    if (!phoneNumber || !imageFile) {
      showStatus("❌ Nomor telepon dan file gambar harus diisi", "error");
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

      // Upload image
      addDebugInfo(
        `🖼️ BREAKTHROUGH: Processing image for WhatsApp: ${
          imageFile.name
        } (${formatFileSize(imageFile.size)})`
      );

      const imageUrl = await uploadWithWorkingServices(
        imageFile,
        uploadService,
        addDebugInfo
      );
      addDebugInfo(`✅ BREAKTHROUGH: Image uploaded successfully: ${imageUrl}`);

      // Send image message
      const payload = {
        session: sessionName,
        to: targetPhone,
        text: processedCaption || "",
        is_group: false,
        image_url: imageUrl,
      };

      const response = await messageAPI.sendImage(payload);
      addDebugInfo(`📊 Send image response: ${JSON.stringify(response.data)}`);

      const contact = selectedContact
        ? contacts.find((c) => c.id === selectedContact)
        : null;
      const contactName = contact ? ` (${contact.name})` : "";
      showStatus(
        `🎉 Gambar berhasil dikirim ke ${phoneNumber}${contactName} dengan BREAKTHROUGH system!`,
        "success"
      );

      resetImageUpload();
      setCaption("");
    } catch (error) {
      console.error("Send image error:", error);
      addDebugInfo(`❌ BREAKTHROUGH: Send image error: ${error.message}`);

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        showStatus(
          `❌ Timeout saat mengirim gambar. File mungkin terlalu besar atau koneksi lambat.`,
          "error"
        );
      } else {
        showStatus(
          `❌ BREAKTHROUGH: Gagal mengirim gambar: ${error.message}`,
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Kirim Gambar dengan Caption
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SessionSelector />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="imagePhoneNumber"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Nomor Telepon / Group ID
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                id="imagePhoneNumber"
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
              💡 Tip: Gambar akan diupload otomatis dengan working services
            </span>
          </div>
        </div>

        {/* Upload Zone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Pilih atau Drag & Drop Gambar
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
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files[0])}
              className="hidden"
            />

            {!imagePreview ? (
              <div>
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  <span className="text-primary cursor-pointer">
                    Klik untuk pilih gambar
                  </span>{" "}
                  atau drag & drop di sini
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  PNG, JPG, GIF, WebP hingga 10MB
                </p>
              </div>
            ) : (
              <div>
                <img
                  src={imagePreview.src}
                  alt="Preview"
                  className="max-w-xs max-h-48 rounded-xl border-2 border-gray-300 dark:border-gray-600 mx-auto shadow-lg"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 font-medium">
                  {imagePreview.name} ({imagePreview.size})
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetImageUpload();
                  }}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Hapus Gambar
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="imageCaption"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
          >
            Caption
          </label>
          <textarea
            id="imageCaption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows="3"
            placeholder="Caption untuk gambar..."
            className="form-input w-full resize-vertical"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !imageFile}
          className="btn-primary w-full"
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              {loading && imageFile
                ? "🎯 BREAKTHROUGH: Mengupload gambar..."
                : "Mengirim..."}
            </>
          ) : (
            " KIRIM GAMBAR "
          )}
        </button>
      </form>
    </div>
  );
};

export default ImageMessage;
