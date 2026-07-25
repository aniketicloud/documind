/**
 * Document ingest worker (Option A).
 *
 * Usage:
 *   npm run worker:ingest
 *
 * Requires: DATABASE_URL, S3_*, REDIS_URL (optional but recommended)
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env") })

import {
  claimNextIngestJob,
  failJob,
  processIngestJob,
} from "../lib/ingest"

const workerId =
  process.env.INGEST_WORKER_ID ||
  `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`

const POLL_MS = Number(process.env.INGEST_POLL_MS || 1500)

let stopping = false

async function loop() {
  console.log(`[ingest-worker] started id=${workerId} poll=${POLL_MS}ms`)

  while (!stopping) {
    try {
      const job = await claimNextIngestJob(workerId)
      if (!job) {
        await sleep(POLL_MS)
        continue
      }

      console.log(
        `[ingest-worker] claimed job=${job.id} document=${job.documentId} attempt=${job.attempts}`
      )

      try {
        const result = await processIngestJob(job)
        if (result.ok) {
          console.log(
            `[ingest-worker] indexed document=${result.documentId} bytes=${result.bytes}`
          )
        } else {
          console.warn(
            `[ingest-worker] job failed job=${job.id} reason=${result.reason}`
          )
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown ingest error"
        console.error(`[ingest-worker] error job=${job.id}`, message)
        await failJob(job.id, job.documentId, message)
      }
    } catch (error) {
      console.error("[ingest-worker] loop error", error)
      await sleep(POLL_MS)
    }
  }

  console.log("[ingest-worker] stopped")
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

process.on("SIGINT", () => {
  stopping = true
})
process.on("SIGTERM", () => {
  stopping = true
})

loop().catch((error) => {
  console.error("[ingest-worker] fatal", error)
  process.exit(1)
})
