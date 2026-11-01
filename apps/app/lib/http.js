import { NextResponse } from "next/server"

/** Parse a JSON body with a zod schema. Returns { data } or { response } (400). */
export async function parseBody(req, schema) {
  const raw = await req.json().catch(() => null)
  if (raw === null || typeof raw !== "object") {
    return { response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue?.path?.join(".") || "body"
    return {
      response: NextResponse.json({ error: `${field}: ${issue?.message || "invalid"}` }, { status: 400 }),
    }
  }
  return { data: result.data }
}

/** Split "a, b ,c" (or an array) into a clean, de-duplicated, length-limited list. */
export function toList(value, { max = 12, itemMax = 40 } = {}) {
  const items = Array.isArray(value) ? value : String(value || "").split(",")
  const seen = new Set()
  const out = []
  for (const item of items) {
    const v = String(item).trim().slice(0, itemMax)
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase())
      out.push(v)
    }
    if (out.length >= max) break
  }
  return out
}

export function serverError(tag, err) {
  console.error(`[API][${tag}]`, err)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
