import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

// GET /api/users/me/credits - Get current user's credits
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ 
      where: { id: session.user.id },
      select: { credits: true }
    });

    if (!user) {
      return NextResponse.json({ credits: 0 });
    }

    return NextResponse.json({ credits: user.credits || 0 });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}

// POST /api/users/me/credits - Redeem credits for actions
export async function POST(request: Request) {
  try {
    console.log("[API][AI-AGENT] POST request received");
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const cost = amount || 1; // Default cost of 1 credit

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get current user with locking to prevent race conditions
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, credits: true }
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.credits < cost) {
        throw new Error("Insufficient credits");
      }

      // Update user credits
      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: { 
          credits: { decrement: cost },
          updatedAt: new Date()
        },
        select: { credits: true }
      });

      // Create ledger entry
      await tx.points_ledger.create({
        data: {
          userId: session.user.id,
          eventType: "CREDITS_REDEEMED",
          points: -cost,
          description: `Redeemed ${cost} credits for ${action}`,
          createdAt: new Date(),
        },
      });

      return updatedUser;
    });

    return NextResponse.json({
      credits: result.credits,
      redeemed: cost,
      action
    });

  } catch (error: any) {
    console.error("Error redeeming credits:", error);
    
    if (error.message === "User not found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    if (error.message === "Insufficient credits") {
      return NextResponse.json({
        error: "Insufficient credits",
        required: cost,
        available: await getCurrentCredits(session.user.id)
      }, { status: 402 });
    }

    return NextResponse.json({ error: "Failed to redeem credits" }, { status: 500 });
  }
}

// Helper function to get current credits
async function getCurrentCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true }
  });
  return user?.credits || 0;
}