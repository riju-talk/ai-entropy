import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

// GET /api/users/me/credits - Get current user's credits
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getPrisma().user.findUnique({ 
      where: { email: session.user.email },
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true, credits: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, amount } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const cost = amount || 1; // Default cost of 1 credit

    // Use transaction to ensure data consistency
    const result = await getPrisma().$transaction(async (tx) => {
      // Get current user with locking to prevent race conditions
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, credits: true }
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      if (currentUser.credits < cost) {
        throw new Error("Insufficient credits");
      }

      // Update user credits
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { 
          credits: { decrement: cost },
          updatedAt: new Date()
        },
        select: { credits: true }
      });

      // Create ledger entry
      await tx.pointsLedger.create({
        data: {
          userId: user.id,
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
      const currentUser = await getPrisma().user.findUnique({
        where: { email: session.user.email },
        select: { credits: true }
      });
      
      return NextResponse.json({
        error: "Insufficient credits",
        required: cost,
        available: currentUser?.credits || 0
      }, { status: 402 });
    }

    return NextResponse.json({ error: "Failed to redeem credits" }, { status: 500 });
  }
}