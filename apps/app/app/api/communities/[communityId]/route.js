import { NextResponse } from "next/server"

import { currentUser, HttpError, readJson, route } from "@/lib/api"
import { findCommunity, isMod, membershipOf } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const GET = route(async (_req, { params }) => {
  const user = await currentUser()
  const c = await findCommunity(params.communityId)
  const [memberCount, membership, mods, postCount] = await Promise.all([
    prisma.communityMember.count({ where: { communityId: c.id } }),
    membershipOf(user?.id, c.id),
    prisma.communityMember.findMany({
      where: { communityId: c.id, role: { in: ["ADMIN", "MODERATOR"] } },
      select: { role: true, user: { select: { id: true, name: true, image: true } } },
      take: 10,
    }),
    prisma.post.count({ where: { communityId: c.id, isRemoved: false } }),
  ])
  return NextResponse.json({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    subject: c.subject,
    rules: c.rules,
    isPublic: c.isPublic,
    createdAt: c.createdAt,
    memberCount,
    postCount,
    isMember: !!membership,
    role: membership?.role ?? null,
    moderators: mods.map((m) => ({ ...m.user, role: m.role })),
  })
})

/** Moderators can edit the description and rules. */
export const PATCH = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  if (!isMod(await membershipOf(user.id, c.id))) throw new HttpError(403, "Only moderators can edit this community")
  const body = await readJson(req)
  const data = {}
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500)
  if (Array.isArray(body.rules)) data.rules = body.rules.map((r) => String(r).trim().slice(0, 200)).filter(Boolean).slice(0, 8)
  const updated = await prisma.community.update({ where: { id: c.id }, data })
  return NextResponse.json({ community: updated })
})

/** Only an admin can delete a community. Posts, comments and votes go with it (cascade); memberships are cleared here. */
export const DELETE = route(async (_req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  const m = await membershipOf(user.id, c.id)
  if (m?.role !== "ADMIN") throw new HttpError(403, "Only a community admin can delete it")
  await prisma.$transaction([
    prisma.communityMember.deleteMany({ where: { communityId: c.id } }),
    prisma.communityDoubt.deleteMany({ where: { communityId: c.id } }),
    prisma.community.delete({ where: { id: c.id } }),
  ])
  return NextResponse.json({ deleted: true })
})
