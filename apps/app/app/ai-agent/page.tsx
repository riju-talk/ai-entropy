"use client"

import { useCallback, useState } from "react"
import { NotebookLayout } from "@/components/ai-agent/notebook/notebook-layout"
import { ChatAgent } from "@/components/ai-agent/chat-agent"
import dynamic from "next/dynamic"

// Each tool is only needed when its tab is opened, so load it on demand instead of with the page.
const TabLoading = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status">
    Loading...
  </div>
)
const QuizAgent = dynamic(() => import("@/components/ai-agent/quiz-agent").then((m) => m.QuizAgent), { ssr: false, loading: TabLoading })
const MindMapAgent = dynamic(() => import("@/components/ai-agent/mindmap-agent").then((m) => m.MindMapAgent), { ssr: false, loading: TabLoading })
const ChartsAgent = dynamic(() => import("@/components/ai-agent/charts-agent").then((m) => m.ChartsAgent), { ssr: false, loading: TabLoading })
const FlashcardsAgent = dynamic(() => import("@/components/ai-agent/flashcards-agent").then((m) => m.FlashcardsAgent), { ssr: false, loading: TabLoading })

const KnowledgeAtlas = dynamic(() => import("@/components/ai-agent/knowledge-atlas").then((m) => m.KnowledgeAtlas), { ssr: false, loading: TabLoading })

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState("qa")
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  // The open chat is shared by the sidebar's chat list and the chat view
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [sessionsRefresh, setSessionsRefresh] = useState(0)
  const refreshSessions = useCallback(() => setSessionsRefresh((n) => n + 1), [])

  // Fills the area beside the sidebar (header is 3.5rem); negative margins cancel the layout's page padding
  return (
    <div className="-mx-4 -my-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-background sm:-mx-6 lg:-mx-10">
      <NotebookLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDocId={selectedDoc?.id}
        onDocSelect={setSelectedDoc}
        conversationId={conversationId}
        onConversationSelect={setConversationId}
        sessionsRefresh={sessionsRefresh}
      >
        <div className="h-full w-full">
          {activeTab === "qa" && <ChatAgent contextDoc={selectedDoc} conversationId={conversationId} onConversationChange={setConversationId} onActivity={refreshSessions} />}
          {activeTab === "assessments" && <QuizAgent />}
          {activeTab === "flashcards" && <FlashcardsAgent />}
          {activeTab === "mindmap" && <MindMapAgent contextDoc={selectedDoc} />}
          {activeTab === "knowledge" && <KnowledgeAtlas />}
          {activeTab === "charts" && <ChartsAgent contextDoc={selectedDoc} />}
        </div>
      </NotebookLayout>
    </div>
  )
}

