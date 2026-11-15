import { prisma } from "@/lib/prisma"
import { sessionCapReached } from "@/lib/sessions"

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
    const title = question.slice(0, 80)
    // Only ever write into the caller's own conversation (an id alone proves nothing about ownership)
    let conv = conversationId ? await prisma.conversation.findFirst({ where: { id: conversationId, userId } }) : null
    if (conv) {
      conv = await prisma.conversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date(), ...(!conv.title || conv.title === "New Chat" ? { title } : {}) },
      })
    } else if (await sessionCapReached(userId)) {
      // At the demo limit a new session cannot be created: add to the most recent one instead of dropping the answer
      conv = await prisma.conversation.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
    } else {
      conv = await prisma.conversation.create({ data: { userId, title } })
    }
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
