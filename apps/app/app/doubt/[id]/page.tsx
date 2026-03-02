import { notFound } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import { DoubtDetail } from "@/components/doubt-detail"
import { AnswersSection } from "@/components/answers-section"

const prisma = new PrismaClient()

async function getDoubt(id: string) {
  try {
    const doubt = await prisma.doubt.findUnique({
      where: { id },
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
        authorId: true,
        isInCommunity: true, // Add this
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        answers: {
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
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            answers: true,
            votes: true,
          },
        },
      },
    })

    if (!doubt) {
      notFound()
    }

    return doubt
  } catch (error) {
    console.error("Error fetching doubt:", error)
    notFound()
  }
}

export default async function DoubtPage({ params }: { params: { id: string } }) {
  const doubt = await getDoubt(params.id)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Doubt Detail */}
        <DoubtDetail doubt={doubt} />

        {/* Answers Section */}
        <AnswersSection
          doubtId={doubt.id}
          initialAnswers={doubt.answers}
          doubtAuthorId={doubt.authorId}
          answersCount={doubt._count.answers}
        />
      </div>
    </div>
  )
}
