/**
 * POST /n8n-callback
 *
 * Secured push endpoint for n8n Workflow D (I7TW9N02Yi4HcvMd).
 * When activated, Workflow D calls this endpoint when research completes,
 * eliminating the need for client-side polling entirely.
 *
 * Security: requires X-N8N-Secret header matching N8N_CALLBACK_SECRET env var.
 *
 * Expected payload:
 * {
 *   execution_id: string,
 *   status: 'completed' | 'failed',
 *   report?: string,
 *   confidence_score?: string
 * }
 */

import { Router, Request, Response } from 'express'
import { getDatabase } from '../db.js'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const callbackSecret = process.env.N8N_CALLBACK_SECRET

  // If N8N_CALLBACK_SECRET is set, enforce it
  if (callbackSecret) {
    const providedSecret = req.headers['x-n8n-secret'] as string | undefined
    if (!providedSecret || providedSecret !== callbackSecret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const { execution_id, status, report, confidence_score } = req.body as {
    execution_id?: string
    status?: string
    report?: string
    confidence_score?: string
  }

  if (!execution_id || !status) {
    res.status(400).json({ error: 'execution_id and status are required' })
    return
  }

  if (!['completed', 'failed'].includes(status)) {
    res.status(400).json({ error: 'status must be completed or failed' })
    return
  }

  const db = getDatabase()

  const research = await db.get(
    'SELECT id FROM researches WHERE n8n_execution_id = ?',
    [execution_id]
  )

  if (!research) {
    // Not a fatal error — could be a duplicate callback for an already-deleted research
    res.json({ received: true, matched: false })
    return
  }

  const safeScore =
    confidence_score && confidence_score !== 'undefined'
      ? confidence_score
      : null

  await db.run(
    `UPDATE researches
     SET status = ?, progress = ?, results = ?, confidence_score = ?,
         updatedAt = CURRENT_TIMESTAMP
     WHERE n8n_execution_id = ?`,
    [
      status,
      status === 'completed' ? 100 : 0,
      report || null,
      safeScore,
      execution_id,
    ]
  )

  console.log(`n8n callback: execution ${execution_id} → ${status}`)
  res.json({ received: true, matched: true })
})

export default router
