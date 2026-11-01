import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError, toList } from "@/lib/http"

export const dynamic = "force-dynamic"

const CATEGORIES = ["WORKSHOP", "CONFERENCE", "MEETUP", "HACKATHON", "SEMINAR", "OTHER"]

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "at least 3 characters").max(120),
    description: z.string().trim().min(10, "describe the event (10+ characters)").max(2000),
    category: z.enum(CATEGORIES).default("OTHER"),
    location: z.string().trim().min(2, "required").max(160),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    capacity: z.coerce.number().int().min(1).max(100000).optional().nullable(),
    tags: z.union([z.string(), z.array(z.string())]).optional().default(""),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, { message: "must be after the start time", path: ["endsAt"] })

// GET /api/events?past=1&category=WORKSHOP   Public. Upcoming by default; adds `rsvped` when signed in.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const past = searchParams.get("past") === "1"
    const category = searchParams.get("category")
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null

    const now = new Date()
    const where = past ? { startsAt: { lt: now } } : { startsAt: { gte: now } }
    if (category && CATEGORIES.includes(category)) where.category = category

    const events = await prisma.campusEvent.findMany({
      where,
      orderBy: { startsAt: past ? "desc" : "asc" },
      take: 60,
      include: {
        creator: { select: { name: true } },
        _count: { select: { rsvps: true } },
        rsvps: userId ? { where: { userId }, select: { id: true } } : false,
      },
    })

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        capacity: e.capacity,
        tags: e.tags,
        hostName: e.creator.name || "Organizer",
        attendees: e._count.rsvps,
        isFull: e.capacity != null && e._count.rsvps >= e.capacity,
        rsvped: Array.isArray(e.rsvps) && e.rsvps.length > 0,
        isHost: userId === e.createdById,
      })),
    })
  } catch (err) {
    return serverError("EVENTS", err)
  }
}

// POST /api/events   Any signed-in user can host an event.
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, eventSchema)
    if (response) return response

    if (data.startsAt.getTime() < Date.now() - 60 * 60 * 1000) {
      return NextResponse.json({ error: "startsAt: the event must be in the future" }, { status: 400 })
    }

    const event = await prisma.campusEvent.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        startsAt: data.startsAt,
        endsAt: data.endsAt || null,
        capacity: data.capacity || null,
        tags: toList(data.tags, { max: 6 }),
        createdById: auth.userId,
      },
    })
    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    return serverError("EVENTS", err)
  }
}
