// lib/spark-api.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_SPARK_API_URL ||
  (typeof window !== "undefined"
    ? "/api/ai-agent" // Use Next.js proxy on client
    : "https://entropy-community-forum.onrender.com/api"); // Use Render backend on server

const AI_BACKEND_TOKEN = process.env.NEXT_PUBLIC_AI_BACKEND_TOKEN || "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  follow_up_questions: string[];
  credits_used: number;
  timestamp: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardResponse {
  flashcards: Flashcard[];
  credits_used: number;
  total_generated: number;
}

export interface QuizQuestion {
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface QuizResponse {
  quiz: QuizQuestion[];
  credits_used: number;
  total_questions: number;
}

export interface MindMapResponse {
  mind_map: {
    topic: string;
    style: string;
    depth: number;
    node_count: number;
  };
  mermaid_code: string;
  credits_used: number;
}

class SparkAPI {
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = AI_BACKEND_TOKEN;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==================== Function 1: Chat ====================

  async chat(userId: string, message: string, sessionId?: string): Promise<ChatResponse> {
    return this.request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        message,
        session_id: sessionId,
      }),
    });
  }

  // ==================== Function 2: Flashcards ====================

  async generateFlashcards(
    userId: string,
    topic: string,
    numCards: number = 10,
    difficulty: "easy" | "medium" | "hard" = "medium"
  ): Promise<FlashcardResponse> {
    return this.request<FlashcardResponse>("/api/flashcards/generate", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        topic,
        num_cards: numCards,
        difficulty,
      }),
    });
  }

  // ==================== Function 3: Quiz ====================

  async generateQuiz(
    userId: string,
    topic: string,
    numQuestions: number = 5,
    questionTypes: string[] = ["mcq", "true_false"]
  ): Promise<QuizResponse> {
    return this.request<QuizResponse>("/api/quiz/generate", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        topic,
        num_questions: numQuestions,
        question_types: questionTypes,
      }),
    });
  }

  // ==================== Function 4: Mind Map ====================

  async generateMindMap(
    userId: string,
    topic: string,
    depth: number = 3,
    style: "hierarchical" | "radial" | "flowchart" = "hierarchical"
  ): Promise<MindMapResponse> {
    return this.request<MindMapResponse>("/api/mindmap/generate", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        topic,
        depth,
        style,
      }),
    });
  }

  // ==================== Documents ====================

  async uploadDocument(userId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${this.baseURL}/api/documents/upload?user_id=${userId}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Document upload failed");
    }

    return response.json();
  }

  async listDocuments(userId: string): Promise<{ documents: string[]; count: number }> {
    return this.request<{ documents: string[]; count: number }>(
      `/api/documents/${userId}`
    );
  }

  // ==================== Utility ====================

  async getServiceInfo(): Promise<any> {
    return this.request("/api/info");
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request("/health");
  }
}

export const sparkAPI = new SparkAPI();
