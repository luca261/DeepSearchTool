import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Request, Response, NextFunction } from 'express'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.startsWith('your-') || secret.startsWith('dev-secret')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set to a secure value in production')
    }
    return 'dev-only-insecure-secret-do-not-use-in-prod'
  }
  return secret
}

const JWT_SECRET = getJwtSecret()
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'

export interface AuthRequest extends Request {
  userId?: string
  user?: Record<string, unknown>
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions)
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    return decoded
  } catch {
    return null
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.userId = decoded.userId
  next()
}
