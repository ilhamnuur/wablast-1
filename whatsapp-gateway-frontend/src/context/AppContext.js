import React, { createContext, useContext, useState, useEffect } from "react";
import { contactAPI } from "../services/api";

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState("session");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionName, setSessionName] = useState("mysession");
  const [availableSessions, setAvailableSessions] = useState([]);
  const [uploadService, setUploadService] = useState("auto");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  
  const refreshSessions = async () => {
    setSessionsLoading(true);
    try {
      const { sessionAPI } = await import("../services/api");
      const response = await sessionAPI.getSessions();
      const data = response.data.data || response.data;
      let sessionList = [];
      if (Array.isArray(data)) {
        sessionList = data;
      } else if (typeof data === "object" && data !== null) {
        sessionList = Object.keys(data);
      }
      setAvailableSessions(sessionList);
      
      // If current sessionName is not in list and we have sessions, pick first
      if (sessionList.length > 0 && (!sessionName || !sessionList.includes(sessionName))) {
        setSessionName(sessionList[0]);
      }
    } catch (error) {
      console.error("Refresh sessions error:", error);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Blast state with retry support
  const [blastInProgress, setBlastInProgress] = useState(false);
  const [customBlastInProgress, setCustomBlastInProgress] = useState(false);
  const [blastResults, setBlastResults] = useState({
    total: 0,
    success: 0,
    failed: 0,
    logs: [],
    failedNumbers: [],
  });

  // Retry blast support
  const [lastBlastConfig, setLastBlastConfig] = useState(null);
  const [isRetryBlast, setIsRetryBlast] = useState(false);

  // Contact and Group Storage - FIXED: Load from database
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);

  // Pre-filled data from contact actions
  const [prefilledContactData, setPrefilledContactData] = useState({
    phoneNumber: "",
    contactName: "",
    contactId: "",
    messageType: "",
    groupData: null,
  });

  // Custom Blast Excel Variables
  const [customBlastExcelData, setCustomBlastExcelData] = useState(null);
  const [customBlastVariables, setCustomBlastVariables] = useState([]);
  const [customBlastPhoneMapping, setCustomBlastPhoneMapping] = useState({});
  const [customBlastDataMapping, setCustomBlastDataMapping] = useState({});

  // Contact Excel Import Variables
  const [contactExcelData, setContactExcelData] = useState(null);
  const [detectedContactMapping, setDetectedContactMapping] = useState({});

  // Debug logs
  const [debugLogs, setDebugLogs] = useState([
    "Debug log akan muncul di sini...\n",
  ]);

  // Load initial data
  useEffect(() => {
    loadContactsAndGroups();
    refreshSessions();
    
    // Auto refresh sessions every 30 seconds
    const interval = setInterval(refreshSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadContactsAndGroups = async () => {
    try {
      // Load contacts
      const contactsResponse = await contactAPI.getContacts();
      if (contactsResponse.data.success) {
        setContacts(contactsResponse.data.data);
        addDebugInfo(
          `📱 App Context: Loaded ${contactsResponse.data.data.length} contacts`
        );
      }

      // Load groups
      const groupsResponse = await contactAPI.getGroups();
      if (groupsResponse.data.success) {
        setGroups(groupsResponse.data.data.groups);
        addDebugInfo(
          `👥 App Context: Loaded ${groupsResponse.data.data.groups.length} groups`
        );
      }
    } catch (error) {
      console.error("App Context: Error loading data:", error);
      addDebugInfo(`❌ App Context: Error loading data: ${error.message}`);
    }
  };

  const addDebugInfo = (info) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `[${timestamp}] ${info}\n`;
    setDebugLogs((prev) => [...prev, newLog]);
  };

  const clearDebugLogs = () => {
    setDebugLogs(["Debug log sudah dibersihkan...\n"]);
  };

  const toggleSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobileOverlay");

    if (window.innerWidth <= 1024) {
      // Mobile logic
      if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains("sidebar-open");
        if (isOpen) {
          // Close sidebar
          sidebar.classList.remove("sidebar-open");
          overlay.classList.remove("show");
        } else {
          // Open sidebar
          sidebar.classList.add("sidebar-open");
          overlay.classList.add("show");
        }
      }
    } else {
      // Desktop logic
      setSidebarOpen(!sidebarOpen);
    }
  };

  const closeSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobileOverlay");

    if (window.innerWidth <= 1024) {
      if (sidebar && overlay) {
        sidebar.classList.remove("sidebar-open");
        overlay.classList.remove("show");
      }
    }
  };

  // Navigation with prefilled data
  const navigateToMessageTab = (tabName, contactData) => {
    setPrefilledContactData(contactData);
    setActiveTab(tabName);
  };

  // Clear prefilled data
  const clearPrefilledData = () => {
    setPrefilledContactData({
      phoneNumber: "",
      contactName: "",
      contactId: "",
      messageType: "",
      groupData: null,
    });
  };

  // FIXED: Get unique groups from database groups
  const getUniqueGroups = () => {
    return groups.map((g) => g.group_name).sort();
  };

  // FIXED: Get contacts by group from database groups
  const getContactsByGroup = (groupName) => {
    const group = groups.find((g) => g.group_name === groupName);
    return group ? group.contacts : [];
  };

  // Enhanced addMessageLog with failed number tracking
  const addMessageLog = (phoneNumber, status, message, details = "") => {
    const timestamp = new Date().toLocaleString();
    const logEntry = {
      timestamp,
      phoneNumber,
      status,
      message: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
      details,
    };

    setBlastResults((prev) => {
      const newResults = { ...prev };
      newResults.logs = [...prev.logs, logEntry];

      if (status === "success") {
        newResults.success = prev.success + 1;
        // Remove from failed numbers if it was there
        newResults.failedNumbers = prev.failedNumbers.filter(
          (num) => num !== phoneNumber
        );
      } else if (status === "error") {
        newResults.failed = prev.failed + 1;
        // Add to failed numbers if not already there
        if (!prev.failedNumbers.includes(phoneNumber)) {
          newResults.failedNumbers = [...prev.failedNumbers, phoneNumber];
        }
      }

      return newResults;
    });
  };

  // Clear logs function with retry support
  const clearLogs = () => {
    setBlastResults({
      total: 0,
      success: 0,
      failed: 0,
      logs: [],
      failedNumbers: [],
    });
    setLastBlastConfig(null);
  };

  // Process template for blast with contact data
  const processTemplateForBlast = (content, phoneNumber) => {
    let processedContent = content;

    // Try contact data from contact management
    const contact = contacts.find((c) => c.phone === phoneNumber);
    if (contact) {
      // Basic contact variables
      processedContent = processedContent.replace(
        /\{nama\}/g,
        contact.name || "Customer"
      );
      processedContent = processedContent.replace(
        /\{telepon\}/g,
        contact.phone || phoneNumber
      );

      // Category-based variables
      if (contact.category) {
        processedContent = processedContent.replace(
          /\{kategori\}/g,
          contact.category
        );
      } else {
        processedContent = processedContent.replace(
          /\{kategori\}/g,
          "Valued Customer"
        );
      }

      // Group-based variables
      if (contact.groups && contact.groups.length > 0) {
        processedContent = processedContent.replace(
          /\{group\}/g,
          contact.groups[0]
        );
        processedContent = processedContent.replace(
          /\{grup\}/g,
          contact.groups[0]
        );
      } else {
        processedContent = processedContent.replace(/\{group\}/g, "General");
        processedContent = processedContent.replace(/\{grup\}/g, "General");
      }

      // Common variables
      processedContent = processedContent.replace(
        /\{tanggal\}/g,
        new Date().toLocaleDateString("id-ID")
      );
      processedContent = processedContent.replace(
        /\{waktu\}/g,
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      processedContent = processedContent.replace(
        /\{hari\}/g,
        new Date().toLocaleDateString("id-ID", { weekday: "long" })
      );

      return processedContent;
    }

    // Use defaults
    processedContent = processedContent.replace(
      /\{tanggal\}/g,
      new Date().toLocaleDateString("id-ID")
    );
    processedContent = processedContent.replace(
      /\{waktu\}/g,
      new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    processedContent = processedContent.replace(
      /\{hari\}/g,
      new Date().toLocaleDateString("id-ID", { weekday: "long" })
    );
    processedContent = processedContent.replace(/\{nama\}/g, "Customer");
    processedContent = processedContent.replace(
      /\{kategori\}/g,
      "Valued Customer"
    );
    processedContent = processedContent.replace(/\{group\}/g, "General");
    processedContent = processedContent.replace(/\{grup\}/g, "General");

    return processedContent;
  };

  // Process custom blast template with Excel variables
  const processCustomBlastTemplate = (content, phoneNumber) => {
    let processedContent = content;

    // Priority 1: Try Excel data first
    if (customBlastDataMapping[phoneNumber]) {
      const excelData = customBlastDataMapping[phoneNumber];

      // Replace all variables with Excel data
      customBlastVariables.forEach((variable) => {
        const regex = new RegExp(`\\{${variable}\\}`, "g");
        const value = excelData[variable] || "";
        processedContent = processedContent.replace(regex, value);
      });

      // Common variables
      processedContent = processedContent.replace(
        /\{tanggal\}/g,
        new Date().toLocaleDateString("id-ID")
      );
      processedContent = processedContent.replace(
        /\{waktu\}/g,
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      processedContent = processedContent.replace(
        /\{hari\}/g,
        new Date().toLocaleDateString("id-ID", { weekday: "long" })
      );

      return processedContent;
    }

    // Priority 2: Fallback to regular template processing
    return processTemplateForBlast(content, phoneNumber);
  };

  const value = {
    // UI State
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    closeSidebar,

    // Session State
    sessionName,
    setSessionName,
    availableSessions,
    sessionsLoading,
    refreshSessions,
    uploadService,
    setUploadService,

    // Blast State with retry support
    blastInProgress,
    setBlastInProgress,
    customBlastInProgress,
    setCustomBlastInProgress,
    blastResults,
    setBlastResults,
    addMessageLog,
    clearLogs,

    // Retry blast support
    lastBlastConfig,
    setLastBlastConfig,
    isRetryBlast,
    setIsRetryBlast,
    processTemplateForBlast,
    processCustomBlastTemplate,

    // Contact State - FIXED: Now loaded from database
    contacts,
    setContacts,
    groups,
    setGroups,
    loadContactsAndGroups, // NEW: Function to reload data

    // Navigation and prefilled data
    prefilledContactData,
    setPrefilledContactData,
    navigateToMessageTab,
    clearPrefilledData,
    getUniqueGroups,
    getContactsByGroup,

    // Excel State
    customBlastExcelData,
    setCustomBlastExcelData,
    customBlastVariables,
    setCustomBlastVariables,
    customBlastPhoneMapping,
    setCustomBlastPhoneMapping,
    customBlastDataMapping,
    setCustomBlastDataMapping,
    contactExcelData,
    setContactExcelData,
    detectedContactMapping,
    setDetectedContactMapping,

    // Debug State
    debugLogs,
    addDebugInfo,
    clearDebugLogs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
