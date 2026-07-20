import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, modLogsTable } from "@workspace/db";
import { awardCredits } from "../lib/credits.js";
import { checkAndPromote } from "../lib/roles.js";
import type { Command } from "../types/index.js";

const COMMEND_CREDITS = 5;

export const commendCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("commend")
    .setDescription("Commend a moderator for good work, awarding them credits")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("moderator")
        .setDescription("The moderator to commend")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("What did they do well?")
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("moderator", true);
    const reason = interaction.options.getString("reason", true);
    const guildId = interaction.guildId!;

    // Can't commend yourself
    if (target.id === interaction.user.id) {
      return interaction.editReply({
        content: "❌ You can't commend yourself.",
      });
    }

    // Can't commend bots
    if (target.bot) {
      return interaction.editReply({
        content: "❌ You can't commend a bot.",
      });
    }

    // Award credits
    const newCredits = await awardCredits(guildId, target.id, COMMEND_CREDITS);
    const promoted = await checkAndPromote(
      interaction.guild!,
      target.id,
      newCredits
    );

    // Log it
    await db.insert(modLogsTable).values({
      guildId,
      moderatorId: interaction.user.id,
      targetId: target.id,
      action: "warn" as any,
      reason: `[COMMEND] ${reason}`,
      creditsAwarded: COMMEND_CREDITS,
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("⭐ Moderator Commended")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "Moderator",
          value: `<@${target.id}>`,
          inline: true,
        },
        {
          name: "Commended By",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "Credits Awarded",
          value: `+${COMMEND_CREDITS} (total: ${newCredits})`,
          inline: true,
        },
        {
          name: "Reason",
          value: reason,
          inline: false,
        }
      )
      .setTimestamp();

    if (promoted) {
      embed.setFooter({ text: `🎉 Promoted to ${promoted}!` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
