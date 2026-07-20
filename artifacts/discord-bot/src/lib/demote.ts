import {
  db,
  roleThresholdsTable,
  modLogsTable,
  modCreditsTable,
} from "@workspace/db";
import { eq, and, asc, lte, gt } from "drizzle-orm";
import type { Guild } from "discord.js";

export interface DemoteResult {
  demoted: boolean;
  fromRole: string | null;
  toRole: string | null;
  reason: string;
}

/**
 * Demote a moderator one tier down in the role hierarchy.
 * Records the demotion in mod_logs. Returns what happened.
 */
export async function demoteModerator(
  guild: Guild,
  userId: string,
  reason: string,
  executorId: string = guild.client.user?.id ?? "system"
): Promise<DemoteResult> {
  const thresholds = await db
    .select()
    .from(roleThresholdsTable)
    .where(eq(roleThresholdsTable.guildId, guild.id))
    .orderBy(asc(roleThresholdsTable.sortOrder));

  if (thresholds.length === 0) {
    return {
      demoted: false,
      fromRole: null,
      toRole: null,
      reason: "No role thresholds configured — use /setuproles to set them up",
    };
  }

  let member;
  try {
    member = await guild.members.fetch(userId);
  } catch {
    return {
      demoted: false,
      fromRole: null,
      toRole: null,
      reason: "Could not fetch member — they may have left the server",
    };
  }

  // Find the highest configured tier role the member currently has
  const currentTierIndex = thresholds.reduce((highestIdx, t, idx) => {
    if (member.roles.cache.has(t.roleId)) return idx;
    return highestIdx;
  }, -1);

  if (currentTierIndex < 0) {
    return {
      demoted: false,
      fromRole: null,
      toRole: null,
      reason: "Member has no configured tier role to demote from",
    };
  }

  if (currentTierIndex === 0) {
    return {
      demoted: false,
      fromRole: thresholds[0].roleName,
      toRole: null,
      reason: "Member is already at the lowest tier — cannot demote further",
    };
  }

  const fromTier = thresholds[currentTierIndex];
  const toTier = thresholds[currentTierIndex - 1];

  try {
    // Remove all configured mod roles
    const roleIdsToRemove = thresholds
      .filter((t) => member.roles.cache.has(t.roleId))
      .map((t) => t.roleId);

    if (roleIdsToRemove.length > 0) {
      await member.roles.remove(roleIdsToRemove, reason);
    }

    // Assign the lower role
    await member.roles.add(toTier.roleId, reason);

    // Log the demotion
    await db.insert(modLogsTable).values({
      guildId: guild.id,
      moderatorId: executorId,
      targetId: userId,
      action: "demote",
      reason,
      creditsAwarded: 0,
    });

    return {
      demoted: true,
      fromRole: fromTier.roleName,
      toRole: toTier.roleName,
      reason,
    };
  } catch (err) {
    console.error("[demote] Role assignment failed:", err);
    return {
      demoted: false,
      fromRole: fromTier.roleName,
      toRole: toTier.roleName,
      reason: "Failed to update roles — make sure the bot role is above all mod roles",
    };
  }
}
