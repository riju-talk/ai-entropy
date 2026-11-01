// Server-only helpers for calling the Entropy AI service (the BFF pattern).
//
// The browser talks only to Next.js API routes. Those routes verify the NextAuth session and
// call the AI service with a shared secret (AI_BACKEND_TOKEN) plus the verified user id, so the
// AI service never trusts a user id sent by the client and the token never reaches the browser.
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const strip = (u) => u.replace(/\/+$/, "")
const BACKEND_URL = strip(process.env.BACKEND_URL || "http://localhost:8000")

// Which AI service owns which API prefix. Each *_URL is optional: unset means "use BACKEND_URL",
// so a single combined AI service (SERVICE_ROLE=all) keeps working. Mirror of apps/ai-agent/app/roles.py.
const ROUTE_ROLES = [
  { url: process.env.AI_TUTOR_URL, prefixes: ["/api/qa", "/api/reasoning", "/api/evaluation"] },
  { url: process.env.AI_KNOWLEDGE_URL, prefixes: ["/api/documents", "/api/graph", "/api/mastery", "/api/gamification"] },
  { url: process.env.AI_STUDIO_URL, prefixes: ["/api/quiz", "/api/flashcards", "/api/mindmap"] },
]

export function aiBaseUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`
  const role = ROUTE_ROLES.find((r) => r.url && r.prefixes.some((x) => p === x || p.startsWith(`${x}/`)))
  return strip(role?.url || BACKEND_URL)
}
const AI_BACKEND_TOKEN = process.env.AI_BACKEND_TOKEN || ""

/**
 * Resolve the signed-in user.
 * Usage:
 *   const auth = await requireUser()
 *   if (auth.response) return auth.response   // 401
 *   const { userId } = auth
 */
export async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }
  return { userId }
}

/** fetch() against the AI service with the service token and verified user id attached. */
export function aiFetch(path, init = {}, userId) {
  const headers = new Headers(init.headers || {})
  if (AI_BACKEND_TOKEN) headers.set("X-Internal-Token", AI_BACKEND_TOKEN)
  if (userId) headers.set("X-User-Id", userId)
  const url = aiBaseUrl(path) + (path.startsWith("/") ? path : `/${path}`)
  return fetch(url, { cache: "no-store", ...init, headers })
}
