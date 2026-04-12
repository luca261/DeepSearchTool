import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db.js'
import { hashPassword, verifyPassword, generateToken, authMiddleware, AuthRequest } from '../auth.js'

const router = Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' })
      return
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters' })
      return
    }

    const db = getDatabase()
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email])

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' })
      return
    }

    const userId = uuidv4()
    const hashedPassword = await hashPassword(password)

    await db.run('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [
      userId,
      email,
      hashedPassword,
    ])

    // Create default settings
    await db.run(
      'INSERT INTO settings (id, userId) VALUES (?, ?)',
      [uuidv4(), userId]
    )

    const token = generateToken(userId)
    res.status(201).json({ token, userId })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' })
      return
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Invalid input' })
      return
    }

    const db = getDatabase()
    const user = await db.get('SELECT id, password FROM users WHERE email = ?', [email])

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = generateToken(user.id)
    res.json({ token, userId: user.id })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Check auth status
router.get('/status', authMiddleware, (req: AuthRequest, res) => {
  res.json({ authenticated: true, userId: req.userId })
})

// Logout
router.post('/logout', authMiddleware, (_req: AuthRequest, res) => {
  res.json({ message: 'Logged out successfully' })
})

export default router
