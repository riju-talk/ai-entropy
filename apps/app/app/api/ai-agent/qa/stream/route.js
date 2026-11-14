import { NextResponse } from "next/server"

import { aiFetch, requireUser } from "@/lib/ai-proxy"
import { loadHistory, persistExchange } from "@/lib/qa-history"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60 // seconds; long answers keep streaming (heartbeats) instead of hitting the platform default

/**
 * POST /api/ai-agent/qa/stream
 * Streams the AI service's Server-Sent Events straight through to the browser (stage progress, tokens,
 * final result) while saving the exchange once the final event passes by.
 */
export async function POST(req) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { userId } = auth

  const body = await req.json().catch(() => null)
  const question = String(body?.question || body?.user_prompt || "").trim()
  if (!question) return NextResponse.json({ error: "Ask a question first" }, { status: 400 })
  if (question.length > 4000) return NextResponse.json({ error: "That question is too long (4,000 characters max)" }, { status: 400 })

  const { conversationId, history } = await loadHistory(userId, body.conversationId)

  const payload = JSON.stringify({
    question,
    system_prompt: body.system_prompt || body.systemPrompt || undefined,
    userId, // verified session user; anything in the request body is ignored
    language: body.language || "en",
    collection_name: body.collection_name || userId, // each learner's uploads live in their own namespace
    conversation_history: history.length ? history : undefined,
  })

  // The AI service may be waking from sleep (free hosting). Retry network errors and gateway errors a couple of times;
  // never retry a real answer from the service (including its own 503 "not configured", which carries a JSON body).
  const WAKING = new Set([502, 504])
  let upstream
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      upstream = await aiFetch(
        "/api/qa/stream",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: req.signal },
        userId
      )
    } catch (e) {
      if (req.signal?.aborted) return new Response(null, { status: 499 })
      upstream = null
    }
    const retryable = !upstream || WAKING.has(upstream.status)
    if (!retryable || attempt === 3) break
    await new Promise((r) => setTimeout(r, 6000))
  }
  if (!upstream) {
    return NextResponse.json({ error: "The AI service is waking up or not reachable right now. Please try again in a moment." }, { status: 503 })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.json().catch(() => null)
    const message =
      upstream.status === 503
        ? "The AI service is not configured or still starting up."
        : upstream.status === 401
          ? "The AI service rejected our credentials."
          : detail?.detail || detail?.error || "The AI service returned an error."
    return NextResponse.json({ error: message }, { status: upstream.status === 401 ? 502 : upstream.status })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ""

  const stream = new ReadableStream({
    async start(controller) {
      // Tell the client which conversation this belongs to before any tokens arrive.
      controller.enqueue(encoder.encode(`event: conversation\ndata: ${JSON.stringify({ id: conversationId ?? null })}\n\n`))
      const reader = upstream.body.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)

          buffer += decoder.decode(value, { stream: true })
          let cut
          while ((cut = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, cut)
            buffer = buffer.slice(cut + 2)
            if (!block.startsWith("event: final")) continue
            try {
              const final = JSON.parse(block.split("data: ")[1])
              void persistExchange({ userId, conversationId, question, answer: final.answer || "", concept: final.concept })
            } catch (e) {
              console.error("[qa/stream] could not parse final event:", e.message)
            }
          }
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "The connection to the AI service was interrupted.", code: "stream_interrupted" })}\n\n`))
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      upstream.body?.cancel().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  })
}
