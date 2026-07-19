import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { awardCredits } from "../lib/credits.js";
import { checkAndPromote } from "../lib/roles.js";
import type { Command } from "../types/index.js";

export const addCreditsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("addcredits")
    .setDescription("Add moderation credits to a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The moderator").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Credits to add")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000)
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for adding credits")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const reason =
      interaction.options.getString("reason") ?? "Manual credit adjustment";
    const guildId = interaction.guildId!;

    const newCredits = await awardCredits(guildId, target.id, amount);
    const promoted = await checkAndPromote(
      interaction.guild!,
      target.id,
      newCredits
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("Credits Added")
      .addFields(
        { name: "User", value: `<@${target.id}>`, inline: true },
        { name: "Added", value: `+${amount}`, inline: true },
        { name: "New Total", value: `${newCredits}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setFooter({
        text: promoted ? `Promoted to ${promoted}!` : "No promotion triggered",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
