import { REST, Routes } from "discord.js";
import { warnCommand } from "./artifacts/discord-bot/src/commands/warn";
import { feedbackCommand } from "./artifacts/discord-bot/src/commands/feedback";
import { modlogsCommand } from "./artifacts/discord-bot/src/commands/modlogs";
import { creditsCommand } from "./artifacts/discord-bot/src/commands/credits";
import { addCreditsCommand } from "./artifacts/discord-bot/src/commands/addCredits";
import { removeCreditsCommand } from "./artifacts/discord-bot/src/commands/removeCredits";
import { leaderboardCommand } from "./artifacts/discord-bot/src/commands/leaderboard";
import { warningsCommand } from "./artifacts/discord-bot/src/commands/warnings";
import { setupRolesCommand } from "./artifacts/discord-bot/src/commands/setupRoles";

const token = process.env.DISCORD_BOT_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!;
const clientId = process.env.DISCORD_CLIENT_ID!; // Add this secret too!

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
].map(c => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing commands...");
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log("✅ SUCCESS: 9 commands registered!");
  } catch (e) {
    console.error("❌", e);
  }
})();