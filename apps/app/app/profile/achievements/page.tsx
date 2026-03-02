"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Trophy, 
  Award, 
  Star, 
  Crown, 
  Target,
  Zap,
  Heart,
  Sparkles,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"

// Mock achievements data structure
const achievementCategories = [
  {
    id: "participation",
    name: "Participation",
    icon: Heart,
    achievements: [
      {
        id: "first-question",
        name: "First Steps",
        description: "Ask your first question",
        icon: "🎯",
        rarity: "common",
        progress: 0,
        total: 1,
        unlocked: false,
      },
      {
        id: "10-questions",
        name: "Curious Mind",
        description: "Ask 10 questions",
        icon: "🤔",
        rarity: "uncommon",
        progress: 0,
        total: 10,
        unlocked: false,
      },
    ],
  },
  {
    id: "helpfulness",
    name: "Helpfulness",
    icon: Sparkles,
    achievements: [
      {
        id: "first-answer",
        name: "Helper",
        description: "Post your first answer",
        icon: "💡",
        rarity: "common",
        progress: 0,
        total: 1,
        unlocked: false,
      },
      {
        id: "10-answers",
        name: "Problem Solver",
        description: "Post 10 helpful answers",
        icon: "🔧",
        rarity: "uncommon",
        progress: 0,
        total: 10,
        unlocked: false,
      },
    ],
  },
  {
    id: "reputation",
    name: "Reputation",
    icon: Crown,
    achievements: [
      {
        id: "first-upvote",
        name: "Appreciated",
        description: "Receive your first upvote",
        icon: "👍",
        rarity: "common",
        progress: 0,
        total: 1,
        unlocked: false,
      },
      {
        id: "100-reputation",
        name: "Rising Star",
        description: "Reach 100 reputation",
        icon: "⭐",
        rarity: "rare",
        progress: 0,
        total: 100,
        unlocked: false,
      },
    ],
  },
]

const rarityColors = {
  common: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  uncommon: "bg-green-500/10 text-green-600 border-green-500/20",
  rare: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  epic: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  legendary: "bg-orange-500/10 text-orange-600 border-orange-500/20",
}

export default function AchievementsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (status === "authenticated") {
      // Simulate loading
      setTimeout(() => setLoading(false), 500)
    }
  }, [status, router])

  if (loading || status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
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
            Earn achievements by being an active member of the community
          </p>
        </div>

        {/* Coming Soon Banner */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Coming Soon!</h3>
                <p className="text-sm text-muted-foreground">
                  We're working hard to bring you an exciting achievement system. 
                  Stay tuned for updates!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievement Categories Preview */}
        {achievementCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <category.icon className="h-5 w-5 text-primary" />
                <CardTitle>{category.name}</CardTitle>
              </div>
              <CardDescription>
                Track your progress in {category.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`p-4 border rounded-lg ${
                      achievement.unlocked ? "bg-card" : "bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{achievement.name}</h4>
                          <Badge
                            variant="outline"
                            className={`text-xs ${rarityColors[achievement.rarity as keyof typeof rarityColors]}`}
                          >
                            {achievement.rarity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {achievement.description}
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>
                              {achievement.progress}/{achievement.total}
                            </span>
                          </div>
                          <Progress
                            value={(achievement.progress / achievement.total) * 100}
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Stats Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Your Achievement Stats</CardTitle>
            <CardDescription>Overview of your progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <Trophy className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Unlocked</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">6</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">0%</div>
                <div className="text-xs text-muted-foreground">Completion</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Star className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Rare+</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
