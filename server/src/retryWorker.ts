/**
 * retryWorker.ts
 *
 * Background service that runs every POLL_INTERVAL_MS and:
 *  1. Finds all non-terminal jobs (running / failed with retries remaining)
 *  2. Polls the MCP server via get_research_results using the stored session_id
 *  3. If completed → saves report to DB
 *  4. If stalled (empty report) → resubmits via run_deep_research
 *  5. If retries exhausted → marks permanently failed
 *  6. If too old → abandons the job
 *
 * The n8n JWT is kept server-side — loaded from N8N_JWT_TOKEN env var via mcpClient.
 */

import { getDatabase } from './db.js'
import { mcpRunResearch, mcpGetResults } from './mcpClient.js'

const POLL_INTERVAL_MS = 2 * 60 * 1000   // check every 2 minutes
const MAX_RETRIES      = 5               // persistent — MCP can be flaky
const MAX_AGE_MS       = 30 * 60 * 1000  // abandon after 30 min

// ---------------------------------------------------------------------------
// Main tick — runs on every interval
// ---------------------------------------------------------------------------
async function tick() {
  const db = getDatabase()

  const jobs = await db.all(
    `SELECT id, title, query, depth, breadth, status, retry_count,
            n8n_session_id, createdAt
     FROM researches
     WHERE status IN ('running', 'failed')
       AND (retry_count IS NULL OR retry_count < ?)`,
    [MAX_RETRIES]
  )

  if (jobs.length === 0) return

  console.log(`[worker] checking ${jobs.length} active job(s)`)

  for (const job of jobs) {
    try {
      const ageMs = Date.now() - new Date(job.createdAt + ' UTC').getTime()

      // Hard age limit — give up permanently
      if (ageMs > MAX_AGE_MS) {
        await db.run(
          `UPDATE researches
           SET status = 'failed',
               error_message = 'Abandoned after 30 minutes without a result.',
               updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [job.id]
        )
        console.log(`[worker] abandoned ${job.id} (age ${Math.round(ageMs / 60000)}m)`)
        continue
      }

      // No session_id yet — try to resubmit
      if (!job.n8n_session_id) {
        await resubmit(db, job)
        continue
      }

      // Poll MCP for results
      let mcpData: Awaited<ReturnType<typeof mcpGetResults>>
      try {
        mcpData = await mcpGetResults(job.n8n_session_id)
      } catch (pollErr) {
        console.warn(`[worker] MCP poll failed for ${job.id}:`, (pollErr as Error).message)
        continue   // Try again next tick
      }

      const { status, report, confidence_score } = mcpData

      // ✅ Completed with report
      if (status === 'completed' && report && report.length > 0) {
        const safeScore =
          confidence_score != null && String(confidence_score) !== 'undefined'
            ? String(confidence_score)
            : null

        await db.run(
          `UPDATE researches
           SET status = 'completed', progress = 100, results = ?,
               confidence_score = ?, error_message = NULL,
               updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [report, safeScore, job.id]
        )
        console.log(`[worker] ✅ completed ${job.id} (${report.length} chars)`)
        continue
      }

      // 🔄 Stalled — resubmit
      const isStalled =
        (status === 'running' || status === 'completed') &&
        (!report || report.length === 0)

      if (isStalled || job.status === 'failed') {
        await resubmit(db, job)
      }

    } catch (err) {
      console.error(`[worker] error processing job ${job.id}:`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: resubmit a job via MCP
// ---------------------------------------------------------------------------
async function resubmit(
  db: Awaited<ReturnType<typeof getDatabase>>,
  job: { id: string; title: string; query: string; depth: number; breadth: number; retry_count: number }
) {
  const retryCount = (job.retry_count || 0) + 1
  console.log(
    `[worker] resubmitting ${job.id} (attempt ${retryCount}/${MAX_RETRIES}) "${job.title.slice(0, 40)}"`
  )

  try {
    const mcpResult = await mcpRunResearch(
      job.query,
      job.depth   || 2,
      job.breadth || 2
    )
    const sessionId = mcpResult.session_id

    await db.run(
      `UPDATE researches
       SET n8n_session_id = ?, n8n_execution_id = NULL,
           status = 'running', progress = 5,
           retry_count = ?,
           error_message = 'Auto-retrying… attempt ' || ? || ' of ${MAX_RETRIES}',
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId, retryCount, retryCount, job.id]
    )
    console.log(`[worker] resubmitted → session_id ${sessionId}`)
  } catch (err) {
    console.error(`[worker] MCP resubmit failed for ${job.id}:`, (err as Error).message)
    // Don't mark failed here — will retry on next tick
  }
}

// ---------------------------------------------------------------------------
// Lifecycle management
// ---------------------------------------------------------------------------
let workerInterval: ReturnType<typeof setInterval> | null = null

export function startRetryWorker() {
  if (workerInterval) return
  console.log(
    `[worker] starting background retry worker (interval: ${POLL_INTERVAL_MS / 1000}s)`
  )
  // First tick after 60 s (let server and DB settle after restart)
  setTimeout(() => {
    tick().catch(console.error)
    workerInterval = setInterval(() => tick().catch(console.error), POLL_INTERVAL_MS)
  }, 60_000)
}

export function stopRetryWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
}
