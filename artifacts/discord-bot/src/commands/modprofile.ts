import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import {
  db,
  modCreditsTable,
  modLogsTable,
  feedbackTable,
  warningsTable,
  inactivityWarningsTable,
  roleThresholdsTable,
} from "@workspace/db";
import { eq, and, desc, count, asc, gte } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const modprofileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("modprofile")
    .setDescription("View a full moderator profile and action history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The moderator to view (defaults to yourself)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser("user") ?? interaction.user;
    const guildId = interaction.guildId!;

    // Fetch all data in parallel
    const [
      creditRow,
      recentActions,
      actionCounts,
      positiveFeedback,
      negativeFeedback,
      warningsGiven,
      inactivityWarns,
      thresholds,
    ] = await Promise.all([
      // Credits
      db
        .select()
        .from(modCreditsTable)
        .where(
          and(
            eq(modCreditsTable.guildId, guildId),
            eq(modCreditsTable.userId, target.id)
          )
        )
        .limit(1),

      // Last 5 mod actions
      db
        .select()
        .from(modLogsTable)
        .where(
          and(
            eq(modLogsTable.guildId, guildId),
            eq(modLogsTable.moderatorId, target.id)
          )
        )
        .orderBy(desc(modLogsTable.createdAt))
        .limit(5),

      // Action breakdown (count per type)
      db
        .select({ action: modLogsTable.action })
        .from(modLogsTable)
        .where(
          and(
            eq(modLogsTable.guildId, guildId),
            eq(modLogsTable.moderatorId, target.id)
          )
        ),

      // Positive feedback count
      db
        .select()
        .from(feedbackTable)
        .where(
          and(
            eq(feedbackTable.guildId, guildId),
            eq(feedbackTable.moderatorId, target.id),
            eq(feedbackTable.isPositive, true)
          )
        ),

      // Negative feedback count
      db
        .select()
        .from(feedbackTable)
        .where(
          and(
            eq(feedbackTable.guildId, guildId),
            eq(feedbackTable.moderatorId, target.id),
            eq(feedbackTable.isPositive, false)
          )
        ),

      // Warnings given to others
      db
        .select()
        .from(warningsTable)
        .where(
          and(
            eq(warningsTable.guildId, guildId),
            eq(warningsTable.moderatorId, target.id)
          )
        ),

      // Inactivity warnings in last 30 days
      db
        .select()
        .from(inactivityWarningsTable)
        .where(
          and(
            eq(inactivityWarningsTable.guildId, guildId),
            eq(inactivityWarningsTable.userId, target.id),
            gte(
              inactivityWarningsTable.createdAt,
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            )
          )
        ),

      // Role thresholds for rank detection
      db
        .select()
        .from(roleThresholdsTable)
        .where(eq(roleThresholdsTable.guildId, guildId))
        .orderBy(asc(roleThresholdsTable.sortOrder)),
    ]);

    const credits = creditRow[0]?.credits ?? 0;
    const totalEarned = creditRow[0]?.totalEarned ?? 0;

    // Determine current tier
    let currentTier = "Unranked";
    for (const t of thresholds) {
      if (credits >= t.creditsRequired) currentTier = t.roleName;
    }

    // Find next tier
    let nextTier: string | null = null;
    let nextCredits: number | null = null;
    for (const t of thresholds) {
      if (credits < t.creditsRequired) {
        nextTier = t.roleName;
        nextCredits = t.creditsRequired;
        break;
      }
    }

    // Action breakdown
    const actionBreakdown: Record<string, number> = {};
    for (const row of actionCounts) {
      actionBreakdown[row.action] = (actionBreakdown[row.action] ?? 0) + 1;
    }

    const actionLines = Object.entries(actionBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([action, n]) => `${action.toUpperCase()}: **${n}**`)
      .join(" · ");

    // Recent actions
    const recentLines = recentActions
      .map((r) => {
        const t = `<t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`;
        const reason = r.reason ? ` — ${r.reason}` : "";
        return `**${r.action.toUpperCase()}** on <@${r.targetId}>${reason} ${t}`;
      })
      .join("\n");

    const progressText = nextTier
      ? `${credits.toLocaleString()} / ${nextCredits!.toLocaleString()} → **${nextTier}**`
      : "**Maximum rank reached** 🏆";

    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle(`📊 Moderator Profile — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        {
          name: "🏅 Current Rank",
          value: currentTier,
          inline: true,
        },
        {
          name: "💰 Credits",
          value: `**${credits.toLocaleString()}** (${totalEarned.toLocaleString()} total earned)`,
          inline: true,
        },
        {
          name: "📈 Next Promotion",
          value: progressText,
          inline: false,
        },
        {
          name: "📋 Action Breakdown",
          value: actionLines || "No actions recorded",
          inline: false,
        },
        {
          name: "💬 Feedback",
          value: `👍 **${positiveFeedback.length}** positive · 👎 **${negativeFeedback.length}** negative`,
          inline: true,
        },
        {
          name: "⚠️ Warnings Issued",
          value: `**${warningsGiven.length}** total`,
          inline: true,
        },
        {
          name: "🔴 Inactivity Warnings",
          value: `**${inactivityWarns.length}** in last 30 days`,
          inline: true,
        }
      );

    if (recentLines) {
      embed.addFields({
        name: "🕐 Recent Actions",
        value: recentLines,
        inline: false,
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
