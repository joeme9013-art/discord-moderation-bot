import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { awardCredits, getCredits } from "../lib/credits.js";
import type { Command } from "../types/index.js";

export const removeCreditsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("removecredits")
    .setDescription("Remove moderation credits from a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The moderator").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Credits to remove")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000)
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for removing credits")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const reason =
      interaction.options.getString("reason") ?? "Manual credit adjustment";
    const guildId = interaction.guildId!;

    const { credits: before } = await getCredits(guildId, target.id);
    const newCredits = await awardCredits(guildId, target.id, -amount);

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("Credits Removed")
      .addFields(
        { name: "User", value: `<@${target.id}>`, inline: true },
        { name: "Removed", value: `-${Math.min(amount, before)}`, inline: true },
        { name: "New Total", value: `${newCredits}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
