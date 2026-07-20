import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, guildSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Command } from "../types/index.js";

async function upsertSettings(guildId: string, patch: Partial<{ inactivityDays: number; warningsBeforeDemote: number; inactivityEnabled: boolean }>) {
  const existing = await db
    .select()
    .from(guildSettingsTable)
    .where(eq(guildSettingsTable.guildId, guildId))
    .limit(1);

  if (existing.length === 0) {
    return await db
      .insert(guildSettingsTable)
      .values({ guildId, ...patch, updatedAt: new Date() })
      .returning();
  }
  return await db
    .update(guildSettingsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(guildSettingsTable.guildId, guildId))
    .returning();
}

export const setinactivityCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setinactivity")
    .setDescription("Configure the auto-inactivity warning system (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("configure")
        .setDescription("Set inactivity thresholds")
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription(
              "Days without activity before warning (default: 7)"
            )
            .setMinValue(1)
            .setMaxValue(90)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("warnings_before_demote")
            .setDescription(
              "Warnings issued before auto-demotion (default: 3)"
            )
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable auto-inactivity warnings")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("Enable or disable the system")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current inactivity settings")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "configure") {
      const days = interaction.options.getInteger("days");
      const warningsBeforeDemote = interaction.options.getInteger(
        "warnings_before_demote"
      );

      if (!days && !warningsBeforeDemote) {
        await interaction.editReply(
          "Please provide at least one option to configure."
        );
        return;
      }

      const patch: Record<string, number> = {};
      if (days) patch.inactivityDays = days;
      if (warningsBeforeDemote) patch.warningsBeforeDemote = warningsBeforeDemote;

      const [settings] = await upsertSettings(guildId, patch);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle("Inactivity Settings Updated")
            .addFields(
              {
                name: "Inactivity Threshold",
                value: `${settings.inactivityDays} days`,
                inline: true,
              },
              {
                name: "Warnings Before Demote",
                value: `${settings.warningsBeforeDemote}`,
                inline: true,
              },
              {
                name: "Status",
                value: settings.inactivityEnabled ? "Enabled" : "Disabled",
                inline: true,
              }
            )
            .setTimestamp(),
        ],
      });
    } else if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const [settings] = await upsertSettings(guildId, { inactivityEnabled: enabled });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(enabled ? Colors.Green : Colors.Grey)
            .setDescription(
              `Auto-inactivity warnings are now **${enabled ? "enabled" : "disabled"}**.`
            )
            .setTimestamp(),
        ],
      });
    } else if (sub === "status") {
      const rows = await db
        .select()
        .from(guildSettingsTable)
        .where(eq(guildSettingsTable.guildId, guildId))
        .limit(1);

      const settings = rows[0] ?? {
        inactivityDays: 7,
        warningsBeforeDemote: 3,
        inactivityEnabled: true,
      };

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle("Inactivity System Settings")
            .addFields(
              {
                name: "Status",
                value: settings.inactivityEnabled ? "✅ Enabled" : "❌ Disabled",
                inline: true,
              },
              {
                name: "Inactivity Threshold",
                value: `${settings.inactivityDays} days without action`,
                inline: true,
              },
              {
                name: "Warnings Before Demote",
                value: `${settings.warningsBeforeDemote} warnings`,
                inline: true,
              },
              {
                name: "How it works",
                value:
                  "The bot checks every 12 hours. If a mod has no logged action within the threshold, they receive a warning. After reaching the warning limit within 30 days, they are automatically demoted one tier.",
              }
            )
            .setTimestamp(),
        ],
      });
    }
  },
};
