"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"

const subjects = [
  { value: "COMPUTER_SCIENCE", label: "Computer Science" },
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "PHYSICS", label: "Physics" },
  { value: "DATA_SCIENCE", label: "Data Science" },
  { value: "PROGRAMMING", label: "Programming" },
  { value: "WEB_DEVELOPMENT", label: "Web Development" },
  { value: "OTHER", label: "Other" },
]

interface CommunityFiltersProps {
  currentSubject?: string
}

export function CommunityFilters({ currentSubject }: CommunityFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubjectChange = (subject: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (currentSubject === subject) {
      params.delete("subject")
    } else {
      params.set("subject", subject)
    }
    params.delete("page")

    router.push(`/community?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push("/community")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter by Subject</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subjects.map((subject) => (
            <Button
              key={subject.value}
              variant={currentSubject === subject.value ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleSubjectChange(subject.value)}
            >
              {subject.label}
            </Button>
          ))}
          
          {currentSubject && (
            <Button variant="outline" className="w-full mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="cursor-pointer">javascript</Badge>
            <Badge variant="secondary" className="cursor-pointer">python</Badge>
            <Badge variant="secondary" className="cursor-pointer">react</Badge>
            <Badge variant="secondary" className="cursor-pointer">algorithms</Badge>
            <Badge variant="secondary" className="cursor-pointer">databases</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Community Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Active Users</span>
            <span className="font-semibold">2.4M</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Questions Today</span>
            <span className="font-semibold">1,247</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Answers Today</span>
            <span className="font-semibold">3,891</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
