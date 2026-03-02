import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const community = await getPrisma().community.findUnique({
      where: { id: params.communityId },
      select: {
        id: true,
        name: true,
        description: true,
        subject: true,
        isPublic: true,
        createdAt: true,
        createdBy: true,
      }
    })

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 })
    }

    // Fetch counts separately
    const [memberCount, postCount] = await Promise.all([
      getPrisma().communityMember.count({ where: { communityId: params.communityId } }),
      getPrisma().communityDoubt.count({ where: { communityId: params.communityId } }),
    ])

    return NextResponse.json({
      ...community,
      _count: {
        members: memberCount,
        communityDoubts: postCount,
      }
    })
  } catch (error) {
    console.error("Error fetching community:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
