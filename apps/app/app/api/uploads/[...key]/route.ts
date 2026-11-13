import { NextResponse } from "next/server"

import { PICTURE_PREFIX, signedPictureUrl, storageConfigured } from "@/lib/storage"

export const runtime = "nodejs"

// GET /api/uploads/<userId>/<file>: pictures are public (they sit inside public questions and posts),
// but the bucket stays private, so redirect to a short-lived signed URL.
export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const rest = params.key.join("/")
  if (!storageConfigured() || !/^[\w-]+\/[\w-]+\.(png|jpg|webp|gif)$/.test(rest)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const url = await signedPictureUrl(PICTURE_PREFIX + rest, 3600)
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=1800" } })
}
