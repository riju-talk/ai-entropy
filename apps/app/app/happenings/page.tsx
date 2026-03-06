"use client"

import { Calendar, MapPin, Users, Clock } from "lucide-react"

const events = [
	{
		id: 1,
		title: "AI Conference 2024",
		description:
			"Join leading experts in artificial intelligence for groundbreaking discussions on the future of AI technology.",
		date: "March 15, 2024",
		time: "9:00 AM - 5:00 PM",
		location: "Tech Convention Center",
		attendees: 250,
		category: "Conference",
		image: "/ai-conference.png",
		tags: ["AI", "Machine Learning", "Technology"],
	},
	{
		id: 2,
		title: "Quantum Computing Workshop",
		description:
			"Hands-on workshop exploring quantum computing principles and practical applications.",
		date: "March 22, 2024",
		time: "2:00 PM - 6:00 PM",
		location: "University Lab Building",
		attendees: 45,
		category: "Workshop",
		image: "/quantum-computing-concept.png",
		tags: ["Quantum", "Physics", "Computing"],
	},
	{
		id: 3,
		title: "Biotech Innovation Summit",
		description:
			"Discover the latest breakthroughs in biotechnology and their impact on healthcare.",
		date: "April 5, 2024",
		time: "10:00 AM - 4:00 PM",
		location: "Medical Research Center",
		attendees: 180,
		category: "Summit",
		image: "/biotech-laboratory.png",
		tags: ["Biotech", "Healthcare", "Innovation"],
	},
	{
		id: 4,
		title: "Robotics Competition",
		description:
			"Annual robotics competition showcasing student projects and innovations.",
		date: "April 12, 2024",
		time: "1:00 PM - 8:00 PM",
		location: "Engineering Campus",
		attendees: 320,
		category: "Competition",
		image: "/robotics-competition.png",
		tags: ["Robotics", "Engineering", "Competition"],
	},
	{
		id: 5,
		title: "Climate Science Symposium",
		description:
			"Leading climate scientists discuss current research and environmental solutions.",
		date: "April 18, 2024",
		time: "9:30 AM - 3:30 PM",
		location: "Environmental Science Building",
		attendees: 150,
		category: "Symposium",
		image: "/climate-science.png",
		tags: ["Climate", "Environment", "Science"],
	},
	{
		id: 6,
		title: "Space Exploration Lecture",
		description:
			"Fascinating insights into current space missions and future exploration plans.",
		date: "April 25, 2024",
		time: "7:00 PM - 9:00 PM",
		location: "Planetarium Auditorium",
		attendees: 200,
		category: "Lecture",
		image: "/vast-space-exploration.png",
		tags: ["Space", "Astronomy", "Exploration"],
	},
]

export default function HappeningsPage() {
	return (
		<div className="relative font-mono">
			{/* Coming Soon Badge */}
			<div className="absolute top-0 right-0 z-10">
				<div className="text-[10px] uppercase tracking-[0.2em] border border-amber-500/40 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg">
					Coming Soon
				</div>
			</div>

			{/* Blurred disabled content */}
			<div className="space-y-6 filter blur-sm opacity-60 pointer-events-none select-none">
				<div>
					<div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-1">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
						<span>ENTROPY · HAPPENINGS</span>
					</div>
					<h1 className="text-2xl font-black tracking-tight">Campus Happenings</h1>
					<p className="text-xs text-muted-foreground mt-1">
						Stay updated with the latest academic events, workshops, and conferences
					</p>
				</div>

				<div className="grid gap-4">
					{events.map((event) => (
						<div
							key={event.id}
							className="rounded-xl border border-white/5 bg-[#0d0d14]/80 p-5 flex flex-col md:flex-row gap-4"
						>
							<div className="md:w-[220px] h-36 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
								<Calendar className="h-10 w-10 text-white/20" />
							</div>
							<div className="flex-1 space-y-3">
								<div className="flex items-start justify-between gap-2">
									<div>
										<span className="text-[10px] uppercase tracking-[0.15em] border border-white/8 text-muted-foreground px-2 py-0.5 rounded">
											{event.category}
										</span>
										<h3 className="text-sm font-bold text-foreground mt-1">{event.title}</h3>
										<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
											{event.description}
										</p>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
									<div className="flex items-center gap-1.5">
										<Calendar className="h-3 w-3" /> {event.date}
									</div>
									<div className="flex items-center gap-1.5">
										<Clock className="h-3 w-3" /> {event.time}
									</div>
									<div className="flex items-center gap-1.5">
										<MapPin className="h-3 w-3" /> {event.location}
									</div>
									<div className="flex items-center gap-1.5">
										<Users className="h-3 w-3" /> {event.attendees} attendees
									</div>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{event.tags.map((tag) => (
										<span
											key={tag}
											className="text-[10px] uppercase tracking-[0.1em] border border-white/8 text-muted-foreground px-2 py-0.5 rounded"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Overlay message */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="rounded-xl border border-amber-500/20 bg-[#0a0a0f]/90 px-8 py-6 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
					<div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/60 mb-2">// STATUS</div>
					<div className="text-lg font-black text-foreground tracking-tight">Coming Soon</div>
					<div className="text-xs text-muted-foreground mt-1">
						Events & happenings module is under development
					</div>
				</div>
			</div>
		</div>
	)
}
