import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) __prisma__ = new PrismaClient({ log: ["error"] });
  return __prisma__;
}

/**
 * GET /api/ai-agent/conversations?user_id=X
 *   → list conversations for user (newest first, with last message preview)
 *
 * GET /api/ai-agent/conversations?user_id=X&id=CONV_ID
 *   → fetch all messages for a specific conversation
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || "";
    const convId = url.searchParams.get("id") || "";

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const prisma = getPrisma();

    // Load a specific conversation's messages
    if (convId) {
      const conv = await prisma.conversation.findFirst({
        where: { id: convId, userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, role: true, content: true, metadata: true, createdAt: true },
          },
        },
      });
      if (!conv) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(conv);
    }

    // List all conversations for user
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[API][CONVERSATIONS] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/ai-agent/conversations
 *   body: { userId }
 *   → create a new empty conversation, return its id
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const userId: string = body?.userId || body?.user_id || "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const conv = await getPrisma().conversation.create({
      data: { userId, title: "New Chat" },
    });
    return NextResponse.json({ id: conv.id, title: conv.title, createdAt: conv.createdAt });
  } catch (err) {
    console.error("[API][CONVERSATIONS] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/ai-agent/conversations?id=CONV_ID&user_id=X
 *   → delete a conversation (and all its messages via cascade)
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const convId = url.searchParams.get("id") || "";
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || "";

    if (!convId || !userId) {
      return NextResponse.json({ error: "id and user_id are required" }, { status: 400 });
    }

    // Verify ownership before deleting
    const conv = await getPrisma().conversation.findFirst({ where: { id: convId, userId } });
    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await getPrisma().conversation.delete({ where: { id: convId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API][CONVERSATIONS] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
