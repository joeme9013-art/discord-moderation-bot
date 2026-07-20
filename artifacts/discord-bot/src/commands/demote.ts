import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { demoteModerator } from "../lib/demote.js";
import type { Command } from "../types/index.js";

export const demoteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("demote")
    .setDescription("Manually demote a moderator one tier (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The moderator to demote")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the demotion")
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    if (target.id === interaction.user.id) {
      await interaction.editReply("You cannot demote yourself.");
      return;
    }

    const result = await demoteModerator(
      interaction.guild!,
      target.id,
      reason,
      interaction.user.id
    );

    if (!result.demoted) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Grey)
            .setDescription(`Could not demote <@${target.id}>: ${result.reason}`)
            .setTimestamp(),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle("📉 Moderator Demoted")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Moderator", value: `<@${target.id}>`, inline: true },
        { name: "Demoted by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "\u200b", value: "\u200b", inline: true },
        {
          name: "Previous Role",
          value: result.fromRole ?? "Unknown",
          inline: true,
        },
        { name: "New Role", value: result.toRole ?? "None", inline: true },
        { name: "\u200b", value: "\u200b", inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM the demoted user
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.DarkRed)
            .setTitle(`📉 You have been demoted in ${interaction.guild!.name}`)
            .addFields(
              {
                name: "Previous Role",
                value: result.fromRole ?? "Unknown",
                inline: true,
              },
              { name: "New Role", value: result.toRole ?? "None", inline: true },
              { name: "Reason", value: reason }
            )
            .setTimestamp(),
        ],
      });
    } catch {
      // DMs disabled — ignore
    }
  },
};
