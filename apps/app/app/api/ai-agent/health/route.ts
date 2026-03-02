import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const AI_AGENT_URL = process.env.AI_AGENT_URL || "";

export async function GET() {
    try {
        // If AI_AGENT_URL is configured, proxy its /health for accurate backend status
        if (AI_AGENT_URL) {
            try {
                const resp = await fetch(`${AI_AGENT_URL}/health`, { method: "GET" });
                const data = await resp.json().catch(() => null);
                // attach local timestamp and DB check
                const diagnostics: any = {
                    upstream: {
                        url: `${AI_AGENT_URL}/health`,
                        status: resp.status,
                        body: data ?? null,
                    },
                    timestamp: new Date().toISOString(),
                };

                // check DB connectivity quickly (non-blocking if no DB)
                try {
                    await prisma.$queryRaw`SELECT 1`;
                    diagnostics.db = { ok: true, message: "ok" };
                } catch (dbErr: any) {
                    diagnostics.db = { ok: false, message: dbErr?.message || String(dbErr) };
                }

                const ok = resp.ok && diagnostics.db?.ok !== false;
                return NextResponse.json({ ok, diagnostics }, { status: resp.status });
            } catch (upErr) {
                console.warn("[AI-AGENT][HEALTH] Upstream health check failed:", upErr);
                // fall through to local checks
            }
        }

        // Fallback local diagnostic (no AI_AGENT_URL available)
        const diagnostics: any = {
            ok: true,
            env: {
                AI_AGENT_URL: AI_AGENT_URL ? "configured" : "missing",
            },
            db: { ok: false, message: null },
            timestamp: new Date().toISOString(),
        };

        try {
            await prisma.$queryRaw`SELECT 1`;
            diagnostics.db.ok = true;
            diagnostics.db.message = "ok";
        } catch (dbErr: any) {
            diagnostics.db.ok = false;
            diagnostics.db.message = dbErr?.message || String(dbErr);
            diagnostics.ok = false;
        }

        return NextResponse.json(diagnostics);
    } catch (err) {
        console.error("[AI-AGENT][HEALTH] Unexpected error:", err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    } finally {
        // don't disconnect prisma here
    }
}
