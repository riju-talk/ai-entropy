import { NextRequest, NextResponse } from "next/server";

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000";

async function proxyRequest(upstreamPath: string, options: RequestInit) {
  const upstreamUrl = `${AI_AGENT_URL}${upstreamPath}`;
  const resp = await fetch(upstreamUrl, options);
  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    return { status: resp.status, body: json };
  } catch {
    return { status: resp.status, body: text, isText: true };
  }
}

// Handle GET: support ?action=greeting|health|history and ?user_id=...
export async function GET(req: NextRequest) {
  try {
    console.log("[API][QA] GET request received");
    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || url.searchParams.get("type") || "").toLowerCase();
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || "";

    // Determine upstream path
    let upstreamPath = "/api/qa/greeting";
    if (action === "health") upstreamPath = "/api/qa/health";
    else if (action === "greeting") upstreamPath = "/api/qa/greeting";
    else if (action === "history" && userId) upstreamPath = `/api/qa/history/${encodeURIComponent(userId)}`;
    // fallback: if user_id present with no action, treat as history
    else if (!action && userId) upstreamPath = `/api/qa/history/${encodeURIComponent(userId)}`;

    // If AI_AGENT_URL not set, return informative error
    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 });
    }

    const res = await proxyRequest(upstreamPath, { method: "GET", headers: {} });
    if (res.isText) {
      return new NextResponse(String(res.body), { status: res.status, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json(res.body, { status: res.status });
  } catch (err) {
    console.error("[AI-AGENT][QA][GET] Proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST remains a proxy for QA requests (JSON or multipart)
export async function POST(req: NextRequest) {
  try {
    console.log("[API][QA] POST request received");
    
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 });
    }

    // Always send the correct payload shape
    const payload = {
      user_prompt: body.user_prompt || body.prompt || body.question || "",
      system_prompt: body.system_prompt || "You are spark an online study buddy"
    };

    console.log("[API][QA] Forwarding to backend:", JSON.stringify(payload));

    const resp = await proxyRequest("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.isText) {
      return new NextResponse(String(resp.body), { status: resp.status, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json(resp.body, { status: resp.status });
  } catch (err) {
    console.error("[API][QA] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
