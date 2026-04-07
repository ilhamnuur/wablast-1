// src/components/Blast/RegularBlast.js
import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI } from "../../services/api";
import {
  parsePhoneNumbers,
  checkSessionBeforeSend,
  validateFileSize,
  formatFileSize,
  getFileIcon,
} from "../../utils/helpers";
import { uploadWithWorkingServices } from "../../services/upload";
import SessionSelector from "../Common/SessionSelector";

const RegularBlast = () => {
  const {
    sessionName,
    contacts,
    uploadService,
    addDebugInfo,
    blastResults,
    setBlastResults,
    blastInProgress,
    setBlastInProgress,
    addMessageLog,
    processTemplateForBlast,
    setLastBlastConfig,
    prefilledContactData,
    clearPrefilledData,
    getUniqueGroups,
    getContactsByGroup,
  } = useApp();
  const { showStatus } = useNotification();

  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [blastMessage, setBlastMessage] = useState("");
  const [blastType, setBlastType] = useState("text");
  const [blastDelay, setBlastDelay] = useState(2);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [contactType, setContactType] = useState("manual"); // manual, contact, group
  const [blastFile, setBlastFile] = useState(null);
  const [blastFileInfo, setBlastFileInfo] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // FIXED: Enhanced progress tracking state
  const [currentProgress, setCurrentProgress] = useState({
    current: 0,
    total: 0,
  });
  const [lastCompletedBlast, setLastCompletedBlast] = useState(null);

  // State untuk tracking kontak yang sudah ditambahkan (hanya untuk mode contact)
  const [addedContacts, setAddedContacts] = useState(new Set());

  const fileInputRef = useRef(null);

  // FIXED: Monitor blast results for enhanced progress tracking
  useEffect(() => {
    const totalProcessed = blastResults.success + blastResults.failed;
    const total = blastResults.total;

    setCurrentProgress({ current: totalProcessed, total: total });
    setProgress({ current: totalProcessed, total: total });

    // FIXED: Detect when blast is completed and show proper notification
    if (total > 0 && totalProcessed === total && !blastInProgress) {
      const successRate =
        total > 0 ? ((blastResults.success / total) * 100).toFixed(1) : 0;

      // Only show completion notification once
      const blastId = `${total}-${blastResults.success}-${blastResults.failed}`;
      if (lastCompletedBlast !== blastId) {
        setLastCompletedBlast(blastId);

        // FIXED: Enhanced completion notification with full details
        const groupInfo = selectedGroup ? ` untuk Group ${selectedGroup}` : "";
        const contactInfo =
          contactType === "contact" && addedContacts.size > 0
            ? ` untuk ${addedContacts.size} kontak terpilih`
            : "";
        const completionMessage = `🎉 Smart Blast selesai${groupInfo}${contactInfo}! Berhasil: ${blastResults.success}/${total} (${successRate}%)`;

        if (blastResults.failed > 0) {
          showStatus(
            `${completionMessage}. Gagal: ${blastResults.failed} pesan.`,
            blastResults.success > blastResults.failed ? "success" : "warning"
          );
        } else {
          showStatus(completionMessage, "success");
        }

        addDebugInfo(
          `📊 SMART BLAST COMPLETED: Success: ${blastResults.success}/${total} (${successRate}%), Failed: ${blastResults.failed}`
        );
      }
    }
  }, [
    blastResults,
    blastInProgress,
    lastCompletedBlast,
    selectedGroup,
    contactType,
    addedContacts.size,
    showStatus,
    addDebugInfo,
  ]);

  // Handle prefilled data from contact management
  useEffect(() => {
    if (
      prefilledContactData.phoneNumber &&
      prefilledContactData.messageType === "blast"
    ) {
      if (prefilledContactData.groupData) {
        // Group blast
        setContactType("group");
        setSelectedGroup(prefilledContactData.groupData.name);
        setPhoneNumbers(prefilledContactData.groupData.phoneNumbers);
        showStatus(
          `✅ Group ${prefilledContactData.groupData.name} berhasil dipilih untuk blast`,
          "success"
        );
      } else {
        // Individual contact blast
        setContactType("contact");
        setAddedContacts(new Set([prefilledContactData.contactId]));
        setPhoneNumbers(prefilledContactData.phoneNumber);
        showStatus(
          `✅ Kontak ${prefilledContactData.contactName} berhasil dipilih untuk blast`,
          "success"
        );
      }

      clearPrefilledData();
    }
  }, [prefilledContactData, showStatus, clearPrefilledData]);

  // FIXED: Calculate progress percentage
  const getProgressPercentage = () => {
    if (currentProgress.total === 0) return 0;
    return Math.round((currentProgress.current / currentProgress.total) * 100);
  };

  // FIXED: Get current blast status
  const getCurrentBlastStatus = () => {
    if (blastInProgress) {
      const remaining = currentProgress.total - currentProgress.current;
      const groupInfo = selectedGroup ? ` ke Group ${selectedGroup}` : "";
      const contactInfo =
        contactType === "contact" && addedContacts.size > 0
          ? ` ke ${addedContacts.size} kontak`
          : "";
      return `Sedang mengirim${groupInfo}${contactInfo}: ${currentProgress.current}/${currentProgress.total} (${remaining} tersisa)`;
    } else if (
      currentProgress.total > 0 &&
      currentProgress.current === currentProgress.total
    ) {
      const successRate =
        currentProgress.total > 0
          ? ((blastResults.success / currentProgress.total) * 100).toFixed(1)
          : 0;
      return `Smart Blast selesai! Berhasil: ${blastResults.success}/${currentProgress.total} (${successRate}%)`;
    }
    return "";
  };

  const handleTypeChange = (type) => {
    setBlastType(type);
    if (type === "text") {
      resetFileUpload();
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (blastType === "image" && !file.type.startsWith("image/")) {
      showStatus(
        "❌ File yang dipilih bukan gambar. Pilih file gambar yang valid.",
        "error"
      );
      resetFileUpload();
      return;
    }

    if (blastType === "document" && file.type.startsWith("image/")) {
      showStatus(
        "❌ File yang dipilih adalah gambar. Pilih dokumen yang valid.",
        "error"
      );
      resetFileUpload();
      return;
    }

    if (!validateFileSize(file, 20)) {
      showStatus("❌ Ukuran file terlalu besar. Maksimal 20MB.", "error");
      resetFileUpload();
      return;
    }

    setBlastFile(file);
    setBlastFileInfo({
      icon: getFileIcon(file.name),
      name: file.name,
      size: formatFileSize(file.size),
    });
  };

  const resetFileUpload = () => {
    setBlastFile(null);
    setBlastFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle contact type change
  const handleContactTypeChange = (type) => {
    setContactType(type);
    if (type === "manual") {
      setSelectedContact("");
      setSelectedGroup("");
      setAddedContacts(new Set());
      // Keep existing phone numbers for manual mode
    } else if (type === "contact") {
      setSelectedGroup("");
      setPhoneNumbers("");
      setAddedContacts(new Set());
    } else if (type === "group") {
      setSelectedContact("");
      setPhoneNumbers("");
      setAddedContacts(new Set());
    }
  };

  // Handle group selection
  const handleGroupChange = (e) => {
    const groupName = e.target.value;
    setSelectedGroup(groupName);

    if (groupName) {
      const groupContacts = getContactsByGroup(groupName);
      const groupPhones = groupContacts.map((c) => c.phone).join("\n");
      setPhoneNumbers(groupPhones);
      setContactType("group");
      setSelectedContact("");
    }
  };

  // Add individual contact to blast (untuk mode contact)
  const addContactToBlast = (contactId) => {
    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        // Check if contact already added
        if (addedContacts.has(contactId)) {
          showStatus(`❌ Kontak ${contact.name} sudah ditambahkan`, "warning");
          return;
        }

        const currentValue = phoneNumbers;
        const newPhoneNumbers = currentValue
          ? `${currentValue}\n${contact.phone}`
          : contact.phone;
        setPhoneNumbers(newPhoneNumbers);

        // Track added contacts
        setAddedContacts((prev) => new Set([...prev, contactId]));

        showStatus(`✅ Kontak ${contact.name} ditambahkan ke blast`, "success");
      }
      setSelectedContact("");
    }
  };

  // Remove contact from blast
  const removeContactFromBlast = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      const phoneList = phoneNumbers
        .split("\n")
        .filter((phone) => phone.trim() !== contact.phone);
      setPhoneNumbers(phoneList.join("\n"));

      setAddedContacts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });

      showStatus(`✅ Kontak ${contact.name} dihapus dari blast`, "success");
    }
  };

  // Add all contacts
  const addAllContacts = () => {
    const allPhones = contacts.map((c) => c.phone).join("\n");
    setPhoneNumbers(allPhones);
    setAddedContacts(new Set(contacts.map((c) => c.id)));
    showStatus(
      `✅ ${contacts.length} kontak ditambahkan ke daftar blast`,
      "success"
    );
  };

  // Clear all contacts
  const clearAllContacts = () => {
    setPhoneNumbers("");
    setAddedContacts(new Set());
    showStatus("✅ Semua kontak dihapus dari daftar blast", "success");
  };

  // Get added contacts data
  const getAddedContactsData = () => {
    return contacts.filter((contact) => addedContacts.has(contact.id));
  };

  // FIXED: Progress update function
  const updateProgress = (current, total) => {
    setProgress({ current, total });
    setCurrentProgress({ current, total });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (blastInProgress) {
      showStatus("❌ Blast sedang berjalan. Tunggu sampai selesai.", "error");
      return;
    }

    // Validation
    if (!phoneNumbers) {
      showStatus("❌ Daftar nomor telepon harus diisi", "error");
      return;
    }

    if (!blastMessage && blastType === "text") {
      showStatus("❌ Pesan harus diisi untuk blast teks", "error");
      return;
    }

    if ((blastType === "image" || blastType === "document") && !blastFile) {
      showStatus(`❌ File ${blastType} harus dipilih`, "error");
      return;
    }

    const phoneNumbersList = parsePhoneNumbers(phoneNumbers);
    if (phoneNumbersList.length === 0) {
      showStatus("❌ Tidak ada nomor telepon yang valid ditemukan", "error");
      return;
    }

    // Check session
    const sessionValid = await checkSessionBeforeSend(
      sessionName,
      addDebugInfo
    );
    if (!sessionValid) {
      return;
    }

    // Initialize blast
    setBlastInProgress(true);

    // FIXED: Reset blast results with proper tracking
    setBlastResults({
      total: phoneNumbersList.length,
      success: 0,
      failed: 0,
      logs: [],
      failedNumbers: [],
    });

    updateProgress(0, phoneNumbersList.length);

    let fileUrl = null;

    try {
      // Upload file if needed
      if (blastFile) {
        addDebugInfo(
          `🚀 BLAST: Uploading ${blastType} for blast: ${
            blastFile.name
          } (${formatFileSize(blastFile.size)})`
        );
        fileUrl = await uploadWithWorkingServices(
          blastFile,
          uploadService,
          addDebugInfo
        );
        addDebugInfo(`✅ BLAST: File uploaded successfully: ${fileUrl}`);
      }

      // Store blast configuration for potential retry
      setLastBlastConfig({
        sessionName,
        blastType,
        blastMessage,
        blastDelay,
        uploadService,
        fileUrl,
        fileName: blastFile?.name || null,
        isCustomBlast: false,
      });

      // Start blast with Smart Template Processing
      const groupInfo = selectedGroup ? ` (Group: ${selectedGroup})` : "";
      const contactInfo =
        contactType === "contact" && addedContacts.size > 0
          ? ` (${addedContacts.size} kontak)`
          : "";
      addDebugInfo(
        `🚀 BLAST: Starting SMART blast${groupInfo}${contactInfo} to ${phoneNumbersList.length} numbers with ${blastDelay}s delay`
      );

      let currentIndex = 0;

      for (const phoneNumber of phoneNumbersList) {
        currentIndex++;
        updateProgress(currentIndex, phoneNumbersList.length);

        try {
          addDebugInfo(
            `🚀 BLAST: Sending to ${phoneNumber} (${currentIndex}/${phoneNumbersList.length})`
          );

          // SMART TEMPLATE PROCESSING: Personalize message per contact
          let personalizedMessage = processTemplateForBlast(
            blastMessage,
            phoneNumber
          );

          let messagePayload = {
            session: sessionName,
            to: phoneNumber,
            text: personalizedMessage || "",
            is_group: false,
          };

          if (blastType === "image") {
            messagePayload.image_url = fileUrl;
          } else if (blastType === "document") {
            messagePayload.document_url = fileUrl;
            messagePayload.document_name = blastFile.name;
          }

          const response = await messageAPI[
            blastType === "text"
              ? "sendText"
              : blastType === "image"
              ? "sendImage"
              : "sendDocument"
          ](messagePayload);

          const contact = contacts.find((c) => c.phone === phoneNumber);
          const contactInfo = contact
            ? ` (${contact.name} - ${contact.category || "No category"})`
            : "";

          addMessageLog(
            phoneNumber,
            "success",
            personalizedMessage,
            `✅ Smart Template berhasil dikirim via ${blastType}${contactInfo}`
          );
          addDebugInfo(
            `✅ BLAST: Success to ${phoneNumber} with personalized message`
          );
        } catch (error) {
          const contact = contacts.find((c) => c.phone === phoneNumber);
          const contactInfo = contact ? ` (${contact.name})` : "";
          addMessageLog(
            phoneNumber,
            "error",
            blastMessage,
            `❌ Error: ${error.message}${contactInfo}`
          );
          addDebugInfo(`❌ BLAST: Failed to ${phoneNumber}: ${error.message}`);
        }

        // Delay between messages (except for last one)
        if (currentIndex < phoneNumbersList.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, blastDelay * 1000)
          );
        }
      }

      // Completion will be handled by useEffect monitoring blastResults
      addDebugInfo(
        `🚀 SMART BLAST: Completed with personalization. Check results for details.`
      );
    } catch (error) {
      console.error("Blast error:", error);
      addDebugInfo(`❌ BLAST: Critical error: ${error.message}`);
      showStatus(`❌ Blast gagal: ${error.message}`, "error");
    } finally {
      setBlastInProgress(false);
      updateProgress(phoneNumbersList.length, phoneNumbersList.length);
    }
  };

  const selectedContactsData = getAddedContactsData();

  return (
    <>

      {/* FIXED: Enhanced Progress Section */}
      {(blastInProgress || currentProgress.total > 0) && (
        <div className="main-card p-6 mb-8 fade-in">
          <div
            className="feature-card p-6"
            style={{
              background: "linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)",
              borderColor: "#0288d1",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold text-blue-800 dark:text-blue-200">
                📈 Progress Blast
                {selectedGroup && ` - Group: ${selectedGroup}`}
                {contactType === "contact" &&
                  addedContacts.size > 0 &&
                  ` - ${addedContacts.size} Kontak`}
              </h4>
              <span className="text-sm text-blue-600 dark:text-blue-300 font-semibold">
                {getProgressPercentage()}%
              </span>
            </div>

            <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-6 overflow-hidden mb-4">
              <div
                className="progress-bar h-6 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{
                  width: `${getProgressPercentage()}%`,
                }}
              ></div>
            </div>

            <p className="text-sm text-blue-700 dark:text-blue-300 text-center font-medium">
              {getCurrentBlastStatus()}
            </p>

            {blastInProgress && (
              <div className="flex justify-center mt-4">
                <div className="loading-spinner-large"></div>
              </div>
            )}
          </div>

          {/* FIXED: Enhanced Statistics Cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">
                {blastResults.success}
              </div>
              <div className="text-sm text-green-600">✅ Berhasil</div>
              {currentProgress.total > 0 && (
                <div className="text-xs text-green-500 mt-1">
                  {(
                    (blastResults.success / currentProgress.total) *
                    100
                  ).toFixed(1)}
                  %
                </div>
              )}
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600">
                {blastResults.failed}
              </div>
              <div className="text-sm text-red-600">❌ Gagal</div>
              {currentProgress.total > 0 && (
                <div className="text-xs text-red-500 mt-1">
                  {(
                    (blastResults.failed / currentProgress.total) *
                    100
                  ).toFixed(1)}
                  %
                </div>
              )}
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">
                {Math.max(0, currentProgress.total - currentProgress.current)}
              </div>
              <div className="text-sm text-blue-600">⏳ Pending</div>
              <div className="text-xs text-blue-500 mt-1">
                {currentProgress.current}/{currentProgress.total}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="main-card p-6 md:p-8 fade-in">
        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          <SessionSelector />
          {/* Contact Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Pilih Sumber Penerima
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: "manual", icon: "✏️", label: "Input Manual" },
                { value: "contact", icon: "👤", label: "Pilih Kontak" },
                { value: "group", icon: "👥", label: "Group Kontak" },
              ].map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    contactType === type.value
                      ? "border-primary bg-gray-50 dark:bg-gray-700 shadow-lg"
                      : "border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                  } ${blastInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="radio"
                    name="contactType"
                    value={type.value}
                    checked={contactType === type.value}
                    onChange={(e) => handleContactTypeChange(e.target.value)}
                    className="mr-3"
                    disabled={blastInProgress}
                  />
                  <div>
                    <span className="text-2xl mr-3">{type.icon}</span>
                    <span className="text-sm font-semibold">{type.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Phone Numbers Input */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {contactType === "group"
                  ? "Anggota Group"
                  : contactType === "contact"
                  ? "Kontak Terpilih"
                  : "Daftar Nomor Telepon"}
                {contactType === "contact" && addedContacts.size > 0 && (
                  <span className="text-green-600 ml-2">
                    ({addedContacts.size} kontak ditambahkan)
                  </span>
                )}
              </label>

              {contactType === "group" && (
                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedGroup}
                    onChange={handleGroupChange}
                    className="form-input text-sm px-3 py-2"
                    required
                    disabled={blastInProgress}
                  >
                    <option value="">Pilih Group Kontak</option>
                    {getUniqueGroups().map((group) => (
                      <option key={group} value={group}>
                        👥 {group} ({getContactsByGroup(group).length} kontak)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {contactType === "contact" && (
                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedContact}
                    onChange={(e) => addContactToBlast(e.target.value)}
                    className="form-input text-sm px-3 py-2"
                    disabled={blastInProgress}
                  >
                    <option value="">Tambah Kontak Satu per Satu</option>
                    {contacts.map((contact) => (
                      <option
                        key={contact.id}
                        value={contact.id}
                        disabled={addedContacts.has(contact.id)}
                      >
                        {addedContacts.has(contact.id) ? "✅ " : ""}
                        {contact.name} ({contact.phone})
                        {contact.category ? ` - ${contact.category}` : ""}
                        {contact.groups && contact.groups.length > 0
                          ? ` [${contact.groups[0]}]`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addAllContacts}
                    className="btn-primary text-sm px-4 py-2 transition-all duration-300 hover:scale-105"
                    disabled={blastInProgress}
                  >
                    Pilih Semua
                  </button>
                  {addedContacts.size > 0 && (
                    <button
                      type="button"
                      onClick={clearAllContacts}
                      className="btn-danger text-sm px-4 py-2 transition-all duration-300 hover:scale-105"
                      disabled={blastInProgress}
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Show added contacts preview for contact mode */}
            {contactType === "contact" && addedContacts.size > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kontak yang Ditambahkan ({addedContacts.size}):
                  </p>
                  <button
                    type="button"
                    onClick={clearAllContacts}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                    disabled={blastInProgress}
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedContactsData.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded text-sm"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {contact.name}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 ml-2">
                          ({contact.phone})
                        </span>
                        {contact.category && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded ml-2">
                            {contact.category}
                          </span>
                        )}
                        {contact.groups && contact.groups.length > 0 && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded ml-1">
                            👥 {contact.groups[0]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeContactFromBlast(contact.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded transition-all"
                        title="Hapus dari blast"
                        disabled={blastInProgress}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedGroup && contactType === "group" && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Anggota Group "{selectedGroup}":
                </p>
                <div className="flex flex-wrap gap-2">
                  {getContactsByGroup(selectedGroup)
                    .slice(0, 8)
                    .map((contact) => (
                      <span
                        key={contact.id}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                      >
                        {contact.name}
                      </span>
                    ))}
                  {getContactsByGroup(selectedGroup).length > 8 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                      +{getContactsByGroup(selectedGroup).length - 8} lainnya
                    </span>
                  )}
                </div>
              </div>
            )}

            <textarea
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              rows="4"
              placeholder={
                contactType === "group"
                  ? "Nomor akan muncul otomatis saat memilih group..."
                  : contactType === "contact"
                  ? "Pilih kontak dari dropdown di atas..."
                  : "628123456789&#10;628987654321&#10;628111222333"
              }
              className="form-input w-full resize-vertical transition-all duration-300 focus:ring-2 focus:ring-primary"
              readOnly={contactType === "group" || contactType === "contact"}
              required
              disabled={blastInProgress}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {contactType === "manual" &&
                "Contoh: 628123456789, 628987654321 atau satu nomor per baris"}
              {contactType === "contact" &&
                "Pilih kontak satu per satu dari dropdown atau pilih semua"}
              {contactType === "group" &&
                "Semua anggota group akan menerima blast sekaligus"}
            </p>
          </div>

          {/* Message Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Tipe Pesan Blast
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: "text", icon: "📝", label: "Teks Saja" },
                { value: "image", icon: "🖼️", label: "Gambar + Caption" },
                { value: "document", icon: "📄", label: "Dokumen + Caption" },
              ].map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    blastType === type.value
                      ? "border-primary bg-gray-50 dark:bg-gray-700 shadow-lg transform scale-[1.02]"
                      : "border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                  } ${blastInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="radio"
                    name="blastType"
                    value={type.value}
                    checked={blastType === type.value}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="mr-4"
                    disabled={blastInProgress}
                  />
                  <div>
                    <span className="text-2xl">{type.icon}</span>
                    <p className="text-sm font-semibold">{type.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Pesan / Caption + 🎯 Smart Template
            </label>
            <textarea
              value={blastMessage}
              onChange={(e) => setBlastMessage(e.target.value)}
              rows="6"
              placeholder="Tulis pesan Anda di sini... Gunakan {nama} untuk nama kontak, {kategori} untuk kategori, {group} untuk group kontak, dll."
              className="form-input w-full resize-vertical transition-all duration-300 focus:ring-2 focus:ring-primary"
              required={blastType === "text"}
              disabled={blastInProgress}
            />
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-1">
                💡 <strong>Template Variables yang tersedia:</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                  {"{nama}"}
                </span>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                  {"{kategori}"}
                </span>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                  {"{group}"}
                </span>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          {blastType !== "text" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Upload File untuk Blast
              </label>
              <div
                className={`upload-zone p-8 md:p-10 text-center cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  blastInProgress ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() =>
                  !blastInProgress && fileInputRef.current?.click()
                }
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={
                    blastType === "image"
                      ? "image/*"
                      : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  }
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  className="hidden"
                  disabled={blastInProgress}
                />

                {!blastFileInfo ? (
                  <div>
                    <svg
                      className="mx-auto h-12 md:h-16 w-12 md:w-16 text-gray-400 mb-4 transition-transform duration-300 hover:scale-110"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      <span className="text-primary cursor-pointer">
                        Klik untuk pilih file
                      </span>{" "}
                      atau drag & drop di sini
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Gambar atau Dokumen hingga 20MB
                    </p>
                  </div>
                ) : (
                  <div className="transition-all duration-300">
                    <div className="flex items-center justify-center mb-3">
                      <span className="text-4xl md:text-5xl mr-4">
                        {blastFileInfo.icon}
                      </span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {blastFileInfo.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {blastFileInfo.size}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFileUpload();
                      }}
                      className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors duration-300 flex items-center gap-2 mx-auto"
                      disabled={blastInProgress}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                      Hapus File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Send Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Delay antar Pesan (detik)
              </label>
              <input
                type="number"
                value={blastDelay}
                onChange={(e) => setBlastDelay(parseInt(e.target.value) || 2)}
                min="1"
                max="60"
                className="form-input w-full transition-all duration-300 focus:ring-2 focus:ring-primary"
                disabled={blastInProgress}
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    ></path>
                  </svg>
                  <strong>Smart Template:</strong>
                </div>
                <div>⚡ Personalisasi otomatis per kontak</div>
                {contactType === "group" && (
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    👥 Mode Group Blast
                  </div>
                )}
                {contactType === "contact" && addedContacts.size > 0 && (
                  <div className="text-green-600 dark:text-green-400 mt-1">
                    📋 {addedContacts.size} kontak dipilih
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={blastInProgress}
            className="btn-primary w-full text-lg py-4 transition-all duration-300 hover:scale-[1.02] disabled:scale-100 flex items-center justify-center gap-3"
          >
            {blastInProgress ? (
              <>
                <div className="loading-spinner"></div>
                🚀 Sedang mengirim ke {progress.current}/{progress.total}{" "}
                nomor...
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  ></path>
                </svg>
                {contactType === "group" &&
                  selectedGroup &&
                  `BLAST KE GROUP ${selectedGroup.toUpperCase()}`}
                {contactType === "contact" &&
                  addedContacts.size > 0 &&
                  `BLAST KE ${addedContacts.size} KONTAK TERPILIH`}
                {contactType === "contact" &&
                  addedContacts.size === 0 &&
                  "PILIH KONTAK UNTUK BLAST"}
                {contactType === "manual" && "MULAI BLAST PESAN"}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Enhanced CSS */}
      <style jsx>{`
        .fade-in {
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .loading-spinner {
          border: 2px solid #f3f3f3;
          border-radius: 50%;
          border-top: 2px solid #5d5cde;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }

        .loading-spinner-large {
          border: 3px solid #e3f2fd;
          border-radius: 50%;
          border-top: 3px solid #1976d2;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .progress-bar {
          background: linear-gradient(90deg, #1976d2, #42a5f5, #64b5f6);
          background-size: 200% 100%;
          animation: progressGradient 2s ease-in-out infinite;
          transition: width 0.3s ease;
          border-radius: 8px;
        }

        @keyframes progressGradient {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </>
  );
};

export default RegularBlast;
