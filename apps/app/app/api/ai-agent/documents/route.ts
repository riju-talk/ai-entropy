import { NextRequest, NextResponse } from "next/server"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

async function upstream(path: string, init?: RequestInit) {
  const res = await fetch(`${AI_AGENT_URL}${path}`, { cache: "no-store", ...init })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text, raw: true } }
}

/**
 * GET /api/ai-agent/documents
 *   (default)             → /api/documents/          (list / Pinecone stats)
 *   action=download&s3_key=X → /api/documents/download?s3_key=X
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "list"

    if (action === "download") {
      const s3Key = url.searchParams.get("s3_key") || ""
      if (!s3Key) return NextResponse.json({ error: "s3_key is required" }, { status: 400 })
      const res = await upstream(`/api/documents/download?s3_key=${encodeURIComponent(s3Key)}`)
      if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
      return NextResponse.json(res.body, { status: res.status })
    }

    // default: list docs / Pinecone stats
    const res = await upstream("/api/documents/")
    if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
    return NextResponse.json(res.body, { status: res.status })
  } catch (err) {
    console.error("[API][DOCUMENTS] GET Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/ai-agent/documents
 *   action=presign  (JSON body: { user_id, filename, content_type? })
 *                   → /api/documents/presign  — returns presigned S3 PUT URL
 *   (default)       — multipart upload → /api/documents/upload
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "upload"

    if (action === "presign") {
      const body = await req.json().catch(() => null)
      if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
      const res = await upstream("/api/documents/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
      return NextResponse.json(res.body, { status: res.status })
    }

    // default: multipart upload
    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 })
    }
    const formData = await req.formData()
    const uploadResp = await fetch(`${AI_AGENT_URL}/api/documents/upload`, {
      method: "POST",
      body: formData,
    })
    const text = await uploadResp.text()
    if (!uploadResp.ok) {
      try { return NextResponse.json(JSON.parse(text), { status: uploadResp.status }) }
      catch { return NextResponse.json({ error: "Document processing failed" }, { status: 502 }) }
    }
    try { return NextResponse.json(JSON.parse(text), { status: uploadResp.status }) }
    catch { return new NextResponse(text, { status: uploadResp.status, headers: { "Content-Type": "text/plain" } }) }
  } catch (err) {
    console.error("[API][DOCUMENTS] POST Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

    
    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 })
    }

    const formData = await req.formData()
    console.log("[API][DOCUMENTS] Forwarding to backend");

    // Forward the multipart request to AI agent backend (do NOT set Content-Type)
    const uploadResp = await fetch(`${AI_AGENT_URL}/api/documents/upload`, {
      method: "POST",
      headers: {},
      body: formData,
    })

    const text = await uploadResp.text()
    if (!uploadResp.ok) {
      console.error("[API][DOCUMENTS] Backend error:", uploadResp.status, text)
      try {
        const parsed = JSON.parse(text)
        return NextResponse.json(parsed, { status: uploadResp.status })
      } catch {
        return NextResponse.json({ error: "Document processing failed" }, { status: 502 })
      }
    }

    try {
      const result = JSON.parse(text)
      return NextResponse.json(result, { status: uploadResp.status })
    } catch {
      return new NextResponse(text, { status: uploadResp.status, headers: { "Content-Type": "text/plain" } })
    }
  } catch (err) {
    console.error("[API][DOCUMENTS] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint to list documents from backend
export async function GET(req: NextRequest) {
  try {
    console.log("[API][DOCUMENTS] GET request received");
    
    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 })
    }

    console.log("[API][DOCUMENTS] Forwarding to backend");

    const getResp = await fetch(`${AI_AGENT_URL}/api/documents/`, {
      method: "GET",
      headers: {},
    })

    const text = await getResp.text()
    if (!getResp.ok) {
      console.error("[API][DOCUMENTS] Backend error:", getResp.status, text)
      try {
        const parsed = JSON.parse(text)
        return NextResponse.json(parsed, { status: getResp.status })
      } catch {
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 502 })
      }
    }

    try {
      const result = JSON.parse(text)
      return NextResponse.json(result, { status: getResp.status })
    } catch {
      return new NextResponse(text, { status: getResp.status, headers: { "Content-Type": "text/plain" } })
    }
  } catch (err) {
    console.error("[API][DOCUMENTS] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
