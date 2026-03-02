import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  return __prisma__
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5", 10) || 5, 50)
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
    const skip = (page - 1) * limit

    const user = await getPrisma().user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return NextResponse.json({ answers: [], total: 0, page, totalPages: 0, hasMore: false })

    const [total, answers] = await Promise.all([
      getPrisma().answer.count({ where: { authorId: user.id } }),
      getPrisma().answer.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          doubt: { select: { id: true, title: true } },
        },
      }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    return NextResponse.json({ answers, total, page, totalPages, hasMore })
  } catch (err) {
    console.error("/api/users/me/answers error:", err)
    return NextResponse.json({ answers: [] }, { status: 500 })
  }
}
