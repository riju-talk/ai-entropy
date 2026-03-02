import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function GET(_req: NextRequest) {
  try {
    const communities = await getPrisma().community.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Fetch member counts separately for each community
    const communitiesWithCounts = await Promise.all(
      communities.map(async (c) => {
        const memberCount = await getPrisma().communityMember.count({
          where: { communityId: c.id },
        });
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          memberCount,
          createdAt: c.createdAt,
        };
      })
    );

    return NextResponse.json(communitiesWithCounts);
  } catch (error) {
    console.error("Error fetching communities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, subject, isPublic } = body;

    // Create community and add creator as first member (ADMIN) in a transaction
    const result = await getPrisma().$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name,
          description: description || "",
          subject: subject || "OTHER",
          isPublic: isPublic !== false,
          createdBy: user.id,
        },
      });

      // Auto-add creator as ADMIN member
      await tx.communityMember.create({
        data: {
          userId: user.id,
          communityId: community.id,
          role: "ADMIN",
        },
      });

      return community;
    });

    return NextResponse.json({ community: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating community:", error);
    return NextResponse.json({ error: "Failed to create community" }, { status: 500 });
  }
}
