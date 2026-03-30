import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeDatabase, closeDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import researchRoutes from './routes/research.js'
import settingsRoutes from './routes/settings.js'
import n8nCallbackRoutes from './routes/n8nCallback.js'
import { startRetryWorker, stopRetryWorker } from './retryWorker.js'

dotenv.config()

// Enforce required secrets at startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-here-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be set to a secure value in production')
    process.exit(1)
  } else {
    console.warn('WARNING: Using default JWT_SECRET. Set a secure value for production.')
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes — mounted under /api to match client fetch calls
app.use('/api/auth', authRoutes)
app.use('/api/research', researchRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/n8n-callback', n8nCallbackRoutes)

// Legacy routes (no /api prefix) kept for backward-compat / health checks
app.use('/auth', authRoutes)
app.use('/research', researchRoutes)
app.use('/settings', settingsRoutes)

// Serve React client (production build) in all environments
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
import fs from 'fs'
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// Error handling middleware
app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status((err as { status?: number }).status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// 404 handler (API only — SPA handled above in production)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Initialize and start server
async function start() {
  try {
    await initializeDatabase()
    console.log('Database initialized')

    // Start background retry worker
    startRetryWorker()

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`API: http://localhost:${PORT}`)
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  stopRetryWorker()
  await closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...')
  stopRetryWorker()
  await closeDatabase()
  process.exit(0)
})

start()
