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
import { modprofileCommand } from "./commands/modprofile.js";
import { demoteCommand } from "./commands/demote.js";
import { setinactivityCommand } from "./commands/setinactivity.js";
import { rosterCommand } from "./commands/roster.js";
import { setupCommand } from "./commands/setup.js";
import { commendCommand } from "./commands/commend.js";
import { handleReady } from "./events/ready.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleAuditLog } from "./events/guildAuditLogEntryCreate.js";
import { runInactivityChecks } from "./lib/inactivity.js";
import { startHealthServer } from "./server.js";

// Start health server FIRST so Railway healthcheck passes even if startup fails
startHealthServer();

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
  modprofileCommand,
  demoteCommand,
  setinactivityCommand,
  rosterCommand,
  setupCommand,
  commendCommand,
];
for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    // GuildMembers is a privileged intent.
    // Enable it in the Discord Developer Portal under Bot → Privileged Gateway Intents
    // if you want member caching. The bot works without it via REST fetches.
  ],
});

client.once(Events.ClientReady, async (c) => {
  await handleReady(c, allCommands);

  // Run inactivity check on startup, then every 12 hours
  await runInactivityChecks(client);
  setInterval(() => runInactivityChecks(client), 12 * 60 * 60 * 1000);
});

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
