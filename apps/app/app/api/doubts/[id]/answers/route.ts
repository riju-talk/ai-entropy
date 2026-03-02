import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doubtId = params.id

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "7", 10) || 7, 100)
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
    const skip = (page - 1) * limit

    const [total, answers] = await Promise.all([
      prisma.answer.count({ where: { doubtId } }),
      prisma.answer.findMany({
        where: { doubtId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      })
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    return NextResponse.json({ answers, total, page, totalPages, hasMore })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch answers" },
      { status: 500 }
    )
  }
}
