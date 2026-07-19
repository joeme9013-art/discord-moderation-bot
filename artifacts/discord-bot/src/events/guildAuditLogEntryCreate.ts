import {
  AuditLogEvent,
  GuildAuditLogsEntry,
  Guild,
  EmbedBuilder,
  Colors,
  TextChannel,
  AuditLogOptionsType,
} from "discord.js";
import { db, modLogsTable } from "@workspace/db";
import { awardCredits, ACTION_CREDITS } from "../lib/credits.js";
import { checkAndPromote } from "../lib/roles.js";

type ActionInfo = {
  label: string;
  emoji: string;
  color: number;
  credits: number;
  action: "ban" | "kick" | "timeout" | "unban";
};

const TRACKED_ACTIONS: Partial<Record<AuditLogEvent, ActionInfo>> = {
  [AuditLogEvent.MemberBanAdd]: {
    label: "Ban",
    emoji: "🔨",
    color: Colors.DarkRed,
    credits: ACTION_CREDITS.ban,
    action: "ban",
  },
  [AuditLogEvent.MemberKick]: {
    label: "Kick",
    emoji: "👢",
    color: Colors.Orange,
    credits: ACTION_CREDITS.kick,
    action: "kick",
  },
  [AuditLogEvent.MemberBanRemove]: {
    label: "Unban",
    emoji: "✅",
    color: Colors.Green,
    credits: 0,
    action: "unban",
  },
};

export async function handleAuditLog(
  entry: GuildAuditLogsEntry,
  guild: Guild
): Promise<void> {
  // Handle timeouts (MemberUpdate with COMMUNICATION_DISABLED_UNTIL change)
  if (entry.action === AuditLogEvent.MemberUpdate) {
    const timeoutChange = entry.changes?.find(
      (c) => c.key === "communication_disabled_until"
    );
    // Only count applying a timeout (new value exists), not removing it
    if (timeoutChange && timeoutChange.new) {
      await processAction(
        guild,
        entry.executorId,
        entry.targetId as string | null,
        "timeout",
        "⏰",
        "Timeout",
        Colors.Yellow,
        ACTION_CREDITS.timeout,
        entry.reason
      );
    }
    return;
  }

  const info = TRACKED_ACTIONS[entry.action as AuditLogEvent];
  if (!info) return;

  // Ignore bot-triggered actions (e.g. anti-raid bots)
  if (!entry.executorId) return;
  const executor = await guild.client.users.fetch(entry.executorId).catch(() => null);
  if (executor?.bot) return;

  await processAction(
    guild,
    entry.executorId,
    entry.targetId as string | null,
    info.action,
    info.emoji,
    info.label,
    info.color,
    info.credits,
    entry.reason
  );
}

async function processAction(
  guild: Guild,
  executorId: string | null,
  targetId: string | null,
  action: string,
  emoji: string,
  label: string,
  color: number,
  credits: number,
  reason: string | null | undefined
): Promise<void> {
  if (!executorId || !targetId) return;

  // Don't credit yourself
  if (executorId === targetId) return;

  const guildId = guild.id;
  const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID;

  // Save to database
  await db.insert(modLogsTable).values({
    guildId,
    moderatorId: executorId,
    targetId,
    action,
    reason: reason ?? null,
    creditsAwarded: credits,
  });

  // Award credits and check promotion
  let promoted: string | null = null;
  if (credits > 0) {
    const newCredits = await awardCredits(guildId, executorId, credits);
    promoted = await checkAndPromote(guild, executorId, newCredits);
  }

  // Post to log channel
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!channel?.isTextBased()) return;

  try {
    const executor = await guild.client.users.fetch(executorId).catch(() => null);
    const target = await guild.client.users.fetch(targetId).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${label}`)
      .addFields(
        {
          name: "Moderator",
          value: executor ? `<@${executorId}> (${executor.tag})` : `<@${executorId}>`,
          inline: true,
        },
        {
          name: "User",
          value: target ? `<@${targetId}> (${target.tag})` : `<@${targetId}>`,
          inline: true,
        },
        {
          name: "Reason",
          value: reason ?? "No reason provided",
        }
      )
      .setFooter({
        text: credits > 0
          ? `+${credits} credit to moderator${promoted ? ` · Promoted to ${promoted}!` : ""}`
          : "No credits awarded",
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Bot] Failed to post audit log embed:", err);
  }
}
