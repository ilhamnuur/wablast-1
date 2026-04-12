import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { query } from "../db/connection";

const scheduledSchema = z.object({
  session: z.string().min(1, "Session is required"),
  recipient: z.string().min(1, "Recipient is required"),
  message: z.string().min(1, "Message is required"),
  media_url: z.string().optional().nullable(),
  scheduled_at: z.string().min(1, "Scheduled time is required"),
  type: z.enum(["individual", "blast"]).default("individual"),
  schedule_type: z.enum(["once", "every_day", "working_days", "holidays"]).default("once"),
});

export const createScheduledController = () => {
  const app = new Hono();

  const normalizeScheduleType = (type: string | null | undefined) => {
    if (!type) return "once";
    if (type === "all") return "every_day";
    if (["once", "every_day", "working_days", "holidays"].includes(type)) return type;
    return "once";
  };

  // Get all scheduled messages
  app.get("/", async (c) => {
    try {
      const result = await query(
        "SELECT id, session, recipient, message, media_url, scheduled_at, status, type, schedule_type, created_at, updated_at FROM scheduled_messages ORDER BY scheduled_at ASC"
      );
      const normalizedRows = result.rows.map((row) => ({
        ...row,
        schedule_type: normalizeScheduleType(row.schedule_type),
      }));
      console.log(`📋 Returning ${normalizedRows.length} scheduled messages with schedule_type:`, 
        normalizedRows.map((r) => ({ id: r.id, schedule_type: r.schedule_type })));
      return c.json({ success: true, data: normalizedRows });
    } catch (error) {
      console.error(`❌ Error fetching scheduled messages:`, error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Schedule new message
  app.post("/", zValidator("json", scheduledSchema), async (c) => {
    try {
      const { session, recipient, message, media_url, scheduled_at, type, schedule_type } =
        c.req.valid("json");

      console.log(`📝 Creating scheduled message with schedule_type: ${schedule_type}`);

      const result = await query(
        "INSERT INTO scheduled_messages (session, recipient, message, media_url, scheduled_at, type, schedule_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [session, recipient, message, media_url || null, scheduled_at, type, schedule_type]
      );

      console.log(`✅ Scheduled message saved with schedule_type: ${result.rows[0].schedule_type}`);

      return c.json({
        success: true,
        data: result.rows[0],
        message: "Message scheduled successfully",
      });
    } catch (error) {
      console.error(`❌ Error scheduling message:`, error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Update scheduled message
  app.put("/:id", zValidator("json", scheduledSchema), async (c) => {
    try {
      const id = c.req.param("id");
      console.log(`📝 Received update request for ID: ${id}`);

      const { session, recipient, message, media_url, scheduled_at, type, schedule_type } =
        c.req.valid("json");

      console.log(`📝 Updating scheduled message ${id} with data:`, {
        session, recipient, message: message.substring(0, 50) + "...",
        media_url, scheduled_at, type, schedule_type
      });

      const result = await query(
        "UPDATE scheduled_messages SET session = $1, recipient = $2, message = $3, media_url = $4, scheduled_at = $5, type = $6, schedule_type = $7, updated_at = NOW() WHERE id = $8 RETURNING *",
        [session, recipient, message, media_url || null, scheduled_at, type, schedule_type, id]
      );

      if (result.rows.length === 0) {
        console.log(`❌ Scheduled message ${id} not found`);
        return c.json({ success: false, error: "Scheduled message not found" }, 404);
      }

      console.log(`✅ Scheduled message ${id} updated successfully with schedule_type: ${result.rows[0].schedule_type}`);

      return c.json({
        success: true,
        data: result.rows[0],
        message: "Scheduled message updated successfully",
      });
    } catch (error) {
      console.error(`❌ Error updating scheduled message:`, error);
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
