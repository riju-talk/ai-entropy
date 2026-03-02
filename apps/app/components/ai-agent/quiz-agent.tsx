"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

export function QuizAgent() {
  const [topic, setTopic] = useState("")
  const [numQuestions, setNumQuestions] = useState(5)
  const [difficulty, setDifficulty] = useState("medium")
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setShowResults(false)
    setSelectedAnswers({})
    setCurrentQuestion(0)

    try {
      const response = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic: topic.trim(), 
          num_questions: numQuestions, 
          difficulty,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate quiz")

      const data = await response.json()
      setQuestions(data.questions || [])
      
      toast({
        title: "Success!",
        description: `Generated ${data.questions?.length || 0} questions`,
      })

      // Deduct 5 credits for quiz generation
      try {
        await fetch("/api/credits/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 5,
            operation: "quiz",
            metadata: { topic, numQuestions, difficulty }
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
      setLoading(false)
    }
  }

  const handleSubmit = () => {
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
      {questions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-topic">Topic</Label>
              <Textarea
                id="quiz-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter topic for quiz..."
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
                <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                  <Label htmlFor="custom-prompt" className="text-sm font-medium">
                    Custom System Prompt (Optional)
                  </Label>
                  <Textarea
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Example: 'Focus on practical coding examples' or 'Use simple language for beginners' or 'Include real-world scenarios'..."
                    rows={4}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: Customize how the AI generates questions. Leave empty to use the default prompt optimized for educational content.
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleGenerate} className="w-full" disabled={loading}>
              {loading ? (
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
                  Score: {score}/{questions.length}
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
                  onValueChange={(value) =>
                    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: Number(value) })
                  }
                >
                  {currentQuestionData.options.map((option, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center space-x-2 p-3 rounded-lg border ${
                        showResults
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
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Explanation:</p>
                    <p className="text-sm">{currentQuestionData.explanation}</p>
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
                    <Button onClick={handleSubmit}>Submit Quiz</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
