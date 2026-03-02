import { AdaptiveLearningInterface } from "@/components/adaptive-learning-interface"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Adaptive Learning | NOVYRA",
  description: "Experience the 7-layer AI brain with adaptive reasoning, mastery tracking, and knowledge graph intelligence",
}

export default function LearnPage() {
  return (
    <div className="fixed inset-0 pt-16 bg-background">
      <AdaptiveLearningInterface />
    </div>
  )
}
