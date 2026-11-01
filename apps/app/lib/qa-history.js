import { prisma } from "@/lib/prisma"

/**
 * Recent turns of the user's active conversation, for context. Never throws: if the database is
 * unavailable the question is simply answered without history.
 * @returns {{ conversationId: string | undefined, history: {role: string, content: string}[] }}
 */
export async function loadHistory(userId, conversationId) {
  let active = conversationId || undefined
  let history = []
  try {
    if (!active) {
      const recent = await prisma.conversation.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } })
      active = recent?.id
    }
    if (active) {
      history = await prisma.message.findMany({
        where: { conversationId: active, conversation: { userId } }, // only the caller's own conversation
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { role: true, content: true },
      })
    }
  } catch (e) {
    console.error("[qa] history unavailable:", e.code || e.message)
  }
  return { conversationId: active, history }
}

/** Save the question and answer. Fire-and-forget: a failure here must never lose the answer the user already saw. */
export async function persistExchange({ userId, conversationId, question, answer, concept }) {
  try {
    const conv = conversationId
      ? await prisma.conversation.upsert({
          where: { id: conversationId },
          create: { id: conversationId, userId, title: question.slice(0, 80) },
          update: { updatedAt: new Date() },
        })
      : await prisma.conversation.create({ data: { userId, title: question.slice(0, 80) } })
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, role: "user", content: question },
        { conversationId: conv.id, role: "assistant", content: answer, metadata: concept ? { concept } : undefined },
      ],
    })
    return conv.id
  } catch (e) {
    console.error("[qa] could not save exchange:", e.code || e.message)
    return conversationId
  }
}
