import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { IMAGE_TYPES, MAX_IMAGE_BYTES, PICTURE_PREFIX, putPicture, storageConfigured } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/uploads (multipart "file"): store a picture for a question or post. Returns { url, markdown }.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: "Sign in to upload pictures" }, { status: 401 })
  if (!storageConfigured()) return NextResponse.json({ error: "Picture storage is not configured" }, { status: 503 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file" }, { status: 400 })
  const ext = IMAGE_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "Only PNG, JPEG, WebP or GIF images are allowed" }, { status: 415 })
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image must be 4 MB or smaller" }, { status: 413 })

  const key = `${PICTURE_PREFIX}${userId}/${randomUUID()}.${ext}`
  try {
    await putPicture(key, Buffer.from(await file.arrayBuffer()), file.type)
  } catch (e) {
    console.error("[uploads] put failed:", e)
    return NextResponse.json({ error: "Upload failed, try again" }, { status: 502 })
  }
  const url = `/api/uploads/${key.slice(PICTURE_PREFIX.length)}`
  return NextResponse.json({ url, markdown: `![picture](${url})` }, { status: 201 })
}
