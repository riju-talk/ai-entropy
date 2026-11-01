import { NextResponse } from "next/server"

import { currentUser, HttpError, route } from "@/lib/api"
import { findCommunity, membershipOf } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function summary(communityId, userId) {
  const [memberCount, m] = await Promise.all([prisma.communityMember.count({ where: { communityId } }), membershipOf(userId, communityId)])
  return { isMember: !!m, role: m?.role ?? null, memberCount }
}

export const GET = route(async (_req, { params }) => {
  const user = await currentUser()
  const c = await findCommunity(params.communityId)
  return NextResponse.json(await summary(c.id, user?.id))
})

/** Join. Idempotent. */
export const POST = route(async (_req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  await prisma.communityMember.upsert({
    where: { userId_communityId: { userId: user.id, communityId: c.id } },
    update: {},
    create: { userId: user.id, communityId: c.id, role: "MEMBER" },
  })
  return NextResponse.json(await summary(c.id, user.id))
})

/** Leave. The last admin cannot leave, otherwise the community would have no one in charge. */
export const DELETE = route(async (_req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  const m = await membershipOf(user.id, c.id)
  if (m?.role === "ADMIN") {
    const admins = await prisma.communityMember.count({ where: { communityId: c.id, role: "ADMIN" } })
    if (admins <= 1) throw new HttpError(409, "You are the only admin. Promote someone else before leaving.")
  }
  await prisma.communityMember.deleteMany({ where: { userId: user.id, communityId: c.id } })
  return NextResponse.json(await summary(c.id, user.id))
})
