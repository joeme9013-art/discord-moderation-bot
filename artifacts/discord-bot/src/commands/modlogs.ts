import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, modLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { Command } from "../types/index.js";

const ACTION_EMOJI: Record<string, string> = {
  ban: "🔨",
  kick: "👢",
  timeout: "⏰",
  warn: "⚠️",
  unban: "✅",
};

export const modlogsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("View moderation logs for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to look up (omit to see all recent logs)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const guildId = interaction.guildId!;

    const rows = await db
      .select()
      .from(modLogsTable)
      .where(
        target
          ? and(
              eq(modLogsTable.guildId, guildId),
              eq(modLogsTable.targetId, target.id)
            )
          : eq(modLogsTable.guildId, guildId)
      )
      .orderBy(desc(modLogsTable.createdAt))
      .limit(15);

    if (rows.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Grey)
            .setDescription(
              target
                ? `No moderation logs found for <@${target.id}>.`
                : "No moderation logs found."
            ),
        ],
      });
      return;
    }

    const lines = rows.map((r) => {
      const emoji = ACTION_EMOJI[r.action] ?? "📋";
      const time = `<t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`;
      const reason = r.reason ? ` — ${r.reason}` : "";
      return `${emoji} **${r.action.toUpperCase()}** by <@${r.moderatorId}>${target ? "" : ` on <@${r.targetId}>`}${reason}\n${time}`;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(
        target ? `📋 Mod Logs — ${target.username}` : "📋 Recent Mod Logs"
      )
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: `Showing ${rows.length} most recent entries` })
      .setTimestamp();

    if (target) embed.setThumbnail(target.displayAvatarURL());

    await interaction.editReply({ embeds: [embed] });
  },
};
