import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError } from "@/lib/http"

const schema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "CANCELLED"]),
  mentorNote: z.string().trim().max(500).optional(),
})

// PATCH /api/mentorship/requests/:id
//   mentor:  PENDING -> ACCEPTED | DECLINED (optional note)
//   student: PENDING -> CANCELLED
export async function PATCH(req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, schema)
    if (response) return response

    const request = await prisma.mentorshipRequest.findUnique({
      where: { id: params.id },
      include: { mentor: { select: { userId: true } } },
    })
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    const isMentor = request.mentor.userId === auth.userId
    const isStudent = request.studentId === auth.userId
    if (!isMentor && !isStudent) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    if (request.status !== "PENDING") {
      return NextResponse.json({ error: `This request is already ${request.status.toLowerCase()}` }, { status: 409 })
    }
    if (data.status === "CANCELLED" && !isStudent) {
      return NextResponse.json({ error: "Only the student can cancel" }, { status: 403 })
    }
    if (data.status !== "CANCELLED" && !isMentor) {
      return NextResponse.json({ error: "Only the mentor can accept or decline" }, { status: 403 })
    }

    const updated = await prisma.mentorshipRequest.update({
      where: { id: request.id },
      data: { status: data.status, mentorNote: isMentor ? data.mentorNote || null : undefined },
    })
    return NextResponse.json({ request: updated })
  } catch (err) {
    return serverError("MENTORSHIP_REQUEST_UPDATE", err)
  }
}
