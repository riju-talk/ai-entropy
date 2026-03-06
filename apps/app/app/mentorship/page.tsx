"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Star, BookOpen, Users, Clock, MapPin } from "lucide-react"

const mentors = [
	{
		id: "1",
		name: "Dr. Sarah Chen",
		title: "Associate Professor",
		image: "/placeholder.svg",
		rating: 4.9,
		reviewCount: 127,
		expertise: ["Machine Learning", "Deep Learning", "Computer Vision"],
		subjects: ["CS"],
		sessionsCompleted: 245,
		students: 89,
		availability: "Mon-Fri, 2-5 PM",
		university: "MIT",
	},
	{
		id: "2",
		name: "Prof. Michael Rodriguez",
		title: "Physics Professor",
		image: "/placeholder.svg",
		rating: 4.8,
		reviewCount: 98,
		expertise: ["Quantum Physics", "Thermodynamics", "Classical Mechanics"],
		subjects: ["Physics"],
		sessionsCompleted: 189,
		students: 67,
		availability: "Tue-Thu, 3-6 PM",
		university: "Stanford",
	},
	{
		id: "3",
		name: "Dr. Emily Watson",
		title: "Mathematics Professor",
		image: "/placeholder.svg",
		rating: 4.9,
		reviewCount: 156,
		expertise: ["Calculus", "Linear Algebra", "Differential Equations"],
		subjects: ["Math"],
		sessionsCompleted: 312,
		students: 124,
		availability: "Mon-Wed-Fri, 1-4 PM",
		university: "Harvard",
	},
	{
		id: "4",
		name: "Prof. James Kim",
		title: "Chemistry Professor",
		image: "/placeholder.svg",
		rating: 4.7,
		reviewCount: 84,
		expertise: ["Organic Chemistry", "Biochemistry", "Analytical Chemistry"],
		subjects: ["Chemistry"],
		sessionsCompleted: 156,
		students: 52,
		availability: "Mon-Fri, 10 AM-1 PM",
		university: "Yale",
	},
	{
		id: "5",
		name: "Dr. Lisa Johnson",
		title: "Computer Science Professor",
		image: "/placeholder.svg",
		rating: 4.8,
		reviewCount: 143,
		expertise: ["Algorithms", "Data Structures", "Web Development"],
		subjects: ["CS"],
		sessionsCompleted: 278,
		students: 95,
		availability: "Tue-Fri, 2-5 PM",
		university: "Berkeley",
	},
	{
		id: "6",
		name: "Prof. David Lee",
		title: "Mathematics Professor",
		image: "/placeholder.svg",
		rating: 4.9,
		reviewCount: 112,
		expertise: ["Statistics", "Probability", "Number Theory"],
		subjects: ["Math"],
		sessionsCompleted: 201,
		students: 78,
		availability: "Mon-Thu, 3-6 PM",
		university: "Princeton",
	},
]

export default function MentorshipPage() {
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedSubject, setSelectedSubject] = useState("all")

	const filteredMentors = mentors.filter((mentor) => {
		const matchesSearch =
			mentor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			mentor.expertise.some((exp) => exp.toLowerCase().includes(searchTerm.toLowerCase()))
		const matchesSubject = selectedSubject === "all" || mentor.subjects.includes(selectedSubject)
		return matchesSearch && matchesSubject
	})

	return (
		<div className="relative font-mono">
			{/* Coming Soon Badge */}
			<div className="absolute top-0 right-0 z-10">
				<div className="text-[10px] uppercase tracking-[0.2em] border border-amber-500/40 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg">
					Coming Soon
				</div>
			</div>

			{/* Blurred Content */}
			<div className="space-y-6 filter blur-sm opacity-60 pointer-events-none select-none">
				<div>
					<div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-1">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
						<span>ENTROPY · MENTORSHIP</span>
					</div>
					<h1 className="text-2xl font-black tracking-tight">Find a Mentor</h1>
					<p className="text-xs text-muted-foreground mt-1">
						Connect with experienced mentors to guide your academic journey
					</p>
				</div>

				{/* Search */}
				<div className="flex gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
						<div className="h-10 pl-9 rounded-lg border border-white/8 bg-[#0d0d14]/80" />
					</div>
					<div className="flex gap-1.5">
						{["All", "CS", "Math", "Physics", "Chem"].map((tab) => (
							<div
								key={tab}
								className="h-10 px-3 rounded-lg border border-white/8 bg-[#0d0d14]/80 flex items-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
							>
								{tab}
							</div>
						))}
					</div>
				</div>

				{/* Mentor Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredMentors.map((mentor) => (
						<div
							key={mentor.id}
							className="rounded-xl border border-white/5 bg-[#0d0d14]/80 p-5 space-y-4"
						>
							<div className="flex items-start gap-3">
								<Avatar className="h-12 w-12 border border-white/10">
									<AvatarImage src={mentor.image} />
									<AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-black">
										{mentor.name.split(" ").map((n) => n[0]).join("")}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="font-bold text-sm text-foreground truncate">{mentor.name}</div>
									<div className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] truncate">
										{mentor.title}
									</div>
									<div className="flex items-center gap-1 mt-1">
										<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
										<span className="text-[11px] font-bold text-yellow-400">{mentor.rating}</span>
										<span className="text-[10px] text-muted-foreground">
											({mentor.reviewCount})
										</span>
									</div>
								</div>
							</div>

							<div className="flex flex-wrap gap-1.5">
								{mentor.expertise.map((skill) => (
									<span
										key={skill}
										className="text-[10px] uppercase tracking-[0.1em] border border-white/8 text-muted-foreground px-1.5 py-0.5 rounded"
									>
										{skill}
									</span>
								))}
							</div>

							<div className="space-y-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
								<div className="flex items-center gap-2">
									<BookOpen className="h-3 w-3" />
									<span>{mentor.sessionsCompleted} sessions</span>
								</div>
								<div className="flex items-center gap-2">
									<Users className="h-3 w-3" />
									<span>{mentor.students} students</span>
								</div>
								<div className="flex items-center gap-2">
									<Clock className="h-3 w-3" />
									<span>{mentor.availability}</span>
								</div>
								{mentor.university && (
									<div className="flex items-center gap-2">
										<MapPin className="h-3 w-3" />
										<span>{mentor.university}</span>
									</div>
								)}
							</div>

							<div className="h-8 rounded-lg border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-center text-[10px] uppercase tracking-[0.15em] text-cyan-400">
								Request Session
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Overlay */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="rounded-xl border border-amber-500/20 bg-[#0a0a0f]/90 px-8 py-6 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
					<div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/60 mb-2">// STATUS</div>
					<div className="text-lg font-black text-foreground tracking-tight">Coming Soon</div>
					<div className="text-xs text-muted-foreground mt-1">
						Mentorship module is under development
					</div>
				</div>
			</div>
		</div>
	)
}
