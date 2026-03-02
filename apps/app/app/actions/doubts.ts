"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { createDoubtSchema, voteSchema } from "@/lib/validations"
import { awardCredits } from "./credits"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

export async function createDoubt(formData: FormData) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id && formData.get("isAnonymous") !== "true") {
    throw new Error("Authentication required")
  }

  const data = {
    title: formData.get("title") as string,
    content: formData.get("content") as string,
    subject: formData.get("subject") as string,
    tags: JSON.parse((formData.get("tags") as string) || "[]"),
    isAnonymous: formData.get("isAnonymous") === "true",
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    communityId: (formData.get("communityId") as string) || undefined,
  }

  const validatedData = createDoubtSchema.parse(data)

  const doubt = await getPrisma().doubt.create({
    data: {
      ...validatedData,
      subject: validatedData.subject as any,
      authorId: validatedData.isAnonymous ? null : (session as any)?.user?.id,
    },
  })

  // Award 1 credit for asking doubt (WORKS FOR BOTH GENERAL & COMMUNITY)
  if (session?.user?.id) {
    await awardCredits(
      session.user.id,
      "DOUBT_CREATED",
      1,
      `Asked: ${doubt.title}`,
      doubt.id
    )
  }

  revalidatePath("/")
  revalidatePath(`/communities/${data.communityId}`)
  redirect(`/doubt/${doubt.id}`)
}

export async function getDoubts(params?: {
  subject?: string
  tag?: string
  search?: string
  page?: number
  limit?: number
}) {
  try {
    const page = params?.page || 1
    const limit = params?.limit || 7
    const skip = (page - 1) * limit

    // Get all doubtIds that are in ANY community
    const communityDoubtIds = await getPrisma().communityDoubt.findMany({
      select: { doubtId: true },
    })

    const where: any = {
      // Exclude doubts that are in communities
      id: {
        notIn: communityDoubtIds.map((cd) => cd.doubtId),
      },
    }

    if (params?.subject) {
      where.subject = params.subject
    }

    if (params?.tag) {
      where.tags = { has: params.tag }
    }

    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { content: { contains: params.search, mode: "insensitive" } },
      ]
    }

    const [doubts, total] = await Promise.all([
      getPrisma().doubt.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          subject: true,
          tags: true,
          isAnonymous: true,
          createdAt: true,
          upvotes: true,
          downvotes: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              answers: true,
              votes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
      }),
      getPrisma().doubt.count({ where }),
    ])

    return {
      doubts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    }
  } catch (error) {
    console.error("Error fetching doubts:", error)
    return {
      doubts: [],
      total: 0,
      page: 1,
      totalPages: 0,
      hasMore: false,
    }
  }
}

export async function getDoubtById(id: string) {
  const doubt = await getPrisma().doubt.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
          _count: {
            select: {
              userVotes: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      _count: {
        select: {
          comments: true,
          userVotes: true,
        },
      },
    },
  })

  if (doubt) {
    // Increment view count
    await getPrisma().doubt.update({
      where: { id },
      data: { views: { increment: 1 } },
    })
  }

  return doubt
}

export async function voteOnDoubt(doubtId: string, voteType: "UP" | "DOWN") {
  // Voting on doubts is not supported in current schema
  // Votes are only for answers/comments
  throw new Error("Direct voting on doubts is not supported. Please vote on answers instead.")
}
