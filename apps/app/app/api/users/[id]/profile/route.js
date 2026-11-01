import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serverError } from "@/lib/http"
import { excerpt } from "@/lib/qa"

export const dynamic = "force-dynamic"

const HEATMAP_DAYS = 182 // 26 weeks

function dayKey(d) {
  return d.toISOString().slice(0, 10)
}

// GET /api/users/:id/profile
// Public profile with engagement metrics. Email, anonymous questions and per-topic study time are
// only included for the owner; everyone else sees what the person chose to do in public.
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    const viewerId = session?.user?.id || null
    const id = params.id
    const isSelf = viewerId === id

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        email: isSelf,
        bio: true,
        university: true,
        course: true,
        year: true,
        reputation: true,
        totalXP: true,
        tier: true,
        createdAt: true,
        isSuspended: true,
      },
    })
    if (!user || user.isSuspended) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    const publicDoubt = isSelf ? {} : { isAnonymous: false }
    const since = new Date(Date.now() - HEATMAP_DAYS * 24 * 60 * 60 * 1000)

    const [
      questions,
      answers,
      acceptedAnswers,
      doubtVotes,
      answerVotes,
      resolvedQuestions,
      streak,
      learner,
      mentor,
      hosted,
      attended,
      memberships,
      unlocks,
      unlockCount,
      recentQuestions,
      recentAnswers,
      actDoubts,
      actAnswers,
      actSessions,
      actRsvps,
    ] = await Promise.all([
      prisma.doubt.count({ where: { authorId: id, ...publicDoubt } }),
      prisma.answer.count({ where: { authorId: id } }),
      prisma.answer.count({ where: { authorId: id, isAccepted: true } }),
      prisma.doubt.aggregate({ where: { authorId: id, ...publicDoubt }, _sum: { upvotes: true } }),
      prisma.answer.aggregate({ where: { authorId: id }, _sum: { upvotes: true } }),
      prisma.doubt.count({ where: { authorId: id, isResolved: true, ...publicDoubt } }),
      prisma.streak.findUnique({ where: { userId: id } }),
      prisma.learnerProfile.findUnique({ where: { userId: id } }),
      prisma.mentorProfile.findUnique({
        where: { userId: id },
        select: {
          id: true,
          headline: true,
          subjects: true,
          isActive: true,
          _count: { select: { requests: { where: { status: "ACCEPTED" } } } },
        },
      }),
      prisma.campusEvent.count({ where: { createdById: id } }),
      prisma.eventRsvp.count({ where: { userId: id } }),
      prisma.communityMember.findMany({ where: { userId: id }, select: { communityId: true, role: true }, take: 12 }),
      prisma.achievementUnlock.findMany({
        where: { userId: id },
        orderBy: { unlockedAt: "desc" },
        take: 8,
        select: { unlockedAt: true, achievement: { select: { name: true, description: true, rarity: true } } },
      }),
      prisma.achievementUnlock.count({ where: { userId: id } }),
      prisma.doubt.findMany({
        where: { authorId: id, ...publicDoubt },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          createdAt: true,
          isResolved: true,
          isAnonymous: true,
          upvotes: true,
          _count: { select: { answers: true } },
        },
      }),
      prisma.answer.findMany({
        where: { authorId: id, ...(isSelf ? {} : { doubt: { isAnonymous: false } }) },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          content: true,
          createdAt: true,
          isAccepted: true,
          upvotes: true,
          doubt: { select: { id: true, title: true } },
        },
      }),
      prisma.doubt.findMany({ where: { authorId: id, createdAt: { gte: since }, ...publicDoubt }, select: { createdAt: true }, take: 2000 }),
      prisma.answer.findMany({ where: { authorId: id, createdAt: { gte: since } }, select: { createdAt: true }, take: 2000 }),
      prisma.studySession.findMany({ where: { userId: id, startedAt: { gte: since } }, select: { startedAt: true }, take: 2000 }),
      prisma.eventRsvp.findMany({ where: { userId: id, createdAt: { gte: since } }, select: { createdAt: true }, take: 2000 }),
    ])

    const communityRows = memberships.length
      ? await prisma.community.findMany({
          where: { id: { in: memberships.map((m) => m.communityId) } },
          select: { id: true, name: true },
        })
      : []

    // Contribution heatmap: one cell per day for the last 26 weeks.
    const counts = {}
    for (const rows of [
      actDoubts.map((r) => r.createdAt),
      actAnswers.map((r) => r.createdAt),
      actSessions.map((r) => r.startedAt),
      actRsvps.map((r) => r.createdAt),
    ]) {
      for (const d of rows) counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1
    }
    const activity = []
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      activity.push({ date: dayKey(d), count: counts[dayKey(d)] || 0 })
    }
    const activeDays = activity.filter((a) => a.count > 0).length

    const upvotesReceived = (doubtVotes._sum.upvotes || 0) + (answerVotes._sum.upvotes || 0)

    return NextResponse.json({
      isSelf,
      user,
      engagement: {
        questions,
        answers,
        acceptedAnswers,
        resolvedQuestions,
        upvotesReceived,
        currentStreak: streak?.currentStreak || 0,
        longestStreak: streak?.longestStreak || 0,
        activeDays,
        focusSeconds: learner?.totalFocusSeconds || 0,
        focusSessions: learner?.sessionsCompleted || 0,
        eventsHosted: hosted,
        eventsJoined: attended,
        mentorSessions: mentor?._count.requests || 0,
        achievements: unlockCount,
      },
      topics: isSelf && learner?.topicSeconds ? learner.topicSeconds : null,
      mentor: mentor && mentor.isActive ? { id: mentor.id, headline: mentor.headline, subjects: mentor.subjects } : null,
      communities: communityRows,
      achievements: unlocks.map((u) => ({ ...u.achievement, unlockedAt: u.unlockedAt })),
      recentQuestions,
      recentAnswers: recentAnswers.map((a) => ({ ...a, content: excerpt(a.content, 200) })),
      activity,
    })
  } catch (err) {
    return serverError("USER_PROFILE", err)
  }
}
