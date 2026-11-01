import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"

import { QuestionThread, type QuestionData } from "@/components/question-thread"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authorSelect, excerpt } from "@/lib/qa"

export const dynamic = "force-dynamic"

async function getQuestion(id: string, viewerId: string | null): Promise<QuestionData | null> {
  const doubt = await prisma.doubt.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      subject: true,
      tags: true,
      isAnonymous: true,
      isResolved: true,
      views: true,
      upvotes: true,
      downvotes: true,
      createdAt: true,
      authorId: true,
      author: { select: { ...authorSelect, reputation: true } },
    },
  })
  if (!doubt) return null

  const isMine = viewerId !== null && doubt.authorId === viewerId
  const vote = viewerId
    ? await prisma.doubtVote.findUnique({ where: { userId_doubtId: { userId: viewerId, doubtId: id } }, select: { type: true } })
    : null

  // Count the view in the background; a failure must not break the page.
  prisma.doubt.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {})

  const { authorId, author, ...rest } = doubt
  return JSON.parse(
    JSON.stringify({
      ...rest,
      author: doubt.isAnonymous && !isMine ? null : author,
      isMine,
      viewerVote: vote?.type ?? null,
    }),
  )
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await prisma.doubt.findUnique({ where: { id: params.id }, select: { title: true, content: true } }).catch(() => null)
  return d ? { title: d.title, description: excerpt(d.content, 160) } : { title: "Question not found" }
}

export default async function QuestionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const viewerId = (session?.user as { id?: string } | undefined)?.id ?? null
  const question = await getQuestion(params.id, viewerId)
  if (!question) notFound()
  return <QuestionThread question={question} viewerId={viewerId} />
}
