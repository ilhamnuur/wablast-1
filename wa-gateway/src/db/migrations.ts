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
        scheduled_at TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'pending',
        type TEXT DEFAULT 'individual',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'auto_replies' checked/created");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}
