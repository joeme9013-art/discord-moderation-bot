import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, warningsTable, modLogsTable } from "@workspace/db";
import { awardCredits, ACTION_CREDITS } from "../lib/credits.js";
import { checkAndPromote } from "../lib/roles.js";
import type { Command } from "../types/index.js";

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to warn").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the warning")
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const guildId = interaction.guildId!;
    const moderatorId = interaction.user.id;

    if (target.id === moderatorId) {
      await interaction.editReply("You cannot warn yourself.");
      return;
    }
    if (target.bot) {
      await interaction.editReply("You cannot warn a bot.");
      return;
    }

    // Save warning
    const [warning] = await db
      .insert(warningsTable)
      .values({ guildId, userId: target.id, moderatorId, reason })
      .returning();

    // Log action
    await db.insert(modLogsTable).values({
      guildId,
      moderatorId,
      targetId: target.id,
      action: "warn",
      reason,
      creditsAwarded: ACTION_CREDITS.warn,
    });

    // Award credits & check promotion
    const newCredits = await awardCredits(
      guildId,
      moderatorId,
      ACTION_CREDITS.warn
    );
    const promoted = await checkAndPromote(
      interaction.guild!,
      moderatorId,
      newCredits
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle("⚠️ Warning Issued")
      .addFields(
        { name: "User", value: `<@${target.id}>`, inline: true },
        {
          name: "Moderator",
          value: `<@${moderatorId}>`,
          inline: true,
        },
        { name: "Warning ID", value: `#${warning.id}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setThumbnail(target.displayAvatarURL())
      .setFooter({
        text: `+${ACTION_CREDITS.warn} credit${promoted ? ` · Promoted to ${promoted}!` : ""}`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM the warned user
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle(`⚠️ You received a warning in ${interaction.guild!.name}`)
            .addFields({ name: "Reason", value: reason })
            .setTimestamp(),
        ],
      });
    } catch {
      // DMs may be disabled — ignore
    }
  },
};
