import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, modCreditsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { Command } from "../types/index.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top moderators by credits"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const guildId = interaction.guildId!;

    const rows = await db
      .select()
      .from(modCreditsTable)
      .where(eq(modCreditsTable.guildId, guildId))
      .orderBy(desc(modCreditsTable.credits))
      .limit(10);

    if (rows.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Grey)
            .setDescription(
              "No moderators have earned credits yet. Get moderating!"
            ),
        ],
      });
      return;
    }

    const lines = rows.map((r, i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      return `${medal} <@${r.userId}> — **${r.credits.toLocaleString()}** credits (${r.totalEarned.toLocaleString()} total earned)`;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("🏆 Moderator Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Based on current credits held" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
