import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db: Database | null = null

export async function initializeDatabase(): Promise<Database> {
  if (db) return db

  db = await open({
    filename: path.join(__dirname, '..', 'data', 'openresearcher.db'),
    driver: sqlite3.Database,
  })

  await db.exec('PRAGMA foreign_keys = ON')
  await db.exec('PRAGMA journal_mode = WAL')

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS researches (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      results TEXT,
      confidence_score TEXT,
      n8n_execution_id TEXT,
      n8n_session_id TEXT,
      depth INTEGER DEFAULT 2,
      breadth INTEGER DEFAULT 2,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE,
      n8nWebhookUrl TEXT,
      apiKey TEXT,
      theme TEXT DEFAULT 'dark',
      notificationsEnabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_researches_userId ON researches(userId);
    CREATE INDEX IF NOT EXISTS idx_researches_status ON researches(status);
    CREATE INDEX IF NOT EXISTS idx_researches_createdAt ON researches(createdAt);
    CREATE INDEX IF NOT EXISTS idx_researches_n8n_execution_id ON researches(n8n_execution_id);
  `)

  // Run migrations for existing databases (add new columns if they don't exist)
  await runMigrations(db)

  return db
}

async function runMigrations(database: Database): Promise<void> {
  const migrations = [
    { column: 'confidence_score', sql: "ALTER TABLE researches ADD COLUMN confidence_score TEXT" },
    { column: 'n8n_execution_id', sql: "ALTER TABLE researches ADD COLUMN n8n_execution_id TEXT" },
    { column: 'n8n_session_id',   sql: "ALTER TABLE researches ADD COLUMN n8n_session_id TEXT" },
    { column: 'depth',            sql: "ALTER TABLE researches ADD COLUMN depth INTEGER DEFAULT 2" },
    { column: 'breadth',          sql: "ALTER TABLE researches ADD COLUMN breadth INTEGER DEFAULT 2" },
    { column: 'retry_count',      sql: "ALTER TABLE researches ADD COLUMN retry_count INTEGER DEFAULT 0" },
    { column: 'error_message',    sql: "ALTER TABLE researches ADD COLUMN error_message TEXT" },
  ]

  const tableInfo = await database.all("PRAGMA table_info(researches)")
  const existingColumns = tableInfo.map((col: { name: string }) => col.name)

  for (const migration of migrations) {
    if (!existingColumns.includes(migration.column)) {
      await database.exec(migration.sql)
      console.log(`Migration: added column researches.${migration.column}`)
    }
  }
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}
