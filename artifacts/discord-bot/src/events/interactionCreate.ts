import {
  Interaction,
  ChatInputCommandInteraction,
  Collection,
  EmbedBuilder,
  Colors,
} from "discord.js";
import type { Command } from "../types/index.js";

export async function handleInteractionCreate(
  interaction: Interaction,
  commands: Collection<string, Command>
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (err) {
    console.error(
      `[Bot] Error executing /${interaction.commandName}:`,
      err
    );

    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(
        "An error occurred while running this command. Please try again."
      );

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    } catch {
      // Ignore reply errors
    }
  }
}
