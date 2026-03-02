"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle, RefreshCw, GraduationCap, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

interface Flashcard {
  front: string
  back: string
}

interface AssessmentsAgentProps {
  contextDoc?: { id: string, title: string } | null
}

export function AssessmentsAgent({ contextDoc }: AssessmentsAgentProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("quiz")

  // Quiz state
  const [quizTopic, setQuizTopic] = useState(contextDoc?.title || "")
  const [numQuestions, setNumQuestions] = useState(5)
  const [difficulty, setDifficulty] = useState("medium")
  const [quizLoading, setQuizLoading] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [customQuizPrompt, setCustomQuizPrompt] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Flashcards state
  const [flashcardsTopic, setFlashcardsTopic] = useState("")
  const [customFlashcardsPrompt, setCustomFlashcardsPrompt] = useState("")
  const [flashcardsCount, setFlashcardsCount] = useState(10)
  const [flashcardsLoading, setFlashcardsLoading] = useState(false)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  const { toast } = useToast()

  // Update when context changes
  useEffect(() => {
    if (contextDoc?.title) {
      setQuizTopic(contextDoc.title)
      setFlashcardsTopic(contextDoc.title)
    }
  }, [contextDoc])

  // Quiz generation
  const handleGenerateQuiz = async () => {
    if (!quizTopic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for the quiz",
        variant: "destructive",
      })
      return
    }

    setQuizLoading(true)
    setShowResults(false)
    setSelectedAnswers({})
    setCurrentQuestion(0)

    try {
      const response = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: quizTopic.trim(),
          numQuestions,
          difficulty,
          customPrompt: customQuizPrompt.trim() || undefined,
          collection_name: contextDoc?.id || "default",
          userId: session?.user?.id || "anonymous"
        }),
      })

      if (!response.ok) throw new Error("Failed to generate quiz")

      const data = await response.json()
      setQuestions(data.questions || [])

      toast({
        title: "Success!",
        description: `Generated ${data.questions?.length || 0} quiz questions`,
      })

      // Deduct credits
      try {
        await fetch("/api/credits/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 5,
            operation: "assessments_quiz",
            metadata: { topic: quizTopic, numQuestions, difficulty }
          })
        })
      } catch (creditError) {
        console.warn("Failed to deduct credits:", creditError)
      }

    } catch (error) {
      console.error("Quiz generation error:", error)
      toast({
        title: "Error",
        description: "Failed to generate quiz",
        variant: "destructive",
      })
    } finally {
      setQuizLoading(false)
    }
  }

  // Flashcards generation
  const handleGenerateFlashcards = async () => {
    if (!flashcardsTopic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for flashcards",
        variant: "destructive"
      })
      return
    }

    setFlashcardsLoading(true)
    setCards([])
    setCurrentCardIndex(0)
    setIsFlipped(false)

    try {
      const res = await fetch("/api/ai-agent/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: flashcardsTopic.trim(),
          count: flashcardsCount,
          customPrompt: customFlashcardsPrompt.trim() || undefined,
          collection_name: contextDoc?.id || "default",
          userId: session?.user?.id || "anonymous"
        })
      })

      if (!res.ok) throw new Error("Failed to generate flashcards")

      const data = await res.json()
      setCards(data.flashcards || [])

      toast({
        title: "Success!",
        description: `Generated ${data.flashcards?.length || 0} flashcards`,
      })

      // Deduct credits
      try {
        await fetch("/api/credits/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 3,
            operation: "assessments_flashcards",
            metadata: { topic: flashcardsTopic, count: flashcardsCount }
          })
        })
      } catch (creditError) {
        console.warn("Failed to deduct credits:", creditError)
      }

    } catch (e) {
      console.error("Flashcard error:", e)
      toast({
        title: "Error",
        description: "Failed to generate flashcards",
        variant: "destructive"
      })
    } finally {
      setFlashcardsLoading(false)
    }
  }

  const handleSubmitQuiz = () => {
    setShowResults(true)
  }

  const score = Object.entries(selectedAnswers).reduce(
    (acc, [idx, answer]) => {
      const question = questions[Number(idx)]
      if (question && question.correctAnswer === answer) {
        return acc + 1
      }
      return acc
    },
    0
  )

  const currentQuestionData = questions[currentQuestion]

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <GraduationCap className="h-24 w-24 text-cyan-500" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-6 w-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-foreground">AI Assessments</h3>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl font-medium">
          Test your knowledge with AI-generated quizzes or study with interactive flashcards
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quiz">
            <GraduationCap className="mr-2 h-4 w-4" />
            Quiz
          </TabsTrigger>
          <TabsTrigger value="flashcards">
            <BookOpen className="mr-2 h-4 w-4" />
            Flashcards
          </TabsTrigger>
        </TabsList>

        {/* Quiz Tab */}
        <TabsContent value="quiz" className="space-y-4">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quiz-topic">Topic</Label>
                  <Textarea
                    id="quiz-topic"
                    value={quizTopic}
                    onChange={(e) => setQuizTopic(e.target.value)}
                    placeholder="Enter topic for quiz (e.g., 'React Hooks', 'Cellular Biology')..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num-questions">Number of Questions</Label>
                    <Input
                      id="num-questions"
                      type="number"
                      min={1}
                      max={20}
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <RadioGroup value={difficulty} onValueChange={setDifficulty}>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="easy" id="easy" />
                          <Label htmlFor="easy">Easy</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="medium" id="medium" />
                          <Label htmlFor="medium">Medium</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="hard" id="hard" />
                          <Label htmlFor="hard">Hard</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full text-sm"
                  >
                    {showAdvanced ? "▼" : "▶"} Advanced Options (Custom AI Prompt)
                  </Button>

                  {showAdvanced && (
                    <div className="space-y-2 p-4 border border-border/50 rounded-xl bg-muted/30 backdrop-blur-md">
                      <Label htmlFor="custom-prompt" className="text-sm font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                        Custom System Prompt (Optional)
                      </Label>
                      <Textarea
                        id="custom-prompt"
                        value={customQuizPrompt}
                        onChange={(e) => setCustomQuizPrompt(e.target.value)}
                        placeholder="Example: 'Focus on practical coding examples' or 'Use simple language for beginners'..."
                        rows={4}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        💡 Tip: Customize how the AI generates questions. Leave empty for default.
                      </p>
                    </div>
                  )}
                </div>

                <Button onClick={handleGenerateQuiz} className="w-full" disabled={quizLoading}>
                  {quizLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Quiz...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate Quiz
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    Question {currentQuestion + 1} of {questions.length}
                  </h3>
                  {showResults && (
                    <Badge variant={score / questions.length >= 0.7 ? "default" : "destructive"}>
                      Score: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
                    </Badge>
                  )}
                </div>
                <Button variant="outline" onClick={() => setQuestions([])}>
                  New Quiz
                </Button>
              </div>

              {currentQuestionData && (
                <Card>
                  <CardHeader>
                    <CardTitle>{currentQuestionData.question}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={String(selectedAnswers[currentQuestion] ?? "")}
                      onValueChange={(value: string) =>
                        setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: Number(value) })
                      }
                    >
                      {currentQuestionData.options.map((option, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center space-x-2 p-3 rounded-lg border ${showResults
                            ? idx === currentQuestionData.correctAnswer
                              ? "bg-green-500/10 border-green-500"
                              : selectedAnswers[currentQuestion] === idx
                                ? "bg-red-500/10 border-red-500"
                                : ""
                            : ""
                            }`}
                        >
                          <RadioGroupItem value={String(idx)} id={`option-${idx}`} disabled={showResults} />
                          <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                          {showResults && idx === currentQuestionData.correctAnswer && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {showResults &&
                            selectedAnswers[currentQuestion] === idx &&
                            idx !== currentQuestionData.correctAnswer && (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                      ))}
                    </RadioGroup>

                    {showResults && (
                      <div className="bg-muted/50 backdrop-blur-md p-4 rounded-xl border border-border/50">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Explanation</p>
                        <p className="text-sm font-medium">{currentQuestionData.explanation}</p>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentQuestion(currentQuestion - 1)}
                        disabled={currentQuestion === 0}
                      >
                        Previous
                      </Button>
                      {currentQuestion < questions.length - 1 ? (
                        <Button onClick={() => setCurrentQuestion(currentQuestion + 1)}>Next</Button>
                      ) : !showResults ? (
                        <Button onClick={handleSubmitQuiz}>Submit Quiz</Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards" className="space-y-4">
          {cards.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Generate Study Flashcards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Topic</Label>
                  <Textarea
                    value={flashcardsTopic}
                    onChange={(e) => setFlashcardsTopic(e.target.value)}
                    rows={2}
                    placeholder="Enter topic (e.g., 'Python Decorators', 'World War II key events')..."
                  />
                </div>

                <div>
                  <Label>Custom Prompt (optional)</Label>
                  <Textarea
                    value={customFlashcardsPrompt}
                    onChange={(e) => setCustomFlashcardsPrompt(e.target.value)}
                    rows={3}
                    placeholder="Optional: guide the AI (e.g., 'Focus on definitions and formulas')..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Number of Cards</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={flashcardsCount}
                      onChange={(e) => setFlashcardsCount(Number(e.target.value))}
                    />
                  </div>
                  <Button onClick={handleGenerateFlashcards} disabled={flashcardsLoading} className="mt-auto">
                    {flashcardsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    Card {currentCardIndex + 1} of {cards.length}
                  </h3>
                  <p className="text-sm text-muted-foreground">Click card to flip</p>
                </div>
                <Button variant="outline" onClick={() => {
                  setCards([])
                  setCurrentCardIndex(0)
                  setIsFlipped(false)
                }}>
                  New Set
                </Button>
              </div>

              <Card
                className="min-h-[300px] cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <CardContent className="flex items-center justify-center p-8 min-h-[300px]">
                  <div className="text-center space-y-4">
                    {!isFlipped ? (
                      <>
                        <Badge>Question</Badge>
                        <h4 className="text-xl font-semibold">{cards[currentCardIndex].front}</h4>
                      </>
                    ) : (
                      <>
                        <Badge variant="secondary">Answer</Badge>
                        <p className="text-lg">{cards[currentCardIndex].back}</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentCardIndex(Math.max(0, currentCardIndex - 1))
                    setIsFlipped(false)
                  }}
                  disabled={currentCardIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  onClick={() => {
                    setCurrentCardIndex(Math.min(cards.length - 1, currentCardIndex + 1))
                    setIsFlipped(false)
                  }}
                  disabled={currentCardIndex === cards.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
