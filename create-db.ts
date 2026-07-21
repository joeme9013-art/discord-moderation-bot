const { Pool } = require('pg');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.query(`
CREATE TABLE IF NOT EXISTS mod_credits (id SERIAL PRIMARY KEY, guild_id TEXT, user_id TEXT, credits INT DEFAULT 0, total_earned INT DEFAULT 0, updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY, log_channel_id TEXT, mod_role_id TEXT, mute_role_id TEXT, auto_role_enabled BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS role_thresholds (id SERIAL, guild_id TEXT, role_id TEXT, required_credits INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS infractions (id SERIAL, guild_id TEXT, user_id TEXT, mod_id TEXT, type TEXT, reason TEXT, created_at TIMESTAMP DEFAULT NOW());
`, e => {
  console.log(e ? '❌ DB ERR' : '✅ DB TABLES READY!');
  process.exit();
});