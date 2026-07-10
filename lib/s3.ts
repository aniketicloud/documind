import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export function getS3Bucket() {
  return process.env.S3_BUCKET || "documind"
}

export function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: requireEnv("S3_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY"),
    },
  })
}

let bucketReady: Promise<void> | null = null

/** Ensure the app bucket exists and allows browser PUT from the app origin. */
export async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const s3 = getS3Client()
      const bucket = getS3Bucket()
      const corsOrigin =
        process.env.S3_CORS_ORIGIN ||
        process.env.BETTER_AUTH_URL ||
        "http://localhost:3000"

      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      } catch {
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }))
        } catch (error) {
          // Race: another request may have created it
          const message =
            error instanceof Error ? error.message : String(error)
          if (!/BucketAlreadyOwnedByYou|BucketAlreadyExists|already exists/i.test(message)) {
            throw error
          }
        }
      }

      await s3.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
                AllowedOrigins: [corsOrigin, "http://localhost:3000"],
                ExposeHeaders: ["ETag", "x-amz-request-id"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      )
    })().catch((error) => {
      bucketReady = null
      throw error
    })
  }

  return bucketReady
}

export async function createPresignedUploadUrl(options: {
  key: string
  contentType: string
  expiresIn?: number
}) {
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.key,
    ContentType: options.contentType,
  })

  return getSignedUrl(s3, command, {
    expiresIn: options.expiresIn ?? 600,
  })
}

/** Short-lived GET URL — only call after verifying the object key belongs to the session user. */
export async function createPresignedDownloadUrl(options: {
  key: string
  expiresIn?: number
  filename?: string
}) {
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: options.key,
    ...(options.filename
      ? {
          ResponseContentDisposition: `attachment; filename="${options.filename.replace(/"/g, "")}"`,
        }
      : {}),
  })

  return getSignedUrl(s3, command, {
    expiresIn: options.expiresIn ?? 300,
  })
}

export async function objectExists(key: string) {
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  try {
    const result = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
    return {
      exists: true as const,
      contentType: result.ContentType,
      size: result.ContentLength,
    }
  } catch {
    return { exists: false as const }
  }
}

/** Delete object from RustFS. Missing objects are treated as success. */
export async function deleteObject(key: string) {
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Idempotent: already gone is fine
    if (!/NotFound|NoSuchKey|404/i.test(message)) {
      throw error
    }
  }
}

export function sanitizeFilename(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-()+\s]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 180)
}
