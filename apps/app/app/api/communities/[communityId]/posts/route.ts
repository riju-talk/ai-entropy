import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { awardCredits } from "@/app/actions/credits"

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    // Support pagination via query params: ?limit=&page=
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5", 10) || 5, 50)
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
    const skip = (page - 1) * limit

    // Step 1: Get all doubtIds linked to this community
    const communityDoubts = await getPrisma().communityDoubt.findMany({
      where: { communityId: params.communityId },
      select: { doubtId: true },
      orderBy: { id: "asc" }
    })

    const doubtIds = communityDoubts.map(cd => cd.doubtId)

    const total = doubtIds.length
    if (total === 0) {
      return NextResponse.json({ posts: [], total: 0, page, totalPages: 0, hasMore: false })
    }

    // Step 3: Fetch the actual doubts (paged)
    const posts = await getPrisma().doubt.findMany({
      where: {
        id: { in: doubtIds },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        _count: {
          select: { 
            answers: true,
            votes: true 
          }
        },
      },
    })

    // Step 4: Update isInCommunity flag for these doubts if needed (best-effort)
    const postsToUpdate = posts.filter((p: any) => !p.isInCommunity).map((p: any) => p.id)
    if (postsToUpdate.length > 0) {
      await getPrisma().doubt.updateMany({
        where: { id: { in: postsToUpdate } },
        data: { isInCommunity: true }
      })
    }

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    return NextResponse.json({
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        author: post.author,
        createdAt: post.createdAt,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        commentCount: post._count.answers,
        isLiked: false,
      })),
      total,
      page,
      totalPages,
      hasMore
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true, credits: true, name: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { title, content, subject } = await req.json()

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      )
    }

    // Verify community exists
    const community = await getPrisma().community.findUnique({
      where: { id: params.communityId },
      select: { id: true, name: true }
    })

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 })
    }

    console.log(`[POST] Creating doubt for community ${params.communityId}`)

    // Create doubt WITH isInCommunity flag set to true
    const post = await getPrisma().doubt.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        subject: subject || "OTHER",
        authorId: user.id,
        tags: [],
        isInCommunity: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    console.log(`[POST] Created doubt ${post.id}`)

    // Link to community via junction table
    await getPrisma().communityDoubt.create({
      data: {
        communityId: params.communityId,
        doubtId: post.id,
        addedBy: user.id
      }
    })

    console.log(`[POST] Linked doubt ${post.id} to community ${params.communityId}`)

    // Award 1 credit
    try {
      await awardCredits(
        user.id, 
        "DOUBT_CREATED", 
        1, 
        `Posted in ${community.name}: ${title.substring(0, 50)}`
      )
      console.log(`[POST] Awarded 1 credit to user ${user.id}`)
    } catch (creditError) {
      console.error("Failed to award credits:", creditError)
    }

    return NextResponse.json({ 
      post,
      message: "Post created successfully! You earned 1 credit."
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating post:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
