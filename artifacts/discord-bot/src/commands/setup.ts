import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ChannelType,
} from "discord.js";
import { db, guildSettingsTable, roleThresholdsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { Command } from "../types/index.js";

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot for this server (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View the current bot configuration for this server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("logchannel")
        .setDescription("Set the channel where mod actions are logged")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The text channel to send mod logs to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    // Fetch or create settings row
    const existing = await db
      .select()
      .from(guildSettingsTable)
      .where(eq(guildSettingsTable.guildId, guildId))
      .limit(1);

    const settings = existing[0] ?? null;

    // ── /setup logchannel ──────────────────────────────────────────────
    if (sub === "logchannel") {
      const channel = interaction.options.getChannel("channel", true);

      if (settings) {
        await db
          .update(guildSettingsTable)
          .set({ logChannelId: channel.id, updatedAt: new Date() })
          .where(eq(guildSettingsTable.guildId, guildId));
      } else {
        await db.insert(guildSettingsTable).values({
          guildId,
          logChannelId: channel.id,
        });
      }

      return interaction.editReply({
        content: `✅ Mod log channel set to <#${channel.id}>. All moderation actions will now be posted there.`,
      });
    }

    // ── /setup status ──────────────────────────────────────────────────
    const roles = await db
      .select()
      .from(roleThresholdsTable)
      .where(eq(roleThresholdsTable.guildId, guildId))
      .orderBy(asc(roleThresholdsTable.sortOrder));

    // Resolve log channel
    const logChannelId = settings?.logChannelId ?? process.env.DISCORD_LOG_CHANNEL_ID;
    const logChannelText = logChannelId
      ? `<#${logChannelId}>`
      : "❌ Not set — use `/setup logchannel`";

    // Inactivity
    const inactivityEnabled = settings?.inactivityEnabled ?? true;
    const inactivityDays = settings?.inactivityDays ?? 7;
    const warnsBefore = settings?.warningsBeforeDemote ?? 3;

    // Role tiers
    const rolesText =
      roles.length === 0
        ? "❌ None configured — use `/setuproles add`"
        : roles
            .map((r) => `• **${r.roleName}** — ${r.creditsRequired} credits`)
            .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Bot Setup — ${guild.name}`)
      .setColor(Colors.Blurple)
      .addFields(
        {
          name: "📋 Mod Log Channel",
          value: logChannelText,
          inline: false,
        },
        {
          name: `🕐 Inactivity Checker — ${inactivityEnabled ? "✅ Enabled" : "⏸️ Disabled"}`,
          value: [
            `Warn after **${inactivityDays} days** of no mod actions`,
            `Auto-demote after **${warnsBefore} warnings**`,
            `Change with \`/setinactivity configure\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: `🎭 Role Tiers — ${roles.length} configured`,
          value: rolesText,
          inline: false,
        },
        {
          name: "📖 Quick Setup Checklist",
          value: [
            logChannelId ? "✅ Log channel set" : "☐ Set log channel — `/setup logchannel`",
            roles.length > 0 ? "✅ Roles configured" : "☐ Add role tiers — `/setuproles add`",
            "☐ Invite bot with correct permissions (if not done)",
          ].join("\n"),
          inline: false,
        }
      )
      .setFooter({ text: "Only administrators can change these settings" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
