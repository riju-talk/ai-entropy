import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, PointEventType } from "@prisma/client";
import { awardCredits } from "@/app/actions/credits";
import { awardXP, checkAchievements } from "@/lib/gamification";

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== POST /api/doubts called ===");

    const session = await getServerSession(authOptions);
    console.log("Session user:", session?.user);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the actual user from database using email
    const user = await getPrisma().user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      console.error("User not found in database:", session.user.email);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("User ID from DB:", user.id);

    const body = await req.json();
    console.log("Request body:", {
      title: body.title,
      subject: body.subject,
      tagsCount: body.tags?.length,
    });

    const { title, content, subject, tags, isAnonymous, id } = body;

    // Validation
    if (!title?.trim() || !content?.trim()) {
      console.log("Validation failed");
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    console.log("Creating doubt with authorId:", user.id);

    // Upsert doubt
    const doubt = await getPrisma().doubt.upsert({
      where: {
        id: id || "new-doubt-placeholder",
      },
      update: {
        title: title.trim(),
        content: content.trim(),
        subject: subject || "OTHER",
        tags: Array.isArray(tags) ? tags : [],
        isAnonymous: Boolean(isAnonymous),
      },
      create: {
        title: title.trim(),
        content: content.trim(),
        subject: subject || "OTHER",
        tags: Array.isArray(tags) ? tags : [],
        isAnonymous: Boolean(isAnonymous),
        authorId: user.id, // Use the actual DB user ID
        isInCommunity: false, // Regular doubts are NOT in communities
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    console.log("Doubt created successfully:", doubt.id);

    // Award XP and check achievements
    if (!isAnonymous) {
      await awardXP(user.id, PointEventType.DOUBT_CREATED, {
        description: `Asked: ${title}`
      });
      await checkAchievements(user.id, PointEventType.DOUBT_CREATED);
    }

    return NextResponse.json(doubt, { status: id ? 200 : 201 });
  } catch (error) {
    console.error("=== Error in POST /api/doubts ===");
    console.error("Error details:", error);

    return NextResponse.json(
      {
        error: "Failed to save doubt",
        details: error instanceof Error ? error.message : "Unknown error",
        stack:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Parse pagination params from the query string
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "7", 10) || 7, 50);
    const skip = (page - 1) * limit;

    // Build base where clause
    const where = { isInCommunity: false } as any;

    // Get total count and paginated results in parallel
    const [total, doubts] = await Promise.all([
      getPrisma().doubt.count({ where }),
      getPrisma().doubt.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          subject: true,
          tags: true,
          isAnonymous: true,
          createdAt: true,
          upvotes: true,
          downvotes: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              answers: true,
              votes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({ doubts, total, page, totalPages, hasMore });
  } catch (error) {
    console.error("Error fetching doubts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
