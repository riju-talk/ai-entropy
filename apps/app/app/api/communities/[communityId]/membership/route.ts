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

// Check membership status
export async function GET(
  req: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ isMember: false, role: null })
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ isMember: false, role: null })
    }

    const membership = await getPrisma().communityMember.findUnique({
      where: {
        userId_communityId: {
          userId: user.id,
          communityId: params.communityId
        }
      },
      select: {
        role: true
      }
    })

    return NextResponse.json({
      isMember: !!membership,
      role: membership?.role || null
    })
  } catch (error) {
    console.error("Error checking membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Join community
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
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if community exists
    const community = await getPrisma().community.findUnique({
      where: { id: params.communityId },
      select: { id: true }
    })

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 })
    }

    // Create membership
    const membership = await getPrisma().communityMember.create({
      data: {
        userId: user.id,
        communityId: params.communityId,
        role: "MEMBER"
      }
    })

    return NextResponse.json({ success: true, membership })
  } catch (error: any) {
    console.error("Error joining community:", error)
    
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Already a member" }, { status: 409 })
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Leave community
export async function DELETE(
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
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await getPrisma().communityMember.delete({
      where: {
        userId_communityId: {
          userId: user.id,
          communityId: params.communityId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error leaving community:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
