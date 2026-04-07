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
import { serveStatic } from "@hono/node-server/serve-static";
import { getPool, query } from "./db/connection";
import { runMigrations } from "./db/migrations";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "WhatsApp Gateway API is running",
    status: "online",
    version: "1.0.0",
    docs: "/health"
  });
});

app.use(
  logger((...params) => {
    params.map((e) => console.log(`${moment().toISOString()} | ${e}`));
  })
);

// Enhanced CORS configuration
app.use(
  cors({
    origin: (origin) => origin || "*", // Dynamically allow any origin matching the request
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "key"], // MUST allow 'key' header
    credentials: true,
  })
);

app.onError(globalErrorMiddleware);
app.notFound(notFoundMiddleware);

// Test database connection on startup
async function initializeDatabase() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database initialized successfully at:", result.rows[0].now);
    await runMigrations();
  } catch (error) {
    console.error(
      "❌ Database initialization failed:",
      error instanceof Error ? error.message : String(error)
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
  })
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
      500
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
        console.log(`📱 Contacts API: http://10.10.10.195:${info.port}/contact`);
      }
    );
  })
  .catch((error) => {
    console.error(
      "❌ Failed to start server:",
      error instanceof Error ? error.message : String(error)
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
      [now]
    );

    for (const msg of result.rows) {
      console.log(`⏰ Sending scheduled message to ${msg.recipient}`);
      try {
        if (msg.type === "blast") {
          // Handle blast (get contacts in group and send)
          const contacts = await query(
            "SELECT c.phone FROM contacts c JOIN contact_groups cg ON c.id = cg.contact_id WHERE cg.group_name = $1",
            [msg.recipient]
          );
          for (const contact of contacts.rows) {
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
          }
        } else {
          // Individual
          if (msg.media_url) {
            await whastapp.sendImage({
              sessionId: msg.session,
              to: msg.recipient,
              text: msg.message,
              media: msg.media_url,
            });
          } else {
            await whastapp.sendTextMessage({
              sessionId: msg.session,
              to: msg.recipient,
              text: msg.message,
            });
          }
        }

        await query(
          "UPDATE scheduled_messages SET status = 'sent', updated_at = NOW() WHERE id = $1",
          [msg.id]
        );
        console.log(`✅ Scheduled message ${msg.id} sent`);
      } catch (err) {
        console.error(`❌ Failed to send scheduled message ${msg.id}:`, err);
        await query(
          "UPDATE scheduled_messages SET status = 'failed', updated_at = NOW() WHERE id = $1",
          [msg.id]
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
whastapp.onMessageReceived(async (msg) => {
  if (msg.key.fromMe) return;

  const sessionId = msg.sessionId;
  const from = msg.key.remoteJid?.split("@")[0];
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

  if (!messageText) return;

  try {
    const result = await query(
      "SELECT * FROM auto_replies WHERE session = $1 AND is_active = true AND $2 ILIKE '%' || keyword || '%'",
      [sessionId, messageText]
    );

    if (result.rows.length > 0) {
      const reply = result.rows[0];
      console.log(`🤖 Auto-replying to ${from} with keyword "${reply.keyword}"`);
      
      await whastapp.sendTextMessage({
        sessionId: sessionId,
        to: from!,
        text: reply.response,
      });
    }
  } catch (error) {
    console.error("❌ Auto-reply error:", error);
  }
});

whastapp.loadSessionsFromStorage();
