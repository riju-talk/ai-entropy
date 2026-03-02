import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(
  req: NextRequest,
  { params }: { params: { communityId: string; postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Support pagination: ?limit=&page=
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "7", 10) || 7, 100)
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
    const skip = (page - 1) * limit

    const total = await prisma.answer.count({ where: { doubtId: params.postId } })

    const comments = await prisma.answer.findMany({
      where: { doubtId: params.postId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        _count: {
          select: { votes: true }
        }
      },
      skip,
      take: limit
    })

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    return NextResponse.json({
      comments: comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        author: comment.author,
        createdAt: comment.createdAt,
        likes: comment._count.votes,
        isLiked: false
      })),
      total,
      page,
      totalPages,
      hasMore
    })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const { content } = await req.json()

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      )
    }

    // Verify doubt exists and is linked to this community
    const communityDoubt = await prisma.communityDoubt.findFirst({
      where: {
        communityId: params.communityId,
        doubtId: params.postId
      }
    })

    if (!communityDoubt) {
      return NextResponse.json({ error: "Post not found in this community" }, { status: 404 })
    }

    // Create answer (comment)
    const comment = await prisma.answer.create({
      data: {
        content: content.trim(),
        doubtId: params.postId,
        authorId: user.id
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        author: comment.author,
        createdAt: comment.createdAt,
        likes: 0,
        isLiked: false
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
