import { prisma } from "@/lib/prisma"

/**
 * Chat session limit. The app runs in demo mode unless DEMO_MODE=false is set, and a demo account may keep at most
 * MAX_DEMO_SESSIONS conversations: delete one to start another. Outside demo mode there is no cap.
 * The limit is enforced here on the server; the UI only mirrors it.
 */
export const MAX_DEMO_SESSIONS = 5

export function sessionLimit() {
  return process.env.DEMO_MODE === "false" ? null : MAX_DEMO_SESSIONS
}

export async function sessionCount(userId) {
  return prisma.conversation.count({ where: { userId } })
}

export async function sessionCapReached(userId) {
  const limit = sessionLimit()
  return limit !== null && (await sessionCount(userId)) >= limit
}
