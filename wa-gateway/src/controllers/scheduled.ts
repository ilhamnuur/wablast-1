import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { query } from "../db/connection";

const scheduledSchema = z.object({
  session: z.string().min(1, "Session is required"),
  recipient: z.string().min(1, "Recipient is required"),
  message: z.string().min(1, "Message is required"),
  media_url: z.string().optional(),
  scheduled_at: z.string().min(1, "Scheduled time is required"),
  type: z.enum(["individual", "blast"]).default("individual"),
});

export const createScheduledController = () => {
  const app = new Hono();

  // Get all scheduled messages
  app.get("/", async (c) => {
    try {
      const result = await query(
        "SELECT * FROM scheduled_messages ORDER BY scheduled_at ASC"
      );
      return c.json({ success: true, data: result.rows });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Schedule new message
  app.post("/", zValidator("json", scheduledSchema), async (c) => {
    try {
      const { session, recipient, message, media_url, scheduled_at, type } =
        c.req.valid("json");

      const result = await query(
        "INSERT INTO scheduled_messages (session, recipient, message, media_url, scheduled_at, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [session, recipient, message, media_url || null, scheduled_at, type]
      );

      return c.json({
        success: true,
        data: result.rows[0],
        message: "Message scheduled successfully",
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Delete scheduled message
  app.delete("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      await query("DELETE FROM scheduled_messages WHERE id = $1", [id]);
      return c.json({ success: true, message: "Scheduled message deleted" });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  return app;
};
