import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useNotification } from "../../context/NotificationContext";
import { contactAPI } from "../../services/api";
import { generateId, formatFileSize, formatPhoneNumber } from "../../utils/helpers";
import * as XLSX from "xlsx";

const ContactManagement = () => {
  const { contacts, setContacts, addDebugInfo, navigateToMessageTab } =
    useApp();
  const { showStatus } = useNotification();

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    category: "",
    group: "",
  });
  const [currentEditingContactId, setCurrentEditingContactId] = useState(null);

  // Contact List State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [loading, setLoading] = useState(false);

  // Group Management State
  const [groups, setGroups] = useState([]);
  const [groupStats, setGroupStats] = useState({
    totalGroups: 0,
    contactsInGroups: 0,
    ungroupedContacts: 0,
    totalContacts: 0,
  });
  const [groupsVisible, setGroupsVisible] = useState(false);
  const [searchGroups, setSearchGroups] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupDetailsModalOpen, setGroupDetailsModalOpen] = useState(false);
  const [currentGroupDetails, setCurrentGroupDetails] = useState(null);
  const [selectedContactsForGroup, setSelectedContactsForGroup] = useState(
    new Set()
  );
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
  });
  const [currentEditingGroupId, setCurrentEditingGroupId] = useState(null);
  const [searchContactsInModal, setSearchContactsInModal] = useState("");

  // Excel Import State - FIXED: Simplified state management
  const [contactExcelData, setContactExcelData] = useState(null);
  const [detectedContactMapping, setDetectedContactMapping] = useState({});
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);

  const contactExcelInputRef = useRef(null);

  // Load data on component mount
  useEffect(() => {
    loadContacts();
    loadGroups();
  }, []);

  // Database Functions
  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await contactAPI.getContacts();

      // FIXED: Better response handling
      if (
        response.data &&
        (response.data.success || Array.isArray(response.data))
      ) {
        const contactsData = response.data.success
          ? response.data.data
          : response.data;
        setContacts(Array.isArray(contactsData) ? contactsData : []);
        addDebugInfo(
          `📱 Loaded ${
            Array.isArray(contactsData) ? contactsData.length : 0
          } contacts from database`
        );
      } else {
        setContacts([]);
        addDebugInfo("📱 No contacts found or invalid response format");
      }
    } catch (error) {
      console.error("Load contacts error:", error);

      if (
        error.code === "ECONNREFUSED" ||
        error.message.includes("Network Error")
      ) {
        showStatus(
          "❌ Tidak dapat terhubung ke server. Pastikan backend berjalan di port 5001.",
          "error"
        );
        addDebugInfo(`❌ Connection refused: Backend server not running`);
      } else {
        showStatus("❌ Gagal memuat kontak dari database", "error");
        addDebugInfo(`❌ Load contacts error: ${error.message}`);
      }
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Simplified loadGroups function with cleaner debug output
  const loadGroups = async () => {
    try {
      const response = await contactAPI.getGroups();

      // FIXED: More comprehensive response handling
      if (response.data) {
        let groupsData;
        let statsData = {};

        // Handle different response structures
        if (response.data.success) {
          // Standard success response
          groupsData = response.data.data;
        } else if (Array.isArray(response.data)) {
          // Direct array response
          groupsData = { groups: response.data };
        } else if (response.data.groups || response.data.data) {
          // Response with groups property
          groupsData = response.data.groups
            ? response.data
            : response.data.data;
        } else {
          // Try to use response.data directly
          groupsData = response.data;
        }

        // FIXED: Extract groups array
        let groupsArray = [];
        if (
          groupsData &&
          groupsData.groups &&
          Array.isArray(groupsData.groups)
        ) {
          groupsArray = groupsData.groups;
          statsData = groupsData.stats || {};
        } else if (Array.isArray(groupsData)) {
          groupsArray = groupsData;
        } else {
          groupsArray = [];
        }

        // FIXED: Set groups state with proper data
        setGroups(groupsArray);

        // FIXED: Calculate stats properly
        const calculatedStats = {
          totalGroups: parseInt(statsData.total_groups) || groupsArray.length,
          contactsInGroups: parseInt(statsData.contacts_in_groups) || 0,
          ungroupedContacts: parseInt(statsData.ungrouped_contacts) || 0,
          totalContacts: parseInt(statsData.total_contacts) || 0,
        };

        setGroupStats(calculatedStats);

        // FIXED: Simplified debug logging - only show final result
        addDebugInfo(`👥 Loaded ${groupsArray.length} groups from database`);
      } else {
        setGroups([]);
        setGroupStats({
          totalGroups: 0,
          contactsInGroups: 0,
          ungroupedContacts: 0,
          totalContacts: 0,
        });
      }
    } catch (error) {
      console.error("Load groups error:", error);
      addDebugInfo(`❌ Load groups error: ${error.message}`);

      showStatus("❌ Gagal memuat grup dari database", "error");
      setGroups([]);
      setGroupStats({
        totalGroups: 0,
        contactsInGroups: 0,
        ungroupedContacts: 0,
        totalContacts: 0,
      });
    }
  };

  // Helper Functions
  const getUniqueGroups = () => {
    return groups.map((g) => g.group_name).sort();
  };

  const getGroupContacts = (groupName) => {
    const group = groups.find((g) => g.group_name === groupName);
    return group ? group.contacts : [];
  };

  const getContactsByGroup = (groupName) => {
    return getGroupContacts(groupName);
  };

  // FIXED: Enhanced error message extraction
  const extractErrorMessage = (error) => {
    console.log("Extracting error message from:", error);

    // Handle different error types
    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object") {
      // Try different properties
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      if (error.response?.data?.error) {
        return error.response.data.error;
      }
      if (error.response?.data && typeof error.response.data === "string") {
        return error.response.data;
      }
      if (error.message) {
        return error.message;
      }
      if (error.statusText) {
        return error.statusText;
      }

      // If it's an object, try to stringify it properly
      try {
        const errorStr = JSON.stringify(error, null, 2);
        if (errorStr !== "{}") {
          return `Error details: ${errorStr}`;
        }
      } catch (e) {
        // JSON.stringify failed
      }

      // Last resort - return a generic message
      return `Unknown error occurred (${error.constructor?.name || "Object"})`;
    }

    return "Unknown error occurred";
  };

  // FIXED: Simplified Excel Processing Functions
  const processExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // FIXED: Simplified JSON conversion
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            blankrows: false,
          });

          if (jsonData.length === 0) {
            reject(new Error("File Excel kosong atau tidak valid"));
            return;
          }

          // Use first row as headers
          const headers = jsonData[0].map((cell) =>
            cell ? cell.toString().trim() : ""
          );
          const dataRows = jsonData
            .slice(1)
            .filter(
              (row) =>
                row && row.some((cell) => cell && cell.toString().trim() !== "")
            );

          if (dataRows.length === 0) {
            reject(new Error("Tidak ada data kontak yang ditemukan"));
            return;
          }

          // Simplified debug output - only show result
          addDebugInfo(`📊 Excel processed: ${dataRows.length} contacts found`);

          resolve({
            headers: headers,
            rows: dataRows,
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

  // FIXED: Simplified field mapping detection
  const detectContactMapping = (headers) => {
    const mapping = {
      name: -1,
      phone: -1,
      category: -1,
      group: -1,
    };

    headers.forEach((header, index) => {
      const headerLower = header.toString().toLowerCase().trim();

      // Name field mapping
      if (
        mapping.name === -1 &&
        (headerLower === "nama" ||
          headerLower === "name" ||
          headerLower.includes("nama") ||
          headerLower.includes("name"))
      ) {
        mapping.name = index;
      }

      // Phone field mapping
      if (
        mapping.phone === -1 &&
        (headerLower === "telepon" ||
          headerLower === "phone" ||
          headerLower === "nomor" ||
          headerLower === "hp" ||
          headerLower === "wa" ||
          headerLower.includes("telepon") ||
          headerLower.includes("phone") ||
          headerLower.includes("nomor"))
      ) {
        mapping.phone = index;
      }

      // Category field mapping
      if (
        mapping.category === -1 &&
        (headerLower === "kategori" ||
          headerLower === "category" ||
          headerLower.includes("kategori") ||
          headerLower.includes("category"))
      ) {
        mapping.category = index;
      }

      // Group field mapping
      if (
        mapping.group === -1 &&
        (headerLower === "group" ||
          headerLower === "grup" ||
          headerLower.includes("group") ||
          headerLower.includes("grup"))
      ) {
        mapping.group = index;
      }
    });

    // Simplified debug output
    addDebugInfo(
      `📊 Column mapping detected: ${mapping.name !== -1 ? "Name✓" : "Name✗"} ${
        mapping.phone !== -1 ? "Phone✓" : "Phone✗"
      } ${mapping.category !== -1 ? "Category✓" : "Category✗"} ${
        mapping.group !== -1 ? "Group✓" : "Group✗"
      }`
    );

    return mapping;
  };

  // FIXED: Enhanced contact submit with better error handling
  const handleContactSubmit = async (e) => {
    e.preventDefault();

    if (!contactForm.name || !contactForm.phone) {
      showStatus("❌ Nama dan nomor telepon harus diisi", "error");
      return;
    }

    // FIXED: Phone number validation and formatting
    const cleanPhone = formatPhoneNumber(contactForm.phone);


    if (!/^62\d{8,}$/.test(cleanPhone)) {
      showStatus(
        "❌ Format nomor telepon tidak valid. Gunakan format 628xxxxxxxxx",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      // FIXED: Prepare contact data with proper structure
      const contactData = {
        name: contactForm.name.trim(),
        phone: cleanPhone,
        category: contactForm.category.trim(),
        group: contactForm.group.trim(),
      };

      if (currentEditingContactId) {
        // Update existing contact
        const response = await contactAPI.updateContact(
          currentEditingContactId,
          contactData
        );

        if (
          response.data &&
          (response.data.success || response.status === 200)
        ) {
          // If group is specified, handle group assignment
          if (contactData.group) {
            try {
              await contactAPI.addContactToGroup(
                currentEditingContactId,
                contactData.group
              );
              addDebugInfo(
                `✅ Contact ${contactData.name} assigned to group: ${contactData.group}`
              );
            } catch (groupError) {
              console.log(
                "Group assignment during update - this is normal:",
                groupError.message
              );
            }
          }

          showStatus(
            `✅ Kontak ${contactData.name} berhasil diperbarui`,
            "success"
          );
          addDebugInfo(`✅ Contact updated: ${contactData.name}`);
          setCurrentEditingContactId(null);
          await loadContacts();
          await loadGroups();
        } else {
          throw new Error("Failed to update contact");
        }
      } else {
        // Add new contact
        const response = await contactAPI.addContact(contactData);

        if (
          response.data &&
          (response.data.success ||
            response.status === 200 ||
            response.status === 201)
        ) {
          const newContactId = response.data.data?.id || response.data.id;

          // FIXED: Auto assign to group if specified
          if (contactData.group && newContactId) {
            try {
              await contactAPI.addContactToGroup(
                newContactId,
                contactData.group
              );
              addDebugInfo(
                `✅ Contact ${contactData.name} auto-assigned to group: ${contactData.group}`
              );
              showStatus(
                `✅ Kontak ${contactData.name} berhasil disimpan dan ditambahkan ke group "${contactData.group}"`,
                "success"
              );
            } catch (groupError) {
              console.log(
                "Group assignment error (contact still saved):",
                groupError.message
              );
              showStatus(
                `✅ Kontak ${contactData.name} berhasil disimpan`,
                "success"
              );
            }
          } else {
            showStatus(
              `✅ Kontak ${contactData.name} berhasil disimpan`,
              "success"
            );
          }

          addDebugInfo(`✅ Contact added: ${contactData.name}`);
          await loadContacts();
          await loadGroups();
        } else {
          throw new Error("Failed to add contact");
        }
      }

      // Clear form
      setContactForm({ name: "", phone: "", category: "", group: "" });
    } catch (error) {
      console.error("Save contact error:", error);

      const errorMessage = extractErrorMessage(error);
      showStatus(`❌ ${errorMessage}`, "error");
      addDebugInfo(`❌ Save contact error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const editContact = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      setCurrentEditingContactId(contactId);
      setContactForm({
        name: contact.name,
        phone: contact.phone,
        category: contact.category || "",
        group:
          contact.groups && contact.groups.length > 0 ? contact.groups[0] : "",
      });
    }
  };

  const deleteContact = async (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    if (
      window.confirm(
        `Apakah Anda yakin ingin menghapus kontak ${contact.name}?`
      )
    ) {
      try {
        setLoading(true);
        const response = await contactAPI.deleteContact(contactId);
        if (
          response.data &&
          (response.data.success || response.status === 200)
        ) {
          showStatus("✅ Kontak berhasil dihapus", "success");
          addDebugInfo(`✅ Contact deleted: ${contact.name}`);
          await loadContacts();
          await loadGroups();
        }
      } catch (error) {
        console.error("Delete contact error:", error);
        const errorMessage = extractErrorMessage(error);
        showStatus(`❌ ${errorMessage}`, "error");
        addDebugInfo(`❌ Delete contact error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const clearContactForm = () => {
    setCurrentEditingContactId(null);
    setContactForm({ name: "", phone: "", category: "", group: "" });
  };

  const clearAllContacts = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua kontak?")) {
      try {
        setLoading(true);
        for (const contact of contacts) {
          await contactAPI.deleteContact(contact.id);
        }
        showStatus("✅ Semua kontak berhasil dihapus", "success");
        addDebugInfo("✅ All contacts deleted");
        await loadContacts();
        await loadGroups();
      } catch (error) {
        console.error("Clear all contacts error:", error);
        const errorMessage = extractErrorMessage(error);
        showStatus(`❌ ${errorMessage}`, "error");
        addDebugInfo(`❌ Clear all contacts error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // FIXED: Simplified Excel Import Functions
  const handleContactExcelFile = async (file) => {
    if (!file) return;

    try {
      setIsImporting(true);
      showStatus("📊 Memproses file Excel kontak...", "info");

      const excelData = await processExcelFile(file);
      const mapping = detectContactMapping(excelData.headers);

      setContactExcelData(excelData);
      setDetectedContactMapping(mapping);

      showStatus(
        `✅ File Excel berhasil diproses: ${excelData.rows.length} kontak ditemukan`,
        "success"
      );
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      showStatus(`❌ Error: ${errorMessage}`, "error");
      addDebugInfo(`❌ Contact Excel error: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  // FIXED: Completely rewritten import function with simplified debug output
  const importContactsFromExcel = async () => {
    if (!contactExcelData || !detectedContactMapping) {
      showStatus("❌ Tidak ada data Excel yang valid untuk diimport", "error");
      return;
    }

    const { headers, rows } = contactExcelData;
    const mapping = detectedContactMapping;

    if (mapping.name === -1 || mapping.phone === -1) {
      showStatus(
        "❌ Kolom nama dan telepon harus terdeteksi untuk import",
        "error"
      );
      return;
    }

    try {
      setIsImporting(true);
      showStatus("📊 Memvalidasi dan mengimport kontak...", "info");

      const contactsToImport = [];
      const errors = [];

      setImportProgress({ current: 0, total: rows.length });

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setImportProgress({ current: i + 1, total: rows.length });

        try {
          // Extract data from row
          const name = row[mapping.name]
            ? row[mapping.name].toString().trim()
            : "";
          const phone = row[mapping.phone]
            ? row[mapping.phone].toString().trim()
            : "";
          const category =
            mapping.category !== -1 && row[mapping.category]
              ? row[mapping.category].toString().trim()
              : "";
          const group =
            mapping.group !== -1 && row[mapping.group]
              ? row[mapping.group].toString().trim()
              : "";

          // Skip empty rows
          if (!name && !phone) {
            continue;
          }

          // Validate required fields
          if (!name) {
            errors.push(`Baris ${i + 2}: Nama kosong`);
            continue;
          }

          if (!phone) {
            errors.push(`Baris ${i + 2}: Nomor telepon kosong`);
            continue;
          }

          // Clean and validate phone number
          const cleanPhone = formatPhoneNumber(phone);


          if (!/^62\d{8,}$/.test(cleanPhone)) {
            errors.push(
              `Baris ${i + 2}: Format nomor telepon tidak valid (${phone})`
            );
            continue;
          }

          // Check for duplicates in current batch
          const isDuplicateInBatch = contactsToImport.some(
            (contact) => contact.phone === cleanPhone
          );
          if (isDuplicateInBatch) {
            errors.push(
              `Baris ${i + 2}: Nomor telepon duplikat dalam file (${phone})`
            );
            continue;
          }

          // Check for existing contact in database
          const existingContact = contacts.find(
            (contact) => contact.phone === cleanPhone
          );
          if (existingContact) {
            errors.push(
              `Baris ${i + 2}: Nomor telepon sudah ada di database (${phone})`
            );
            continue;
          }

          // Add to import list
          contactsToImport.push({
            name: name,
            phone: cleanPhone,
            category: category,
            group: group,
          });
        } catch (rowError) {
          errors.push(`Baris ${i + 2}: ${extractErrorMessage(rowError)}`);
        }
      }

      // Simplified debug output for validation
      addDebugInfo(
        `📊 Validation complete: ${contactsToImport.length} valid contacts, ${errors.length} errors`
      );

      if (contactsToImport.length === 0) {
        throw new Error(
          "Tidak ada data kontak yang valid ditemukan untuk diimport"
        );
      }

      // Import to API using the same approach as manual contact addition
      showStatus(
        `📤 Mengimpor ${contactsToImport.length} kontak ke database...`,
        "info"
      );

      let imported = 0;
      let failed = 0;
      const importErrors = [];

      // Import contacts one by one (more reliable than bulk)
      for (let i = 0; i < contactsToImport.length; i++) {
        const contactData = contactsToImport[i];
        setImportProgress({ current: i + 1, total: contactsToImport.length });

        try {
          const response = await contactAPI.addContact(contactData);

          if (
            response &&
            (response.data?.success ||
              response.status === 200 ||
              response.status === 201)
          ) {
            imported++;
            const newContactId = response.data?.data?.id || response.data?.id;

            // Auto assign to group if specified
            if (contactData.group && newContactId) {
              try {
                await contactAPI.addContactToGroup(
                  newContactId,
                  contactData.group
                );
              } catch (groupError) {
                // Silent group assignment error
              }
            }
          } else {
            throw new Error(`Invalid response from server`);
          }
        } catch (contactError) {
          failed++;
          const errorMsg = extractErrorMessage(contactError);
          importErrors.push(
            `${contactData.name} (${contactData.phone}): ${errorMsg}`
          );
        }

        // Small delay to prevent overwhelming the server
        if (i < contactsToImport.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Reload data from server
      await loadContacts();
      await loadGroups();

      // Show results
      const stats = {
        total: rows.length,
        valid: contactsToImport.length,
        imported: imported,
        failed: failed,
        errors: errors.length,
        importErrors: importErrors,
      };

      setImportStats(stats);

      const successRate =
        contactsToImport.length > 0
          ? ((imported / contactsToImport.length) * 100).toFixed(1)
          : 0;

      if (imported > 0) {
        const message = `✅ Import berhasil: ${imported}/${
          contactsToImport.length
        } kontak diimport (${successRate}%)${
          failed > 0 ? `, ${failed} gagal` : ""
        }${errors.length > 0 ? `, ${errors.length} data tidak valid` : ""}`;
        showStatus(message, "success");

        // Simplified debug output for import result
        addDebugInfo(
          `✅ Excel import completed: ${imported} imported, ${failed} failed`
        );
      } else {
        throw new Error("Tidak ada kontak yang berhasil diimport");
      }

      // Clear preview
      clearContactExcelPreview();
    } catch (error) {
      console.error("Import contacts error:", error);

      const errorMessage = extractErrorMessage(error);
      showStatus(`❌ Error saat import: ${errorMessage}`, "error");
      addDebugInfo(`❌ Excel import error: ${errorMessage}`);
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const clearContactExcelPreview = () => {
    setContactExcelData(null);
    setDetectedContactMapping({});
    setImportStats(null);
    if (contactExcelInputRef.current) {
      contactExcelInputRef.current.value = "";
    }
  };

  // FIXED: Enhanced Download Excel Template
  const downloadExcelTemplate = async () => {
    try {
      showStatus("📊 Mengunduh template Excel...", "info");

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Template data - using exact headers that will be detected
      const headers = ["Nama", "Telepon", "Kategori", "Group"];
      const sampleData = [
        ["John Doe", "628123456789", "Customer", "VIP"],
        ["Jane Smith", "628234567890", "Supplier", "Partner"],
        ["Bob Wilson", "628345678901", "Staff", "Internal"],
        ["Alice Brown", "628456789012", "Customer", "Regular"],
        ["Charlie Davis", "628567890123", "Partner", "Strategic"],
      ];

      // Create main sheet
      const wsData = [headers, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws["!cols"] = [
        { wch: 20 }, // Nama
        { wch: 15 }, // Telepon
        { wch: 15 }, // Kategori
        { wch: 20 }, // Group
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Template Kontak");

      // Create instructions sheet
      const instructions = [
        ["PETUNJUK PENGGUNAAN TEMPLATE KONTAK"],
        [""],
        ["📋 FORMAT TEMPLATE:"],
        ["1. Nama (WAJIB): Nama lengkap kontak"],
        ["2. Telepon (WAJIB): Nomor WhatsApp dengan format 628xxxxxxxxx"],
        ["3. Kategori (Opsional): Customer, Supplier, Partner, Staff, dll."],
        ["4. Group (Opsional): Nama group untuk mengelompokkan kontak"],
        [""],
        ["📝 CONTOH FORMAT NOMOR TELEPON:"],
        ["- 628123456789 (format internasional, direkomendasikan)"],
        ["- 08123456789 (akan otomatis dikonversi ke 628123456789)"],
        ["- +628123456789 (akan otomatis dikonversi ke 628123456789)"],
        [""],
        ["⚠️ CATATAN PENTING:"],
        ["- Header (baris 1) JANGAN diubah"],
        ["- Kolom Nama dan Telepon WAJIB diisi"],
        ["- Nomor telepon harus valid dan unik"],
        ["- Kategori dan Group boleh kosong"],
        ["- File harus dalam format .xlsx atau .xls"],
        [""],
        ["🔧 LANGKAH-LANGKAH:"],
        ["1. Isi data kontak di baris ke-2 dan seterusnya"],
        ["2. Pastikan format nomor telepon benar"],
        ["3. Simpan file dalam format Excel (.xlsx)"],
        ["4. Upload file ke menu Import Kontak"],
        ["5. Periksa hasil import dan perbaiki jika ada error"],
        [""],
        ["💡 TIPS:"],
        ["- Test dengan data sedikit dulu sebelum import massal"],
        ["- Pastikan tidak ada nomor telepon yang duplikat"],
        ["- Group akan otomatis dibuat jika belum ada"],
        ["- Backup data kontak lama sebelum import"],
      ];

      const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
      wsInstructions["!cols"] = [{ wch: 80 }];

      XLSX.utils.book_append_sheet(wb, wsInstructions, "Petunjuk");

      // Download file
      const fileName = `Template_Kontak_WhatsApp_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      showStatus("✅ Template Excel berhasil diunduh", "success");
      addDebugInfo(`📊 Excel template downloaded: ${fileName}`);
    } catch (error) {
      console.error("Download template error:", error);
      const errorMessage = extractErrorMessage(error);
      showStatus(`❌ ${errorMessage}`, "error");
      addDebugInfo(`❌ Download template error: ${errorMessage}`);
    }
  };

  // Group Management Functions (simplified error handling)
  const showGroupDetails = (groupName) => {
    setCurrentGroupDetails(groupName);
    setGroupDetailsModalOpen(true);
  };

  const openGroupManagementModal = (editGroupName = null) => {
    setSelectedContactsForGroup(new Set());
    setCurrentEditingGroupId(null);

    if (editGroupName) {
      setGroupForm({ name: editGroupName, description: "" });
      setCurrentEditingGroupId(editGroupName);

      // Pre-select contacts that are in this group
      const groupContacts = getGroupContacts(editGroupName);
      setSelectedContactsForGroup(new Set(groupContacts.map((c) => c.id)));
    } else {
      setGroupForm({ name: "", description: "" });
    }

    setGroupModalOpen(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();

    if (!groupForm.name) {
      showStatus("❌ Nama group harus diisi", "error");
      return;
    }

    // Check for duplicate group names (exclude current editing group)
    const existingGroup = getUniqueGroups().find(
      (g) =>
        g.toLowerCase() === groupForm.name.toLowerCase() &&
        g !== currentEditingGroupId
    );

    if (existingGroup) {
      showStatus(`❌ Group dengan nama "${groupForm.name}" sudah ada`, "error");
      return;
    }

    try {
      setLoading(true);

      const groupData = {
        name: groupForm.name,
        description: groupForm.description,
        contact_ids: Array.from(selectedContactsForGroup),
      };

      const response = await contactAPI.saveGroup(groupData);
      if (response.data && (response.data.success || response.status === 200)) {
        if (currentEditingGroupId) {
          showStatus(
            `✅ Group "${groupForm.name}" berhasil diperbarui`,
            "success"
          );
          addDebugInfo(
            `👥 Group updated: ${currentEditingGroupId} → ${groupForm.name} with ${selectedContactsForGroup.size} contacts`
          );
        } else {
          showStatus(
            `✅ Group "${groupForm.name}" berhasil dibuat dengan ${selectedContactsForGroup.size} kontak`,
            "success"
          );
          addDebugInfo(
            `👥 Group created: ${groupForm.name} with ${selectedContactsForGroup.size} contacts`
          );
        }

        setGroupModalOpen(false);
        setGroupForm({ name: "", description: "" });
        setSelectedContactsForGroup(new Set());
        setCurrentEditingGroupId(null);

        await loadContacts();
        await loadGroups();
      }
    } catch (error) {
      console.error("Save group error:", error);
      const errorMessage = extractErrorMessage(error);
      showStatus(`❌ ${errorMessage}`, "error");
      addDebugInfo(`❌ Save group error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupName) => {
    if (
      window.confirm(
        `Apakah Anda yakin ingin menghapus group "${groupName}"? Kontak tidak akan dihapus, hanya group-nya saja.`
      )
    ) {
      try {
        setLoading(true);
        const response = await contactAPI.deleteGroup(groupName);
        if (
          response.data &&
          (response.data.success || response.status === 200)
        ) {
          setGroupDetailsModalOpen(false);
          showStatus(`✅ Group "${groupName}" berhasil dihapus`, "success");
          addDebugInfo(`👥 Group deleted: ${groupName}`);
          await loadContacts();
          await loadGroups();
        }
      } catch (error) {
        console.error("Delete group error:", error);
        const errorMessage = extractErrorMessage(error);
        showStatus(`❌ ${errorMessage}`, "error");
        addDebugInfo(`❌ Delete group error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const removeContactFromGroup = async (contactId, groupName) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    if (
      window.confirm(
        `Apakah Anda yakin ingin menghapus kontak ${contact.name} dari group "${groupName}"?`
      )
    ) {
      try {
        setLoading(true);
        const response = await contactAPI.removeContactFromGroup(
          contactId,
          groupName
        );
        if (
          response.data &&
          (response.data.success || response.status === 200)
        ) {
          showStatus(
            `✅ Kontak ${contact.name} berhasil dihapus dari group "${groupName}"`,
            "success"
          );
          addDebugInfo(
            `👥 Contact removed from group: ${contact.name} from ${groupName}`
          );
          await loadContacts();
          await loadGroups();
        }
      } catch (error) {
        console.error("Remove contact from group error:", error);
        const errorMessage = extractErrorMessage(error);
        showStatus(`❌ ${errorMessage}`, "error");
        addDebugInfo(`❌ Remove contact from group error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleContactSelection = (contactId) => {
    const newSelection = new Set(selectedContactsForGroup);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContactsForGroup(newSelection);
  };

  // Enhanced contact action functions with navigation
  const selectContactForMessage = (contactId, messageType) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const contactData = {
      phoneNumber: contact.phone,
      contactName: contact.name,
      contactId: contact.id,
      messageType: messageType,
      groupData: null,
    };

    // Navigate to appropriate tab with prefilled data
    switch (messageType) {
      case "text":
        navigateToMessageTab("text", contactData);
        break;
      case "image":
        navigateToMessageTab("image", contactData);
        break;
      case "document":
        navigateToMessageTab("document", contactData);
        break;
      case "blast":
        navigateToMessageTab("blast", contactData);
        break;
      default:
        break;
    }

    showStatus(
      `✅ Navigasi ke ${messageType} dengan kontak ${contact.name} ter-prefill`,
      "success"
    );
  };

  // Group blast function
  const blastToGroup = (groupName) => {
    const groupContacts = getContactsByGroup(groupName);
    if (groupContacts.length === 0) {
      showStatus(`❌ Group "${groupName}" tidak memiliki kontak`, "error");
      return;
    }

    const groupData = {
      phoneNumber: "",
      contactName: `Group: ${groupName}`,
      contactId: "",
      messageType: "blast",
      groupData: {
        name: groupName,
        contacts: groupContacts,
        phoneNumbers: groupContacts.map((c) => c.phone).join("\n"),
      },
    };

    navigateToMessageTab("blast", groupData);
    showStatus(
      `✅ Navigasi ke blast untuk group "${groupName}" dengan ${groupContacts.length} kontak`,
      "success"
    );
  };

  // Filter Functions
  const getFilteredContacts = () => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.category &&
          contact.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.groups &&
          contact.groups.some((group) =>
            group.toLowerCase().includes(searchTerm.toLowerCase())
          ));

      const matchesGroup =
        !selectedGroup ||
        (contact.groups && contact.groups.includes(selectedGroup));

      return matchesSearch && matchesGroup;
    });
  };

  const getFilteredGroups = () => {
    return groups.filter((group) =>
      group.group_name.toLowerCase().includes(searchGroups.toLowerCase())
    );
  };

  const getFilteredContactsForModal = () => {
    return contacts.filter(
      (contact) =>
        contact.name
          .toLowerCase()
          .includes(searchContactsInModal.toLowerCase()) ||
        contact.phone
          .toLowerCase()
          .includes(searchContactsInModal.toLowerCase()) ||
        (contact.category &&
          contact.category
            .toLowerCase()
            .includes(searchContactsInModal.toLowerCase()))
    );
  };

  // FIXED: Simplified render functions
  const renderContactExcelPreview = () => {
    if (!contactExcelData) return null;

    const { headers, rows } = contactExcelData;
    const mapping = detectedContactMapping;

    // Update mapping info
    const mappingInfo = [];
    if (mapping.name !== -1)
      mappingInfo.push(`Nama: "${headers[mapping.name]}"`);
    if (mapping.phone !== -1)
      mappingInfo.push(`Telepon: "${headers[mapping.phone]}"`);
    if (mapping.category !== -1)
      mappingInfo.push(`Kategori: "${headers[mapping.category]}"`);
    if (mapping.group !== -1)
      mappingInfo.push(`Group: "${headers[mapping.group]}"`);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-green-800 dark:text-green-200">
            Preview Data Excel
          </h4>
          <div className="flex gap-3">
            <button
              onClick={importContactsFromExcel}
              className="btn-success"
              disabled={
                isImporting || mapping.name === -1 || mapping.phone === -1
              }
            >
              {isImporting ? "⏳ Importing..." : "✅ Import Semua Kontak"}
            </button>
            <button
              onClick={clearContactExcelPreview}
              className="btn-danger"
              disabled={isImporting}
            >
              ❌ Batal
            </button>
          </div>
        </div>

        <div
          className="feature-card p-4"
          style={{
            background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
            borderColor: "#3b82f6",
          }}
        >
          <p className="text-sm text-blue-800 dark:text-blue-200">
            🎯 <strong>Auto-Detected Mapping:</strong>{" "}
            {mappingInfo.length > 0
              ? mappingInfo.join(", ")
              : "Tidak ada kolom yang terdeteksi otomatis"}
          </p>
          {(mapping.name === -1 || mapping.phone === -1) && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              ⚠️ <strong>Peringatan:</strong> Kolom Nama dan Telepon harus
              terdeteksi untuk import. Pastikan header menggunakan kata
              "Nama"/"Name" dan "Telepon"/"Phone".
            </p>
          )}
        </div>

        {/* Import Progress */}
        {isImporting && (
          <div
            className="feature-card p-4"
            style={{
              background: "linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)",
              borderColor: "#0288d1",
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Progress Import
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-300">
                {importProgress.total > 0
                  ? Math.round(
                      (importProgress.current / importProgress.total) * 100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{
                  width: `${
                    importProgress.total > 0
                      ? (importProgress.current / importProgress.total) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Mengimport {importProgress.current} dari {importProgress.total}{" "}
              kontak...
            </p>
          </div>
        )}

        <div className="excel-preview-table">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                {headers.map((header, index) => {
                  let headerClass =
                    "p-3 text-left border border-gray-300 font-semibold";
                  if (index === mapping.name)
                    headerClass +=
                      " bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200";
                  else if (index === mapping.phone)
                    headerClass +=
                      " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200";
                  else if (index === mapping.category)
                    headerClass +=
                      " bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200";
                  else if (index === mapping.group)
                    headerClass +=
                      " bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200";
                  else headerClass += " bg-gray-100 dark:bg-gray-700";

                  return (
                    <th key={index} className={headerClass}>
                      {header}
                      {index === mapping.name && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                      {index === mapping.phone && (
                        <span className="ml-1 text-blue-600">✓</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {headers.map((header, colIndex) => {
                    let cellClass = "p-3 border border-gray-300 text-sm";
                    if (colIndex === mapping.name)
                      cellClass += " bg-green-50 dark:bg-green-900/20";
                    else if (colIndex === mapping.phone)
                      cellClass += " bg-blue-50 dark:bg-blue-900/20";
                    else if (colIndex === mapping.category)
                      cellClass += " bg-yellow-50 dark:bg-yellow-900/20";
                    else if (colIndex === mapping.group)
                      cellClass += " bg-purple-50 dark:bg-purple-900/20";

                    return (
                      <td key={colIndex} className={cellClass}>
                        {row[colIndex] || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length > 10 && (
                <tr>
                  <td
                    colSpan={headers.length}
                    className="text-center text-gray-500 font-medium p-4 border border-gray-300 bg-gray-50 dark:bg-gray-700"
                  >
                    ... dan {rows.length - 10} baris lainnya
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          📊 {rows.length} baris data ditemukan, siap untuk diimport
        </div>
      </div>
    );
  };

  // FIXED: Import Statistics Display
  const renderImportStats = () => {
    if (!importStats) return null;

    return (
      <div className="main-card p-6 mb-6 fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            📊 Hasil Import Excel
          </h3>
          <button
            onClick={() => setImportStats(null)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ✕ Tutup
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="feature-card service-tier-2 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {importStats.total}
            </div>
            <div className="text-sm text-blue-600">Total Baris</div>
          </div>
          <div className="feature-card service-tier-1 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {importStats.imported}
            </div>
            <div className="text-sm text-green-600">Berhasil Import</div>
          </div>
          <div className="feature-card service-tier-4 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {importStats.failed}
            </div>
            <div className="text-sm text-red-600">Gagal Import</div>
          </div>
          <div className="feature-card service-tier-3 p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {importStats.valid > 0
                ? ((importStats.imported / importStats.valid) * 100).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-sm text-purple-600">Success Rate</div>
          </div>
        </div>

        {importStats.errors > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Data Tidak Valid: {importStats.errors} baris
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Cek debug log untuk detail error pada setiap baris yang tidak
              valid.
            </p>
          </div>
        )}

        {importStats.importErrors && importStats.importErrors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Import Errors:
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 max-h-32 overflow-y-auto">
              {importStats.importErrors.slice(0, 5).map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
              {importStats.importErrors.length > 5 && (
                <li className="text-red-500">
                  ... and {importStats.importErrors.length - 5} more errors
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const filteredContacts = getFilteredContacts();
  const filteredGroups = getFilteredGroups();
  const filteredContactsForModal = getFilteredContactsForModal();
  const selectedContactsData = contacts.filter((c) =>
    selectedContactsForGroup.has(c.id)
  );

  return (
    <>


      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="loading-spinner"></div>
              <span className="text-gray-700 dark:text-gray-300">
                Loading...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Import Statistics */}
      {renderImportStats()}

      {/* Excel Import for Contacts */}
      <div className="feature-card excel-import-zone p-8 mb-8">
        <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-6">
          📊 Import Kontak dari Excel
        </h3>

        <div className="flex gap-4 mb-6">
          <div
            className="excel-import-zone p-8 rounded-xl text-center cursor-pointer flex-1"
            onClick={() =>
              !isImporting && contactExcelInputRef.current?.click()
            }
          >
            <input
              type="file"
              ref={contactExcelInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleContactExcelFile(e.target.files[0])}
              className="hidden"
              disabled={isImporting}
            />
            <div>
              <svg
                className="mx-auto h-16 w-16 text-green-500 mb-4"
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
              <p className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                {isImporting
                  ? "⏳ Memproses..."
                  : "📊 Drop Excel file kontak di sini atau klik untuk pilih"}
              </p>
              <p className="text-sm text-green-600 dark:text-green-300">
                Format: .xlsx, .xls, .csv - Otomatis deteksi kolom Nama,
                Telepon, Kategori, Group
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <button
              onClick={downloadExcelTemplate}
              className="btn-primary mb-4 px-6 py-3"
              disabled={loading || isImporting}
            >
              📥 Download Template Excel
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Download template untuk memudahkan format data
            </p>
          </div>
        </div>

        {/* Excel Preview */}
        {contactExcelData && (
          <div className="border-2 border-green-200 dark:border-green-700 rounded-xl p-6">
            {renderContactExcelPreview()}
          </div>
        )}
      </div>

      {/* Add Contact Form */}
      <div
        className="feature-card p-8 mb-8"
        style={{
          background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
          borderColor: "#3b82f6",
        }}
      >
        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-6">
          ➕ Tambah Kontak Baru
        </h3>

        <form onSubmit={handleContactSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Nama Kontak *
              </label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="David Smith"
                className="form-input w-full"
                required
                disabled={loading || isImporting}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Nomor Telepon *
              </label>
              <input
                type="text"
                value={contactForm.phone}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="628123456789"
                className="form-input w-full"
                required
                disabled={loading || isImporting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Kategori (opsional)
              </label>
              <input
                type="text"
                value={contactForm.category}
                onChange={(e) =>
                  setContactForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                placeholder="Customer, Supplier, Partner, dll."
                className="form-input w-full"
                disabled={loading || isImporting}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Group (opsional)
              </label>
              <div className="flex gap-2">
                <select
                  value={contactForm.group}
                  onChange={(e) =>
                    setContactForm((prev) => ({
                      ...prev,
                      group: e.target.value,
                    }))
                  }
                  className="form-input flex-1"
                  disabled={loading || isImporting}
                >
                  <option value="">Pilih Group Existing</option>
                  {getUniqueGroups().map((group) => (
                    <option key={group} value={group}>
                      👥 {group}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={contactForm.group}
                  onChange={(e) =>
                    setContactForm((prev) => ({
                      ...prev,
                      group: e.target.value,
                    }))
                  }
                  placeholder="Atau buat group baru"
                  className="form-input flex-1"
                  disabled={loading || isImporting}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Group memudahkan blast ke kelompok kontak tertentu. Kontak akan
                otomatis masuk ke group yang dipilih/dibuat.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-success"
              disabled={loading || isImporting}
            >
              {loading || isImporting
                ? "⏳ Menyimpan..."
                : currentEditingContactId
                ? "✏️ Update Kontak"
                : "💾 Simpan Kontak"}
            </button>
            {currentEditingContactId && (
              <button
                type="button"
                onClick={clearContactForm}
                className="btn-danger"
                disabled={loading || isImporting}
              >
                ❌ Batal Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Group Management Section */}
      <div
        className="feature-card p-8 mb-8"
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)",
          borderColor: "#f59e0b",
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200">
            👥 Manajemen Group Kontak
          </h3>
          <button
            onClick={() => openGroupManagementModal()}
            className="btn-primary text-sm px-4 py-2"
            disabled={loading || isImporting}
          >
            ➕ Buat Group Baru
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
              {groupStats.totalGroups}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Total Groups
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
              {groupStats.contactsInGroups}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Kontak dalam Groups
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
              {groupStats.ungroupedContacts}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Tanpa Group
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={() => setGroupsVisible(!groupsVisible)}
              className="btn-primary w-full text-sm"
              disabled={loading || isImporting}
            >
              {groupsVisible
                ? "🙈 Sembunyikan Groups"
                : "👁️ Lihat Semua Groups"}
            </button>
          </div>
        </div>

        {groupsVisible && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-amber-800 dark:text-amber-200">
                Daftar Groups:
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchGroups}
                  onChange={(e) => setSearchGroups(e.target.value)}
                  placeholder="Cari group..."
                  className="form-input px-3 py-1 text-sm"
                  disabled={loading || isImporting}
                />
                <button
                  className="btn-success text-sm px-3 py-1"
                  onClick={loadGroups}
                  disabled={loading || isImporting}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {filteredGroups.length === 0 ? (
                <p className="text-amber-600 dark:text-amber-400">
                  Belum ada group yang dibuat atau tidak ada yang cocok dengan
                  pencarian
                </p>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.group_name} className="group-card p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-1">
                        <h5 className="font-bold text-amber-800 dark:text-amber-200 text-lg">
                          👥 {group.group_name}
                        </h5>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {group.contact_count} kontak
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {group.contacts.slice(0, 3).map((contact) => (
                            <span
                              key={contact.id}
                              className="text-xs bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded"
                            >
                              {contact.name}
                            </span>
                          ))}
                          {group.contacts.length > 3 && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              +{group.contacts.length - 3} lainnya
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => showGroupDetails(group.group_name)}
                          className="btn-primary text-sm px-3 py-1"
                          disabled={loading || isImporting}
                        >
                          👁️ Detail
                        </button>
                        <button
                          onClick={() => blastToGroup(group.group_name)}
                          className="btn-success text-sm px-3 py-1"
                          disabled={loading || isImporting}
                        >
                          🚀 Blast
                        </button>
                        <button
                          onClick={() =>
                            openGroupManagementModal(group.group_name)
                          }
                          className="btn-secondary text-sm px-3 py-1"
                          style={{
                            background:
                              "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            color: "white",
                            borderRadius: "8px",
                            fontWeight: "600",
                          }}
                          disabled={loading || isImporting}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteGroup(group.group_name)}
                          className="btn-danger text-sm px-3 py-1"
                          disabled={loading || isImporting}
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contacts List */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            📋 Daftar Kontak ({contacts.length})
          </h3>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kontak..."
              className="form-input px-4 py-2 text-sm"
              disabled={loading || isImporting}
            />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="form-input px-4 py-2 text-sm"
              disabled={loading || isImporting}
            >
              <option value="">Semua Groups</option>
              {getUniqueGroups().map((group) => (
                <option key={group} value={group}>
                  👥 {group}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadContacts()}
              className="btn-success text-sm px-4 py-2"
              disabled={loading || isImporting}
            >
              🔄 Refresh
            </button>
            <button
              onClick={clearAllContacts}
              className="btn-danger text-sm px-4 py-2"
              disabled={loading || isImporting}
            >
              🗑️ Hapus Semua
            </button>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-lg font-medium mb-2">
              {contacts.length === 0
                ? "Belum ada kontak yang ditambahkan"
                : "Tidak ada kontak yang cocok dengan filter"}
            </p>
            <p className="text-sm">
              {contacts.length === 0
                ? "Gunakan form di atas untuk menambah kontak pertama Anda."
                : "Coba ubah kata kunci pencarian atau filter group."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <div key={contact.id} className="contact-card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xl mb-2">
                      {contact.name}
                    </h4>
                    <p className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
                      {contact.phone}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {contact.category && (
                        <span className="category-badge">
                          {contact.category}
                        </span>
                      )}
                      {contact.groups &&
                        contact.groups.map((group) => (
                          <span key={group} className="group-badge">
                            👥 {group}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editContact(contact.id)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                      title="Edit"
                      disabled={loading || isImporting}
                    >
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        ></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteContact(contact.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Hapus"
                      disabled={loading || isImporting}
                    >
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => selectContactForMessage(contact.id, "text")}
                    className="flex-1 text-sm btn-success py-2 px-3"
                    disabled={loading || isImporting}
                  >
                    📝 Kirim Teks
                  </button>
                  <button
                    onClick={() => selectContactForMessage(contact.id, "image")}
                    className="flex-1 text-sm btn-primary py-2 px-3"
                    disabled={loading || isImporting}
                  >
                    🖼️ Kirim Gambar
                  </button>
                  <button
                    onClick={() => selectContactForMessage(contact.id, "blast")}
                    className="flex-1 text-sm py-2 px-3"
                    style={{
                      background:
                        "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                      color: "white",
                      borderRadius: "8px",
                      fontWeight: "600",
                    }}
                    disabled={loading || isImporting}
                  >
                    🚀 Blast
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group Management Modal */}
      {groupModalOpen && (
        <div className="settings-modal">
          <div className="settings-content" style={{ maxWidth: "800px" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                👥 Manajemen Group Kontak
              </h2>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                disabled={loading || isImporting}
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            {/* Group Form */}
            <div
              className="feature-card p-6 mb-6"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                borderColor: "#f59e0b",
              }}
            >
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-4">
                {currentEditingGroupId ? "✏️ Edit Group" : "➕ Buat Group Baru"}
              </h3>

              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Nama Group *
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) =>
                      setGroupForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="VIP Customer, Jakarta Team, dll."
                    className="form-input w-full"
                    required
                    disabled={loading || isImporting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Deskripsi (opsional)
                  </label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) =>
                      setGroupForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows="2"
                    placeholder="Deskripsi singkat tentang group ini..."
                    className="form-input w-full resize-vertical"
                    disabled={loading || isImporting}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="btn-success"
                    disabled={loading || isImporting}
                  >
                    {loading || isImporting
                      ? "⏳ Menyimpan..."
                      : currentEditingGroupId
                      ? "✏️ Update Group"
                      : "💾 Simpan Group"}
                  </button>
                  {currentEditingGroupId && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupForm({ name: "", description: "" });
                        setCurrentEditingGroupId(null);
                        setSelectedContactsForGroup(new Set());
                      }}
                      className="btn-danger"
                      disabled={loading || isImporting}
                    >
                      ❌ Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Contact Selector */}
            <div className="feature-card p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                📱 Pilih Kontak untuk Group
              </h3>

              <div className="mb-4">
                <input
                  type="text"
                  value={searchContactsInModal}
                  onChange={(e) => setSearchContactsInModal(e.target.value)}
                  placeholder="Cari kontak untuk ditambahkan..."
                  className="form-input w-full"
                  disabled={loading || isImporting}
                />
              </div>

              <div className="contact-selector">
                {filteredContactsForModal.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Tidak ada kontak yang ditemukan
                  </p>
                ) : (
                  filteredContactsForModal.map((contact) => {
                    const isSelected = selectedContactsForGroup.has(contact.id);
                    return (
                      <div
                        key={contact.id}
                        className={`contact-selector-item ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() =>
                          !(loading || isImporting) &&
                          toggleContactSelection(contact.id)
                        }
                      >
                        <div className="flex items-center">
                          <div
                            className={`w-4 h-4 border-2 border-gray-300 rounded mr-3 flex items-center justify-center ${
                              isSelected ? "bg-blue-500 border-blue-500" : ""
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {contact.name}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                              {contact.phone}
                            </span>
                            {contact.category && (
                              <span className="category-badge ml-2">
                                {contact.category}
                              </span>
                            )}
                            {contact.groups &&
                              contact.groups.map((group) => (
                                <span key={group} className="group-badge ml-2">
                                  👥 {group}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                {selectedContactsForGroup.size} kontak dipilih
              </div>
            </div>

            {/* Selected Contacts Preview */}
            {selectedContactsForGroup.size > 0 && (
              <div className="feature-card p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  ✅ Kontak Terpilih
                </h3>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedContactsData.map((contact) => (
                    <div key={contact.id} className="group-contact-item">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {contact.name}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {contact.phone}
                          </span>
                          {contact.category && (
                            <span className="category-badge ml-2">
                              {contact.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            !(loading || isImporting) &&
                            toggleContactSelection(contact.id)
                          }
                          className="text-red-600 hover:text-red-800 p-1 rounded transition-all"
                          title="Hapus dari pilihan"
                          disabled={loading || isImporting}
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {groupDetailsModalOpen && currentGroupDetails && (
        <div className="settings-modal">
          <div className="settings-content" style={{ maxWidth: "700px" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                👥 {currentGroupDetails}
              </h2>
              <button
                onClick={() => setGroupDetailsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                disabled={loading || isImporting}
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            {/* Group Info */}
            <div
              className="feature-card p-6 mb-6"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                borderColor: "#f59e0b",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200">
                    👥 {currentGroupDetails}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {getGroupContacts(currentGroupDetails).length} kontak dalam
                    group
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                    {getGroupContacts(currentGroupDetails).length}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Total Kontak
                  </p>
                </div>
              </div>
            </div>

            {/* Group Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={() => openGroupManagementModal(currentGroupDetails)}
                className="btn-primary w-full"
                disabled={loading || isImporting}
              >
                ✏️ Edit Group
              </button>
              <button
                onClick={() => blastToGroup(currentGroupDetails)}
                className="btn-success w-full"
                disabled={loading || isImporting}
              >
                🚀 Blast ke Group
              </button>
              <button
                onClick={() => deleteGroup(currentGroupDetails)}
                className="btn-danger w-full"
                disabled={loading || isImporting}
              >
                🗑️ Hapus Group
              </button>
            </div>

            {/* Group Contacts List */}
            <div className="feature-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  📋 Kontak dalam Group (
                  {getGroupContacts(currentGroupDetails).length})
                </h3>
                <button
                  onClick={() => blastToGroup(currentGroupDetails)}
                  className="btn-primary text-sm px-4 py-2"
                  disabled={loading || isImporting}
                >
                  🚀 Blast ke Group
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {getGroupContacts(currentGroupDetails).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-sm">Belum ada kontak dalam group ini</p>
                  </div>
                ) : (
                  getGroupContacts(currentGroupDetails).map((contact) => (
                    <div key={contact.id} className="group-contact-item">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {contact.name}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {contact.phone}
                          </span>
                          {contact.category && (
                            <span className="category-badge ml-2">
                              {contact.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            removeContactFromGroup(
                              contact.id,
                              currentGroupDetails
                            )
                          }
                          className="text-red-600 hover:text-red-800 p-1 rounded transition-all"
                          title="Hapus dari group"
                          disabled={loading || isImporting}
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .loading-spinner {
          border: 3px solid #f3f3f3;
          border-radius: 50%;
          border-top: 3px solid #3498db;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
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
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .excel-preview-table {
          overflow-x: auto;
          border-radius: 8px;
        }

        .service-tier-1 {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f7fa 100%);
          border-color: #10b981;
        }

        .service-tier-2 {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #3b82f6;
        }

        .service-tier-3 {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          border-color: #8b5cf6;
        }

        .service-tier-4 {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-color: #ef4444;
        }
      `}</style>
    </>
  );
};

export default ContactManagement;
