import { NextRequest, NextResponse } from "next/server"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    console.log("[API][DOCUMENTS] POST request received");
    
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

    const getResp = await fetch(`${AI_AGENT_URL}/api/documents`, {
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
