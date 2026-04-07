import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { messageAPI, contactAPI } from "../../services/api";
import {
  processCustomBlastTemplate,
  getTemplatePreview,
} from "../../utils/template";
import {
  validateFileSize,
  formatFileSize,
  getFileIcon,
  formatPhoneNumber,
  checkSessionBeforeSend,
} from "../../utils/helpers";
import { uploadWithWorkingServices } from "../../services/upload";
import * as XLSX from "xlsx";
import SessionSelector from "../Common/SessionSelector";

const CustomBlast = () => {
  const {
    sessionName,
    contacts,
    uploadService,
    addDebugInfo,
    blastResults,
    setBlastResults,
    customBlastInProgress,
    setCustomBlastInProgress,
    customBlastExcelData,
    setCustomBlastExcelData,
    customBlastVariables,
    setCustomBlastVariables,
    customBlastPhoneMapping,
    setCustomBlastPhoneMapping,
    customBlastDataMapping,
    setCustomBlastDataMapping,
    addMessageLog,
    processCustomBlastTemplate: processCustomTemplate,
    setLastBlastConfig,
  } = useApp();
  const { showStatus } = useNotification();

  const [customBlastMessage, setCustomBlastMessage] = useState("");
  const [customBlastType, setCustomBlastType] = useState("text");
  const [customBlastDelay, setCustomBlastDelay] = useState(2);
  const [customBlastFile, setCustomBlastFile] = useState(null);
  const [customBlastFileInfo, setCustomBlastFileInfo] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // FIXED: Enhanced progress tracking state
  const [currentProgress, setCurrentProgress] = useState({
    current: 0,
    total: 0,
  });
  const [lastCompletedBlast, setLastCompletedBlast] = useState(null);

  // Enhanced UI States
  const [variablesExpanded, setVariablesExpanded] = useState(true);
  const [searchVariable, setSearchVariable] = useState("");
  const [recentlyUsedVars, setRecentlyUsedVars] = useState([]);
  const [variableAnimations, setVariableAnimations] = useState({});

  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const messageTextareaRef = useRef(null);

  // FIXED: Monitor blast results for enhanced progress tracking
  useEffect(() => {
    const totalProcessed = blastResults.success + blastResults.failed;
    const total = blastResults.total;

    setCurrentProgress({ current: totalProcessed, total: total });
    setProgress({ current: totalProcessed, total: total });

    // FIXED: Detect when blast is completed and show proper notification
    if (total > 0 && totalProcessed === total && !customBlastInProgress) {
      const successRate =
        total > 0 ? ((blastResults.success / total) * 100).toFixed(1) : 0;

      // Only show completion notification once
      const blastId = `${total}-${blastResults.success}-${blastResults.failed}`;
      if (lastCompletedBlast !== blastId) {
        setLastCompletedBlast(blastId);

        // FIXED: Enhanced completion notification with full details
        const completionMessage = `🎉 Custom Blast selesai! Berhasil: ${blastResults.success}/${total} (${successRate}%)`;

        if (blastResults.failed > 0) {
          showStatus(
            `${completionMessage}. Gagal: ${blastResults.failed} pesan.`,
            blastResults.success > blastResults.failed ? "success" : "warning"
          );
        } else {
          showStatus(completionMessage, "success");
        }

        addDebugInfo(
          `📊 CUSTOM BLAST COMPLETED: Success: ${blastResults.success}/${total} (${successRate}%), Failed: ${blastResults.failed}`
        );
      }
    }
  }, [
    blastResults,
    customBlastInProgress,
    lastCompletedBlast,
    showStatus,
    addDebugInfo,
  ]);

  // Process Excel data when it changes
  useEffect(() => {
    if (customBlastExcelData) {
      processCustomBlastExcelData();
    }
  }, [customBlastExcelData]);

  // FIXED: Calculate progress percentage
  const getProgressPercentage = () => {
    if (currentProgress.total === 0) return 0;
    return Math.round((currentProgress.current / currentProgress.total) * 100);
  };

  // FIXED: Get current blast status
  const getCurrentBlastStatus = () => {
    if (customBlastInProgress) {
      const remaining = currentProgress.total - currentProgress.current;
      return `Sedang mengirim Custom Blast: ${currentProgress.current}/${currentProgress.total} (${remaining} tersisa)`;
    } else if (
      currentProgress.total > 0 &&
      currentProgress.current === currentProgress.total
    ) {
      const successRate =
        currentProgress.total > 0
          ? ((blastResults.success / currentProgress.total) * 100).toFixed(1)
          : 0;
      return `Custom Blast selesai! Berhasil: ${blastResults.success}/${currentProgress.total} (${successRate}%)`;
    }
    return "";
  };

  // Excel Processing Functions
  const processExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            blankrows: false,
          });

          if (jsonData.length === 0) {
            reject(new Error("File Excel kosong atau tidak valid"));
            return;
          }

          const headers = jsonData[0];
          const rows = jsonData.slice(1);

          addDebugInfo(
            `📊 Excel processed: ${headers.length} columns, ${rows.length} rows`
          );

          resolve({
            headers: headers,
            rows: rows,
            filename: file.name,
          });
        } catch (error) {
          addDebugInfo(`❌ Excel processing error: ${error.message}`);
          reject(new Error("Gagal membaca file Excel: " + error.message));
        }
      };

      reader.onerror = function () {
        reject(new Error("Gagal membaca file"));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const processCustomBlastExcelData = () => {
    if (!customBlastExcelData) return;

    const { headers, rows } = customBlastExcelData;

    // Auto-detect phone column
    let phoneColumnIndex = -1;
    const phonePatterns = [
      "telepon",
      "phone",
      "hp",
      "wa",
      "whatsapp",
      "nomor",
      "number",
    ];

    headers.forEach((header, index) => {
      const headerLower = header.toString().toLowerCase();
      if (
        phoneColumnIndex === -1 &&
        phonePatterns.some((pattern) => headerLower.includes(pattern))
      ) {
        phoneColumnIndex = index;
      }
    });

    const newVariables = [];
    const newPhoneMapping = {};
    const newDataMapping = {};

    headers.forEach((header) => {
      const cleanHeader = header.toString().trim();
      if (cleanHeader) {
        newVariables.push(cleanHeader);
      }
    });

    if (phoneColumnIndex !== -1) {
      rows.forEach((row) => {
        const rawPhone = row[phoneColumnIndex]?.toString().trim();
        if (rawPhone) {
          const phoneNumber = formatPhoneNumber(rawPhone);
          const rowData = {};
          headers.forEach((header, index) => {
            const cleanHeader = header.toString().trim();
            rowData[cleanHeader] = row[index]?.toString().trim() || "";
          });

          newDataMapping[phoneNumber] = rowData;
          newPhoneMapping[phoneNumber] = true;
        }
      });

      addDebugInfo(
        `📊 Custom Blast: Processed ${
          Object.keys(newDataMapping).length
        } records with ${newVariables.length} variables`
      );
      addDebugInfo(`📊 Variables: ${newVariables.join(", ")}`);
    } else {
      addDebugInfo(
        `⚠️ Custom Blast: No phone column detected, custom blast disabled`
      );
    }

    setCustomBlastVariables(newVariables);
    setCustomBlastPhoneMapping(newPhoneMapping);
    setCustomBlastDataMapping(newDataMapping);
    setVariablesExpanded(true);
  };

  const handleExcelFile = async (file) => {
    if (!file) return;

    try {
      showStatus("📊 Memproses file Excel untuk custom blast...", "info");

      const excelData = await processExcelFile(file);
      setCustomBlastExcelData(excelData);

      showStatus(
        `✅ File Excel berhasil diproses: ${excelData.rows.length} records`,
        "success"
      );
    } catch (error) {
      showStatus(`❌ Error: ${error.message}`, "error");
      addDebugInfo(`❌ Custom Blast Excel error: ${error.message}`);
    }
  };

  // Download Excel Template for Custom Blast - UPDATED FORMAT
  const downloadCustomBlastTemplate = async () => {
    try {
      showStatus("📊 Mengunduh template custom blast...", "info");

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Template data sesuai format yang diinginkan: Telepon, Nama, custom
      const templateData = [
        ["Telepon", "Nama", "custom"],
        ["628123456789", "John Doe", "custom"],
        ["628234567890", "Jane Smith", "custom"],
        ["628345678901", "Bob Wilson", "custom"],
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);

      // Set column widths
      ws["!cols"] = [
        { wch: 15 }, // Telepon
        { wch: 20 }, // Nama
        { wch: 15 }, // custom
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Custom Blast Data");

      // Create instructions sheet with detailed explanation
      const instructionsData = [
        ["PETUNJUK PENGGUNAAN TEMPLATE CUSTOM BLAST"],
        [""],
        ["🎯 CARA KERJA CUSTOM BLAST:"],
        [
          "1. Custom Blast otomatis mendeteksi HEADER (baris paling atas) sebagai VARIABLE",
        ],
        [
          "2. Setiap kolom header akan menjadi variable yang bisa digunakan di pesan",
        ],
        ["3. Kolom 'Telepon' WAJIB ada untuk menentukan tujuan pesan"],
        ["4. Nama kolom lainnya bisa disesuaikan sesuai kebutuhan Anda"],
        [""],
        ["📋 FORMAT TEMPLATE:"],
        [
          "- Kolom 'Telepon': Nomor WhatsApp dengan format 628xxxxxxxxx (WAJIB)",
        ],
        ["- Kolom 'Nama': Nama kontak (bisa diganti dengan nama kolom lain)"],
        [
          "- Kolom 'custom': Contoh kolom custom (bisa diganti dengan apa saja)",
        ],
        [""],
        ["✨ CONTOH PENGGUNAAN VARIABLE:"],
        ["Jika header Excel Anda: Telepon | Nama | Perusahaan | Kota"],
        ["Maka variable yang tersedia: {Telepon} {Nama} {Perusahaan} {Kota}"],
        [""],
        ["📝 CONTOH PESAN CUSTOM BLAST:"],
        ["Halo {Nama}! 👋"],
        [""],
        ["Kami ingin memberikan penawaran khusus untuk {Perusahaan}"],
        ["yang berlokasi di {Kota}."],
        [""],
        ["Hubungi kami kembali di {Telepon} untuk informasi lebih lanjut."],
        [""],
        ["Terima kasih!"],
        [""],
        ["🔧 LANGKAH-LANGKAH:"],
        ["1. Ubah header sesuai kebutuhan (jangan hapus kolom Telepon)"],
        ["2. Isi data kontak di baris-baris berikutnya"],
        ["3. Simpan file dalam format .xlsx"],
        ["4. Upload file ke menu Custom Blast"],
        ["5. Variable akan otomatis terdeteksi dari header"],
        ["6. Klik variable untuk menambahkan ke pesan"],
        ["7. Kirim Custom Blast"],
        [""],
        ["⚠️ CATATAN PENTING:"],
        ["- Header (baris 1) akan menjadi nama variable"],
        ["- Pastikan tidak ada spasi berlebih di nama header"],
        ["- Kolom telepon harus berisi nomor yang valid"],
        ["- Setiap baris data akan menjadi 1 pesan terpisah"],
        ["- Variable {NamaKolom} akan diganti otomatis sesuai data per baris"],
        [""],
        ["💡 TIPS:"],
        ["- Gunakan nama header yang mudah diingat"],
        ["- Contoh header bagus: Nama, Perusahaan, Jabatan, Kota, Produk"],
        ["- Hindari karakter khusus di nama header"],
        ["- Test dengan data sedikit dulu sebelum blast massal"],
      ];

      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      wsInstructions["!cols"] = [{ wch: 80 }];

      XLSX.utils.book_append_sheet(wb, wsInstructions, "Petunjuk");

      // Download file
      const fileName = `Template_CustomBlast_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      showStatus("✅ Template custom blast berhasil diunduh", "success");
      addDebugInfo(`📊 Custom blast template downloaded: ${fileName}`);
    } catch (error) {
      console.error("Download custom blast template error:", error);
      showStatus("❌ Gagal mengunduh template custom blast", "error");
      addDebugInfo(`❌ Download custom blast template error: ${error.message}`);
    }
  };

  // Enhanced Variable Insertion with Animation
  const insertVariableToMessage = (variable) => {
    const messageField = messageTextareaRef.current;
    if (messageField) {
      const cursorPos =
        messageField.selectionStart || customBlastMessage.length;
      const textBefore = customBlastMessage.substring(0, cursorPos);
      const textAfter = customBlastMessage.substring(cursorPos);

      const variableText = `{${variable}}`;
      const newMessage = textBefore + variableText + textAfter;
      setCustomBlastMessage(newMessage);

      // Add to recently used
      setRecentlyUsedVars((prev) => {
        const filtered = prev.filter((v) => v !== variable);
        return [variable, ...filtered].slice(0, 6); // Keep last 6
      });

      // Trigger animation
      setVariableAnimations((prev) => ({
        ...prev,
        [variable]: Date.now(),
      }));

      // Set cursor position after inserted variable
      setTimeout(() => {
        const newCursorPos = cursorPos + variableText.length;
        messageField.setSelectionRange(newCursorPos, newCursorPos);
        messageField.focus();
      }, 0);

      // Clear animation after 1 second
      setTimeout(() => {
        setVariableAnimations((prev) => {
          const newAnims = { ...prev };
          delete newAnims[variable];
          return newAnims;
        });
      }, 1000);

      showStatus(`✅ Variabel {${variable}} berhasil ditambahkan`, "success");
    }
  };

  const clearExcelPreview = () => {
    setCustomBlastExcelData(null);
    setCustomBlastVariables([]);
    setCustomBlastPhoneMapping({});
    setCustomBlastDataMapping({});
    setRecentlyUsedVars([]);
    setSearchVariable("");
    if (excelInputRef.current) {
      excelInputRef.current.value = "";
    }
    setCustomBlastMessage("");
  };

  const handleTypeChange = (type) => {
    setCustomBlastType(type);
    if (type === "text") {
      resetFileUpload();
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (customBlastType === "image" && !file.type.startsWith("image/")) {
      showStatus(
        "❌ File yang dipilih bukan gambar. Pilih file gambar yang valid.",
        "error"
      );
      resetFileUpload();
      return;
    }

    if (customBlastType === "document" && file.type.startsWith("image/")) {
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

    setCustomBlastFile(file);
    setCustomBlastFileInfo({
      icon: getFileIcon(file.name),
      name: file.name,
      size: formatFileSize(file.size),
    });
  };

  const resetFileUpload = () => {
    setCustomBlastFile(null);
    setCustomBlastFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // FIXED: Progress update function
  const updateProgress = (current, total) => {
    setProgress({ current, total });
    setCurrentProgress({ current, total });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (customBlastInProgress) {
      showStatus(
        "❌ Custom blast sedang berjalan. Tunggu sampai selesai.",
        "error"
      );
      return;
    }

    // Check if Excel data is available
    if (Object.keys(customBlastPhoneMapping).length === 0) {
      showStatus(
        "❌ Harap upload file Excel terlebih dahulu untuk custom blast",
        "error"
      );
      return;
    }

    if (!customBlastMessage && customBlastType === "text") {
      showStatus("❌ Pesan harus diisi untuk custom blast teks", "error");
      return;
    }

    if (
      (customBlastType === "image" || customBlastType === "document") &&
      !customBlastFile
    ) {
      showStatus(`❌ File ${customBlastType} harus dipilih`, "error");
      return;
    }

    const phoneNumbersList = Object.keys(customBlastPhoneMapping);
    if (phoneNumbersList.length === 0) {
      showStatus(
        "❌ Tidak ada nomor telepon yang valid ditemukan di Excel",
        "error"
      );
      return;
    }

    const sessionValid = await checkSessionBeforeSend(
      sessionName,
      addDebugInfo
    );
    if (!sessionValid) {
      return;
    }

    setCustomBlastInProgress(true);

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
      if (customBlastFile) {
        addDebugInfo(
          `📊 CUSTOM BLAST: Uploading ${customBlastType} for custom blast: ${
            customBlastFile.name
          } (${formatFileSize(customBlastFile.size)})`
        );
        fileUrl = await uploadWithWorkingServices(
          customBlastFile,
          uploadService,
          addDebugInfo
        );
        addDebugInfo(`✅ CUSTOM BLAST: File uploaded successfully: ${fileUrl}`);
      }

      // Store custom blast configuration for potential retry
      setLastBlastConfig({
        sessionName,
        blastType: customBlastType,
        blastMessage: customBlastMessage,
        blastDelay: customBlastDelay,
        uploadService,
        fileUrl,
        fileName: customBlastFile?.name || null,
        isCustomBlast: true,
      });

      addDebugInfo(
        `📊 CUSTOM BLAST: Starting Excel variables blast to ${phoneNumbersList.length} numbers with ${customBlastDelay}s delay`
      );

      let currentIndex = 0;

      for (const phoneNumber of phoneNumbersList) {
        currentIndex++;
        updateProgress(currentIndex, phoneNumbersList.length);

        try {
          addDebugInfo(
            `📊 CUSTOM BLAST: Sending to ${phoneNumber} (${currentIndex}/${phoneNumbersList.length})`
          );

          let personalizedMessage = processCustomBlastTemplate(
            customBlastMessage,
            phoneNumber,
            customBlastDataMapping,
            customBlastVariables,
            contacts
          );

          let messagePayload = {
            session: sessionName,
            to: phoneNumber,
            text: personalizedMessage || "",
            is_group: false,
          };

          let response;
          if (customBlastType === "text") {
            response = await messageAPI.sendText(messagePayload);
          } else if (customBlastType === "image") {
            messagePayload.image_url = fileUrl;
            response = await messageAPI.sendImage(messagePayload);
          } else if (customBlastType === "document") {
            messagePayload.document_url = fileUrl;
            messagePayload.document_name = customBlastFile.name;
            response = await messageAPI.sendDocument(messagePayload);
          }

          const excelData = customBlastDataMapping[phoneNumber];
          const dataInfo = excelData
            ? ` (Excel data applied)`
            : ` (No Excel data)`;

          addMessageLog(
            phoneNumber,
            "success",
            personalizedMessage,
            `✅ Custom Excel variables berhasil dikirim via ${customBlastType}${dataInfo}`
          );
          addDebugInfo(
            `✅ CUSTOM BLAST: Success to ${phoneNumber} with Excel variables`
          );
        } catch (error) {
          addMessageLog(
            phoneNumber,
            "error",
            customBlastMessage,
            `❌ Error: ${error.message}`
          );
          addDebugInfo(
            `❌ CUSTOM BLAST: Failed to ${phoneNumber}: ${error.message}`
          );
        }

        if (currentIndex < phoneNumbersList.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, customBlastDelay * 1000)
          );
        }
      }

      // Completion will be handled by useEffect monitoring blastResults
      addDebugInfo(
        `📊 CUSTOM BLAST: Completed with Excel variables. Check results for details.`
      );
    } catch (error) {
      console.error("Custom blast error:", error);
      addDebugInfo(`❌ CUSTOM BLAST: Critical error: ${error.message}`);
      showStatus(`❌ Custom blast gagal: ${error.message}`, "error");
    } finally {
      setCustomBlastInProgress(false);
      updateProgress(phoneNumbersList.length, phoneNumbersList.length);
    }
  };

  // Filter variables based on search
  const filteredVariables = customBlastVariables.filter((variable) =>
    variable.toLowerCase().includes(searchVariable.toLowerCase())
  );

  // Sort variables: recently used first, then alphabetical
  const sortedVariables = [...filteredVariables].sort((a, b) => {
    const aIndex = recentlyUsedVars.indexOf(a);
    const bIndex = recentlyUsedVars.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  const templatePreview = customBlastMessage
    ? getTemplatePreview(
        customBlastMessage,
        customBlastDataMapping[Object.keys(customBlastDataMapping)[0]] || {}
      )
    : "";

  return (
    <>

      {/* FIXED: Enhanced Progress Section */}
      {(customBlastInProgress || currentProgress.total > 0) && (
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
                📈 Progress Custom Blast
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

            {customBlastInProgress && (
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

      {/* Excel Import Section */}
      <div className="main-card p-6 md:p-8 mb-8 fade-in">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          📂 Import File Excel untuk Custom Blast
        </h3>

        <div
          className="feature-card p-4 mb-6"
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            borderColor: "#f59e0b",
          }}
        >
          <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 mt-1"
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
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2">
                🎯 Cara Kerja Custom Blast:
              </h4>
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Header Excel otomatis jadi VARIABLE</strong> - Baris
                  paling atas akan menjadi nama variable
                </li>
                <li>
                  • <strong>Kolom "Telepon" WAJIB ada</strong> - Untuk
                  menentukan tujuan pesan WhatsApp
                </li>
                <li>
                  • <strong>Nama kolom lain bebas disesuaikan</strong> - Contoh:
                  Nama, Perusahaan, Kota, Produk, dll.
                </li>
                <li>
                  • <strong>Variable bisa diklik untuk ditambahkan</strong> -
                  Variable akan muncul otomatis setelah upload Excel
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div
            className={`excel-import-zone p-6 md:p-8 rounded-xl text-center cursor-pointer flex-1 transition-all duration-300 hover:scale-[1.02] ${
              customBlastInProgress ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={() =>
              !customBlastInProgress && excelInputRef.current?.click()
            }
          >
            <input
              type="file"
              ref={excelInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleExcelFile(e.target.files[0])}
              className="hidden"
              disabled={customBlastInProgress}
            />
            <div>
              <svg
                className="mx-auto h-12 md:h-16 w-12 md:w-16 text-green-500 mb-4 transition-transform duration-300 hover:scale-110"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg md:text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                📊 Upload Excel untuk Auto-Detect Variable & Nomor Telepon
              </p>
              <p className="text-sm text-green-600 dark:text-green-300">
                Header Excel akan otomatis jadi variable yang bisa diklik untuk
                ditambahkan ke pesan
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <button
              onClick={downloadCustomBlastTemplate}
              className="btn-primary mb-4 px-6 py-3"
              disabled={customBlastInProgress}
            >
              📥 Download Template Custom Blast
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Template Excel dengan petunjuk lengkap cara penggunaan
            </p>
          </div>
        </div>

        {/* Excel Preview with Enhanced UI */}
        {customBlastExcelData && (
          <div className="space-y-6 fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h4 className="font-bold text-green-800 dark:text-green-200">
                Preview Data Excel & Auto-Detection
              </h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={clearExcelPreview}
                  className="btn-danger flex items-center gap-2 transition-all duration-300 hover:scale-105"
                  disabled={customBlastInProgress}
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
                  Clear
                </button>
              </div>
            </div>

            {/* Auto-Detection Info */}
            <div
              className="feature-card p-4 transition-all duration-300 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                borderColor: "#3b82f6",
              }}
            >
              <div className="flex flex-wrap items-center gap-4 text-sm text-blue-800 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                  <span>
                    <strong>Phone:</strong>{" "}
                    {Object.keys(customBlastPhoneMapping).length > 0
                      ? "Detected"
                      : "Not detected"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span>
                    <strong>Variables:</strong> {customBlastVariables.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  <span>
                    <strong>Records:</strong> {customBlastExcelData.rows.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Variables Section */}
            <div
              className="feature-card p-6 transition-all duration-300 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                borderColor: "#6366f1",
              }}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h5 className="text-lg font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                    🔧 <strong>Available Variables</strong>
                    <span className="text-sm bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 px-2 py-1 rounded-full">
                      {customBlastVariables.length}
                    </span>
                  </h5>
                  <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">
                    Klik variable untuk menambahkan ke pesan
                  </p>
                </div>
                <button
                  onClick={() => setVariablesExpanded(!variablesExpanded)}
                  className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all duration-300"
                  disabled={customBlastInProgress}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ${
                      variablesExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                  {variablesExpanded ? "Tutup" : "Buka"} Variables
                </button>
              </div>

              {variablesExpanded && (
                <div className="space-y-4 transition-all duration-500">
                  {/* Search Variables */}
                  {customBlastVariables.length > 8 && (
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <svg
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          ></path>
                        </svg>
                        <input
                          type="text"
                          placeholder="Cari variable..."
                          value={searchVariable}
                          onChange={(e) => setSearchVariable(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-all duration-300"
                          disabled={customBlastInProgress}
                        />
                      </div>
                      <div className="text-sm text-indigo-600 dark:text-indigo-300">
                        {filteredVariables.length} dari{" "}
                        {customBlastVariables.length}
                      </div>
                    </div>
                  )}

                  {/* Recently Used Variables */}
                  {recentlyUsedVars.length > 0 && (
                    <div>
                      <h6 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        Recently Used
                      </h6>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {recentlyUsedVars.slice(0, 6).map((variable, index) => (
                          <button
                            key={`recent-${variable}`}
                            className="variable-chip-recent"
                            onClick={() => insertVariableToMessage(variable)}
                            style={{ animationDelay: `${index * 0.1}s` }}
                            disabled={customBlastInProgress}
                          >
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                            {`{${variable}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Variables Grid */}
                  <div>
                    <h6 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
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
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                        ></path>
                      </svg>
                      All Variables
                      {searchVariable && (
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-800 px-2 py-1 rounded">
                          {filteredVariables.length} hasil
                        </span>
                      )}
                    </h6>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {sortedVariables.map((variable, index) => {
                        const isAnimating = variableAnimations[variable];
                        const isRecentlyUsed =
                          recentlyUsedVars.includes(variable);

                        return (
                          <button
                            key={variable}
                            className={`variable-chip ${
                              isAnimating ? "variable-chip-animated" : ""
                            } ${isRecentlyUsed ? "variable-chip-used" : ""} ${
                              customBlastInProgress
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                            onClick={() =>
                              !customBlastInProgress &&
                              insertVariableToMessage(variable)
                            }
                            style={{ animationDelay: `${index * 0.05}s` }}
                            title={`Klik untuk menambahkan {${variable}} ke pesan`}
                            disabled={customBlastInProgress}
                          >
                            <span className="variable-text">{`{${variable}}`}</span>
                            {isRecentlyUsed && (
                              <span className="variable-badge">
                                <svg
                                  className="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  ></path>
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {filteredVariables.length === 0 && searchVariable && (
                      <div className="text-center py-8">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.239 0-4.236-.906-5.672-2.365M6.343 6.343A8 8 0 0112 4c4.418 0 8 3.582 8 8 0 .993-.183 1.946-.515 2.826"
                          ></path>
                        </svg>
                        <p className="text-gray-500 text-sm">
                          Tidak ada variable yang cocok dengan "{searchVariable}
                          "
                        </p>
                      </div>
                    )}

                    {customBlastVariables.length === 0 && (
                      <div className="text-center py-8">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          ></path>
                        </svg>
                        <p className="text-indigo-600 dark:text-indigo-300 text-sm">
                          Import file Excel untuk menampilkan variables yang
                          tersedia
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Excel Preview Table */}
            <div className="excel-preview-table transition-all duration-300 hover:shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {customBlastExcelData.headers.map((header, index) => (
                        <th
                          key={index}
                          className="bg-green-100 dark:bg-green-800 p-3 text-left font-semibold whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customBlastExcelData.rows
                      .slice(0, 5)
                      .map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="hover:bg-green-25 dark:hover:bg-green-900/5 transition-colors duration-200"
                        >
                          {customBlastExcelData.headers.map(
                            (header, colIndex) => (
                              <td
                                key={colIndex}
                                className="bg-green-50 dark:bg-green-900/10 p-3 whitespace-nowrap"
                              >
                                {row[colIndex] || "-"}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    {customBlastExcelData.rows.length > 5 && (
                      <tr>
                        <td
                          colSpan={customBlastExcelData.headers.length}
                          className="text-center text-gray-500 font-medium p-4 bg-gray-50 dark:bg-gray-800"
                        >
                          ... dan {customBlastExcelData.rows.length - 5} baris
                          lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              {customBlastExcelData.rows.length} baris data ditemukan
            </div>
          </div>
        )}

        {Object.keys(customBlastPhoneMapping).length === 0 &&
          !customBlastExcelData && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-lg font-medium mb-2">
                Upload file Excel untuk memulai Custom Blast
              </p>
              <p className="text-sm">
                File Excel harus berisi kolom nomor telepon dan variable lainnya
                untuk personalisasi pesan.
              </p>
            </div>
          )}
      </div>

      {/* Custom Blast Form - Only show if Excel data is available */}
      {Object.keys(customBlastPhoneMapping).length > 0 && (
        <div className="main-card p-6 md:p-8 fade-in">
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            <SessionSelector />
            {/* Message Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Tipe Pesan Custom Blast
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: "text", icon: "📝", label: "Teks Custom" },
                  {
                    value: "image",
                    icon: "🖼️",
                    label: "Gambar + Caption Custom",
                  },
                  {
                    value: "document",
                    icon: "📄",
                    label: "Dokumen + Caption Custom",
                  },
                ].map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                      customBlastType === type.value
                        ? "border-primary bg-gray-50 dark:bg-gray-700 shadow-lg transform scale-[1.02]"
                        : "border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                    } ${
                      customBlastInProgress
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="customBlastType"
                      value={type.value}
                      checked={customBlastType === type.value}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="mr-4"
                      disabled={customBlastInProgress}
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
                Pesan / Caption Custom (gunakan variables dari Excel)
              </label>
              <textarea
                ref={messageTextareaRef}
                id="customBlastMessage"
                value={customBlastMessage}
                onChange={(e) => setCustomBlastMessage(e.target.value)}
                rows="6"
                placeholder="Tulis pesan Anda di sini... Klik variables dari Excel di atas untuk menambahkan ke pesan."
                className="form-input w-full resize-vertical transition-all duration-300 focus:ring-2 focus:ring-primary"
                required={customBlastType === "text"}
                disabled={customBlastInProgress}
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
                Excel variables akan otomatis replaced per kontak sesuai data di
                file Excel
              </p>
            </div>

            {/* Template Preview */}
            {customBlastMessage && templatePreview && (
              <div className="template-preview transition-all duration-300 hover:shadow-lg">
                <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                  Preview Template
                </h4>
                <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm mb-2 opacity-80">
                    Contoh hasil pesan yang akan dikirim:
                  </p>
                  <p className="whitespace-pre-wrap font-medium">
                    {templatePreview}
                  </p>
                </div>
              </div>
            )}

            {/* File Upload Section */}
            {customBlastType !== "text" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Upload File untuk Custom Blast
                </label>
                <div
                  className={`upload-zone p-8 md:p-10 text-center cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    customBlastInProgress ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() =>
                    !customBlastInProgress && fileInputRef.current?.click()
                  }
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept={
                      customBlastType === "image"
                        ? "image/*"
                        : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                    }
                    onChange={(e) => handleFileChange(e.target.files[0])}
                    className="hidden"
                    disabled={customBlastInProgress}
                  />

                  {!customBlastFileInfo ? (
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
                          {customBlastFileInfo.icon}
                        </span>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {customBlastFileInfo.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {customBlastFileInfo.size}
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
                        disabled={customBlastInProgress}
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
                  value={customBlastDelay}
                  onChange={(e) =>
                    setCustomBlastDelay(parseInt(e.target.value) || 2)
                  }
                  min="1"
                  max="60"
                  className="form-input w-full transition-all duration-300 focus:ring-2 focus:ring-primary"
                  disabled={customBlastInProgress}
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
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      ></path>
                    </svg>
                    <strong>Excel Data:</strong>
                  </div>
                  <div>
                    {Object.keys(customBlastDataMapping).length} data rows ready
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={customBlastInProgress}
              className="btn-success w-full text-lg py-4 transition-all duration-300 hover:scale-[1.02] disabled:scale-100 flex items-center justify-center gap-3"
            >
              {customBlastInProgress ? (
                <>
                  <div className="loading-spinner"></div>
                  📊 Sedang mengirim custom blast ke {progress.current}/
                  {progress.total} nomor...
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
                  MULAI CUSTOM BLAST dengan Excel Variables
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Enhanced CSS Styles */}
      <style jsx>{`
        .variable-chip {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-weight: 600;
          box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
          border: 2px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          position: relative;
          overflow: hidden;
          animation: slideInUp 0.5s ease-out forwards;
          opacity: 0;
          transform: translateY(20px);
        }

        .variable-chip:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 25px 0 rgba(16, 185, 129, 0.5);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .variable-chip:active {
          transform: translateY(0) scale(0.98);
        }

        .variable-chip:disabled {
          cursor: not-allowed;
          transform: none;
          opacity: 0.5;
        }

        .variable-chip-animated {
          animation: chipPulse 0.6s ease-out;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          transform: scale(1.1);
        }

        .variable-chip-used {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .variable-chip-recent {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
          box-shadow: 0 2px 8px 0 rgba(245, 158, 11, 0.3);
          display: flex;
          align-items: center;
          animation: slideInLeft 0.5s ease-out forwards;
          opacity: 0;
          transform: translateX(-20px);
        }

        .variable-chip-recent:hover:not(:disabled) {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 4px 12px 0 rgba(245, 158, 11, 0.4);
        }

        .variable-chip-recent:disabled {
          cursor: not-allowed;
          transform: none;
          opacity: 0.5;
        }

        .variable-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
        }

        .variable-text {
          position: relative;
          z-index: 1;
        }

        .loading-spinner {
          border: 2px solid #f3f3f3;
          border-radius: 50%;
          border-top: 2px solid #10b981;
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

        @keyframes slideInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes chipPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 8px 25px 0 rgba(59, 130, 246, 0.6);
          }
          100% {
            transform: scale(1.05);
            box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.45);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

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

        @media (max-width: 640px) {
          .variable-chip {
            padding: 8px 12px;
            font-size: 0.75rem;
            min-height: 40px;
          }

          .variable-chip-recent {
            padding: 6px 10px;
            font-size: 0.7rem;
          }
        }
      `}</style>
    </>
  );
};

export default CustomBlast;
