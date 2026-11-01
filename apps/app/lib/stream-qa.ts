/** Client for POST /api/ai-agent/qa/stream (Server-Sent Events over fetch, so we can send a body). */

export interface StageEvent {
  name: string
  status: "start" | "done" | "timeout" | "error" | "skipped"
  ms?: number
}

export interface QAResult {
  answer: string
  conversationId?: string
  cognitive_trace?: any
  [key: string]: any
}

export class QAStreamError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message)
  }
}

export async function streamQA(
  body: Record<string, unknown>,
  on: { token?: (text: string) => void; stage?: (e: StageEvent) => void; meta?: (m: any) => void; signal?: AbortSignal }
): Promise<QAResult> {
  let res: Response
  try {
    res = await fetch("/api/ai-agent/qa/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: on.signal,
    })
  } catch {
    throw new QAStreamError("Could not reach the server. Check your connection and try again.", "network")
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null)
    const message = res.status === 401 ? "Sign in to use the AI tutor." : data?.error || `The AI tutor is unavailable (${res.status}).`
    throw new QAStreamError(message, "http", res.status)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let conversationId: string | undefined
  let final: QAResult | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut: number
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, cut)
      buffer = buffer.slice(cut + 2)
      const event = /^event: (.+)$/m.exec(block)?.[1]
      const dataLine = /^data: (.+)$/m.exec(block)?.[1]
      if (!event || !dataLine) continue
      let data: any
      try {
        data = JSON.parse(dataLine)
      } catch {
        continue
      }
      if (event === "token") on.token?.(data.text)
      else if (event === "stage") on.stage?.(data)
      else if (event === "meta") on.meta?.(data)
      else if (event === "conversation") conversationId = data.id ?? undefined
      else if (event === "final") final = data
      else if (event === "error") throw new QAStreamError(data.message || "The AI tutor ran into a problem.", data.code)
    }
  }

  if (!final) throw new QAStreamError("The answer was cut off. Please try again.", "incomplete")
  return { ...final, conversationId }
}
