import React from "react";
import { useApp } from "../context/AppContext";

const RetryBlast = () => {
  const {
    blastResults,
    lastBlastConfig,
    isRetryBlast,
    setIsRetryBlast,
    addMessageLog,
    contacts,
    processTemplateForBlast,
    processCustomBlastTemplate,
  } = useApp();

  const createTimeoutRequest = (url, options = {}, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      ...options,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  };

  const retryFailedBlast = async () => {
    if (!lastBlastConfig || blastResults.failedNumbers.length === 0) {
      alert("❌ Tidak ada blast yang gagal untuk diulangi");
      return;
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin mengirim ulang ${blastResults.failedNumbers.length} pesan yang gagal?`
      )
    ) {
      return;
    }

    setIsRetryBlast(true);

    try {
      const {
        sessionName,
        blastType,
        blastMessage,
        blastDelay,
        fileUrl,
        fileName,
        isCustomBlast,
      } = lastBlastConfig;

      const failedNumbers = [...blastResults.failedNumbers];
      let retrySuccess = 0;
      let retryFailed = 0;
      const baseUrl = process.env.REACT_APP_API_URL || "http://10.10.10.195:5001";

      console.log(
        `🔄 RETRY BLAST: Starting retry for ${failedNumbers.length} failed numbers`
      );

      for (let i = 0; i < failedNumbers.length; i++) {
        const phoneNumber = failedNumbers[i];

        try {
          console.log(
            `🔄 RETRY: Attempting to send to ${phoneNumber} (${i + 1}/${
              failedNumbers.length
            })`
          );

          // Process template for retry
          let personalizedMessage;
          if (isCustomBlast) {
            personalizedMessage = processCustomBlastTemplate(
              blastMessage,
              phoneNumber
            );
          } else {
            personalizedMessage = processTemplateForBlast(
              blastMessage,
              phoneNumber
            );
          }

          let messagePayload = {
            session: sessionName,
            to: phoneNumber,
            text: personalizedMessage || "",
            is_group: false,
          };

          let apiEndpoint = "";
          if (blastType === "text") {
            apiEndpoint = "/message/send-text";
          } else if (blastType === "image") {
            apiEndpoint = "/message/send-image";
            messagePayload.image_url = fileUrl;
          } else if (blastType === "document") {
            apiEndpoint = "/message/send-document";
            messagePayload.document_url = fileUrl;
            messagePayload.document_name = fileName || "document";
          }

          const response = await createTimeoutRequest(
            `${baseUrl}${apiEndpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(messagePayload),
            },
            30000
          );

          const responseData = await response.text();

          if (response.ok) {
            retrySuccess++;
            const contact = contacts.find((c) => c.phone === phoneNumber);
            const contactInfo = contact ? ` (${contact.name})` : "";
            addMessageLog(
              phoneNumber,
              "success",
              personalizedMessage,
              `✅ RETRY berhasil via ${blastType}${contactInfo}`
            );
            console.log(`✅ RETRY: Success to ${phoneNumber}`);
          } else {
            throw new Error(`HTTP ${response.status}: ${responseData}`);
          }
        } catch (error) {
          retryFailed++;
          const contact = contacts.find((c) => c.phone === phoneNumber);
          const contactInfo = contact ? ` (${contact.name})` : "";
          addMessageLog(
            phoneNumber,
            "error",
            blastMessage,
            `❌ RETRY masih gagal: ${error.message}${contactInfo}`
          );
          console.log(`❌ RETRY: Failed to ${phoneNumber}: ${error.message}`);
        }

        // Delay between messages (except for last one)
        if (i < failedNumbers.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, blastDelay * 1000)
          );
        }
      }

      const successRate =
        retrySuccess > 0
          ? ((retrySuccess / failedNumbers.length) * 100).toFixed(1)
          : 0;
      alert(
        `🔄 Retry selesai! Berhasil: ${retrySuccess}/${failedNumbers.length} (${successRate}%). Masih gagal: ${retryFailed}`
      );

      console.log(
        `🔄 RETRY BLAST: Completed. Success: ${retrySuccess}, Still failed: ${retryFailed}`
      );
    } catch (error) {
      console.error("Retry blast error:", error);
      alert(`❌ Retry blast gagal: ${error.message}`);
    } finally {
      setIsRetryBlast(false);
    }
  };

  if (blastResults.failedNumbers.length === 0) {
    return null;
  }

  return (
    <button
      onClick={retryFailedBlast}
      disabled={isRetryBlast}
      className="btn-warning text-sm px-4 py-2"
    >
      {isRetryBlast ? (
        <>
          <div className="loading-spinner"></div>
          Mengirim Ulang...
        </>
      ) : (
        `🔄 Kirim Ulang yang Gagal (${blastResults.failedNumbers.length})`
      )}
    </button>
  );
};

export default RetryBlast;
