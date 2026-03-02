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

    const existingVote = await getPrisma().doubtVote.findUnique({
      where: {
        userId_doubtId: {
          userId: user.id,
          doubtId: params.id,
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

    const doubtId = params.id
    const { type } = await req.json()

    if (!["UP", "DOWN"].includes(type)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 })
    }

    const doubt = await getPrisma().doubt.findUnique({
      where: { id: doubtId },
      select: { id: true }
    })

    if (!doubt) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Use a transaction to handle vote logic atomically
    const result = await getPrisma().$transaction(async (tx) => {
      // Get existing vote within transaction
      const existingVote = await tx.doubtVote.findUnique({
        where: {
          userId_doubtId: {
            userId: user.id,
            doubtId,
          },
        },
      })

      if (existingVote) {
        if (existingVote.type === type) {
          // User clicked same vote again - remove it
          await tx.doubtVote.delete({
            where: { id: existingVote.id },
          })
          
          await tx.doubt.update({
            where: { id: doubtId },
            data: {
              [type === "UP" ? "upvotes" : "downvotes"]: {
                decrement: 1
              }
            }
          })
        } else {
          // User is changing vote from UP to DOWN or vice versa
          await tx.doubtVote.update({
            where: { id: existingVote.id },
            data: { type },
          })
          
          // Decrement old vote type, increment new vote type
          await tx.doubt.update({
            where: { id: doubtId },
            data: {
              upvotes: existingVote.type === "UP" ? { decrement: 1 } : { increment: 1 },
              downvotes: existingVote.type === "DOWN" ? { decrement: 1 } : { increment: 1 },
            }
          })
        }
      } else {
        // Create new vote
        try {
          await tx.doubtVote.create({
            data: {
              userId: user.id,
              doubtId,
              type,
            },
          })
          
          await tx.doubt.update({
            where: { id: doubtId },
            data: {
              [type === "UP" ? "upvotes" : "downvotes"]: {
                increment: 1
              }
            }
          })
        } catch (error: any) {
          // Handle unique constraint error
          if (error.code === 'P2002') {
            throw new Error('Vote already exists')
          }
          throw error
        }
      }

      // Return updated counts
      const updatedDoubt = await tx.doubt.findUnique({
        where: { id: doubtId },
        select: { upvotes: true, downvotes: true }
      })

      return updatedDoubt
    })

    console.log(`Vote updated for doubt ${doubtId}:`, {
      type,
      upvotes: result?.upvotes,
      downvotes: result?.downvotes,
    })

    return NextResponse.json({ 
      success: true, 
      upvotes: result?.upvotes || 0,
      downvotes: result?.downvotes || 0,
    })
  } catch (error: any) {
    console.error("Error voting on doubt:", error)
    
    if (error.message === 'Vote already exists') {
      return NextResponse.json(
        { error: "You have already voted on this question" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { 
        error: "Failed to register vote",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
