export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { DoubtsFeed } from "@/components/doubts-feed"
import { getDoubts } from "@/app/actions/doubts"
import { PrismaClient } from "@prisma/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Users, ArrowRight } from "lucide-react"
import Link from "next/link"
import { HeroSection } from "@/components/hero-section"

// Local Prisma singleton (no external prisma.ts)
let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

async function getRecentCommunities() {
  try {
    const prisma = getPrisma()
    const communities = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        description: true,
        subject: true,
        createdAt: true,
      },
    })

    // Fetch counts separately for each community
    const communitiesWithCounts = await Promise.all(
      communities.map(async (c) => {
        const [memberCount, postCount] = await Promise.all([
          prisma.communityMember.count({ where: { communityId: c.id } }),
          prisma.communityDoubt.count({ where: { communityId: c.id } }),
        ])
        return {
          ...c,
          _count: {
            members: memberCount,
            communityDoubts: postCount,
          },
        }
      })
    )

    return { communities: communitiesWithCounts }
  } catch (error) {
    console.error("[HomePage] Error fetching communities:", error)
    return { communities: [] }
  }
}

async function safeGetDoubts() {
  if (process.env.SKIP_DB === "true") {
    return { doubts: [], total: 0, totalPages: 0, hasMore: false }
  }
  try {
    // load first page with 7 items for initial feed
    return await getDoubts({ page: 1, limit: 7 })
  } catch (e) {
    console.error("safeGetDoubts error:", e)
    return { doubts: [], total: 0, totalPages: 0, hasMore: false }
  }
}

async function safeGetRecentCommunities() {
  if (process.env.SKIP_DB === "true") {
    return { communities: [] }
  }
  return await getRecentCommunities()
}

export default async function HomePage() {
  const { doubts, total, totalPages, hasMore } = await safeGetDoubts()
  const { communities } = await safeGetRecentCommunities()

  const totalAnswers = Array.isArray(doubts)
    ? doubts.reduce((acc, d) => acc + (d._count?.answers || 0), 0)
    : 0

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
      {/* Hero Section - Only for first-time visitors */}
      <HeroSection totalQuestions={total} totalAnswers={totalAnswers} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-foreground">All Questions</h2>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin">
            <DoubtsFeed
              initialDoubts={doubts}
              currentPage={1}
              totalPages={totalPages}
              hasMore={hasMore}
            />
          </div>
        </div>

        {/* Sidebar - New Communities */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <Card className="border-white/5 bg-card/60 backdrop-blur-sm shadow-[0_0_15px_rgba(6,182,212,0.05)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-cyan-400" />
                New Communities
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Recently created communities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {communities && communities.length > 0 ? (
                <>
                  {communities.map((community: any) => (
                    <Link
                      key={community.id}
                      href={`/communities/${community.id}`}
                      className="block p-3 rounded-lg border border-white/5 hover:bg-accent hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                          {community.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-1">
                            {community.name}
                          </h3>
                          {community.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {community.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{community._count?.members || 0} members</span>
                            <span>•</span>
                            <span>{community._count?.communityDoubts || 0} posts</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Button variant="outline" className="w-full border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all" asChild>
                    <Link href="/communities">
                      View All Communities
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-2">
                    No communities yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (Found: {communities?.length || 0})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
