import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError, toList } from "@/lib/http"

export const dynamic = "force-dynamic"

const updateSchema = z.object({
  headline: z.string().trim().min(5).max(120).optional(),
  bio: z.string().trim().min(20).max(1500).optional(),
  university: z.string().trim().max(120).optional(),
  subjects: z.union([z.string(), z.array(z.string())]).optional(),
  expertise: z.union([z.string(), z.array(z.string())]).optional(),
  availability: z.string().trim().min(3).max(200).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/mentors/me -> the caller's mentor profile (or { mentor: null })
export async function GET() {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const mentor = await prisma.mentorProfile.findUnique({ where: { userId: auth.userId } })
    return NextResponse.json({ mentor })
  } catch (err) {
    return serverError("MENTORS_ME", err)
  }
}

// PATCH /api/mentors/me -> edit profile, or pause/resume with { isActive }
export async function PATCH(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, updateSchema)
    if (response) return response

    const existing = await prisma.mentorProfile.findUnique({ where: { userId: auth.userId } })
    if (!existing) return NextResponse.json({ error: "Register as a mentor first" }, { status: 404 })

    const update = { ...data }
    if (data.subjects !== undefined) update.subjects = toList(data.subjects, { max: 8 })
    if (data.expertise !== undefined) update.expertise = toList(data.expertise, { max: 12 })
    if (data.university !== undefined) update.university = data.university || null
    if ((update.subjects && !update.subjects.length) || (update.expertise && !update.expertise.length)) {
      return NextResponse.json({ error: "Subjects and expertise cannot be empty" }, { status: 400 })
    }

    const mentor = await prisma.mentorProfile.update({ where: { userId: auth.userId }, data: update })
    return NextResponse.json({ mentor })
  } catch (err) {
    return serverError("MENTORS_ME", err)
  }
}
