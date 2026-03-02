import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    console.log("[API RECENT] GET /api/communities/recent called")
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    console.log("[API RECENT] Query params:", { page, limit, skip })

    const communities = await getPrisma().community.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    })

    console.log("[API RECENT] Found communities:", communities.length)
    console.log("[API RECENT] Communities data:", communities)

    const total = await getPrisma().community.count()

    console.log("[API RECENT] Total communities in DB:", total)

    const response = {
      communities,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + communities.length < total
      }
    }

    console.log("[API RECENT] Sending response with", response.communities.length, "communities")

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API RECENT] Error fetching recent communities:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
