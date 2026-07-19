/**
 * Standalone script to register slash commands.
 * Normally this runs automatically when the bot starts (via the ready event).
 * Run manually with: pnpm --filter @workspace/discord-bot run deploy
 */
import { REST, Routes } from "discord.js";
import { warnCommand } from "./commands/warn.js";
import { feedbackCommand } from "./commands/feedback.js";
import { modlogsCommand } from "./commands/modlogs.js";
import { creditsCommand } from "./commands/credits.js";
import { addCreditsCommand } from "./commands/addcredits.js";
import { removeCreditsCommand } from "./commands/removecredits.js";
import { leaderboardCommand } from "./commands/leaderboard.js";
import { warningsCommand } from "./commands/warnings.js";
import { setupRolesCommand } from "./commands/setuproles.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
if (!guildId) throw new Error("DISCORD_GUILD_ID is not set");

const commands = [
  warnCommand,
  feedbackCommand,
  modlogsCommand,
  creditsCommand,
  addCreditsCommand,
  removeCreditsCommand,
  leaderboardCommand,
  warningsCommand,
  setupRolesCommand,
].map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(token);

console.log(`Registering ${commands.length} slash commands...`);

const clientId = await rest
  .get(Routes.currentUser())
  .then((data: unknown) => (data as { id: string }).id);

await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: commands,
});

console.log("Done! Commands registered to guild:", guildId);
