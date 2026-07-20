import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, roleThresholdsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const rosterCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("View all moderators and their current roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    const thresholds = await db
      .select()
      .from(roleThresholdsTable)
      .where(eq(roleThresholdsTable.guildId, guildId))
      .orderBy(asc(roleThresholdsTable.sortOrder));

    if (thresholds.length === 0) {
      return interaction.editReply({
        content:
          "⚠️ No roles have been configured yet. Use `/setuproles add` to set up the moderation hierarchy.",
      });
    }

    // Fetch all members for each role tier
    const lines: string[] = [];
    let totalMods = 0;

    for (const tier of [...thresholds].reverse()) {
      try {
        const role = await guild.roles.fetch(tier.roleId);
        if (!role) continue;

        // Fetch members with this role
        await guild.members.fetch({ force: false });
        const members = role.members;

        if (members.size === 0) continue;

        totalMods += members.size;

        const memberList = members
          .map((m) => `• ${m.user.username}`)
          .sort()
          .join("\n");

        lines.push(
          `**${tier.roleName}** (${members.size})\n${memberList}`
        );
      } catch {
        // Role may have been deleted — skip it
      }
    }

    if (lines.length === 0) {
      return interaction.editReply({
        content:
          "No moderators found. Make sure the configured roles have members.",
      });
    }

    // Split into multiple embeds if content is too long
    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation Roster — ${guild.name}`)
      .setColor(Colors.Blurple)
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: `${totalMods} staff member${totalMods !== 1 ? "s" : ""} total` })
      .setTimestamp();

    // Discord embed description limit is 4096 chars
    const description = lines.join("\n\n");
    if (description.length > 4096) {
      // Chunk into multiple embeds
      const embeds: EmbedBuilder[] = [];
      let chunk = "";
      let first = true;

      for (const line of lines) {
        if ((chunk + "\n\n" + line).length > 4000) {
          const e = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(chunk);
          if (first) {
            e.setTitle(`📋 Moderation Roster — ${guild.name}`);
            first = false;
          }
          embeds.push(e);
          chunk = line;
        } else {
          chunk = chunk ? chunk + "\n\n" + line : line;
        }
      }

      if (chunk) {
        const e = new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setDescription(chunk)
          .setFooter({
            text: `${totalMods} staff member${totalMods !== 1 ? "s" : ""} total`,
          })
          .setTimestamp();
        if (first) e.setTitle(`📋 Moderation Roster — ${guild.name}`);
        embeds.push(e);
      }

      return interaction.editReply({ embeds });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
