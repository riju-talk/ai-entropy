import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function POST(
  req: NextRequest,
  { params }: { params: { communityId: string; postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user already voted
    const existingVote = await prisma.doubtVote.findUnique({
      where: {
        userId_doubtId: {
          userId: user.id,
          doubtId: params.postId
        }
      }
    })

    if (existingVote) {
      // Remove vote (unlike)
      await prisma.doubtVote.delete({
        where: { id: existingVote.id }
      })
    } else {
      // Add upvote
      await prisma.doubtVote.create({
        data: {
          userId: user.id,
          doubtId: params.postId,
          type: "UP"
        }
      })
    }

    // Recalculate vote counts
    const votes = await prisma.doubtVote.groupBy({
      by: ["type"],
      where: { doubtId: params.postId },
      _count: true
    })

    const upvotes = votes.find(v => v.type === "UP")?._count ?? 0
    const downvotes = votes.find(v => v.type === "DOWN")?._count ?? 0

    await prisma.doubt.update({
      where: { id: params.postId },
      data: { upvotes, downvotes }
    })

    return NextResponse.json({ success: true, upvotes, downvotes })

  } catch (error) {
    console.error("Error toggling like:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
