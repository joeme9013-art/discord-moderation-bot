import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, roleThresholdsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const setupRolesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setuproles")
    .setDescription("Configure auto-promotion role thresholds (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Map a Discord role to a credit threshold")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The Discord role to auto-assign")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription(
              'Tier name (e.g. "Moderator", "Senior Admin")'
            )
            .setRequired(true)
            .setMaxLength(50)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("credits")
            .setDescription("Credits needed to earn this role")
            .setRequired(true)
            .setMinValue(0)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("order")
            .setDescription(
              "Sort order: 0 = lowest rank, higher = more senior"
            )
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all configured role thresholds")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role threshold")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to remove from thresholds")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Remove ALL role thresholds for this server")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "add") {
      const role = interaction.options.getRole("role", true);
      const name = interaction.options.getString("name", true);
      const credits = interaction.options.getInteger("credits", true);
      const order = interaction.options.getInteger("order", true);

      // Upsert: remove existing entry for this role if any, then insert
      await db
        .delete(roleThresholdsTable)
        .where(
          and(
            eq(roleThresholdsTable.guildId, guildId),
            eq(roleThresholdsTable.roleId, role.id)
          )
        );

      await db.insert(roleThresholdsTable).values({
        guildId,
        roleId: role.id,
        roleName: name,
        creditsRequired: credits,
        sortOrder: order,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle("Role Threshold Added")
            .addFields(
              { name: "Role", value: `<@&${role.id}>`, inline: true },
              { name: "Tier Name", value: name, inline: true },
              {
                name: "Credits Required",
                value: `${credits.toLocaleString()}`,
                inline: true,
              },
              { name: "Sort Order", value: `${order}`, inline: true }
            )
            .setFooter({
              text: "Moderators will be auto-promoted when they hit this threshold",
            })
            .setTimestamp(),
        ],
      });
    } else if (sub === "list") {
      const rows = await db
        .select()
        .from(roleThresholdsTable)
        .where(eq(roleThresholdsTable.guildId, guildId))
        .orderBy(asc(roleThresholdsTable.sortOrder));

      if (rows.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Grey)
              .setDescription(
                "No role thresholds configured.\nUse `/setuproles add` to map Discord roles to credit thresholds."
              ),
          ],
        });
        return;
      }

      const lines = rows.map(
        (r) =>
          `**${r.roleName}** — <@&${r.roleId}>\n${r.creditsRequired.toLocaleString()} credits required · order: ${r.sortOrder}`
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle("Role Thresholds")
            .setDescription(lines.join("\n\n"))
            .setTimestamp(),
        ],
      });
    } else if (sub === "remove") {
      const role = interaction.options.getRole("role", true);

      const deleted = await db
        .delete(roleThresholdsTable)
        .where(
          and(
            eq(roleThresholdsTable.guildId, guildId),
            eq(roleThresholdsTable.roleId, role.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        await interaction.editReply(`<@&${role.id}> is not configured as a threshold.`);
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Orange)
            .setDescription(
              `Removed threshold for <@&${role.id}> (${deleted[0].roleName}).`
            )
            .setTimestamp(),
        ],
      });
    } else if (sub === "clear") {
      await db
        .delete(roleThresholdsTable)
        .where(eq(roleThresholdsTable.guildId, guildId));

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(
              "All role thresholds for this server have been cleared."
            )
            .setTimestamp(),
        ],
      });
    }
  },
};
