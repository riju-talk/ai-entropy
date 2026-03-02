"use client"

import { useState } from "react"
import { NotebookLayout } from "@/components/ai-agent/notebook/notebook-layout"
import { ChatAgent } from "@/components/ai-agent/chat-agent"
import { QuizAgent } from "@/components/ai-agent/quiz-agent"
import { MindMapAgent } from "@/components/ai-agent/mindmap-agent"
import { ChartsAgent } from "@/components/ai-agent/charts-agent"

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState("qa")
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)

  return (
    <div className="fixed inset-0 pt-16 bg-[#0a0a0f]">
      <NotebookLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDocId={selectedDoc?.id}
        onDocSelect={setSelectedDoc}
      >
        <div className="h-full w-full">
          {activeTab === "qa" && <ChatAgent contextDoc={selectedDoc} />}
          {activeTab === "assessments" && <QuizAgent />}
          {activeTab === "flashcards" && <QuizAgent />}
          {activeTab === "mindmap" && <MindMapAgent contextDoc={selectedDoc} />}
          {activeTab === "charts" && <ChartsAgent contextDoc={selectedDoc} />}
        </div>
      </NotebookLayout>
    </div>
  )
}

