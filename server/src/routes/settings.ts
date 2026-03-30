import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db.js'
import { authMiddleware, AuthRequest } from '../auth.js'

const router = Router()

// Get settings
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const db = getDatabase()

    let settings = await db.get('SELECT * FROM settings WHERE userId = ?', [userId])

    if (!settings) {
      // Create default settings if they don't exist
      const settingsId = uuidv4()
      await db.run(
        'INSERT INTO settings (id, userId) VALUES (?, ?)',
        [settingsId, userId]
      )
      settings = await db.get('SELECT * FROM settings WHERE userId = ?', [userId])
    }

    res.json({
      n8nWebhookUrl: settings.n8nWebhookUrl || '',
      apiKey: settings.apiKey ? '••••••••' : '',
      theme: settings.theme || 'dark',
      notificationsEnabled: Boolean(settings.notificationsEnabled),
    })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// Update settings
router.put('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { n8nWebhookUrl, apiKey, theme, notificationsEnabled } = req.body
    const db = getDatabase()

    // Check if settings exist
    let settings = await db.get('SELECT id FROM settings WHERE userId = ?', [userId])

    if (!settings) {
      // Create if doesn't exist
      const settingsId = uuidv4()
      await db.run(
        'INSERT INTO settings (id, userId, n8nWebhookUrl, apiKey, theme, notificationsEnabled) VALUES (?, ?, ?, ?, ?, ?)',
        [settingsId, userId, n8nWebhookUrl || null, apiKey || null, theme || 'dark', notificationsEnabled ? 1 : 0]
      )
    } else {
      // Update existing
      await db.run(
        'UPDATE settings SET n8nWebhookUrl = ?, apiKey = ?, theme = ?, notificationsEnabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?',
        [n8nWebhookUrl || null, apiKey || null, theme || 'dark', notificationsEnabled ? 1 : 0, userId]
      )
    }

    res.json({ message: 'Settings updated' })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router
