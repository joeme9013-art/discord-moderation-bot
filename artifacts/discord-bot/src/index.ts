import { Client, Collection, GatewayIntentBits, Events } from "discord.js";
import type { Command } from "./types/index.js";
import { warnCommand } from "./commands/warn.js";
import { feedbackCommand } from "./commands/feedback.js";
import { modlogsCommand } from "./commands/modlogs.js";
import { creditsCommand } from "./commands/credits.js";
import { addCreditsCommand } from "./commands/addcredits.js";
import { removeCreditsCommand } from "./commands/removecredits.js";
import { leaderboardCommand } from "./commands/leaderboard.js";
import { warningsCommand } from "./commands/warnings.js";
import { setupRolesCommand } from "./commands/setuproles.js";
import { handleReady } from "./events/ready.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleAuditLog } from "./events/guildAuditLogEntryCreate.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

// Build command collection
const commands = new Collection<string, Command>();
const allCommands: Command[] = [
  warnCommand,
  feedbackCommand,
  modlogsCommand,
  creditsCommand,
  addCreditsCommand,
  removeCreditsCommand,
  leaderboardCommand,
  warningsCommand,
  setupRolesCommand,
];
for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

// NOTE: GuildMembers is a privileged intent — the bot works without it because
// it fetches members via REST (guild.members.fetch) rather than gateway cache.
// To enable member caching (optional), turn on "Server Members Intent" in the
// Discord Developer Portal under your app → Bot → Privileged Gateway Intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
  ],
});

client.once(Events.ClientReady, (c) => handleReady(c));
client.on(Events.InteractionCreate, (i) =>
  handleInteractionCreate(i, commands)
);
client.on(Events.GuildAuditLogEntryCreate, (entry, guild) =>
  handleAuditLog(entry, guild)
);

client.on(Events.Error, (err) => {
  console.error("[Bot] Client error:", err);
});

console.log("[Bot] Connecting to Discord...");
client.login(token);
