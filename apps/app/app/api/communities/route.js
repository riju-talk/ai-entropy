import { NextResponse } from "next/server"

import { currentUser, HttpError, intParam, readJson, route } from "@/lib/api"
import { slugify } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const SUBJECTS = ["COMPUTER_SCIENCE", "MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY", "ENGINEERING", "BUSINESS", "LITERATURE", "HISTORY", "PSYCHOLOGY"]

/** GET /api/communities?sort=popular|new&q=&limit= -> array of communities with member counts and the viewer's membership. */
export const GET = route(async (req) => {
  const url = new URL(req.url)
  const limit = intParam(url, "limit", 20, { max: 100 })
  const sort = url.searchParams.get("sort") === "new" ? "new" : "popular"
  const q = (url.searchParams.get("q") || "").trim()
  const user = await currentUser()

  const rows = await prisma.community.findMany({
    where: {
      isPublic: true,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, slug: true, name: true, description: true, subject: true, createdAt: true },
  })
  const ids = rows.map((c) => c.id)
  const [counts, mine] = await Promise.all([
    prisma.communityMember.groupBy({ by: ["communityId"], where: { communityId: { in: ids } }, _count: { _all: true } }),
    user ? prisma.communityMember.findMany({ where: { userId: user.id, communityId: { in: ids } }, select: { communityId: true, role: true } }) : [],
  ])
  const countOf = new Map(counts.map((c) => [c.communityId, c._count._all]))
  const roleOf = new Map(mine.map((m) => [m.communityId, m.role]))

  const out = rows.map((c) => ({ ...c, memberCount: countOf.get(c.id) ?? 0, isMember: roleOf.has(c.id), role: roleOf.get(c.id) ?? null }))
  if (sort === "popular") out.sort((a, b) => b.memberCount - a.memberCount)
  return NextResponse.json(out.slice(0, limit))
})

export const POST = route(async (req) => {
  const user = await currentUser({ required: true })
  const body = await readJson(req)

  const name = String(body.name || "").trim()
  if (name.length < 3 || name.length > 40) throw new HttpError(400, "Name must be 3-40 characters")
  const slug = slugify(body.slug || name)
  if (slug.length < 3) throw new HttpError(400, "Pick a name with at least 3 letters or digits")
  const rules = (Array.isArray(body.rules) ? body.rules : []).map((r) => String(r).trim().slice(0, 200)).filter(Boolean).slice(0, 8)
  const subject = SUBJECTS.includes(body.subject) ? body.subject : null

  if (await prisma.community.findUnique({ where: { slug }, select: { id: true } })) {
    throw new HttpError(409, `A community called "${slug}" already exists`)
  }

  const community = await prisma.$transaction(async (tx) => {
    const c = await tx.community.create({
      data: {
        slug,
        name,
        description: String(body.description || "").trim().slice(0, 500),
        subject,
        rules,
        isPublic: body.isPublic !== false,
        createdBy: user.id,
      },
    })
    await tx.communityMember.create({ data: { userId: user.id, communityId: c.id, role: "ADMIN" } })
    return c
  })
  return NextResponse.json({ community }, { status: 201 })
})
