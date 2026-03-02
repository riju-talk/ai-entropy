"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Medal, Award, TrendingUp, Crown, Flame, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function LeaderboardPage() {
	const { status } = useSession()
	const [selectedPeriod, setSelectedPeriod] = useState("all")
	const [selectedTab, setSelectedTab] = useState("leaderboard")
	const [leaderboard, setLeaderboard] = useState<any[]>([])
	const [achievements, setAchievements] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [leaderboardLoading, setLeaderboardLoading] = useState(false)
	const [achievementsLoading, setAchievementsLoading] = useState(true)

	// Lazy load leaderboard only when Rankings tab is selected
	useEffect(() => {
		if (selectedTab !== "leaderboard") return

		setLeaderboardLoading(true)
		fetch(`/api/leaderboard?period=${selectedPeriod}`)
			.then((res) => res.json())
			.then((data) => {
				setLeaderboard(data || [])
				setLeaderboardLoading(false)
			})
			.catch((err) => {
				console.error(err)
				setLeaderboardLoading(false)
			})
	}, [selectedTab, selectedPeriod])

	// Fetch achievements on mount
	useEffect(() => {
		setAchievementsLoading(true)
		fetch("/api/achievements")
			.then((res) => res.json())
			.then((data) => {
				setAchievements(data || [])
				setAchievementsLoading(false)
			})
			.catch((err) => {
				console.error("Failed to fetch achievements:", err)
				setAchievementsLoading(false)
			})
	}, [])

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
		switch (rarity?.toUpperCase()) {
			case "COMMON":
				return "bg-gray-500"
			case "UNCOMMON":
				return "bg-green-500"
			case "RARE":
				return "bg-blue-500"
			case "EPIC":
				return "bg-purple-500"
			case "LEGENDARY":
				return "bg-yellow-500"
			default:
				return "bg-gray-500"
		}
	}

	const getRarityTextColor = (rarity: string) => {
		switch (rarity?.toUpperCase()) {
			case "COMMON":
				return "text-gray-400"
			case "UNCOMMON":
				return "text-green-400"
			case "RARE":
				return "text-blue-400"
			case "EPIC":
				return "text-purple-400"
			case "LEGENDARY":
				return "text-yellow-400"
			default:
				return "text-gray-400"
		}
	}

	if (loading || achievementsLoading) {
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
					<p className="text-muted-foreground italic">Compete, learn, and climb the ranks in the NOVYRA community</p>
				</div>

				<Tabs defaultValue="leaderboard" className="w-full" value={selectedTab} onValueChange={setSelectedTab}>
					<TabsList className="grid w-full grid-cols-2 bg-muted p-1">
						<TabsTrigger value="leaderboard">Rankings</TabsTrigger>
						<TabsTrigger value="achievements">Achievements</TabsTrigger>
					</TabsList>

					<TabsContent value="leaderboard" className="space-y-6">
						{/* Period Filter */}
						<div className="flex justify-center gap-2">
							{["all", "monthly", "weekly"].map((period) => (
								<Button
									key={period}
									variant={selectedPeriod === period ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedPeriod(period)}
									className="capitalize"
								>
									{period === "all" ? "All Time" : period.charAt(0).toUpperCase() + period.slice(1)}
								</Button>
							))}
						</div>

						{/* Loading skeleton */}
						{leaderboardLoading && (
							<div className="space-y-4 animate-pulse">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{[1, 2, 3].map((i) => (
										<div key={i} className="h-64 bg-muted rounded-xl border border-white/5"></div>
									))}
								</div>
								<div className="h-96 bg-muted rounded-xl border border-white/5"></div>
							</div>
						)}

						{/* Top 3 Podium */}
						{!leaderboardLoading && leaderboard.length >= 1 && (
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
												<AvatarImage src={stats.image || "/placeholder.svg"} alt={stats.name} />
												<AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white text-2xl font-black">
													{stats.name?.[0] || "U"}
												</AvatarFallback>
											</Avatar>
											<CardTitle className="text-2xl font-black tracking-tight">{stats.name}</CardTitle>
											<CardDescription className="font-bold text-primary italic uppercase tracking-widest text-[10px]">
												{stats.tier || "Initiate"}
											</CardDescription>
										</CardHeader>
										<CardContent className="text-center space-y-4">
											<div className="space-y-2">
												<div className="text-3xl font-extrabold text-yellow-400 tracking-tighter tabular-nums">
													{stats.credits?.toLocaleString() || 0}
												</div>
												<div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Novyra Coins</div>
												<div className="text-2xl font-extrabold text-cyan-400 tracking-tighter tabular-nums">
													{stats.totalXP?.toLocaleString() || 0}
												</div>
												<div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Total XP</div>
											</div>
											<div className="flex justify-center space-x-4 text-xs bg-secondary/30 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
												<div className="flex items-center font-bold">
													<Trophy className="h-3 w-3 mr-1.5 text-cyan-400" />
													{stats.totalAchievements || 0} ACHIEVEMENTS
												</div>
												<div className="flex items-center font-bold">
													<Flame className={`h-3 w-3 mr-1.5 ${stats.streakInfo?.currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
													{stats.streakInfo?.currentStreak ?? 0} DAYS
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}

						{/* Full Leaderboard */}
						{!leaderboardLoading && leaderboard.length > 0 && (
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
													<AvatarImage src={stats.image || "/placeholder.svg"} alt={stats.name} />
													<AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold">
														{stats.name?.[0] || "U"}
													</AvatarFallback>
												</Avatar>

												<div className="flex-1 min-w-0">
													<div className="flex items-center space-x-3">
														<h3 className="font-black text-lg group-hover:text-primary transition-colors truncate">
															{stats.name}
														</h3>
														<Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-black h-5 px-2">
															{stats.tier ?? "INITIATE"}
														</Badge>
													</div>
													<div className="flex items-center gap-2 mt-1.5">
														<Badge className="bg-orange-500/10 text-orange-500 border-none text-[9px] font-black px-2 h-5 tracking-tighter">
															<Flame className="h-3 w-3 mr-1" />
															{stats.streakInfo?.currentStreak ?? 0} DAY STREAK
														</Badge>
													</div>
												</div>

												<div className="text-right space-y-1">
													<div>
														<div className="text-lg font-black text-yellow-400 tabular-nums tracking-tighter">
															{stats.credits?.toLocaleString() || 0} 💰
														</div>
														<div className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Coins</div>
													</div>
													<div>
														<div className="text-lg font-black text-cyan-400 tabular-nums tracking-tighter">
															{stats.totalXP?.toLocaleString() || 0}
														</div>
														<div className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">XP</div>
													</div>
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="achievements" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{achievements.map((achievement) => (
								<Card key={achievement.id} className="hover:shadow-lg transition-shadow">
									<CardHeader>
										<div className="flex items-center space-x-3">
											<div className={`p-3 rounded-lg ${getRarityColor(achievement.rarity)}`}>
												<span className="text-2xl">{achievement.icon}</span>
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
										
										{/* Show progress only if authenticated */}
										{status === "authenticated" && (
											<div className="mt-4">
												<div className="flex justify-between text-xs mb-2">
													<span>Target: {achievement.criteria?.target || 0}</span>
													<span className={`font-bold ${getRarityTextColor(achievement.rarity)}`}>
														+{achievement.points} pts
													</span>
												</div>
												<div className="text-xs text-muted-foreground">
													Requirement: {achievement.criteria?.requirementType?.replace(/_/g, " ") || "Unknown"}
												</div>
											</div>
										)}

										{status !== "authenticated" && (
											<div className="mt-4 text-xs text-muted-foreground italic">
												Log in to see your progress
											</div>
										)}
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
