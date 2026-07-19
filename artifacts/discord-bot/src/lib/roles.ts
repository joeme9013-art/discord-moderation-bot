import { db, roleThresholdsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { Guild } from "discord.js";

/** Default role hierarchy — admins configure these via /setuproles */
export const DEFAULT_TIERS = [
  { roleName: "Trial Moderator", creditsRequired: 0, sortOrder: 0 },
  { roleName: "Moderator", creditsRequired: 50, sortOrder: 1 },
  { roleName: "Senior Moderator", creditsRequired: 150, sortOrder: 2 },
  { roleName: "Head Moderator", creditsRequired: 300, sortOrder: 3 },
  { roleName: "Trial Admin", creditsRequired: 500, sortOrder: 4 },
  { roleName: "Admin", creditsRequired: 750, sortOrder: 5 },
  { roleName: "Senior Admin", creditsRequired: 1000, sortOrder: 6 },
  { roleName: "Head Admin", creditsRequired: 1500, sortOrder: 7 },
  { roleName: "Assistant Server Manager", creditsRequired: 2000, sortOrder: 8 },
  { roleName: "Server Manager", creditsRequired: 3000, sortOrder: 9 },
];

/**
 * Check if a moderator qualifies for a higher role and promote them.
 * Returns the new role name if promoted, null otherwise.
 */
export async function checkAndPromote(
  guild: Guild,
  userId: string,
  currentCredits: number
): Promise<string | null> {
  const thresholds = await db
    .select()
    .from(roleThresholdsTable)
    .where(eq(roleThresholdsTable.guildId, guild.id))
    .orderBy(asc(roleThresholdsTable.sortOrder));

  if (thresholds.length === 0) return null;

  // Find highest role the user qualifies for
  let highestQualified: (typeof thresholds)[number] | null = null;
  for (const threshold of thresholds) {
    if (currentCredits >= threshold.creditsRequired) {
      highestQualified = threshold;
    }
  }

  if (!highestQualified) return null;

  try {
    const member = await guild.members.fetch(userId);

    // Already has this role — no promotion needed
    if (member.roles.cache.has(highestQualified.roleId)) return null;

    // Remove all configured mod roles first
    const rolesToRemove = thresholds
      .filter((t) => member.roles.cache.has(t.roleId))
      .map((t) => t.roleId);

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove, "Credit-based role update");
    }

    await member.roles.add(
      highestQualified.roleId,
      `Auto-promoted to ${highestQualified.roleName} (${currentCredits} credits)`
    );

    return highestQualified.roleName;
  } catch {
    return null;
  }
}
