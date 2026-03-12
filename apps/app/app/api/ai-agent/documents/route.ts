import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

async function upstream(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store", ...init })
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
    if (!BACKEND_URL) {
      return NextResponse.json({ error: "BACKEND_URL not configured" }, { status: 500 })
    }
    const formData = await req.formData()
    const uploadResp = await fetch(`${BACKEND_URL}/api/documents/upload`, {
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

/**
 * DELETE /api/ai-agent/documents?user_id=X&source=Y&s3_key=Z
 *   → DELETE /api/documents/by-source?user_id=X&source=Y&s3_key=Z
 *   Removes vectors from Pinecone and (if s3_key provided) the file from S3.
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get("user_id") || ""
    const source = url.searchParams.get("source") || ""
    const s3Key  = url.searchParams.get("s3_key")  || ""

    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    const params = new URLSearchParams({ user_id: userId })
    if (source) params.set("source", source)
    if (s3Key)  params.set("s3_key", s3Key)

    const res = await upstream(`/api/documents/by-source?${params.toString()}`, { method: "DELETE" })
    if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
    return NextResponse.json(res.body, { status: res.status })
  } catch (err) {
    console.error("[API][DOCUMENTS] DELETE Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
