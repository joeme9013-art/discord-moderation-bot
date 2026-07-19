import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { getCredits } from "../lib/credits.js";
import { DEFAULT_TIERS } from "../lib/roles.js";
import { db, roleThresholdsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const creditsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("credits")
    .setDescription("View moderation credits for yourself or another user")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to check (defaults to yourself)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser("user") ?? interaction.user;
    const guildId = interaction.guildId!;

    const { credits, totalEarned } = await getCredits(guildId, target.id);

    // Find next role threshold
    const thresholds = await db
      .select()
      .from(roleThresholdsTable)
      .where(eq(roleThresholdsTable.guildId, guildId))
      .orderBy(asc(roleThresholdsTable.sortOrder));

    let nextRole: { roleName: string; creditsRequired: number } | null = null;
    for (const t of thresholds) {
      if (credits < t.creditsRequired) {
        nextRole = t;
        break;
      }
    }

    // Fall back to default tier display if no thresholds configured
    if (thresholds.length === 0) {
      for (const t of DEFAULT_TIERS) {
        if (credits < t.creditsRequired) {
          nextRole = t;
          break;
        }
      }
    }

    const progressText = nextRole
      ? `**${credits} / ${nextRole.creditsRequired}** credits toward **${nextRole.roleName}**`
      : "**Maximum rank reached!** 🏆";

    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle(`🏅 Moderation Credits — ${target.username}`)
      .addFields(
        {
          name: "Current Credits",
          value: `**${credits.toLocaleString()}**`,
          inline: true,
        },
        {
          name: "Total Earned",
          value: `**${totalEarned.toLocaleString()}**`,
          inline: true,
        },
        { name: "Next Promotion", value: progressText }
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
