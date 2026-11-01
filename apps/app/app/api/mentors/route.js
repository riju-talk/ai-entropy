import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError, toList } from "@/lib/http"

export const dynamic = "force-dynamic"

const profileSchema = z.object({
  headline: z.string().trim().min(5, "at least 5 characters").max(120),
  bio: z.string().trim().min(20, "tell students a bit more (20+ characters)").max(1500),
  university: z.string().trim().max(120).optional().default(""),
  subjects: z.union([z.string(), z.array(z.string())]),
  expertise: z.union([z.string(), z.array(z.string())]),
  availability: z.string().trim().min(3, "required").max(200),
})

// GET /api/mentors?q=&subject=   Public list of active mentors.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") || "").trim().slice(0, 100)
    const subject = (searchParams.get("subject") || "").trim().slice(0, 40)

    const where = { isActive: true }
    const and = []
    if (subject) and.push({ subjects: { has: subject } })
    if (q) {
      and.push({
        OR: [
          { headline: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
          { university: { contains: q, mode: "insensitive" } },
          { expertise: { hasSome: [q] } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      })
    }
    if (and.length) where.AND = and

    const mentors = await prisma.mentorProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        user: { select: { id: true, name: true, image: true } },
        _count: { select: { requests: { where: { status: "ACCEPTED" } } } },
      },
    })

    const all = await prisma.mentorProfile.findMany({ where: { isActive: true }, select: { subjects: true } })
    const subjects = [...new Set(all.flatMap((m) => m.subjects))].sort()

    return NextResponse.json({
      subjects,
      mentors: mentors.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name || "Mentor",
        image: m.user.image,
        headline: m.headline,
        bio: m.bio,
        university: m.university,
        subjects: m.subjects,
        expertise: m.expertise,
        availability: m.availability,
        acceptedSessions: m._count.requests,
      })),
    })
  } catch (err) {
    return serverError("MENTORS", err)
  }
}

// POST /api/mentors   Register the signed-in user as a mentor (one profile per user).
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, profileSchema)
    if (response) return response

    const existing = await prisma.mentorProfile.findUnique({ where: { userId: auth.userId } })
    if (existing) {
      return NextResponse.json({ error: "You are already registered as a mentor" }, { status: 409 })
    }
    const subjects = toList(data.subjects, { max: 8 })
    const expertise = toList(data.expertise, { max: 12 })
    if (!subjects.length || !expertise.length) {
      return NextResponse.json({ error: "Add at least one subject and one area of expertise" }, { status: 400 })
    }

    const profile = await prisma.mentorProfile.create({
      data: {
        userId: auth.userId,
        headline: data.headline,
        bio: data.bio,
        university: data.university || null,
        subjects,
        expertise,
        availability: data.availability,
      },
    })
    return NextResponse.json({ mentor: profile }, { status: 201 })
  } catch (err) {
    return serverError("MENTORS", err)
  }
}
