import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** An error that maps straight to an HTTP response. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const DB_DOWN_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"])

export function isDbDown(e) {
  return (
    e?.name === "PrismaClientInitializationError" ||
    DB_DOWN_CODES.has(e?.code) ||
    /Can't reach database|Timed out fetching a new connection/i.test(e?.message || "")
  )
}

function toResponse(e) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status })
  if (isDbDown(e)) {
    console.error("[api] database unavailable:", e.code || e.name)
    return NextResponse.json({ error: "The database is unavailable right now. Please try again shortly." }, { status: 503 })
  }
  console.error("[api] unhandled error:", e)
  return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 })
}

/** Wrap a route handler so every failure becomes a clean JSON response instead of a stack trace. */
export function route(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      return toResponse(e)
    }
  }
}

export async function readJson(req) {
  try {
    const body = await req.json()
    if (body && typeof body === "object") return body
  } catch {
    /* fall through */
  }
  throw new HttpError(400, "Request body must be valid JSON")
}

/**
 * The signed-in user, loaded fresh from the database.
 * A valid cookie for a user that no longer exists (database reset) counts as signed out.
 */
export async function currentUser({ required = false } = {}) {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  const email = session?.user?.email
  let user = null
  if (id || email) {
    user = await prisma.user.findUnique({
      where: id ? { id } : { email },
      select: { id: true, name: true, email: true, image: true, role: true },
    })
  }
  if (required && !user) throw new HttpError(401, "Sign in to continue")
  return user
}

export function intParam(url, name, fallback, { min = 1, max = 100 } = {}) {
  const n = parseInt(url.searchParams.get(name) || "", 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(Math.max(n, min), max)
}
