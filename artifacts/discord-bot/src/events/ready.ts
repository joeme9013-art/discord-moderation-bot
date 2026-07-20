import { Client, REST, Routes, ActivityType } from "discord.js";
import type { Command } from "../types/index.js";

export async function handleReady(
  client: Client<true>,
  allCommands: Command[]
): Promise<void> {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  client.user.setActivity("moderation activity", {
    type: ActivityType.Watching,
  });

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
    const commandData = allCommands.map((cmd) => cmd.data.toJSON());

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
