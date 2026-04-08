import { createTimeoutRequest } from "./api";

export const uploadServices = {
  "local-gateway": {
    url: (process.env.REACT_APP_API_URL || "http://10.10.10.195:5001") + "/upload",
    headers: {
      'key': process.env.REACT_APP_API_KEY || "your-secret-key"
    },
    formField: "file",
    responseField: "url",
    description: "🎯 Local Gateway (FAST & RELIABLE)",
    maxSizeMB: 500,
    priority: 0,
    whatsappCompatible: true,
    documentPriority: 0,
    directAccess: true,
    tier: 1,
    reliability: "highest",
    proven: true,
    corsProof: true,
    method: "direct",
  },
  tmpfiles: {
    url: "https://tmpfiles.org/api/v1/upload",
    headers: {},
    formField: "file",
    responseField: "data.url",
    description: "🥇 TmpFiles (PERMANENT + CORS-FREE)",
    maxSizeMB: 100,
    priority: 1,
    whatsappCompatible: true,
    documentPriority: 1,
    directAccess: true,
    tier: 1,
    reliability: "highest",
    proven: true,
    corsProof: true,
    method: "direct",
    postProcess: (url) => url.replace("tmpfiles.org/", "tmpfiles.org/dl/"),
  },
  "file-io": {
    url: "https://file.io/",
    headers: {},
    formField: "file",
    responseField: "link",
    description: "🥇 File.io (14d + CORS-FREE)",
    maxSizeMB: 100,
    priority: 2,
    whatsappCompatible: true,
    documentPriority: 2,
    directAccess: true,
    tier: 1,
    reliability: "highest",
    proven: true,
    corsProof: true,
    method: "direct",
  },
  uguu: {
    url: "https://uguu.se/upload.php",
    headers: {},
    formField: "files[]",
    responseField: "files.0.url",
    description: "🥈 Uguu.se (24h)",
    maxSizeMB: 128,
    priority: 3,
    whatsappCompatible: true,
    documentPriority: 3,
    directAccess: true,
    tier: 2,
    reliability: "high",
    proven: true,
    corsProof: true,
    method: "direct",
  },
  "0x0": {
    url: "https://0x0.st",
    headers: {},
    formField: "file",
    responseField: "direct",
    description: "🥈 0x0.st (365d)",
    maxSizeMB: 512,
    priority: 4,
    whatsappCompatible: true,
    documentPriority: 4,
    directAccess: true,
    tier: 2,
    reliability: "high",
    proven: true,
    corsProof: true,
    method: "direct",
  },
};

export const uploadWithWorkingServices = async (
  file,
  preferredService = "auto",
  addDebugInfo
) => {
  const isImage = file.type.startsWith("image/");
  addDebugInfo(
    `🎯 BREAKTHROUGH: Starting ${isImage ? "image" : "DOCUMENT"} upload: ${
      file.name
    } (${formatFileSize(file.size)})`
  );

  // Get ordered list of working services
  const servicesToTry = getWorkingUploadServices(isImage, preferredService);

  let lastError = null;
  let serviceAttempts = 0;

  for (const serviceName of servicesToTry) {
    serviceAttempts++;

    try {
      addDebugInfo(
        `🔄 BREAKTHROUGH: Attempt ${serviceAttempts}: Trying WORKING service ${serviceName}`
      );

      const uploadConfig = uploadServices[serviceName];
      if (!uploadConfig) {
        throw new Error(`Service ${serviceName} not found`);
      }

      // Check file size
      if (!validateFileSize(file, uploadConfig.maxSizeMB)) {
        addDebugInfo(
          `❌ File too large for ${serviceName} (max: ${uploadConfig.maxSizeMB}MB)`
        );
        continue;
      }

      // Upload with working method
      let fileUrl = null;

      switch (uploadConfig.method) {
        case "direct":
          fileUrl = await uploadDirectWorking(
            file,
            serviceName,
            uploadConfig,
            addDebugInfo
          );
          break;
        case "put":
          fileUrl = await uploadPutWorking(file, uploadConfig, addDebugInfo);
          break;
        default:
          fileUrl = await uploadDirectWorking(
            file,
            serviceName,
            uploadConfig,
            addDebugInfo
          );
      }

      if (!fileUrl) {
        throw new Error("No URL returned from upload service");
      }

      // Post-process URL if needed
      if (uploadConfig.postProcess) {
        fileUrl = uploadConfig.postProcess(fileUrl);
      }

      // Validate URL
      const processedUrl = await validateWorkingUrl(
        fileUrl,
        serviceName,
        !isImage,
        addDebugInfo
      );

      addDebugInfo(
        `✅ BREAKTHROUGH: Upload successful with ${serviceName}: ${processedUrl}`
      );
      return processedUrl;
    } catch (error) {
      lastError = error;
      addDebugInfo(`❌ Upload failed with ${serviceName}: ${error.message}`);
      continue;
    }
  }

  // If all services failed
  const errorMsg = `BREAKTHROUGH: All ${serviceAttempts} working upload services failed for ${
    isImage ? "image" : "document"
  }. Last error: ${lastError?.message || "Unknown error"}`;
  addDebugInfo(`💥 ${errorMsg}`);
  throw new Error(errorMsg);
};

const uploadDirectWorking = async (file, serviceName, config, addDebugInfo) => {
  const formData = new FormData();
  formData.append(config.formField, file);

  addDebugInfo(
    `📤 ${serviceName}: Uploading ${file.name} (${formatFileSize(
      file.size
    )}) to ${config.url}`
  );

  const response = await createTimeoutRequest(
    config.url,
    {
      method: "POST",
      headers: config.headers,
      body: formData,
    },
    45000
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  let result;

  if (contentType && contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const textResult = await response.text();
    result = { url: textResult.trim() };
  }

  addDebugInfo(
    `📥 ${serviceName}: Response received: ${JSON.stringify(result).substring(
      0,
      200
    )}...`
  );

  return extractUrlFromResponse(result, config.responseField);
};

// Added missing uploadPutWorking function
const uploadPutWorking = async (file, config, addDebugInfo) => {
  addDebugInfo(
    `📤 PUT Upload: Uploading ${file.name} (${formatFileSize(file.size)}) to ${
      config.url
    }`
  );

  const response = await createTimeoutRequest(
    config.url,
    {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        ...config.headers,
      },
      body: file,
    },
    45000
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  let result;

  if (contentType && contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const textResult = await response.text();
    result = { url: textResult.trim() };
  }

  addDebugInfo(
    `📥 PUT Upload: Response received: ${JSON.stringify(result).substring(
      0,
      200
    )}...`
  );

  return extractUrlFromResponse(result, config.responseField);
};

const extractUrlFromResponse = (result, responseField) => {
  if (responseField === "direct") {
    return result.url || result;
  }

  const responseFieldPath = responseField.split(".");

  let current = result;
  for (const field of responseFieldPath) {
    if (
      current &&
      typeof current === "object" &&
      current[field] !== undefined
    ) {
      current = current[field];
    } else {
      break;
    }
  }

  if (typeof current === "string") {
    return current;
  }

  // Fallback URL extraction
  const fallbackUrl =
    result.url || result.link || result.data?.url || result.data?.link;
  if (!fallbackUrl || typeof fallbackUrl !== "string") {
    throw new Error("Could not extract URL from upload response");
  }

  return fallbackUrl.trim();
};

const validateWorkingUrl = async (
  url,
  serviceName,
  isDocument = false,
  addDebugInfo
) => {
  try {
    let processedUrl = url.trim();

    // Basic URL validation
    try {
      new URL(processedUrl);
    } catch (error) {
      throw new Error(`Invalid URL format: ${processedUrl}`);
    }

    addDebugInfo(`✅ ${serviceName}: URL validated: ${processedUrl}`);
    return processedUrl;
  } catch (error) {
    throw error;
  }
};

const getWorkingUploadServices = (
  isImage = false,
  preferredService = "auto"
) => {
  let services = Object.entries(uploadServices)
    .filter(([key, config]) => {
      // Filter out inappropriate services
      if (isImage && config.imageOnly === false) return false;
      if (!isImage && config.imageOnly === true) return false;
      return true;
    })
    .sort((a, b) => {
      const [, configA] = a;
      const [, configB] = b;

      // Prioritize CORS-proof services
      if (configA.corsProof && !configB.corsProof) return -1;
      if (!configA.corsProof && configB.corsProof) return 1;

      // Then by tier
      if (configA.tier !== configB.tier) return configA.tier - configB.tier;

      // Then by priority
      const priorityA = !isImage
        ? configA.documentPriority || configA.priority || 99
        : configA.priority || 99;
      const priorityB = !isImage
        ? configB.documentPriority || configB.priority || 99
        : configB.priority || 99;

      return priorityA - priorityB;
    })
    .map(([key]) => key);

  return services;
};

const validateFileSize = (file, maxSizeMB) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
