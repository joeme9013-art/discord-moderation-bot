import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, feedbackTable } from "@workspace/db";
import { awardCredits, ACTION_CREDITS } from "../lib/credits.js";
import { checkAndPromote } from "../lib/roles.js";
import type { Command } from "../types/index.js";

export const feedbackCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Submit feedback about a moderator")
    .addUserOption((opt) =>
      opt
        .setName("moderator")
        .setDescription("The moderator to leave feedback for")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Type of feedback")
        .setRequired(true)
        .addChoices(
          { name: "Positive 👍", value: "positive" },
          { name: "Negative 👎", value: "negative" }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Your feedback message")
        .setRequired(true)
        .setMaxLength(1000)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const moderator = interaction.options.getUser("moderator", true);
    const type = interaction.options.getString("type", true);
    const message = interaction.options.getString("message", true);
    const guildId = interaction.guildId!;
    const isPositive = type === "positive";

    if (moderator.id === interaction.user.id) {
      await interaction.editReply("You cannot leave feedback for yourself.");
      return;
    }
    if (moderator.bot) {
      await interaction.editReply("You cannot leave feedback for a bot.");
      return;
    }

    await db.insert(feedbackTable).values({
      guildId,
      userId: interaction.user.id,
      moderatorId: moderator.id,
      message,
      isPositive,
    });

    // Award credits for positive feedback
    let promoted: string | null = null;
    if (isPositive) {
      const newCredits = await awardCredits(
        guildId,
        moderator.id,
        ACTION_CREDITS.positive_feedback
      );
      promoted = await checkAndPromote(
        interaction.guild!,
        moderator.id,
        newCredits
      );
    }

    // Notify the moderator via DM
    try {
      await moderator.send({
        embeds: [
          new EmbedBuilder()
            .setColor(isPositive ? Colors.Green : Colors.Red)
            .setTitle(
              `${isPositive ? "👍 Positive" : "👎 Negative"} feedback received in ${interaction.guild!.name}`
            )
            .addFields({ name: "Message", value: message })
            .setFooter({
              text: isPositive
                ? `+${ACTION_CREDITS.positive_feedback} credits awarded${promoted ? ` · Promoted to ${promoted}!` : ""}`
                : "No credits awarded for negative feedback",
            })
            .setTimestamp(),
        ],
      });
    } catch {
      // DMs disabled — ignore
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(isPositive ? Colors.Green : Colors.Red)
          .setTitle("Feedback Submitted")
          .setDescription(
            `Your ${isPositive ? "positive" : "negative"} feedback for <@${moderator.id}> has been recorded. Thank you!`
          )
          .setTimestamp(),
      ],
    });
  },
};
