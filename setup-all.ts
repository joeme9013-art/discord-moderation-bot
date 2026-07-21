// Auto-setup DB + commands
import { Pool } from "pg";
import { REST, Routes } from "discord.js";
import { warnCommand, feedbackCommand, modlogsCommand, creditsCommand, addCreditsCommand, removeCreditsCommand, leaderboardCommand, warningsCommand, setupRolesCommand } from "./artifacts/discord-bot/src/commands/warn.js";

const { DATABASE_URL, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CLIENT_ID } = process.env;

// 1. Create ALL DB tables
async function setupDB() {
  const db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.query(`
    CREATE TABLE IF NOT EXISTS mod_credits (id SERIAL PRIMARY KEY, guild_id TEXT, user_id TEXT, credits INT DEFAULT 0, total_earned INT DEFAULT 0, updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY, log_channel_id TEXT, mod_role_id TEXT, mute_role_id TEXT, auto_role_enabled BOOLEAN DEFAULT FALSE);
    CREATE TABLE IF NOT EXISTS role_thresholds (id SERIAL, guild_id TEXT, role_id TEXT, required_credits INT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS infractions (id SERIAL, guild_id TEXT, user_id TEXT, mod_id TEXT, type TEXT, reason TEXT, created_at TIMESTAMP DEFAULT NOW());
  `);
  console.log("✅ DATABASE: All tables ready!");
  await db.end();
}

// 2. Register ALL slash commands
async function setupCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN!);
  const commands = [warnCommand, feedbackCommand, modlogsCommand, creditsCommand, addCreditsCommand, removeCreditsCommand, leaderboardCommand, warningsCommand, setupRolesCommand].map(c => c.data.toJSON());

  await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID!, DISCORD_GUILD_ID!), { body: commands });
  console.log("✅ DISCORD: 9 commands registered!");
}

// Run everything
setupDB().then(setupCommands).then(() => console.log("🎉 EVERYTHING DONE!")).catch(console.error);