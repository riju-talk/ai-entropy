import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { prisma as sharedPrisma } from "@/lib/prisma"

let __prisma__;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = sharedPrisma;
  }
  return __prisma__;
}

export async function GET(_req) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: {
        credits: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Provide default for freeQueriesUsed to remain compatible with clients
    return NextResponse.json({
      credits: user.credits,
      freeQueriesUsed: (user)?.freeQueriesUsed ?? 0,
    })
  } catch (error) {
    console.error("Error fetching credits:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { amount } = body

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const user = await getPrisma().user.update({
      where: { email: session.user.email },
      data: {
        credits: {
          increment: amount
        }
      },
      select: { credits: true }
    })

    return NextResponse.json({ credits: user.credits })
  } catch (error) {
    console.error("Error updating credits:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
