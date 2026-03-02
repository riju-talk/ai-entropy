"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Brain,
  Lightbulb,
  TrendingUp,
  Sparkles,
  Send,
  Loader2,
  Target,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

interface MasteryState {
  concept: string
  mastery_score: number
  delta: number
  status: "mastered" | "improving" | "struggling"
  nudge?: string
}

interface ReasoningResponse {
  concept: string
  prerequisites: string[]
  stepwise_reasoning: string[]
  hint_ladder: string[]
  final_solution: string
  confidence_score: number
  related_concepts: string[]
  common_mistakes?: string[]
  language: string
}

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  reasoning?: ReasoningResponse
  mastery?: MasteryState
  showHints?: boolean
  currentHintLevel?: number
}

export function AdaptiveLearningInterface() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPrerequisites, setShowPrerequisites] = useState<Record<number, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userMastery, setUserMastery] = useState<Record<string, number>>({})
  const [hintsRevealed, setHintsRevealed] = useState<Record<number, number>>({})

  useEffect(() => {
    // Load initial greeting with system status
    setMessages([
      {
        role: "system",
        content: `# Welcome to NOVYRA's Adaptive Learning System 🧠

I'm powered by a **7-layer AI architecture** that understands:
- **Knowledge Graph**: 200+ concepts across 25+ disciplines
- **Mastery Tracking**: Your learning progress over time
- **Adaptive Reasoning**: Personalized explanations based on your level
- **Prerequisite Detection**: Identifies gaps in your knowledge
- **Rubric-Based Evaluation**: Structured, explainable feedback
- **Multilingual Support**: Learn in your language
- **Edge Optimization**: Fast, intelligent AI routing

**How to use:**
1. Ask any question across any subject
2. I'll detect your mastery level and adapt my explanation
3. Get structured reasoning with hint ladders
4. Track your progress as you learn

Try asking: "What is binary search?" or "Explain photosynthesis"`,
      },
    ])

    // Load user's current mastery if logged in
    if (session?.user?.id) {
      loadUserMastery()
    }
  }, [session])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadUserMastery = async () => {
    try {
      const response = await fetch(`/api/mastery/profile/${session?.user?.id}`)
      if (response.ok) {
        const data = await response.json()
        const masteryMap: Record<string, number> = {}
        data.concepts?.forEach((c: any) => {
          masteryMap[c.concept] = c.mastery_score
        })
        setUserMastery(masteryMap)
      }
    } catch (error) {
      console.error("Failed to load mastery profile:", error)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setLoading(true)

    try {
      // Step 1: Call the adaptive reasoning engine
      const reasoningResponse = await fetch("/api/reasoning/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          user_id: session?.user?.id || "anonymous",
          language: "en",
          include_hints: true,
        }),
      })

      if (!reasoningResponse.ok) {
        throw new Error("Failed to get reasoning response")
      }

      const reasoning: ReasoningResponse = await reasoningResponse.json()

      // Add reasoning response to messages
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reasoning.final_solution,
          reasoning,
          showHints: false,
          currentHintLevel: 0,
        },
      ])

      // Step 2: If user is authenticated, record this as an attempt
      // (In a real scenario, you'd track correctness after user answers)
      if (session?.user?.id && reasoning.concept) {
        // For demo, we'll record this as a successful interaction
        recordAttempt(reasoning.concept, true, 0)
      }
    } catch (error) {
      console.error("Error getting AI response:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I apologize, but I encountered an error processing your question. Please make sure the AI backend is running on port 8000.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const recordAttempt = async (concept: string, isCorrect: boolean, hintsUsed: number) => {
    try {
      const response = await fetch("/api/mastery/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session?.user?.id,
          concept,
          is_correct: isCorrect,
          hints_used: hintsUsed,
        }),
      })

      if (response.ok) {
        const mastery: MasteryState = await response.json()

        // Update local mastery state
        setUserMastery((prev) => ({
          ...prev,
          [concept]: mastery.mastery_score,
        }))

        // Add mastery update to messages if significant change
        if (Math.abs(mastery.delta) > 0.05) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `**Mastery Update**: ${concept} → ${(mastery.mastery_score * 100).toFixed(0)}% ${mastery.delta > 0 ? "📈" : "📉"}`,
              mastery,
            },
          ])
        }
      }
    } catch (error) {
      console.error("Failed to record attempt:", error)
    }
  }

  const revealHint = (messageIndex: number, currentLevel: number) => {
    setHintsRevealed((prev) => ({
      ...prev,
      [messageIndex]: currentLevel + 1,
    }))
  }

  const togglePrerequisites = (index: number) => {
    setShowPrerequisites((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with Mastery Summary */}
      {session?.user && Object.keys(userMastery).length > 0 && (
        <div className="border-b bg-muted/30 p-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-semibold">Your Learning Progress</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Avg Mastery:</span>
                <span className="ml-2 font-semibold">
                  {(
                    (Object.values(userMastery).reduce((a, b) => a + b, 0) / Object.values(userMastery).length) *
                    100
                  ).toFixed(0)}
                  %
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Concepts:</span>
                <span className="ml-2 font-semibold">{Object.keys(userMastery).length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role !== "user" && (
                <div className="flex-shrink-0">
                  {message.role === "system" ? (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <Info className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              )}

              <div className={cn("flex-1 space-y-2", message.role === "user" ? "max-w-[80%]" : "max-w-full")}>
                {/* Main Message */}
                <Card
                  className={cn(
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : message.role === "system"
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : "bg-card"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>

                {/* Reasoning Details (for assistant messages) */}
                {message.reasoning && message.role === "assistant" && (
                  <div className="space-y-3">
                    {/* Concept & Confidence */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {message.reasoning.concept}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Confidence: {(message.reasoning.confidence_score * 100).toFixed(0)}%
                      </Badge>
                      {userMastery[message.reasoning.concept] !== undefined && (
                        <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                          <Brain className="h-3 w-3" />
                          Mastery: {(userMastery[message.reasoning.concept] * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>

                    {/* Prerequisites */}
                    {message.reasoning.prerequisites.length > 0 && (
                      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <CardHeader className="p-3">
                          <button
                            onClick={() => togglePrerequisites(index)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Prerequisites ({message.reasoning.prerequisites.length})
                            </CardTitle>
                            {showPrerequisites[index] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </CardHeader>
                        {showPrerequisites[index] && (
                          <CardContent className="p-3 pt-0">
                            <div className="space-y-2">
                              {message.reasoning.prerequisites.map((prereq, i) => {
                                const masteryLevel = userMastery[prereq]
                                const status =
                                  masteryLevel === undefined
                                    ? "unknown"
                                    : masteryLevel >= 0.8
                                      ? "strong"
                                      : masteryLevel >= 0.5
                                        ? "okay"
                                        : "weak"

                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    {status === "strong" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                    {status === "okay" && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                                    {status === "weak" && <AlertCircle className="h-4 w-4 text-red-600" />}
                                    {status === "unknown" && <Info className="h-4 w-4 text-gray-400" />}
                                    <span className="text-sm">{prereq}</span>
                                    {masteryLevel !== undefined && (
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {(masteryLevel * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )}

                    {/* Hint Ladder */}
                    {message.reasoning.hint_ladder.length > 0 && (
                      <Card>
                        <CardHeader className="p-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Structured Hints ({message.reasoning.hint_ladder.length})
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Reveal hints progressively if you need help
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          {message.reasoning.hint_ladder.map((hint, hintIndex) => {
                            const isRevealed = (hintsRevealed[index] || 0) > hintIndex

                            return (
                              <div key={hintIndex}>
                                {isRevealed ? (
                                  <Alert className="bg-yellow-50 dark:bg-yellow-950/20">
                                    <Lightbulb className="h-4 w-4" />
                                    <AlertDescription className="text-sm">{hint}</AlertDescription>
                                  </Alert>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => revealHint(index, hintIndex)}
                                    className="w-full justify-start"
                                    disabled={hintIndex > 0 && (hintsRevealed[index] || 0) < hintIndex}
                                  >
                                    <Lightbulb className="h-3 w-3 mr-2" />
                                    Reveal Hint {hintIndex + 1}
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {/* Related Concepts */}
                    {message.reasoning.related_concepts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Related:</span>
                        {message.reasoning.related_concepts.map((concept, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Mastery Update (for system messages) */}
                {message.mastery && (
                  <Card
                    className={cn(
                      message.mastery.status === "mastered"
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200"
                        : message.mastery.status === "improving"
                          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200"
                          : "bg-red-50 dark:bg-red-950/20 border-red-200"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{message.mastery.concept}</span>
                          <Badge
                            variant={
                              message.mastery.status === "mastered"
                                ? "default"
                                : message.mastery.status === "improving"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {message.mastery.status}
                          </Badge>
                        </div>
                        <Progress value={message.mastery.mastery_score * 100} className="h-2" />
                        {message.mastery.nudge && (
                          <p className="text-xs text-muted-foreground italic">{message.mastery.nudge}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs text-primary-foreground font-semibold">
                      {session?.user?.name?.[0] || "U"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              </div>
              <Card className="flex-1">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      Analyzing your question, checking prerequisites, and generating adaptive response...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask any question... I'll adapt my explanation to your learning level!"
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <Button type="submit" disabled={loading || !input.trim()} size="lg" className="px-8">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Powered by Knowledge Graph + Mastery Tracking + Adaptive Reasoning
          </p>
        </form>
      </div>
    </div>
  )
}
