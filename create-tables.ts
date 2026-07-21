import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mod_credits (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      credits INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      log_channel_id TEXT,
      mod_role_id TEXT,
      mute_role_id TEXT,
      auto_role_enabled BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS role_thresholds (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      required_credits INTEGER DEFAULT 0
    );
  `);
  console.log("✅ ALL TABLES CREATED SUCCESSFULLY!");
  process.exit(0);
}

setup().catch(err => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});