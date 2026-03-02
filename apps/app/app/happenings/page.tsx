"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, Clock } from "lucide-react"
import Image from "next/image"

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
		<div className="relative">
			{/* Ribbon */}
			<div className="absolute top-3 right-3 z-10">
				<div className="bg-amber-500 text-white px-3 py-1 rounded-md text-sm font-semibold shadow">
					Coming soon
				</div>
			</div>

			{/* Blurred disabled content */}
			<div className="space-y-6 filter blur-sm opacity-80 pointer-events-none">
				<div>
					<h1 className="text-3xl font-bold mb-2">Campus Happenings</h1>
					<p className="text-muted-foreground">
						Stay updated with the latest academic events, workshops, and
						conferences
					</p>
				</div>

				<div className="grid gap-6">
					{events.map((event) => (
						<Card key={event.id} className="overflow-hidden">
							<div className="md:flex">
								<div className="md:w-1/3">
									<Image
										src={event.image || "/placeholder.svg"}
										alt={event.title}
										width={400}
										height={250}
										className="w-full h-48 md:h-full object-cover"
									/>
								</div>
								<div className="md:w-2/3 p-6">
									<div className="flex items-start justify-between mb-4">
										<div>
											<Badge variant="secondary" className="mb-2">
												{event.category}
											</Badge>
											<h3 className="text-xl font-semibold mb-2">
												{event.title}
											</h3>
											<p className="text-muted-foreground mb-4">
												{event.description}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div className="flex items-center text-sm text-muted-foreground">
											<Calendar className="h-4 w-4 mr-2" />
											{event.date}
										</div>
										<div className="flex items-center text-sm text-muted-foreground">
											<Clock className="h-4 w-4 mr-2" />
											{event.time}
										</div>
										<div className="flex items-center text-sm text-muted-foreground">
											<MapPin className="h-4 w-4 mr-2" />
											{event.location}
										</div>
										<div className="flex items-center text-sm text-muted-foreground">
											<Users className="h-4 w-4 mr-2" />
											{event.attendees} attendees
										</div>
									</div>

									<div className="flex flex-wrap gap-2 mb-4">
										{event.tags.map((tag) => (
											<Badge key={tag} variant="outline" className="text-xs">
												{tag}
											</Badge>
										))}
									</div>

									<div className="flex gap-2">
										<Button>Register</Button>
										<Button variant="outline">Learn More</Button>
									</div>
								</div>
							</div>
						</Card>
					))}
				</div>
			</div>
		</div>
	)
}
