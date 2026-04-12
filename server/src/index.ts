import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.startsWith('your-') || jwtSecret.startsWith('dev-secret')) {
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

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}))

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})

// API Routes — mounted under /api to match client fetch calls
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/research', researchRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/n8n-callback', n8nCallbackRoutes)

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
  const status = err.status || 500
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message || 'Internal server error'
  res.status(status).json({ error: message })
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
