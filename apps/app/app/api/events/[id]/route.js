import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { serverError } from "@/lib/http"

// DELETE /api/events/:id   Only the host can remove their event.
export async function DELETE(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const event = await prisma.campusEvent.findUnique({ where: { id: params.id }, select: { createdById: true } })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
    if (event.createdById !== auth.userId) {
      return NextResponse.json({ error: "Only the host can delete this event" }, { status: 403 })
    }
    await prisma.campusEvent.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError("EVENT_DELETE", err)
  }
}
