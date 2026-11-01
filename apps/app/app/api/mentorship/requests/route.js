import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { serverError } from "@/lib/http"

export const dynamic = "force-dynamic"

// GET /api/mentorship/requests -> { isMentor, sent, received }
export async function GET() {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const mentor = await prisma.mentorProfile.findUnique({ where: { userId: auth.userId }, select: { id: true } })

    const [sent, received] = await Promise.all([
      prisma.mentorshipRequest.findMany({
        where: { studentId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { mentor: { include: { user: { select: { name: true, image: true } } } } },
      }),
      mentor
        ? prisma.mentorshipRequest.findMany({
            where: { mentorId: mentor.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { student: { select: { name: true, image: true } } },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      isMentor: Boolean(mentor),
      sent: sent.map((r) => ({
        id: r.id,
        topic: r.topic,
        message: r.message,
        preferredTime: r.preferredTime,
        status: r.status,
        mentorNote: r.mentorNote,
        createdAt: r.createdAt,
        mentorName: r.mentor.user.name || "Mentor",
        mentorHeadline: r.mentor.headline,
      })),
      received: received.map((r) => ({
        id: r.id,
        topic: r.topic,
        message: r.message,
        preferredTime: r.preferredTime,
        status: r.status,
        mentorNote: r.mentorNote,
        createdAt: r.createdAt,
        studentName: r.student.name || "Student",
      })),
    })
  } catch (err) {
    return serverError("MENTORSHIP_REQUESTS", err)
  }
}
