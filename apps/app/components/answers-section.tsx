"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { AnswerForm } from "@/components/answer-form"
import { AnswersList } from "@/components/answers-list"

interface Answer {
  id: string
  content: string
  createdAt: Date
  authorId: string
  author?: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface AnswersSectionProps {
  doubtId: string
  initialAnswers: Answer[]
  doubtAuthorId: string
  answersCount: number
}

export function AnswersSection({ 
  doubtId, 
  initialAnswers, 
  doubtAuthorId,
  answersCount: initialCount 
}: AnswersSectionProps) {
  const { data: session } = useSession()
  const [answers, setAnswers] = useState(initialAnswers)
  const [count, setCount] = useState(initialCount)

  // Get current user's ID from session
  const getCurrentUserId = async () => {
    if (!session?.user?.email) return null
    
    try {
      const response = await fetch("/api/users/me/profile")
      const data = await response.json()
      return data.id
    } catch (error) {
      return null
    }
  }

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useState(() => {
    getCurrentUserId().then(setCurrentUserId)
  })

  const handleAnswerAdded = async () => {
    // Fetch fresh first page of answers (7 per page)
    const response = await fetch(`/api/doubts/${doubtId}/answers?limit=7&page=1`)
    if (response.ok) {
      const data = await response.json()
      setAnswers(data.answers || [])
      setCount(data.total ?? (data.answers || []).length)
    }
  }

  return (
    <>
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">Your Answer</h2>
        <AnswerForm doubtId={doubtId} onAnswerAdded={handleAnswerAdded} />
      </div>

      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {count} {count === 1 ? "Answer" : "Answers"}
          </h2>
        </div>
        <AnswersList 
          answers={answers} 
          doubtAuthorId={doubtAuthorId}
          currentUserId={currentUserId || undefined}
        />
      </div>
    </>
  )
}
