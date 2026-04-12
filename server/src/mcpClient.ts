/**
 * mcpClient.ts
 *
 * Thin wrapper around the n8n MCP Server at:
 *   https://n8n-aimpact.up.railway.app/mcp-server/http
 *
 * The n8n JWT is kept **server-side only** — loaded from the N8N_JWT_TOKEN
 * environment variable and never forwarded to the browser.
 *
 * Two tools are exposed:
 *   run_deep_research  → submits a query, returns session_id
 *   get_research_results → polls for the finished report by session_id
 */

import axios from 'axios'

const MCP_ENDPOINT = process.env.N8N_MCP_ENDPOINT || 'https://n8n-aimpact.up.railway.app/mcp-server/http'
const MAX_QUERY_LENGTH = 800

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpRunResult {
  session_id: string
  status: string   // "accepted"
  message: string
}

export interface McpPollResult {
  status: 'running' | 'completed' | 'failed' | string
  report?: string
  confidence_score?: string | number
  total_sources?: number
  sources?: unknown[]
}

// ---------------------------------------------------------------------------
// Internal: JSON-RPC call helper
// ---------------------------------------------------------------------------

function getJwt(): string {
  const token = process.env.N8N_JWT_TOKEN
  if (!token) {
    throw new Error(
      'N8N_JWT_TOKEN is not set. Add it to your .env file.\n' +
      'See .env.example for the correct key name.'
    )
  }
  return token
}

async function mcpCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const jwt = getJwt()

  const body = {
    jsonrpc: '2.0',
    id:      Date.now(),
    method,
    params,
  }

  const response = await axios.post<{
    result?: { content?: Array<{ type: string; text: string }> }
    error?: { code: number; message: string }
  }>(MCP_ENDPOINT, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${jwt}`,
    },
    timeout: 20_000,
  })

  const { data } = response

  // Surface auth errors clearly so the operator knows to rotate the JWT
  if ((data as unknown as { message?: string }).message?.includes('Unauthorized')) {
    throw new Error(
      `MCP auth rejected: ${(data as unknown as { message: string }).message}. ` +
      'Please regenerate the N8N_JWT_TOKEN with audience "mcp-server-api" in n8n → Settings → API.'
    )
  }

  if (data.error) {
    throw new Error(`MCP error ${data.error.code}: ${data.error.message}`)
  }

  // MCP returns results as an array of content blocks; the first text block
  // contains the JSON payload we care about.
  const content = data.result?.content
  if (!content || content.length === 0) {
    throw new Error('MCP returned empty content')
  }

  const textBlock = content.find(c => c.type === 'text')
  if (!textBlock) {
    throw new Error('MCP returned no text content block')
  }

  try {
    return JSON.parse(textBlock.text) as T
  } catch {
    throw new Error(`MCP returned invalid JSON: ${textBlock.text.slice(0, 200)}`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a new research query via the MCP `run_deep_research` tool.
 *
 * @param query    The research question (will be truncated to MAX_QUERY_LENGTH)
 * @param depth    Recursion depth 1-3
 * @param breadth  Parallel branches 1-5
 * @returns        { session_id, status, message }
 */
export async function mcpRunResearch(
  query: string,
  depth: number,
  breadth: number
): Promise<McpRunResult> {
  const safeQuery = query.length > MAX_QUERY_LENGTH
    ? query.slice(0, MAX_QUERY_LENGTH) + '...'
    : query

  return mcpCall<McpRunResult>('tools/call', {
    name: 'run_deep_research',
    arguments: {
      research_question: safeQuery,
      depth,
      breadth,
    },
  })
}

/**
 * Poll the MCP `get_research_results` tool for a given session_id.
 *
 * @param sessionId  The session_id returned by mcpRunResearch
 * @returns          { status, report?, confidence_score?, total_sources?, sources? }
 */
export async function mcpGetResults(sessionId: string): Promise<McpPollResult> {
  return mcpCall<McpPollResult>('tools/call', {
    name: 'get_research_results',
    arguments: { session_id: sessionId },
  })
}
