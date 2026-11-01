import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma } from "@/lib/prisma"

let __prisma__;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = sharedPrisma;
  }
  return __prisma__;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        credits: true,
        createdAt: true,
        _count: {
          select: {
            doubts: true,
            answers: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Ensure backward compatibility: if the DB doesn't expose `freeQueriesUsed`,
    // provide a default value so clients expecting it don't crash.
    const result = {
      ...user,
      freeQueriesUsed: (user)?.freeQueriesUsed ?? 0,
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
