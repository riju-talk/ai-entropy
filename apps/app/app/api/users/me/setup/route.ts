import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

// Check if profile setup is complete
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        bio: true,
        university: true,
        course: true,
        year: true,
        role: true,
      },
    });

    // If user doesn't exist, create them with basic info
    if (!user) {
      console.log('[Profile Setup Check] User not found, creating:', session.user.email);
      
      const newUser = await getPrisma().user.create({
        data: {
          email: session.user.email,
          name: session.user.name || null,
          image: session.user.image || null,
          credits: 100,
          reputation: 0,
          subscriptionTier: "FREE",
          documentCount: 0,
          role: "STUDENT",
        },
        select: {
          id: true,
          name: true,
          bio: true,
          university: true,
          course: true,
          year: true,
          role: true,
        },
      });
      
      user = newUser;
      console.log('[Profile Setup Check] User created:', newUser.id);
    }

    // Check if profile is complete
    // Required fields: name, bio, university, course, year
    const isComplete = !!(
      user.name &&
      user.bio &&
      user.university &&
      user.course &&
      user.year
    );

    console.log('[Profile Setup Check] Profile complete:', isComplete);

    return NextResponse.json({
      isComplete,
      user: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        university: user.university,
        course: user.course,
        year: user.year,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Profile Setup Check] Error:", error);
    return NextResponse.json(
      { error: "Failed to check profile setup status" },
      { status: 500 }
    );
  }
}

// Update profile with required information
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, bio, university, course, year, role } = body;

    // Validate required fields
    if (!name || !bio || !university || !course || !year) {
      return NextResponse.json(
        { error: "Missing required fields: name, bio, university, course, year" },
        { status: 400 }
      );
    }

    // Validate year is a number
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1 || yearNum > 10) {
      return NextResponse.json(
        { error: "Year must be a number between 1 and 10" },
        { status: 400 }
      );
    }

    console.log('[Profile Setup] Upserting user:', session.user.email);

    // Upsert user profile (create if doesn't exist, update if exists)
    const updatedUser = await getPrisma().user.upsert({
      where: { email: session.user.email },
      create: {
        email: session.user.email,
        name,
        bio,
        university,
        course,
        year: yearNum,
        role: role || "STUDENT",
        image: session.user.image || null,
        credits: 100, // Default credits for new users
        reputation: 0,
        subscriptionTier: "FREE",
        documentCount: 0,
      },
      update: {
        name,
        bio,
        university,
        course,
        year: yearNum,
        role: role || "STUDENT",
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
      },
    });

    console.log('[Profile Setup] User upserted successfully:', updatedUser.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("[Profile Setup] Error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
