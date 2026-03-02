import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { deductCredits } from "@/app/actions/credits"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, operation, metadata } = body

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      )
    }

    const newBalance = await deductCredits(amount)

    // Log the operation for audit
    console.log(`Credits deducted: ${amount} for ${operation} by user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      newBalance,
      deducted: amount,
    })
  } catch (error: any) {
    console.error("Credit deduction error:", error)
    
    if (error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    if (error.message === "Insufficient credits") {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 500 }
    )
  }
}
