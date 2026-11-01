"use client"

import { useState } from "react"
import { NotebookLayout } from "@/components/ai-agent/notebook/notebook-layout"
import { ChatAgent } from "@/components/ai-agent/chat-agent"
import { QuizAgent } from "@/components/ai-agent/quiz-agent"
import { MindMapAgent } from "@/components/ai-agent/mindmap-agent"
import { ChartsAgent } from "@/components/ai-agent/charts-agent"
import { FlashcardsAgent } from "@/components/ai-agent/flashcards-agent"

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState("qa")
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)

  // Fills the area beside the sidebar (header is 3.5rem); negative margins cancel the layout's page padding
  return (
    <div className="-mx-4 -my-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-background sm:-mx-6 lg:-mx-10">
      <NotebookLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDocId={selectedDoc?.id}
        onDocSelect={setSelectedDoc}
      >
        <div className="h-full w-full">
          {activeTab === "qa" && <ChatAgent contextDoc={selectedDoc} />}
          {activeTab === "assessments" && <QuizAgent />}
          {activeTab === "flashcards" && <FlashcardsAgent />}
          {activeTab === "mindmap" && <MindMapAgent contextDoc={selectedDoc} />}
          {activeTab === "charts" && <ChartsAgent contextDoc={selectedDoc} />}
        </div>
      </NotebookLayout>
    </div>
  )
}

