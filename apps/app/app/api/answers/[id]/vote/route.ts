import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ userVote: null })
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ userVote: null })
    }

    const existingVote = await getPrisma().answerVote.findUnique({
      where: {
        userId_answerId: {
          userId: user.id,
          answerId: params.id,
        },
      },
    })

    return NextResponse.json({ userVote: existingVote?.type || null })
  } catch (error) {
    console.error("Error fetching user vote:", error)
    return NextResponse.json({ userVote: null })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const answerId = params.id
    const { type } = await req.json()

    if (!["UP", "DOWN"].includes(type)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 })
    }

    const answer = await getPrisma().answer.findUnique({
      where: { id: answerId },
      select: { id: true }
    })

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 })
    }

    // Use a transaction to handle vote logic atomically
    const result = await getPrisma().$transaction(async (tx) => {
      const existingVote = await tx.answerVote.findUnique({
        where: {
          userId_answerId: {
            userId: user.id,
            answerId,
          },
        },
      })

      if (existingVote) {
        if (existingVote.type === type) {
          // Remove vote
          await tx.answerVote.delete({
            where: { id: existingVote.id },
          })
        } else {
          // Change vote type
          await tx.answerVote.update({
            where: { id: existingVote.id },
            data: { type },
          })
        }
      } else {
        // Create new vote
        try {
          await tx.answerVote.create({
            data: {
              userId: user.id,
              answerId,
              type,
            },
          })
        } catch (error: any) {
          if (error.code === 'P2002') {
            throw new Error('Vote already exists')
          }
          throw error
        }
      }

      // Count votes for this answer
      const [upvotes, downvotes] = await Promise.all([
        tx.answerVote.count({
          where: { answerId, type: "UP" }
        }),
        tx.answerVote.count({
          where: { answerId, type: "DOWN" }
        })
      ])

      return { upvotes, downvotes }
    })

    return NextResponse.json({ 
      success: true, 
      upvotes: result.upvotes,
      downvotes: result.downvotes,
    })
  } catch (error: any) {
    console.error("Error voting on answer:", error)
    
    if (error.message === 'Vote already exists') {
      return NextResponse.json(
        { error: "You have already voted on this answer" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to register vote" },
      { status: 500 }
    )
  }
}
