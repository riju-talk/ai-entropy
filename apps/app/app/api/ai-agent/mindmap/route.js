import { NextResponse } from "next/server"
import { aiFetch, requireUser } from "@/lib/ai-proxy"

// Helper function for proxying requests
async function proxyRequest(endpoint, options, userId) {
  const resp = await aiFetch(endpoint, options, userId);
  const text = await resp.text();

  try {
    return {
      body: text ? JSON.parse(text) : null,
      status: resp.status,
      isText: false,
    };
  } catch {
    return {
      body: text,
      status: resp.status,
      isText: true,
    };
  }
}

export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { userId: sessionUserId } = auth
    console.log("[API][MINDMAP] POST request received");

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Always send the correct payload shape
    const payload = {
      topic: body.topic || "",
      diagram_type: body.diagram_type || "mindmap",
      detail_level: typeof body.detail_level === "number" ? body.detail_level : 3,
      research: typeof body.research === "boolean" ? body.research : true,
      systemPrompt: body.systemPrompt || undefined,
    };

    console.log("[API][MINDMAP] Forwarding to backend:", JSON.stringify(payload));

    const resp = await proxyRequest("/api/mindmap/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, sessionUserId);

    if (resp.isText) {
      return new NextResponse(String(resp.body), { status: resp.status, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json(resp.body, { status: resp.status });
  } catch (err) {
    console.error("[API][MINDMAP] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
