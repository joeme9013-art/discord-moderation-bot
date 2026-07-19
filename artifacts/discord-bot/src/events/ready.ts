import { Client, REST, Routes, ActivityType } from "discord.js";
import { warnCommand } from "../commands/warn.js";
import { feedbackCommand } from "../commands/feedback.js";
import { modlogsCommand } from "../commands/modlogs.js";
import { creditsCommand } from "../commands/credits.js";
import { addCreditsCommand } from "../commands/addcredits.js";
import { removeCreditsCommand } from "../commands/removecredits.js";
import { leaderboardCommand } from "../commands/leaderboard.js";
import { warningsCommand } from "../commands/warnings.js";
import { setupRolesCommand } from "../commands/setuproles.js";

const ALL_COMMANDS = [
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

export async function handleReady(client: Client<true>): Promise<void> {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  client.user.setActivity("moderation activity", {
    type: ActivityType.Watching,
  });

  // Auto-register slash commands to the guild on startup
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    console.warn(
      "[Bot] DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set — skipping command registration"
    );
    return;
  }

  try {
    const rest = new REST().setToken(token);
    const commandData = ALL_COMMANDS.map((cmd) => cmd.data.toJSON());

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guildId),
      { body: commandData }
    );

    console.log(
      `[Bot] Registered ${commandData.length} slash commands to guild ${guildId}`
    );
  } catch (err) {
    console.error("[Bot] Failed to register slash commands:", err);
  }
}
