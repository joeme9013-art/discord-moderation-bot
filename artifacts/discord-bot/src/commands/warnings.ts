import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, warningsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const warningsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View or manage warnings for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View warnings for a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The user to look up")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Mark a specific warning as inactive")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("Warning ID to clear")
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "view") {
      const target = interaction.options.getUser("user", true);

      const rows = await db
        .select()
        .from(warningsTable)
        .where(
          and(
            eq(warningsTable.guildId, guildId),
            eq(warningsTable.userId, target.id)
          )
        )
        .orderBy(desc(warningsTable.createdAt))
        .limit(20);

      if (rows.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Green)
              .setDescription(`<@${target.id}> has no warnings on record.`),
          ],
        });
        return;
      }

      const active = rows.filter((r) => r.active);
      const inactive = rows.filter((r) => !r.active);

      const lines = rows.map((r) => {
        const time = `<t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`;
        const status = r.active ? "🔴 Active" : "⚫ Cleared";
        return `**#${r.id}** ${status} — by <@${r.moderatorId}>\n${r.reason}\n${time}`;
      });

      const embed = new EmbedBuilder()
        .setColor(active.length > 0 ? Colors.Red : Colors.Grey)
        .setTitle(`⚠️ Warnings — ${target.username}`)
        .setDescription(lines.join("\n\n"))
        .addFields({
          name: "Summary",
          value: `**${active.length}** active · **${inactive.length}** cleared`,
        })
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === "clear") {
      const warningId = interaction.options.getInteger("id", true);

      const rows = await db
        .select()
        .from(warningsTable)
        .where(
          and(
            eq(warningsTable.id, warningId),
            eq(warningsTable.guildId, guildId)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        await interaction.editReply(`Warning #${warningId} not found.`);
        return;
      }

      await db
        .update(warningsTable)
        .set({ active: false })
        .where(
          and(
            eq(warningsTable.id, warningId),
            eq(warningsTable.guildId, guildId)
          )
        );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setDescription(`Warning #${warningId} has been marked as cleared.`)
            .setTimestamp(),
        ],
      });
    }
  },
};
