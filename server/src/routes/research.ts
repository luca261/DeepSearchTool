import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db.js'
import { authMiddleware, AuthRequest } from '../auth.js'
import { mcpRunResearch, mcpGetResults } from '../mcpClient.js'

const router = Router()

const MIN_QUERY_LENGTH = 20
/** Hard timeout — abandon a job after this long */
const TIMEOUT_MS = 10 * 60 * 1000   // 10 min
/** Maximum number of auto-resubmissions before giving up */
const MAX_RETRIES = 3

// ---------------------------------------------------------------------------
// POST /research/create
// ---------------------------------------------------------------------------
router.post('/create', authMiddleware, async (req: AuthRequest, res) => {
  const { title, query, depth = 2, breadth = 2 } = req.body
  const userId = req.userId!

  if (!title || !query) {
    res.status(400).json({ error: 'Title and query are required' })
    return
  }
  if (query.length < MIN_QUERY_LENGTH) {
    res.status(400).json({
      error: `Research query must be at least ${MIN_QUERY_LENGTH} characters`,
    })
    return
  }

  const db          = getDatabase()
  const researchId  = uuidv4()
  const safeDepth   = Math.min(Math.max(Number(depth)   || 2, 1), 3)
  const safeBreadth = Math.min(Math.max(Number(breadth) || 2, 1), 5)

  // Insert row in pending state first
  await db.run(
    `INSERT INTO researches
      (id, userId, title, query, status, progress, depth, breadth, retry_count)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, 0)`,
    [researchId, userId, title, query, safeDepth, safeBreadth]
  )

  try {
    // Submit via MCP — JWT stays on the server
    const mcpResult = await mcpRunResearch(query, safeDepth, safeBreadth)
    const sessionId = mcpResult.session_id

    await db.run(
      `UPDATE researches
       SET n8n_session_id = ?, status = 'running', progress = 5,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId, researchId]
    )

    res.status(201).json({
      researchId,
      session_id: sessionId,
      status:     'running',
      message:    'Research submitted via MCP. Poll /research/:id/status for updates.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[research/create] MCP submit error:', message)

    await db.run(
      `UPDATE researches
       SET status = 'failed', error_message = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['Failed to reach research engine. Please try again.', researchId]
    )
    res.status(500).json({ error: 'Failed to submit to research engine. Please try again.' })
  }
})

// ---------------------------------------------------------------------------
// POST /research/:id/retry  — manual retry triggered from the UI
// ---------------------------------------------------------------------------
router.post('/:id/retry', authMiddleware, async (req: AuthRequest, res) => {
  const { id }  = req.params
  const userId  = req.userId!
  const db      = getDatabase()

  const research = await db.get(
    'SELECT * FROM researches WHERE id = ? AND userId = ?',
    [id, userId]
  )
  if (!research) {
    res.status(404).json({ error: 'Research not found' })
    return
  }
  if (research.status === 'completed') {
    res.json({ status: 'completed', message: 'Already completed' })
    return
  }

  const retryCount = (research.retry_count || 0) + 1

  try {
    const mcpResult = await mcpRunResearch(
      research.query,
      research.depth  || 2,
      research.breadth || 2
    )
    const sessionId = mcpResult.session_id

    await db.run(
      `UPDATE researches
       SET n8n_session_id = ?, n8n_execution_id = NULL,
           status = 'running', progress = 5,
           retry_count = ?, error_message = NULL,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId, retryCount, id]
    )

    res.json({
      status:      'running',
      session_id:  sessionId,
      retry_count: retryCount,
      message:     `Retry #${retryCount} submitted via MCP.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[research/retry] MCP submit error:', message)
    res.status(500).json({ error: 'Failed to resubmit. Please try again shortly.' })
  }
})

// ---------------------------------------------------------------------------
// GET /research/:id/status  — poll MCP for live progress, with auto-retry
// ---------------------------------------------------------------------------
router.get('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  const { id }  = req.params
  const userId  = req.userId!
  const db      = getDatabase()

  const research = await db.get(
    'SELECT * FROM researches WHERE id = ? AND userId = ?',
    [id, userId]
  )
  if (!research) {
    res.status(404).json({ error: 'Research not found' })
    return
  }

  // Already terminal — serve cached result
  if (research.status === 'completed' || research.status === 'failed') {
    res.json({
      status:           research.status,
      progress:         research.progress,
      results:          research.results,
      confidence_score: research.confidence_score,
      retry_count:      research.retry_count || 0,
      error_message:    research.error_message || null,
    })
    return
  }

  // Hard timeout guard
  const elapsed = Date.now() - new Date(research.createdAt + ' UTC').getTime()
  if (elapsed > TIMEOUT_MS) {
    await db.run(
      `UPDATE researches
       SET status = 'failed',
           error_message = 'Research timed out after 10 minutes. Please retry.',
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    )
    res.json({
      status:        'failed',
      progress:      0,
      results:       null,
      error_message: 'Research timed out after 10 minutes. Please retry.',
      retry_count:   research.retry_count || 0,
    })
    return
  }

  // No session_id yet — still pending submission
  if (!research.n8n_session_id) {
    res.json({ status: 'pending', progress: 0, retry_count: 0 })
    return
  }

  // Poll MCP for results
  try {
    const mcpData = await mcpGetResults(research.n8n_session_id)
    const { status, report, confidence_score } = mcpData

    // ✅ Completed with a report
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
        [report, safeScore, id]
      )

      res.json({
        status:           'completed',
        progress:         100,
        results:          report,
        confidence_score: safeScore,
        retry_count:      research.retry_count || 0,
      })
      return
    }

    // 🔄 Stalled: status is running/completed but report is empty
    const isStalled =
      (status === 'running' || status === 'completed') &&
      (!report || report.length === 0)

    if (isStalled) {
      const retryCount = research.retry_count || 0

      if (retryCount < MAX_RETRIES) {
        console.log(
          `[auto-retry] research ${id} stalled (attempt ${retryCount + 1}/${MAX_RETRIES})`
        )

        try {
          const mcpResult = await mcpRunResearch(
            research.query,
            research.depth  || 2,
            research.breadth || 2
          )

          await db.run(
            `UPDATE researches
             SET n8n_session_id = ?, n8n_execution_id = NULL,
                 status = 'running', progress = 5,
                 retry_count = ?,
                 error_message = 'Auto-retrying… attempt ' || ? || ' of ${MAX_RETRIES}',
                 updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [mcpResult.session_id, retryCount + 1, retryCount + 1, id]
          )

          res.json({
            status:      'running',
            progress:    5,
            retry_count: retryCount + 1,
            retrying:    true,
            message:     `Auto-retrying via MCP (attempt ${retryCount + 1}/${MAX_RETRIES})…`,
          })
        } catch (retryErr) {
          console.error('[auto-retry] MCP resubmit failed:', retryErr)
          const progress = Math.min(85, Math.round((elapsed / 90_000) * 100))
          res.json({ status: 'running', progress, retry_count: retryCount })
        }
        return
      }

      // Exhausted all retries
      await db.run(
        `UPDATE researches
         SET status = 'failed',
             error_message = 'Research engine did not return a report after ${MAX_RETRIES} attempts.',
             updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      )
      res.json({
        status:        'failed',
        progress:      0,
        results:       null,
        retry_count:   retryCount,
        error_message: `Research engine did not return a report after ${MAX_RETRIES} attempts.`,
      })
      return
    }

    // Still running normally — estimate progress from elapsed time
    // MCP research typically takes 45-90 s
    const progress = Math.min(90, Math.max(5, Math.round((elapsed / 90_000) * 100)))
    await db.run(
      'UPDATE researches SET progress = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [progress, id]
    )
    res.json({ status: 'running', progress, retry_count: research.retry_count || 0 })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[research/status] MCP poll error:', message)
    // Return last known state rather than crashing
    const progress = Math.min(85, Math.round((elapsed / 90_000) * 100))
    res.json({
      status:      research.status,
      progress,
      retry_count: research.retry_count || 0,
    })
  }
})

// ---------------------------------------------------------------------------
// GET /research/recent
// ---------------------------------------------------------------------------
router.get('/recent', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const db     = getDatabase()

  const researches = await db.all(
    `SELECT id, title, status, progress, depth, breadth, retry_count, createdAt
     FROM researches WHERE userId = ? ORDER BY createdAt DESC LIMIT 10`,
    [userId]
  )
  res.json(researches)
})

// ---------------------------------------------------------------------------
// GET /research/history
// ---------------------------------------------------------------------------
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const db     = getDatabase()

  const researches = await db.all(
    `SELECT id, title, query, status, progress, results, confidence_score,
            depth, breadth, retry_count, error_message, createdAt, updatedAt
     FROM researches WHERE userId = ? ORDER BY createdAt DESC`,
    [userId]
  )
  res.json(researches)
})

// ---------------------------------------------------------------------------
// GET /research/:id
// ---------------------------------------------------------------------------
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id }  = req.params
  const userId  = req.userId!
  const db      = getDatabase()

  const research = await db.get(
    'SELECT * FROM researches WHERE id = ? AND userId = ?',
    [id, userId]
  )
  if (!research) {
    res.status(404).json({ error: 'Research not found' })
    return
  }
  res.json(research)
})

// ---------------------------------------------------------------------------
// DELETE /research/:id
// ---------------------------------------------------------------------------
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id }  = req.params
  const userId  = req.userId!
  const db      = getDatabase()

  const research = await db.get(
    'SELECT id FROM researches WHERE id = ? AND userId = ?',
    [id, userId]
  )
  if (!research) {
    res.status(404).json({ error: 'Research not found' })
    return
  }

  await db.run('DELETE FROM researches WHERE id = ?', [id])
  res.json({ message: 'Research deleted' })
})

// ---------------------------------------------------------------------------
// GET /research/:id/export
// ---------------------------------------------------------------------------
router.get('/:id/export', authMiddleware, async (req: AuthRequest, res) => {
  const { id }  = req.params
  const userId  = req.userId!
  const db      = getDatabase()

  const research = await db.get(
    'SELECT * FROM researches WHERE id = ? AND userId = ?',
    [id, userId]
  )
  if (!research) {
    res.status(404).json({ error: 'Research not found' })
    return
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="research-${id}.json"`)
  res.json(research)
})

export default router
