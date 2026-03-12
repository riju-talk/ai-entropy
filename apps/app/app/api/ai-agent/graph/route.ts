import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

/**
 * GET /api/ai-agent/graph
 *   ?action=nodes               → /api/graph/nodes  (default)
 *   ?action=context&concept=X   → /api/graph/context/{concept}
 *   ?action=weak&user_id=X      → /api/graph/weak/{user_id}
 *   ?action=path&user_id=X&concept=Y → /api/graph/path/{user_id}/{concept}
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = (url.searchParams.get("action") || "nodes").toLowerCase()
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || ""
    const concept = url.searchParams.get("concept") || ""

    let upstreamPath: string

    switch (action) {
      case "user-graph":
        if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })
        upstreamPath = `/api/graph/user-graph/${encodeURIComponent(userId)}`
        break
      case "context":
        if (!concept) return NextResponse.json({ error: "concept is required" }, { status: 400 })
        upstreamPath = `/api/graph/context/${encodeURIComponent(concept)}`
        break
      case "weak":
        if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })
        upstreamPath = `/api/graph/weak/${encodeURIComponent(userId)}`
        break
      case "path":
        if (!userId || !concept) return NextResponse.json({ error: "user_id and concept are required" }, { status: 400 })
        upstreamPath = `/api/graph/path/${encodeURIComponent(userId)}/${encodeURIComponent(concept)}`
        break
      case "nodes":
      default:
        upstreamPath = `/api/graph/nodes${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`
    }

    const res = await fetch(`${BACKEND_URL}${upstreamPath}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    const text = await res.text()
    if (!res.ok) {
      console.error("[API][GRAPH] Backend error:", res.status, text)
      return NextResponse.json({ nodes: [], edges: [] }, { status: res.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return NextResponse.json({ nodes: [], edges: [] }, { status: 502 })
    }
  } catch (err) {
    console.error("[API][GRAPH] Proxy error:", err)
    return NextResponse.json({ nodes: [], edges: [] }, { status: 500 })
  }
}

/**
 * POST /api/ai-agent/graph
 *   body.action = "concept"      → POST /api/graph/concept
 *   body.action = "prerequisite" → POST /api/graph/prerequisite
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const action = (body.action || "concept").toLowerCase()
    const upstreamPath = action === "prerequisite" ? "/api/graph/prerequisite" : "/api/graph/concept"

    // Strip the action field before forwarding
    const { action: _action, ...payload } = body

    const res = await fetch(`${BACKEND_URL}${upstreamPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const text = await res.text()
    if (!res.ok) {
      console.error("[API][GRAPH] POST Backend error:", res.status, text)
      return NextResponse.json({ error: "Graph operation failed", details: text }, { status: res.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return new NextResponse(text, { status: 200 })
    }
  } catch (err) {
    console.error("[API][GRAPH] POST Proxy error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
