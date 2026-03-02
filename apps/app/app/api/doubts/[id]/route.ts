import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const doubt = await prisma.doubt.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            reputation: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                reputation: true
              }
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true
                  }
                }
              }
            }
          },
          where: {
            parentId: null // Only get top-level comments
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!doubt) {
      return NextResponse.json({ error: "Doubt not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      ...doubt, 
      answers: doubt.comments // Map comments to answers for backward compatibility
    });
  } catch (error) {
    console.error("Error in doubt detail route:", error);
    return NextResponse.json({ error: "Failed to fetch doubt" }, { status: 500 });
  }
}
