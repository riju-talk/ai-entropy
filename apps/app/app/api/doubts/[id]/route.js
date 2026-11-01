import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError, toList } from "@/lib/http"
import { authorSelect, toPublicDoubt } from "@/lib/qa"

export const dynamic = "force-dynamic"

const updateSchema = z.object({
  title: z.string().trim().min(8).max(200).optional(),
  content: z.string().trim().min(20).max(10000).optional(),
  subject: z.string().trim().max(40).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
})

// GET /api/doubts/:id   Public. Counts a view.
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    const viewerId = session?.user?.id || null

    const doubt = await prisma.doubt
      .update({
        where: { id: params.id },
        data: { views: { increment: 1 } },
        include: {
          author: { select: authorSelect },
          _count: { select: { answers: true } },
        },
      })
      .catch(() => null)
    if (!doubt) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    return NextResponse.json(toPublicDoubt(doubt, { viewerId }))
  } catch (err) {
    return serverError("DOUBT_GET", err)
  }
}

// PATCH /api/doubts/:id   Only the author can edit.
export async function PATCH(req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, updateSchema)
    if (response) return response

    const existing = await prisma.doubt.findUnique({ where: { id: params.id }, select: { authorId: true } })
    if (!existing) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    if (existing.authorId !== auth.userId) {
      return NextResponse.json({ error: "Only the author can edit this question" }, { status: 403 })
    }

    const update = { ...data }
    if (data.tags !== undefined) update.tags = toList(data.tags, { max: 5, itemMax: 30 })
    const doubt = await prisma.doubt.update({
      where: { id: params.id },
      data: update,
      select: { id: true, title: true, content: true, subject: true, tags: true },
    })
    return NextResponse.json(doubt)
  } catch (err) {
    return serverError("DOUBT_PATCH", err)
  }
}

// DELETE /api/doubts/:id   Only the author can delete (answers and votes cascade).
export async function DELETE(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const existing = await prisma.doubt.findUnique({ where: { id: params.id }, select: { authorId: true } })
    if (!existing) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    if (existing.authorId !== auth.userId) {
      return NextResponse.json({ error: "Only the author can delete this question" }, { status: 403 })
    }
    await prisma.doubt.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError("DOUBT_DELETE", err)
  }
}
