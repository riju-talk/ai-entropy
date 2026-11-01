import { NextResponse } from "next/server"
import { aiFetch, requireUser } from "@/lib/ai-proxy"
import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma } from "@/lib/prisma"

let __prisma__;
function getPrisma() {
  if (!__prisma__) __prisma__ = sharedPrisma;
  return __prisma__;
}

async function proxyRequest(upstreamPath, options, userId) {
  const resp = await aiFetch(upstreamPath, options, userId);
  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    return { status: resp.status, body: json };
  } catch {
    return { status: resp.status, body: text, isText: true };
  }
}

// GET: greeting / health only (history is served by /api/ai-agent/conversations)
export async function GET(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { userId: sessionUserId } = auth
    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "greeting").toLowerCase();

    let upstreamPath = "/api/qa/greeting";
    if (action === "health") upstreamPath = "/api/qa/health";

    const res = await proxyRequest(upstreamPath, { method: "GET", headers: {} }, sessionUserId);
    if (res.isText) {
      return new NextResponse(String(res.body), { status: res.status, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json(res.body, { status: res.status });
  } catch (err) {
    console.error("[AI-AGENT][QA][GET] Proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: proxy to Python QA backend, then persist Q+A to DB
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { userId: sessionUserId } = auth
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // The verified session user is authoritative; any user id in the body is ignored.
    const userId = sessionUserId;
    const conversationId = body.conversationId || undefined;
    const question = body.question || body.user_prompt || body.prompt || "";

    // Load recent message history for context (last 10 turns = 20 messages)
    let conversationHistory = [];
    let activeConversationId = conversationId;

    if (userId) {
      const prisma = getPrisma();
      try {
        // Find or create the active conversation
        if (!activeConversationId) {
          // Use the most recent conversation, or create a new one
          const recent = await prisma.conversation.findFirst({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });
          activeConversationId = recent?.id;
        }

        if (activeConversationId) {
          const recent = await prisma.message.findMany({
            where: { conversationId: activeConversationId },
            orderBy: { createdAt: "asc" },
            take: 20,
            select: { role: true, content: true },
          });
          conversationHistory = recent;
        }
      } catch (e) {
        console.error("[API][QA] DB history fetch failed:", e);
      }
    }

    const payload = {
      question,
      user_prompt: question,
      system_prompt: body.system_prompt || body.systemPrompt || undefined,
      userId,
      language: body.language || "en",
      collection_name: userId, // uploads are stored under the learner's own namespace
      conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
    };

    console.log("[API][QA] Forwarding to backend (userId=%s, history=%d)", userId, conversationHistory.length);

    const resp = await proxyRequest("/api/qa/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, sessionUserId);

    if (resp.isText) {
      return new NextResponse(String(resp.body), { status: resp.status, headers: { "Content-Type": "text/plain" } });
    }

    // Persist messages to DB in the background (non-blocking)
    if (userId && resp.status === 200) {
      const answer = (resp.body)?.answer || "";
      const concept = (resp.body)?.concept || "";
      const messageMetadata = concept ? { concept } : null;

      getPrisma().conversation.upsert({
        where: { id: activeConversationId ?? "" },
        create: {
          id: activeConversationId,
          userId,
          title: question.slice(0, 80),
        },
        update: { updatedAt: new Date() },
      }).then(async (conv) => {
        await getPrisma().message.createMany({
          data: [
            { conversationId: conv.id, role: "user", content: question },
            { conversationId: conv.id, role: "assistant", content: answer, metadata: messageMetadata ?? undefined },
          ],
        });
      }).catch((e) => console.error("[API][QA] DB persist failed:", e));
    }

    return NextResponse.json({ ...(resp.body), conversationId: activeConversationId }, { status: resp.status });
  } catch (err) {
    console.error("[API][QA] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
