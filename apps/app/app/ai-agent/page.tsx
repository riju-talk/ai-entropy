"use client"

import { useState } from "react"
import { NotebookLayout } from "@/components/ai-agent/notebook/notebook-layout"
import { ChatAgent } from "@/components/ai-agent/chat-agent"
import { MindMapAgent } from "@/components/ai-agent/mindmap-agent"
import { AssessmentsAgent } from "@/components/ai-agent/assessments-agent"
import { ChartsAgent } from "@/components/ai-agent/charts-agent"
import { Sparkles } from "lucide-react"

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState("qa")
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)

  return (
    <div className="fixed inset-0 pt-16 bg-background">
      <NotebookLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDocId={selectedDoc?.id}
        onDocSelect={setSelectedDoc}
      >
        <div className="h-full w-full">
          {activeTab === "qa" && <ChatAgent contextDoc={selectedDoc} />}
          {activeTab === "mindmap" && <MindMapAgent contextDoc={selectedDoc} />}
          {(activeTab === "assessments" || activeTab === "flashcards") && (
            <AssessmentsAgent contextDoc={selectedDoc} />
          )}
          {activeTab === "charts" && <ChartsAgent contextDoc={selectedDoc} />}
        </div>
      </NotebookLayout>
    </div>
  )
}
