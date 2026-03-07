"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Trophy, 
  Star, 
  Target,
  Zap,
  ArrowLeft,
  Lock
} from "lucide-react"
import Link from "next/link"

interface Achievement {
  id: string
  name: string
  description: string
  xp_reward: number
  unlocked: boolean
  unlocked_at: string | null
  progress: number | null
}

interface BadgeData {
  id: string
  name: string
  description: string
  icon?: string
  color?: string
  granted_at?: string
}

const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_correct_answer: "🎯",
  concept_master_all: "🧠",
  polymath: "🌟",
  consistent_learner: "🔥",
  marathon_learner: "🏃",
  helpful_contributor: "💡",
  trusted_expert: "🛡️",
  fact_checked: "✅",
  community_validator: "🗳️",
  doubt_resolver: "🔧",
  knowledge_seeker: "📚",
  early_adopter: "🚀",
  mentor: "👨‍🏫",
  fast_responder: "⚡",
  deep_diver: "🤿",
}

export default function AchievementsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/profile/achievements")
      return
    }
    if (status !== "authenticated") return

    async function fetchData() {
      try {
        const resp = await fetch("/api/users/me/achievements", { cache: "no-store" })
        if (!resp.ok) throw new Error("Failed to load achievements")
        const data = await resp.json()
        setAchievements(data.achievements ?? [])
        setBadges(data.badges ?? [])
      } catch (err) {
        setError("Could not load your achievements. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [status, router])

  const earned = achievements.filter((a) => a.unlocked)
  const totalXP = earned.reduce((sum, a) => sum + (a.xp_reward ?? 0), 0)

  if (loading || status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Achievements & Badges</h1>
          </div>
          <p className="text-muted-foreground">
            Your earned achievements and badges
          </p>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <Trophy className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{earned.length}</div>
            <div className="text-xs text-muted-foreground">Achievements</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Star className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold">{badges.length}</div>
            <div className="text-xs text-muted-foreground">Badges</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{totalXP.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">XP Earned</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">
              {achievements.length > 0
                ? Math.round((earned.length / achievements.length) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Completion</div>
          </div>
        </div>

        {/* Earned Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Earned Achievements
              <Badge variant="secondary">{earned.length}</Badge>
            </CardTitle>
            <CardDescription>Achievements you have unlocked</CardDescription>
          </CardHeader>
          <CardContent>
            {earned.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-medium text-muted-foreground">No achievements yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Keep participating to earn your first achievement!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {earned.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">
                        {ACHIEVEMENT_ICONS[achievement.id] ?? "🏆"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold truncate">{achievement.name}</h4>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            +{achievement.xp_reward} XP
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {achievement.description}
                        </p>
                        {achievement.unlocked_at && (
                          <p className="text-xs text-muted-foreground/60">
                            Earned{" "}
                            {new Date(achievement.unlocked_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earned Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Earned Badges
              <Badge variant="secondary">{badges.length}</Badge>
            </CardTitle>
            <CardDescription>Badges awarded to you</CardDescription>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-medium text-muted-foreground">No badges yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Badges are awarded for special milestones and contributions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="p-4 border rounded-lg bg-card text-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="text-4xl mb-2">{badge.icon ?? "🎖️"}</div>
                    <h4 className="font-semibold text-sm">{badge.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                    {badge.granted_at && (
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        {new Date(badge.granted_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
