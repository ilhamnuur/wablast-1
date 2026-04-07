import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { query } from "../db/connection";

const autoreplySchema = z.object({
  session: z.string().min(1, "Session is required"),
  keyword: z.string().min(1, "Keyword is required"),
  response: z.string().min(1, "Response is required"),
  persona: z.string().optional(),
  is_active: z.boolean().default(true),
  schedule_type: z.enum(["all", "working_hours", "outside_working_hours", "custom"]).default("all"),
  custom_days: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

export const createAutoreplyController = () => {
  const app = new Hono();

  // Get all auto replies
  app.get("/", async (c) => {
    try {
      const result = await query(
        "SELECT * FROM auto_replies ORDER BY created_at DESC"
      );
      return c.json({ success: true, data: result.rows });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Create new auto reply
  app.post("/", zValidator("json", autoreplySchema), async (c) => {
    try {
      const { session, keyword, response, persona, is_active, schedule_type, custom_days, start_time, end_time } =
        c.req.valid("json");

      const result = await query(
        "INSERT INTO auto_replies (session, keyword, response, persona, is_active, schedule_type, custom_days, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        [session, keyword, response, persona || null, is_active, schedule_type, custom_days || null, start_time || null, end_time || null]
      );

      return c.json({
        success: true,
        data: result.rows[0],
        message: "Auto reply created successfully",
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Update auto reply
  app.put("/:id", zValidator("json", autoreplySchema), async (c) => {
    try {
      const id = c.req.param("id");
      const { session, keyword, response, persona, is_active, schedule_type, custom_days, start_time, end_time } =
        c.req.valid("json");

      const result = await query(
        "UPDATE auto_replies SET session = $1, keyword = $2, response = $3, persona = $4, is_active = $5, schedule_type = $6, custom_days = $7, start_time = $8, end_time = $9, updated_at = NOW() WHERE id = $10 RETURNING *",
        [session, keyword, response, persona || null, is_active, schedule_type, custom_days || null, start_time || null, end_time || null, id]
      );

      return c.json({
        success: true,
        data: result.rows[0],
        message: "Auto reply updated successfully",
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Delete auto reply
  app.delete("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      await query("DELETE FROM auto_replies WHERE id = $1", [id]);
      return c.json({ success: true, message: "Auto reply deleted" });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  return app;
};
