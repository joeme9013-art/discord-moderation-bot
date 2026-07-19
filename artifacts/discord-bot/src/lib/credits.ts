import { db, modCreditsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/** Credits awarded per moderation action */
export const ACTION_CREDITS = {
  ban: 10,
  kick: 5,
  timeout: 3,
  warn: 2,
  positive_feedback: 5,
} as const;

export type ActionType = keyof typeof ACTION_CREDITS;

export async function getCredits(
  guildId: string,
  userId: string
): Promise<{ credits: number; totalEarned: number }> {
  const rows = await db
    .select()
    .from(modCreditsTable)
    .where(
      and(
        eq(modCreditsTable.guildId, guildId),
        eq(modCreditsTable.userId, userId)
      )
    )
    .limit(1);

  return {
    credits: rows[0]?.credits ?? 0,
    totalEarned: rows[0]?.totalEarned ?? 0,
  };
}

/**
 * Award (or deduct) credits from a moderator.
 * Returns the new credit total.
 */
export async function awardCredits(
  guildId: string,
  userId: string,
  amount: number
): Promise<number> {
  const existing = await db
    .select()
    .from(modCreditsTable)
    .where(
      and(
        eq(modCreditsTable.guildId, guildId),
        eq(modCreditsTable.userId, userId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    const newCredits = Math.max(0, amount);
    await db.insert(modCreditsTable).values({
      guildId,
      userId,
      credits: newCredits,
      totalEarned: newCredits,
      updatedAt: new Date(),
    });
    return newCredits;
  }

  const newCredits = Math.max(0, existing[0].credits + amount);
  const newTotal =
    amount > 0
      ? existing[0].totalEarned + amount
      : existing[0].totalEarned;

  await db
    .update(modCreditsTable)
    .set({ credits: newCredits, totalEarned: newTotal, updatedAt: new Date() })
    .where(
      and(
        eq(modCreditsTable.guildId, guildId),
        eq(modCreditsTable.userId, userId)
      )
    );

  return newCredits;
}
