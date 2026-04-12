import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Trash2, ArrowRight, Search, Plus } from 'lucide-react'
import { api } from '../lib/api'

interface Research {
  id: string
  title: string
  query: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  results?: string
  confidence_score?: string
  depth: number
  breadth: number
  createdAt: string
  updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-900 bg-opacity-40 text-green-300 border border-green-800',
  running:   'bg-accent-900 bg-opacity-20 text-accent-300 border border-accent-800',
  failed:    'bg-red-900 bg-opacity-30 text-red-300 border border-red-800',
  pending:   'bg-navy-800 text-navy-300 border border-navy-700',
}

export default function History() {
  const [researches, setResearches]             = useState<Research[]>([])
  const [filtered, setFiltered]                 = useState<Research[]>([])
  const [selected, setSelected]                 = useState<Research | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [error, setError]                       = useState('')
  const [searchQuery, setSearchQuery]           = useState('')
  const [statusFilter, setStatusFilter]         = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Research[]>('/api/research/history')
        setResearches(data)
        setFiltered(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter whenever search or status changes
  useEffect(() => {
    let result = researches
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        r => r.title.toLowerCase().includes(q) || r.query.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
    // Reset selection if it's no longer visible
    if (selected && !result.find(r => r.id === selected.id)) setSelected(null)
  }, [searchQuery, statusFilter, researches])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this research permanently?')) return
    try {
      await api.delete(`/api/research/${id}`)
      const updated = researches.filter(r => r.id !== id)
      setResearches(updated)
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleExport = async (research: Research) => {
    try {
      const res = await api.rawGet(`/api/research/${research.id}/export`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${research.title.replace(/\s+/g, '-')}-${research.id}.json`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const confidencePercent = (score?: string) => {
    if (!score || score === 'undefined') return null
    return Math.round(parseFloat(score) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-1">Research History</h1>
          <p className="text-navy-400">
            {researches.length} total research{researches.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Link to="/new-research" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Research
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
          <input
            type="text"
            placeholder="Search by title or query…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-navy-900 border border-navy-800 rounded-lg text-sm focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-navy-900 border border-navy-800 rounded-lg text-sm focus:outline-none focus:border-accent-500 transition-colors"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-navy-400 mb-2">
            {researches.length === 0 ? 'No research history yet' : 'No results match your filter'}
          </p>
          {researches.length === 0 && (
            <Link to="/new-research" className="btn-primary inline-flex items-center gap-2 text-sm mt-4">
              <Plus size={16} /> Start Your First Research
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {filtered.map(r => (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                className={`card cursor-pointer transition-all ${
                  selected?.id === r.id
                    ? 'border-accent-500 bg-navy-800'
                    : 'hover:border-navy-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold flex-1 leading-snug">{r.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-navy-400 text-sm line-clamp-2 mb-3 leading-relaxed">{r.query}</p>
                <div className="flex items-center justify-between">
                  <p className="text-navy-500 text-xs">
                    {new Date(r.createdAt).toLocaleDateString()} · Depth {r.depth} · Breadth {r.breadth}
                    {confidencePercent(r.confidence_score) !== null && (
                      <> · {confidencePercent(r.confidence_score)}% confidence</>
                    )}
                  </p>
                  <Link
                    to={`/research/${r.id}`}
                    className="text-accent-400 hover:text-accent-300 text-xs flex items-center gap-1 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    View <ArrowRight size={12} />
                  </Link>
                </div>

                {/* Progress bar for running */}
                {(r.status === 'running' || r.status === 'pending') && (
                  <div className="mt-3 w-full bg-navy-700 rounded-full h-1">
                    <div
                      className="bg-accent-500 h-1 rounded-full transition-all"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="space-y-4">
            {selected ? (
              <>
                <div className="card sticky top-8">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-lg leading-snug flex-1 pr-2">{selected.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[selected.status]}`}>
                      {selected.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div>
                      <p className="text-navy-500 text-xs uppercase tracking-wide mb-1">Query</p>
                      <p className="text-sm text-navy-300 leading-relaxed">{selected.query}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-navy-500 uppercase tracking-wide mb-1">Created</p>
                        <p>{new Date(selected.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-navy-500 uppercase tracking-wide mb-1">Depth/Breadth</p>
                        <p>{selected.depth} / {selected.breadth}</p>
                      </div>
                      {confidencePercent(selected.confidence_score) !== null && (
                        <div>
                          <p className="text-navy-500 uppercase tracking-wide mb-1">Confidence</p>
                          <p className="text-green-400">{confidencePercent(selected.confidence_score)}%</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Report preview */}
                  {selected.results && (
                    <div className="mb-4">
                      <p className="text-navy-500 text-xs uppercase tracking-wide mb-2">Preview</p>
                      <div className="bg-navy-800 rounded p-3 text-xs text-navy-300 max-h-36 overflow-y-auto leading-relaxed">
                        {selected.results.substring(0, 400)}…
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Link
                      to={`/research/${selected.id}`}
                      className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
                    >
                      <ArrowRight size={16} /> Open Full Report
                    </Link>
                    {selected.status === 'completed' && (
                      <button
                        onClick={() => handleExport(selected)}
                        className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                      >
                        <Download size={16} /> Export JSON
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="w-full px-4 py-2 bg-red-900 bg-opacity-20 hover:bg-opacity-30 text-red-300 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-10 text-navy-500 text-sm">
                Select a research item to see details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
