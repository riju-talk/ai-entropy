import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Update user profile
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, bio, university, course, year } = body;

    // Validate year if provided
    if (year !== undefined && year !== null) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 1 || yearNum > 6) {
        return NextResponse.json(
          { error: "Year must be a number between 1 and 6" },
          { status: 400 }
        );
      }
    }

    console.log('[Profile Update] Updating user:', session.user.email);

    // Update user profile (excluding image)
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(university !== undefined && { university }),
        ...(course !== undefined && { course }),
        ...(year !== undefined && { year: parseInt(year) }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        university: true,
        course: true,
        year: true,
        role: true,
        image: true,
        reputation: true,
        credits: true,
        subscriptionTier: true,
      },
    });

    console.log('[Profile Update] User updated successfully:', updatedUser.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
