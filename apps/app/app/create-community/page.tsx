"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export default function CreateCommunityPage() {
	const { data: session, status } = useSession()
	const isAuthenticated = status === "authenticated"
	const { open: openAuthModal } = useAuthModal()
	const router = useRouter()
	const { toast } = useToast()

	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [subject, setSubject] = useState("OTHER")
	const [isPublic, setIsPublic] = useState(true)
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!isAuthenticated) {
			openAuthModal()
			return
		}
		if (!name.trim()) {
			toast({ title: "Name required", variant: "destructive" })
			return
		}
		setLoading(true)
		try {
			const res = await fetch("/api/communities", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), description: description.trim(), subject, isPublic }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data?.error || "Failed to create community")
			toast({ title: "Community created", description: data.community?.name })
			// redirect to community page if available, otherwise home
			if (data.community?.id) {
				router.push(`/communities/${data.community.id}`)
			} else {
				router.push("/")
			}
		} catch (err: any) {
			toast({ title: "Error", description: err.message || "Failed to create", variant: "destructive" })
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-3xl mx-auto bg-card p-6 rounded">
			<h1 className="text-2xl font-semibold mb-4">Create a Community</h1>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="text-sm font-medium block mb-1">Name</label>
					<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" />
				</div>

				<div>
					<label className="text-sm font-medium block mb-1">Description</label>
					<Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Short description" />
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label className="text-sm font-medium block mb-1">Subject</label>
						<Select onValueChange={(v) => setSubject(v)} defaultValue={subject}>
							<SelectTrigger>
								<SelectValue placeholder="Subject" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
								<SelectItem value="MATHEMATICS">Mathematics</SelectItem>
								<SelectItem value="PHYSICS">Physics</SelectItem>
								<SelectItem value="OTHER">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">Visibility</label>
						<div className="flex gap-2">
							<Button variant={isPublic ? "secondary" : "ghost"} onClick={() => setIsPublic(true)}>Public</Button>
							<Button variant={!isPublic ? "secondary" : "ghost"} onClick={() => setIsPublic(false)}>Private</Button>
						</div>
					</div>
				</div>

				<div className="flex justify-end">
					<Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Community"}</Button>
				</div>
			</form>
		</div>
	)
}
