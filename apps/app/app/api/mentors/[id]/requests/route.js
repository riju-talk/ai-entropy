import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError } from "@/lib/http"

const requestSchema = z.object({
  topic: z.string().trim().min(3, "at least 3 characters").max(120),
  message: z.string().trim().min(10, "tell the mentor what you need (10+ characters)").max(1000),
  preferredTime: z.string().trim().max(120).optional().default(""),
})

// POST /api/mentors/:id/requests -> ask a mentor for a session
export async function POST(req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, requestSchema)
    if (response) return response

    const mentor = await prisma.mentorProfile.findUnique({ where: { id: params.id } })
    if (!mentor || !mentor.isActive) {
      return NextResponse.json({ error: "Mentor not found or not accepting requests" }, { status: 404 })
    }
    if (mentor.userId === auth.userId) {
      return NextResponse.json({ error: "You cannot request a session with yourself" }, { status: 400 })
    }
    const pending = await prisma.mentorshipRequest.findFirst({
      where: { mentorId: mentor.id, studentId: auth.userId, status: "PENDING" },
    })
    if (pending) {
      return NextResponse.json({ error: "You already have a pending request with this mentor" }, { status: 409 })
    }

    const created = await prisma.mentorshipRequest.create({
      data: {
        mentorId: mentor.id,
        studentId: auth.userId,
        topic: data.topic,
        message: data.message,
        preferredTime: data.preferredTime || null,
      },
    })
    return NextResponse.json({ request: created }, { status: 201 })
  } catch (err) {
    return serverError("MENTOR_REQUEST", err)
  }
}
