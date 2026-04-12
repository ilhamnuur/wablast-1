import { query } from "./connection";

export async function runMigrations() {
  console.log("🔄 Running migrations...");

  try {
    // Scheduled Messages Table
    await query(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id SERIAL PRIMARY KEY,
        session TEXT NOT NULL,
        recipient TEXT NOT NULL,
        message TEXT NOT NULL,
        media_url TEXT,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status TEXT DEFAULT 'pending',
        type TEXT DEFAULT 'individual',
        schedule_type TEXT DEFAULT 'once',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Ensure scheduled_at is TIMESTAMPTZ even if table already exists
    try {
      await query("ALTER TABLE scheduled_messages ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC'");
      await query("ALTER TABLE scheduled_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ");
      await query("ALTER TABLE scheduled_messages ALTER COLUMN updated_at TYPE TIMESTAMPTZ");
      // Add schedule_type column if not exists (for backward compatibility)
      await query("ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'once'");
      // Add error_message column
      await query("ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS error_message TEXT");
      // Update any existing rows with invalid schedule_type values
      await query("UPDATE scheduled_messages SET schedule_type = 'once' WHERE schedule_type NOT IN ('once', 'every_day', 'working_days', 'holidays')");
      console.log("✅ Table 'scheduled_messages' columns updated to TIMESTAMPTZ and schedule_type, error_message corrected");
    } catch (e) {
      console.log("⚠️ Failed to alter columns in 'scheduled_messages':", e);
    }

    console.log("✅ Table 'scheduled_messages' checked/created");

    // Auto Replies Table
    await query(`
      CREATE TABLE IF NOT EXISTS auto_replies (
        id SERIAL PRIMARY KEY,
        session TEXT NOT NULL,
        keyword TEXT NOT NULL,
        response TEXT NOT NULL,
        persona TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        schedule_type TEXT DEFAULT 'all', -- 'all', 'working_hours', 'outside_working_hours', 'custom'
        custom_days TEXT, -- 'monday,tuesday,...'
        start_time TIME,
        end_time TIME,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'auto_replies' checked/created");

    // Ensure new columns exist in auto_replies
    try {
      await query("ALTER TABLE auto_replies ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'all'");
      await query("ALTER TABLE auto_replies ADD COLUMN IF NOT EXISTS custom_days TEXT");
      await query("ALTER TABLE auto_replies ADD COLUMN IF NOT EXISTS start_time TIME");
      await query("ALTER TABLE auto_replies ADD COLUMN IF NOT EXISTS end_time TIME");
      console.log("✅ Table 'auto_replies' columns updated");
    } catch (e) {
      console.log("⚠️ Some columns might already exist in 'auto_replies'");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}
