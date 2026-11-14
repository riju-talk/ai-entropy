/**
 * Client for POST /api/ai-agent/qa/stream (Server-Sent Events over fetch, so we can send a body).
 *
 * Contract with the server (see apps/ai-agent/app/api/routes/qa.py):
 *   stage | tool | meta | token | continuation   progress, rendered as it arrives
 *   final                                        the complete, validated result (authoritative answer text)
 *   error                                        the run failed
 *   done                                         always last: {ok}. A stream that ends WITHOUT `done` was cut off.
 * Lines beginning with ":" are heartbeats and are ignored.
 *
 * Failure handling: every failure is a QAStreamError with a `code` and the `partial` answer text received so far,
 * so the UI can keep what the student already read instead of throwing it away.
 */

export interface StageEvent {
  name: string
  status: "start" | "done" | "timeout" | "error" | "skipped"
  ms?: number
  detail?: string
}

export interface ToolEvent {
  id: string
  name: string
  kind: "builtin" | "mcp"
  status: "running" | "ok" | "error" | "timeout"
  ms?: number
  summary?: string
  origin?: string
}

export interface QAResult {
  answer: string
  conversationId?: string
  cognitive_trace?: any
  nli?: { verdict: string; supported_ratio: number | null; relevance: number | null; issues: string[]; qualification: string } | null
  answer_note?: string
  completion?: { finish_reason: string; continuations: number; truncated: boolean }
  [key: string]: any
}

export type QAErrorCode = "network" | "http" | "incomplete" | "interrupted" | "aborted" | "rate_limited" | "not_configured" | string

export class QAStreamError extends Error {
  constructor(message: string, public code?: QAErrorCode, public status?: number, public partial: string = "", public retryAfter?: number) {
    super(message)
  }
}

export interface StreamHandlers {
  token?: (text: string) => void
  stage?: (e: StageEvent) => void
  tool?: (e: ToolEvent) => void
  meta?: (m: any) => void
  continuation?: (n: number) => void
  signal?: AbortSignal
}

/** Parse one SSE block into {event, data}. Handles CRLF, multi-line data, and comment (heartbeat) lines. */
function parseBlock(block: string): { event: string; data: any } | null {
  let event = "message"
  const data: string[] = []
  for (const raw of block.split(/\r?\n/)) {
    if (!raw || raw.startsWith(":")) continue
    const i = raw.indexOf(":")
    const field = i === -1 ? raw : raw.slice(0, i)
    const value = i === -1 ? "" : raw.slice(i + 1).replace(/^ /, "")
    if (field === "event") event = value
    else if (field === "data") data.push(value)
  }
  if (!data.length) return null
  try {
    return { event, data: JSON.parse(data.join("\n")) }
  } catch {
    return null
  }
}

export async function streamQA(body: Record<string, unknown>, on: StreamHandlers): Promise<QAResult> {
  let partial = ""
  let res: Response
  try {
    res = await fetch("/api/ai-agent/qa/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: on.signal,
    })
  } catch (e: any) {
    if (e?.name === "AbortError") throw new QAStreamError("Stopped.", "aborted")
    throw new QAStreamError("Could not reach the server. Check your connection and try again.", "network")
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null)
    const retryAfter = Number(res.headers.get("retry-after")) || undefined
    const message =
      res.status === 401
        ? "Sign in to use the AI tutor."
        : res.status === 429
          ? data?.detail || data?.error || "You're asking quickly. Please wait a moment and try again."
          : res.status === 503
            ? data?.error || "The AI tutor is not available right now."
            : data?.error || `The AI tutor is unavailable (${res.status}).`
    throw new QAStreamError(typeof message === "string" ? message : "The AI tutor is unavailable.", res.status === 429 ? "rate_limited" : "http", res.status, "", retryAfter)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let conversationId: string | undefined
  let final: QAResult | null = null
  let serverError: QAStreamError | null = null
  let sawDone = false

  const handle = (block: string) => {
    const parsed = parseBlock(block)
    if (!parsed) return
    const { event, data } = parsed
    if (event === "token") {
      partial += data.text
      on.token?.(data.text)
    } else if (event === "stage") on.stage?.(data)
    else if (event === "tool") on.tool?.(data)
    else if (event === "meta") on.meta?.(data)
    else if (event === "continuation") on.continuation?.(data.n)
    else if (event === "conversation") conversationId = data.id ?? undefined
    else if (event === "final") final = data
    else if (event === "error") serverError = new QAStreamError(data.message || "The AI tutor ran into a problem.", data.code, undefined, partial)
    else if (event === "done") sawDone = true
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let cut: number
      // Events are separated by a blank line (\n\n or \r\n\r\n).
      while ((cut = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const sep = buffer.slice(cut).match(/^\r?\n\r?\n/)![0].length
        handle(buffer.slice(0, cut))
        buffer = buffer.slice(cut + sep)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) handle(buffer)
  } catch (e: any) {
    if (e?.name === "AbortError") throw new QAStreamError("Stopped.", "aborted", undefined, partial)
    // The connection dropped mid-answer (network change, proxy timeout, deploy). Keep what we have.
    throw new QAStreamError("The connection was interrupted before the answer finished.", "interrupted", undefined, partial)
  }

  if (serverError) throw serverError
  if (!final) {
    // Stream closed cleanly but with no final result: never present partial text as a finished answer.
    throw new QAStreamError(
      sawDone ? "The AI tutor finished without an answer. Please try again." : "The answer was cut off before it finished. Please try again.",
      "incomplete",
      undefined,
      partial
    )
  }
  return { ...(final as QAResult), conversationId }
}
