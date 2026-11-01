import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { serverError } from "@/lib/http"

// POST /api/events/:id/rsvp   Join an event (idempotent; respects capacity and past events).
export async function POST(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.campusEvent.findUnique({
        where: { id: params.id },
        include: { _count: { select: { rsvps: true } } },
      })
      if (!event) return { status: 404, error: "Event not found" }
      if (event.startsAt.getTime() < Date.now()) return { status: 409, error: "This event has already started" }

      const already = await tx.eventRsvp.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: auth.userId } },
      })
      if (already) return { status: 200, attendees: event._count.rsvps }
      if (event.capacity != null && event._count.rsvps >= event.capacity) {
        return { status: 409, error: "This event is full" }
      }
      await tx.eventRsvp.create({ data: { eventId: event.id, userId: auth.userId } })
      return { status: 201, attendees: event._count.rsvps + 1 }
    })

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ rsvped: true, attendees: result.attendees }, { status: result.status })
  } catch (err) {
    return serverError("EVENT_RSVP", err)
  }
}

// DELETE /api/events/:id/rsvp   Leave an event.
export async function DELETE(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    await prisma.eventRsvp.deleteMany({ where: { eventId: params.id, userId: auth.userId } })
    const attendees = await prisma.eventRsvp.count({ where: { eventId: params.id } })
    return NextResponse.json({ rsvped: false, attendees })
  } catch (err) {
    return serverError("EVENT_RSVP", err)
  }
}
