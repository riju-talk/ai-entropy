"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
		<div className="relative">
			{/* Coming Soon Ribbon */}
			<div className="absolute top-3 right-3 z-10">
				<div className="bg-amber-500 text-white px-3 py-1 rounded-md text-sm font-semibold shadow">
					Coming soon
				</div>
			</div>

			{/* Blurred Content */}
			<div className="space-y-6 filter blur-sm opacity-80 pointer-events-none">
				<div>
					<h1 className="text-3xl font-bold mb-2">Find a Mentor</h1>
					<p className="text-muted-foreground">
						Connect with experienced mentors to guide your academic journey
					</p>
				</div>

				{/* Search and Filter */}
				<Card>
					<CardContent className="pt-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="relative">
								<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search mentors by name or expertise..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-9"
								/>
							</div>
							<Tabs value={selectedSubject} onValueChange={setSelectedSubject}>
								<TabsList className="grid w-full grid-cols-5">
									<TabsTrigger value="all">All</TabsTrigger>
									<TabsTrigger value="CS">CS</TabsTrigger>
									<TabsTrigger value="Math">Math</TabsTrigger>
									<TabsTrigger value="Physics">Physics</TabsTrigger>
									<TabsTrigger value="Chemistry">Chem</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</CardContent>
				</Card>

				{/* Mentors Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredMentors.map((mentor) => (
						<Card key={mentor.id} className="hover:shadow-lg transition-shadow">
							<CardHeader>
								<div className="flex items-start gap-4">
									<Avatar className="h-16 w-16">
										<AvatarImage src={mentor.image} />
										<AvatarFallback>
											{mentor.name
												.split(" ")
												.map((n) => n[0])
												.join("")}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<CardTitle className="text-lg">{mentor.name}</CardTitle>
										<CardDescription>{mentor.title}</CardDescription>
										<div className="flex items-center gap-1 mt-1">
											<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
											<span className="text-sm font-medium">{mentor.rating}</span>
											<span className="text-xs text-muted-foreground">
												({mentor.reviewCount} reviews)
											</span>
										</div>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<p className="text-sm text-muted-foreground mb-2">Expertise:</p>
									<div className="flex flex-wrap gap-2">
										{mentor.expertise.map((skill) => (
											<Badge key={skill} variant="secondary">
												{skill}
											</Badge>
										))}
									</div>
								</div>

								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2 text-muted-foreground">
										<BookOpen className="h-4 w-4" />
										<span>{mentor.sessionsCompleted} sessions completed</span>
									</div>
									<div className="flex items-center gap-2 text-muted-foreground">
										<Users className="h-4 w-4" />
										<span>{mentor.students} students mentored</span>
									</div>
									<div className="flex items-center gap-2 text-muted-foreground">
										<Clock className="h-4 w-4" />
										<span>{mentor.availability}</span>
									</div>
									{mentor.university && (
										<div className="flex items-center gap-2 text-muted-foreground">
											<MapPin className="h-4 w-4" />
											<span>{mentor.university}</span>
										</div>
									)}
								</div>

								<Button className="w-full">Request Session</Button>
							</CardContent>
						</Card>
					))}
				</div>

				{filteredMentors.length === 0 && (
					<Card>
						<CardContent className="text-center py-12">
							<p className="text-muted-foreground">No mentors found matching your criteria</p>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	)
}
