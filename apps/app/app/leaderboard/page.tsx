"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Medal, Award, Target, TrendingUp, Crown, Flame, Brain, Zap, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const leaderboardData = [
	{
		id: 1,
		rank: 1,
		name: "Alex Chen",
		username: "@alexchen",
		points: 15420,
		level: 47,
		streak: 28,
		badge: "AI Master",
		subjects: ["Computer science", "Mathematics"],
		achievements: ["Problem solver", "Mentor", "Top contributor"],
		weeklyGain: 340,
		monthlyGain: 1250,
	},
	{
		id: 2,
		rank: 2,
		name: "Sarah Johnson",
		username: "@sarahj",
		points: 14890,
		level: 45,
		streak: 21,
		badge: "Physics guru",
		subjects: ["Physics", "Engineering"],
		achievements: ["Research star", "Helper", "Consistent"],
		weeklyGain: 280,
		monthlyGain: 980,
	},
	{
		id: 3,
		rank: 3,
		name: "Michael Rodriguez",
		username: "@mikero",
		points: 13750,
		level: 42,
		streak: 35,
		badge: "Bio expert",
		subjects: ["Biology", "Chemistry"],
		achievements: ["Knowledge seeker", "Community leader", "Streak master"],
		weeklyGain: 420,
		monthlyGain: 1100,
	},
]

const achievements = [
	{ name: "First steps", description: "Complete your first doubt", icon: Target, rarity: "Common" },
	{ name: "Problem solver", description: "Solve 50 doubts", icon: Brain, rarity: "Uncommon" },
	{ name: "Streak master", description: "Maintain 30-day streak", icon: Flame, rarity: "Rare" },
	{ name: "Mentor", description: "Help 100 students", icon: Award, rarity: "Epic" },
	{ name: "AI master", description: "Master AI concepts", icon: Zap, rarity: "Legendary" },
	{ name: "Top contributor", description: "Top 1% contributor", icon: Crown, rarity: "Legendary" },
]

export default function LeaderboardPage() {
	const [selectedPeriod, setSelectedPeriod] = useState("all")
	const [leaderboard, setLeaderboard] = useState<any[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		setLoading(true)
		fetch(`/api/leaderboard?period=${selectedPeriod}`)
			.then((res) => res.json())
			.then((data) => {
				setLeaderboard(data)
				setLoading(false)
			})
			.catch((err) => {
				console.error(err)
				setLoading(false)
			})
	}, [selectedPeriod])

	const getRankIcon = (rank: number) => {
		switch (rank) {
			case 1:
				return <Crown className="h-6 w-6 text-yellow-500" />
			case 2:
				return <Medal className="h-6 w-6 text-gray-400" />
			case 3:
				return <Award className="h-6 w-6 text-amber-600" />
			default:
				return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
		}
	}

	const getRarityColor = (rarity: string) => {
		switch (rarity) {
			case "Common":
				return "bg-gray-500"
			case "Uncommon":
				return "bg-green-500"
			case "Rare":
				return "bg-blue-500"
			case "Epic":
				return "bg-purple-500"
			case "Legendary":
				return "bg-yellow-500"
			default:
				return "bg-gray-500"
		}
	}

	if (loading) {
		return (
			<div className="space-y-8 animate-pulse">
				<div className="space-y-3">
					<div className="h-10 w-48 bg-muted rounded"></div>
					<div className="h-4 w-96 bg-muted rounded"></div>
				</div>
				<div className="h-12 w-full bg-muted rounded-lg"></div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-64 bg-muted rounded-xl"></div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="relative">
			<div className="space-y-8">
				<div className="space-y-3">
					<h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
						Leaderboard
					</h1>
					<p className="text-muted-foreground italic">Compete, learn, and climb the ranks in the STEM community</p>
				</div>

				<Tabs defaultValue="leaderboard" className="w-full">
					<TabsList className="grid w-full grid-cols-3 bg-muted p-1">
						<TabsTrigger value="leaderboard">Rankings</TabsTrigger>
						<TabsTrigger value="achievements">Achievements</TabsTrigger>
						<TabsTrigger value="subjects">By subject</TabsTrigger>
					</TabsList>

					<TabsContent value="leaderboard" className="space-y-6">
						{/* Period Filter */}
						<div className="flex justify-center gap-2">
							{["all-time", "monthly", "weekly"].map((period) => (
								<Button
									key={period}
									variant={selectedPeriod === period ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedPeriod(period)}
									className="capitalize"
								>
									{period.replace("-", " ")}
								</Button>
							))}
						</div>

						{/* Top 3 Podium */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
							{leaderboard.slice(0, 3).map((stats, index) => (
								<Card
									key={stats.id}
									className={`${index === 0
										? "md:order-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-transparent shadow-2xl shadow-yellow-500/10"
										: index === 1
											? "md:order-1 border-gray-400/30"
											: "md:order-3 border-amber-600/30"
										} relative overflow-hidden transition-all duration-500 hover:scale-[1.02] group`}
								>
									<CardHeader className="text-center pb-3">
										<div className="flex justify-center mb-4 transition-transform group-hover:scale-110 duration-300">
											{getRankIcon(index + 1)}
										</div>
										<Avatar className={`h-24 w-24 mx-auto mb-4 border-4 ${index === 0 ? "border-yellow-500" : "border-background"} ring-4 ring-primary/10`}>
											<AvatarImage src={stats.user?.image || "/placeholder.svg"} alt={stats.user?.name} />
											<AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white text-2xl font-black">
												{stats.user?.name?.[0] || "U"}
											</AvatarFallback>
										</Avatar>
										<CardTitle className="text-2xl font-black tracking-tight">{stats.user?.name}</CardTitle>
										<CardDescription className="font-bold text-primary italic uppercase tracking-widest text-[10px]">
											{stats.currentLevel > 1 ? "Scholar" : "Freshman"}
										</CardDescription>
									</CardHeader>
									<CardContent className="text-center space-y-4">
										<div className="space-y-1">
											<div className="text-4xl font-extrabold text-foreground tracking-tighter tabular-nums">
												{stats.totalPoints.toLocaleString()}
											</div>
											<div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Entropy Coins</div>
										</div>
										<div className="flex justify-center space-x-4 text-xs bg-secondary/30 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
											<div className="flex items-center font-bold">
												<Trophy className="h-3 w-3 mr-1.5 text-cyan-400" />
												LVL {stats.currentLevel}
											</div>
											<div className="flex items-center font-bold">
												<Flame className={`h-3 w-3 mr-1.5 ${stats.user?.streaks?.currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
												{stats.user?.streaks?.currentStreak ?? 0} DAYS
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>

						{/* Full Leaderboard */}
						<Card className="border-white/5 bg-background/30 backdrop-blur-md">
							<CardHeader className="border-b border-white/5">
								<CardTitle className="text-xl font-black uppercase tracking-widest">Global Hall of Fame</CardTitle>
							</CardHeader>
							<CardContent className="pt-6">
								<div className="space-y-4">
									{leaderboard.map((stats, index) => (
										<div
											key={stats.id}
											className="flex items-center space-x-6 p-5 rounded-2xl bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 border border-transparent hover:border-white/10 group"
										>
											<div className="flex items-center justify-center w-12 text-center transition-transform group-hover:scale-125">
												{getRankIcon(index + 1)}
											</div>

											<Avatar className="h-14 w-14 border-2 border-primary/20 shadow-lg group-hover:shadow-primary/20 transition-all">
												<AvatarImage src={stats.user?.image || "/placeholder.svg"} alt={stats.user?.name} />
												<AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold">
													{stats.user?.name?.[0] || "U"}
												</AvatarFallback>
											</Avatar>

											<div className="flex-1 min-w-0">
												<div className="flex items-center space-x-3">
													<h3 className="font-black text-lg group-hover:text-primary transition-colors truncate">
														{stats.user?.name}
													</h3>
													<Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-black h-5 px-2">
														{stats.user?.tier ?? "INITIATE"}
													</Badge>
												</div>
												<div className="flex items-center gap-2 mt-1.5">
													<Badge className="bg-orange-500/10 text-orange-500 border-none text-[9px] font-black px-2 h-5 tracking-tighter">
														<Flame className="h-3 w-3 mr-1" />
														{stats.user?.streaks?.currentStreak ?? 0} DAY STREAK
													</Badge>
												</div>
											</div>

											<div className="text-right">
												<div className="text-2xl font-black text-foreground tabular-nums tracking-tighter">
													{stats.totalPoints.toLocaleString()}
												</div>
												<div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Points</div>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="achievements" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{achievements.map((achievement) => (
								<Card key={achievement.name} className="hover:shadow-lg transition-shadow">
									<CardHeader>
										<div className="flex items-center space-x-3">
											<div className={`p-3 rounded-lg ${getRarityColor(achievement.rarity)}`}>
												<achievement.icon className="h-6 w-6 text-white" />
											</div>
											<div>
												<CardTitle className="text-base">{achievement.name}</CardTitle>
												<Badge className={`${getRarityColor(achievement.rarity)} text-white text-xs mt-1`}>
													{achievement.rarity}
												</Badge>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-muted-foreground">{achievement.description}</p>
										<div className="mt-4">
											<div className="flex justify-between text-xs mb-2">
												<span>Progress</span>
												<span>75%</span>
											</div>
											<Progress value={75} className="h-2" />
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>

					<TabsContent value="subjects" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{["Computer science", "Mathematics", "Physics", "Biology", "Chemistry", "Engineering"].map((subject) => (
								<Card key={subject} className="hover:shadow-lg transition-shadow">
									<CardHeader className="border-b">
										<CardTitle className="text-base">{subject}</CardTitle>
										<CardDescription>245 active learners</CardDescription>
									</CardHeader>
									<CardContent className="pt-6">
										<div className="space-y-3">
											{leaderboardData.slice(0, 3).map((user, index) => (
												<div key={user.id} className="flex items-center space-x-3">
													<span className="text-sm font-medium w-5">#{index + 1}</span>
													<Avatar className="h-8 w-8 border border-primary/20">
														<AvatarImage src="/placeholder.svg" alt={user.name} />
														<AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-pink-600 text-white">
															{user.name
																.split(" ")
																.map((n) => n[0])
																.join("")}
														</AvatarFallback>
													</Avatar>
													<div className="flex-1">
														<p className="text-sm font-medium">{user.name}</p>
														<p className="text-xs text-muted-foreground">{user.points.toLocaleString()} pts</p>
													</div>
												</div>
											))}
										</div>
										<Button variant="outline" className="w-full mt-4 bg-transparent h-8">
											View all rankings
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}
