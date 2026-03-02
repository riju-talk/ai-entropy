"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, RefreshCw } from "lucide-react"

interface Flashcard {
  front: string
  back: string
}

export function FlashcardsAgent() {
  const [topic, setTopic] = useState("")
  const [customPrompt, setCustomPrompt] = useState("")
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Flashcard[]>([])
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: "Topic required", description: "Please enter a topic", variant: "destructive" })
      return
    }
    setLoading(true)
    setCards([])

    try {
      const res = await fetch("/api/ai-agent/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          count,
          customPrompt: customPrompt.trim() || undefined
        })
      })
      if (!res.ok) throw new Error("Failed to generate flashcards")
      const data = await res.json()
      setCards(data.flashcards || [])
    } catch (e) {
      console.error("Flashcard error:", e)
      toast({ title: "Error", description: "Failed to generate flashcards", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Flashcards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Topic</Label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="Enter topic like 'Cellular Respiration' or 'React Hooks'"/>
          </div>

          <div>
            <Label>Custom Prompt (optional)</Label>
            <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={3} placeholder="Optional: give the AI extra guidance, e.g., 'Focus on core formulas and definitions'"/>
          </div>

          <div className="flex items-center gap-2">
            <Label>Count</Label>
            <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24"/>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</> : <><RefreshCw className="mr-2 h-4 w-4"/>Generate</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((c, i) => (
            <Card key={i}>
              <CardContent>
                <h4 className="font-semibold mb-2">Q{i+1}: {c.front}</h4>
                <p className="text-sm text-muted-foreground">{c.back}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
