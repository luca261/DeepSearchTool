import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Send, Loader, Zap, Search, BookOpen } from 'lucide-react'
import { api } from '../lib/api'

type DepthMode = 'standard' | 'deep'

interface DepthOption {
  id: DepthMode
  label: string
  description: string
  depth: number
  breadth: number
  icon: typeof Zap
  time: string
}

const DEPTH_OPTIONS: DepthOption[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Fast, focused analysis with quality verification',
    depth: 2, breadth: 2,
    icon: Search,
    time: '~50 seconds',
  },
  {
    id: 'deep',
    label: 'Deep',
    description: 'Broader search with more sources and cross-validation',
    depth: 3, breadth: 2,
    icon: BookOpen,
    time: '~90 seconds',
  },
]

export default function NewResearch() {
  const location = useLocation()
  const prefill   = (location.state as { prefillTitle?: string; prefillQuery?: string } | null) ?? {}

  const [title, setTitle]             = useState(prefill.prefillTitle ?? '')
  const [query, setQuery]             = useState(prefill.prefillQuery ?? '')
  const [depthMode, setDepthMode]     = useState<DepthMode>('standard')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const navigate = useNavigate()

  const MIN_QUERY = 20
  const MAX_QUERY = 800

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (query.length < MIN_QUERY) {
      setError(`Research query must be at least ${MIN_QUERY} characters for meaningful results.`)
      return
    }

    setLoading(true)
    const selected = DEPTH_OPTIONS.find(o => o.id === depthMode)!

    try {
      const data = await api.post<{ researchId: string }>('/api/research/create', {
        title,
        query,
        depth:   selected.depth,
        breadth: selected.breadth,
      })

      // Navigate straight to the live research detail view
      navigate(`/research/${data.researchId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research')
      setLoading(false)
    }
  }

  const selectedOption = DEPTH_OPTIONS.find(o => o.id === depthMode)!
  const queryTooShort = query.length > 0 && query.length < MIN_QUERY
  const queryTooLong  = query.length > MAX_QUERY

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">New Research</h1>
        <p className="text-navy-400">Submit a question — n8n handles the rest</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="card">
          <label htmlFor="title" className="block text-sm font-semibold mb-2">
            Research Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Competitive Analysis — AI Research Tools 2025"
            className="w-full px-4 py-2.5 bg-navy-800 border border-navy-700 rounded-lg focus:outline-none focus:border-accent-500 transition-colors text-sm"
            required
          />
        </div>

        {/* Query */}
        <div className="card">
          <label htmlFor="query" className="block text-sm font-semibold mb-2">
            Research Question
            <span className={`font-normal ml-2 text-xs ${
              queryTooLong ? 'text-red-400' : query.length >= MIN_QUERY ? 'text-green-400' : 'text-navy-500'
            }`}>
              {query.length} / {MAX_QUERY} chars
            </span>
          </label>
          <textarea
            id="query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Describe what you want researched. Be specific — include context, timeframe, or constraints to get better results. Example: What are the most cost-effective AI automation tools for small businesses in 2025, compared by pricing model and feature set?"
            rows={6}
            className={`w-full px-4 py-2.5 bg-navy-800 border rounded-lg focus:outline-none focus:border-accent-500 transition-colors resize-none text-sm ${
              queryTooLong ? 'border-red-700' : queryTooShort ? 'border-yellow-700' : 'border-navy-700'
            }`}
            required
          />
          {queryTooShort && (
            <p className="text-yellow-400 text-xs mt-1">
              Add {MIN_QUERY - query.length} more characters for a meaningful research query.
            </p>
          )}
          {queryTooLong && (
            <p className="text-red-400 text-xs mt-1">
              ⚠️ Query exceeds {MAX_QUERY} characters. The AI engine works best with focused questions — queries will be trimmed. Consider condensing your question for best results.
            </p>
          )}
          {!queryTooShort && !queryTooLong && query.length >= MIN_QUERY && (
            <p className="text-green-400 text-xs mt-1">✓ Good length for the research engine.</p>
          )}
          <p className="text-navy-500 text-xs mt-2">
            Keep under {MAX_QUERY} characters. Be specific but concise — the AI engine performs best with focused questions.
          </p>
        </div>

        {/* Depth Selector */}
        <div className="card">
          <label className="block text-sm font-semibold mb-3">Search Depth</label>
          <div className="grid grid-cols-2 gap-3">
            {DEPTH_OPTIONS.map(opt => {
              const Icon = opt.icon
              const active = depthMode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDepthMode(opt.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    active
                      ? 'border-accent-500 bg-accent-500 bg-opacity-10'
                      : 'border-navy-700 bg-navy-800 hover:border-navy-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={18} className={active ? 'text-accent-400' : 'text-navy-400'} />
                    <span className={`font-semibold text-sm ${active ? 'text-accent-300' : ''}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-navy-400 text-xs leading-snug mb-1">{opt.description}</p>
                  <p className={`text-xs font-medium ${active ? 'text-accent-400' : 'text-navy-500'}`}>
                    {opt.time}
                  </p>
                </button>
              )
            })}
          </div>
          <p className="text-navy-500 text-xs mt-2">
            Depth {selectedOption.depth} · Breadth {selectedOption.breadth} · Circle of Truth verification included
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !title || query.length < MIN_QUERY}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader size={18} className="animate-spin" /> Submitting…</>
            ) : (
              <><Send size={18} /> Start Research</>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* How it works */}
      <div className="card bg-navy-800 bg-opacity-50 border-navy-700">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-accent-400" />
          <h3 className="font-semibold text-sm">How it works</h3>
        </div>
        <ol className="space-y-2 text-navy-300 text-sm">
          {[
            'Your question is submitted to the n8n research engine (~0.5s)',
            'n8n searches, gathers, and analyses sources in parallel',
            'A "Circle of Truth" dual-verifier checks the findings',
            'A structured markdown report is written and stored',
            'You can view, download, or share the report at any time',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-accent-500 font-bold flex-shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
