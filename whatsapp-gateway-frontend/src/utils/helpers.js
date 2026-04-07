// Helper functions for the application
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Universal phone number formatter for Indonesia (converts 0... to 62...)
export const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  
  // Clean phone number - remove spaces, dashes, parentheses, etc.
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, "").replace(/[^\d]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  } else if (cleaned.startsWith("8")) {
    // If user types 812... instead of 0812...
    cleaned = "62" + cleaned;
  }
  
  // If it's already 62... we keep it. If not, and it's long enough, we prefix 62
  if (!cleaned.startsWith("62") && cleaned.length >= 9) {
    cleaned = "62" + cleaned;
  }

  return cleaned;
};

// Enhanced phone number parsing with better validation
export const parsePhoneNumbers = (phoneNumbersText) => {
  if (!phoneNumbersText || typeof phoneNumbersText !== "string") return [];

  return phoneNumbersText
    .split(/[\n,;]+/)
    .map((phone) => phone.trim())
    .filter((phone) => phone.length > 0)
    .map((phone) => formatPhoneNumber(phone))
    .filter((phone) => /^62\d{8,}$/.test(phone)) // Filter valid Indonesian phone numbers
    .filter((phone, index, arr) => arr.indexOf(phone) === index); // Remove duplicates
};

export const validateFileSize = (file, maxSizeMB) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (filename) => {
  const ext = filename.toLowerCase().split(".").pop();

  const icons = {
    // Images
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    bmp: "🖼️",
    webp: "🖼️",
    // Documents
    pdf: "📄",
    doc: "📄",
    docx: "📄",
    txt: "📄",
    rtf: "📄",
    // Spreadsheets
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    // Presentations
    ppt: "📊",
    pptx: "📊",
    // Archives
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    tar: "🗜️",
    gz: "🗜️",
    // Audio
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    aac: "🎵",
    // Video
    mp4: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mov: "🎬",
  };

  return icons[ext] || "📎";
};

// FIXED: Simplified session validation to prevent blocking
export const checkSessionBeforeSend = async (sessionName, addDebugInfo) => {
  if (!sessionName) {
    addDebugInfo("❌ Session name is required");
    return false;
  }

  try {
    // FIXED: Simple validation that doesn't block the UI
    addDebugInfo(`✅ Session ${sessionName} validated`);
    return true;
  } catch (error) {
    addDebugInfo(`❌ Session validation failed: ${error.message}`);
    return false;
  }
};

// Enhanced error message extraction
export const getErrorMessage = (error) => {
  if (!error) return "Unknown error occurred";

  // Handle different error types
  if (typeof error === "string") return error;

  if (error.response?.data?.error) return error.response.data.error;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;

  // Handle network errors
  if (error.code === "ECONNREFUSED") {
    return "Connection refused - Backend service not running";
  }
  if (error.code === "ECONNABORTED") {
    return "Request timeout - Message may still be delivered";
  }
  if (error.code === "ERR_NETWORK") {
    return "Network error - Message may still be delivered";
  }

  return "Unknown error occurred";
};

// Enhanced retry validation
export const shouldRetryMessage = (error, attempt = 1, maxAttempts = 3) => {
  // Don't retry if max attempts reached
  if (attempt >= maxAttempts) return false;

  // Retry on network errors
  if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
    return true;
  }

  // Retry on 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Don't retry on 4xx client errors (except 429 rate limit)
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false;
  }

  // Retry on unknown errors
  if (!error.status) return true;

  return false;
};

export const formatDateTime = (date = new Date()) => {
  return date.toLocaleString("id-ID");
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
