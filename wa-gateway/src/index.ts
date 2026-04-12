import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import moment from "moment";
import { globalErrorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/notfound.middleware";
import { serve } from "@hono/node-server";
import { env } from "./env";
import { createSessionController } from "./controllers/session";
import * as whastapp from "wa-multi-session";
import { createMessageController } from "./controllers/message";
import { CreateWebhookProps } from "./webhooks";
import { createWebhookMessage } from "./webhooks/message";
import { createWebhookSession } from "./webhooks/session";
import { createProfileController } from "./controllers/profile";
import { createContactController } from "./controllers/contact";
import { createScheduledController } from "./controllers/scheduled";
import { createAutoreplyController } from "./controllers/autoreply";
import { createUploadController } from "./controllers/upload";
import { serveStatic } from "@hono/node-server/serve-static";
import { getPool, query } from "./db/connection";
import { runMigrations } from "./db/migrations";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "WhatsApp Gateway API is running",
    status: "online",
    version: "1.0.0",
    docs: "/health",
  });
});

app.use(
  logger((...params) => {
    params.map((e) => console.log(`${moment().toISOString()} | ${e}`));
  }),
);

// Enhanced CORS configuration
app.use(
  cors({
    origin: (origin) => origin || "*", // Dynamically allow any origin matching the request
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "key"], // MUST allow 'key' header
    credentials: true,
  }),
);

app.onError(globalErrorMiddleware);
app.notFound(notFoundMiddleware);

// Test database connection on startup
async function initializeDatabase() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database initialized successfully at:", new Date().toISOString());
    // Auto-reset 'sending' status to 'pending' on startup (in case of crash during blast)
    try {
      const resetResult = await query("UPDATE scheduled_messages SET status = 'pending' WHERE status = 'sending'");
      if (resetResult.rowCount && resetResult.rowCount > 0) {
        console.log(`♻️ Reset ${resetResult.rowCount} messages from 'sending' back to 'pending'`);
      }
    } catch (resetErr) {
      console.error("❌ Failed to reset sending status:", resetErr);
    }
    await runMigrations();
  } catch (error) {
    console.error(
      "❌ Database initialization failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * serve media message static files
 */
app.use(
  "/media/*",
  serveStatic({
    root: "./",
  }),
);

/**
 * Health check endpoint
 */
app.get("/health", async (c) => {
  try {
    const pool = getPool();
    const dbResult = await pool.query("SELECT NOW()");
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      dbTime: dbResult.rows[0].now,
    });
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

/**
 * session routes
 */
app.route("/session", createSessionController());
/**
 * message routes
 */
app.route("/message", createMessageController());
/**
 * profile routes
 */
app.route("/profile", createProfileController());
/**
 * contact routes
 */
app.route("/contact", createContactController());
/**
 * scheduled routes
 */
app.route("/scheduled", createScheduledController());
/**
 * autoreply routes
 */
app.route("/autoreply", createAutoreplyController());
/**
 * upload routes
 */
app.route("/upload", createUploadController());

const port = env.PORT;

// Initialize database first
initializeDatabase()
  .then(() => {
    serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`🚀 Server is running on http://10.10.10.195:${info.port}`);
        console.log(`📊 Health check: http://10.10.10.195:${info.port}/health`);
        console.log(
          `📱 Contacts API: http://10.10.10.195:${info.port}/contact`,
        );
      },
    );
  })
  .catch((error) => {
    console.error(
      "❌ Failed to start server:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });

whastapp.onConnected((session) => {
  console.log(`session: '${session}' connected`);
});

// Implement Webhook
if (env.WEBHOOK_BASE_URL) {
  const webhookProps: CreateWebhookProps = {
    baseUrl: env.WEBHOOK_BASE_URL,
  };

  // message webhook
  whastapp.onMessageReceived(createWebhookMessage(webhookProps));

  // session webhook
  const webhookSession = createWebhookSession(webhookProps);

  whastapp.onConnected((session) => {
    console.log(`session: '${session}' connected`);
    webhookSession({ session, status: "connected" });
  });
  whastapp.onConnecting((session) => {
    console.log(`session: '${session}' connecting`);
    webhookSession({ session, status: "connecting" });
  });
  whastapp.onDisconnected((session) => {
    console.log(`session: '${session}' disconnected`);
    webhookSession({ session, status: "disconnected" });
  });
}
// End Implement Webhook

// Scheduler Logic
async function processScheduledMessages() {
  try {
    const now = new Date().toISOString();
    const result = await query(
      "SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= $1",
      [now],
    );

    if (result.rows.length === 0) return;

    // Immediately mark all picked messages as 'sending' to prevent race conditions
    // since the next interval (60s) might start before a long blast finishes.
    const messageIds = result.rows.map(m => m.id);
    await query(
      "UPDATE scheduled_messages SET status = 'sending', updated_at = NOW() WHERE id = ANY($1)",
      [messageIds]
    );

    for (const msg of result.rows) {
      // Use Jakarta time (UTC+7) for day of week calculation to match user expectations
      const scheduledDate = new Date(msg.scheduled_at);
      const jakartaTime = new Date(
        scheduledDate.getTime() + 7 * 60 * 60 * 1000,
      );
      const dayOfWeek = jakartaTime.getUTCDay(); // 0 = Sunday, 1 = Monday, ...

      const scheduleType = msg.schedule_type || "once";
      const isValidDay =
        scheduleType === "every_day" ||
        scheduleType === "once" ||
        (scheduleType === "working_days" && dayOfWeek >= 1 && dayOfWeek <= 5) ||
        (scheduleType === "holidays" && (dayOfWeek === 0 || dayOfWeek === 6));

      if (!isValidDay) {
        // If it's a repeating schedule but today is not the day,
        // we move the scheduled_at forward by 24h so we don't keep checking the same instant
        console.log(
          `⏳ Skipping scheduled message ${msg.id} because schedule_type ${scheduleType} does not match day ${dayOfWeek}. Moving forward 24h.`,
        );
        const nextDay = new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000);
        await query(
          "UPDATE scheduled_messages SET scheduled_at = $1, updated_at = NOW() WHERE id = $2",
          [nextDay.toISOString(), msg.id],
        );
        continue;
      }

      console.log(
        `⏰ Processing scheduled message ${msg.id} for recipient ${msg.recipient} (Type: ${scheduleType})`,
      );

      try {
        if (msg.type === "blast") {
          const contacts = await query(
            "SELECT c.phone FROM contacts c JOIN contact_groups cg ON c.id = cg.contact_id WHERE LOWER(cg.group_name) = LOWER($1)",
            [msg.recipient],
          );

          console.log(
            `🚀 Blasting message ${msg.id} to ${contacts.rows.length} contacts matching group "${msg.recipient}"`,
          );

          if (contacts.rows.length === 0) {
             throw new Error(`Group "${msg.recipient}" has no contacts or does not exist.`);
          }

          for (const contact of contacts.rows) {
            try {
              if (msg.media_url) {
                await whastapp.sendImage({
                  sessionId: msg.session,
                  to: contact.phone,
                  text: msg.message,
                  media: msg.media_url,
                });
              } else {
                await whastapp.sendTextMessage({
                  sessionId: msg.session,
                  to: contact.phone,
                  text: msg.message,
                });
              }
              // Anti-ban delay between blast messages
              await new Promise((res) => setTimeout(res, 2000));
            } catch (blastErr) {
              console.error(
                `⚠️ Failed to send blast component to ${contact.phone}:`,
                blastErr,
              );
            }
          }
        } else {
          // Individual - ensure JID suffix
          let toJid = msg.recipient;
          if (!toJid.includes("@")) {
            toJid = toJid.includes("-") ? `${toJid}@g.us` : `${toJid}@s.whatsapp.net`;
          }

          if (msg.media_url) {
            await whastapp.sendImage({
              sessionId: msg.session,
              to: toJid,
              text: msg.message,
              media: msg.media_url,
            });
          } else {
            await whastapp.sendTextMessage({
              sessionId: msg.session,
              to: toJid,
              text: msg.message,
            });
          }
        }

        // Handle completion/repetition
        if (scheduleType === "once") {
          await query(
            "UPDATE scheduled_messages SET status = 'sent', error_message = NULL, updated_at = NOW() WHERE id = $1",
            [msg.id],
          );
          console.log(`✅ Scheduled message ${msg.id} marked as SENT`);
        } else {
          // Reschedule for next day same time
          const nextRun = new Date(
            scheduledDate.getTime() + 24 * 60 * 60 * 1000,
          );
          await query(
            "UPDATE scheduled_messages SET scheduled_at = $1, error_message = NULL, updated_at = NOW() WHERE id = $2",
            [nextRun.toISOString(), msg.id],
          );
          console.log(
            `✅ Scheduled message ${msg.id} RESCHEDULED to ${nextRun.toISOString()}`,
          );
        }
      } catch (err) {
        console.error(`❌ Failed to send scheduled message ${msg.id}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE scheduled_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2",
          [errorMsg, msg.id],
        );
      }
    }
  } catch (error) {
    console.error("❌ Scheduler error:", error);
  }
}

// Start scheduler (every 1 minute)
setInterval(processScheduledMessages, 60000);

// Auto-Reply Logic
const extractMessageText = (msg: any): string => {
  let message = msg?.message;
  if (!message) return "";

  // Handle message editions
  if (message.editedMessage) {
    message = message.editedMessage.message || message.editedMessage;
  }
  if (!message) return "";

  // Unwrap various message containers recursively
  for (let i = 0; i < 5; i++) {
    if (message.viewOnceMessage) message = message.viewOnceMessage.message;
    else if (message.viewOnceMessageV2) message = message.viewOnceMessageV2.message;
    else if (message.viewOnceMessageV2Extension) message = message.viewOnceMessageV2Extension.message;
    else if (message.ephemeralMessage) message = message.ephemeralMessage.message;
    else if (message.message) message = message.message; // some versions nest it
    else break;
    if (!message) return "";
  }

  // Common text fields across different WhatsApp versions and clients
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.text || // Fallback for some clients
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.contactMessage?.displayName ||
    message.locationMessage?.comment ||
    message.liveLocationMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  ).trim();
};

whastapp.onMessageReceived(async (msg) => {
  console.log("📩 Full Message Object:", JSON.stringify(msg, null, 2));
  
  // allow both from others and self for better testing experience
  const allowSelf = env.ALLOW_SELF_MESSAGES === "true" || env.ALLOW_SELF_MESSAGES === undefined;
  if (msg.key.fromMe && !allowSelf) return;

  const sessionId = msg.sessionId;
  let remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  // Clean remoteJid from device suffixes (e.g. 628123@s.whatsapp.net:1)
  // This is crucial for replying correctly to mobile senders
  if (remoteJid.includes(':')) {
    const parts = remoteJid.split('@');
    if (parts.length > 1) {
      remoteJid = parts[0].split(':')[0] + '@' + parts[1];
    }
  }

  const fromLog = remoteJid.split("@")[0];
  const messageText = extractMessageText(msg);

  if (!messageText) return;

  try {
    const result = await query(
      "SELECT * FROM auto_replies WHERE session = $1 AND LOWER(keyword) = LOWER($2) AND is_active = true LIMIT 1",
      [sessionId, messageText],
    );

    if (result.rows.length > 0) {
      const reply = result.rows[0];
      const scheduleType = reply.schedule_type || "all";
      let shouldReply = true;

      // Use Jakarta time (UTC+7) for auto-reply scheduling
      const now = new Date();
      const jakartaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const currentDay = jakartaNow.getUTCDay();
      const currentTimeStr = jakartaNow
        .toISOString()
        .split("T")[1]
        .split(".")[0]; // "HH:mm:ss"

      if (scheduleType === "working_hours") {
        const isWorkDay = currentDay >= 1 && currentDay <= 5;
        const isTalkTime =
          currentTimeStr >= "07:30:00" && currentTimeStr <= "16:00:00";
        shouldReply = isWorkDay && isTalkTime;
      } else if (scheduleType === "outside_working_hours") {
        const isWeekend = currentDay === 0 || currentDay === 6;
        const isNotWorkTime =
          currentTimeStr < "07:30:00" || currentTimeStr > "16:00:00";
        shouldReply = isWeekend || isNotWorkTime;
      } else if (scheduleType === "custom") {
        if (reply.custom_days) {
          const daysMap: Record<string, number> = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };
          const allowedDays = reply.custom_days
            .split(",")
            .map((d: string) => d.trim().toLowerCase())
            .map((day: string) => daysMap[day])
            .filter(
              (value: number | undefined): value is number =>
                typeof value === "number",
            );
          shouldReply = allowedDays.includes(currentDay);
        }
        if (shouldReply && reply.start_time && reply.end_time) {
          shouldReply =
            currentTimeStr >= reply.start_time &&
            currentTimeStr <= reply.end_time;
        }
      }

      if (shouldReply) {
        console.log(
          `🤖 Auto-replying to ${fromLog} with keyword "${reply.keyword}"`,
        );
        await whastapp.sendTextMessage({
          sessionId,
          to: remoteJid,
          text: reply.response,
        });
      }
    }
  } catch (error) {
    console.error("❌ Error processing auto reply:", error);
  }
});

whastapp.loadSessionsFromStorage();
