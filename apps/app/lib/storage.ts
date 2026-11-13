import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * S3-compatible object storage (Neon). Credentials come from the standard AWS_* env vars:
 * AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION. Bucket: S3_BUCKET.
 */
let client: S3Client | null = null
const s3 = () => (client ??= new S3Client({ forcePathStyle: true }))
export const BUCKET = process.env.S3_BUCKET || "assets"
export const PICTURE_PREFIX = "pictures/"

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}
// Vercel functions reject request bodies over 4.5 MB
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export const storageConfigured = () =>
  !!(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

export async function putPicture(key: string, body: Buffer, contentType: string) {
  await s3().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
  )
}

export const signedPictureUrl = (key: string, expiresIn = 3600) =>
  getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
