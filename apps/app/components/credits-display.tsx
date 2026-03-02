"use client"

import { useEffect, useState } from "react"
import { Coins } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => setCredits(data.credits))
      .catch(console.error)
  }, [])

  if (credits === null) return null

  return (
    <Badge variant={credits < 10 ? "destructive" : "default"} className="gap-1">
      <Coins className="h-3 w-3" />
      {credits} Credits
    </Badge>
  )
}
