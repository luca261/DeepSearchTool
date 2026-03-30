import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, CheckCircle, Clock, Plus, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'

interface Research {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  depth: number
  breadth: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-900 bg-opacity-40 text-green-300 border border-green-800',
  running:   'bg-accent-900 bg-opacity-20 text-accent-300 border border-accent-800',
  failed:    'bg-red-900 bg-opacity-30 text-red-300 border border-red-800',
  pending:   'bg-navy-800 text-navy-300 border border-navy-700',
}

export default function Dashboard() {
  const [researches, setResearches] = useState<Research[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollRunning = useCallback(async (items: Research[]) => {
    const running = items.filter(r => r.status === 'running' || r.status === 'pending')
    if (running.length === 0) return items

    const updated = await Promise.all(
      running.map(async r => {
        try {
          const s = await api.get<{ status: string; progress: number }>(`/api/research/${r.id}/status`)
          return { ...r, status: s.status as Research['status'], progress: s.progress }
        } catch {
          return r
        }
      })
    )

    return items.map(r => {
      const u = updated.find(x => x.id === r.id)
      return u ?? r
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Research[]>('/api/research/recent')
        setResearches(data)
        setLoading(false)

        const hasRunning = data.some(r => r.status === 'running' || r.status === 'pending')
        if (hasRunning) {
          pollRef.current = setInterval(async () => {
            setResearches(prev => {
              const stillRunning = prev.some(r => r.status === 'running' || r.status === 'pending')
              if (!stillRunning) {
                clearInterval(pollRef.current!)
                pollRef.current = null
              }
              return prev
            })
            setResearches(prev => {
              pollRunning(prev).then(updated => setResearches(updated))
              return prev
            })
          }, 5_000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setLoading(false)
      }
    }
    load()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pollRunning])

  const completed = researches.filter(r => r.status === 'completed').length
  const inProgress = researches.filter(r => r.status === 'running' || r.status === 'pending').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-1">Dashboard</h1>
          <p className="text-navy-400">Your AI-powered research workspace</p>
        </div>
        <Link to="/new-research" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Research
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-navy-400 text-sm mb-1">Recent Research</p>
              <p className="text-3xl font-bold">{researches.length}</p>
              <p className="text-navy-500 text-xs mt-1">Last 10 jobs</p>
            </div>
            <div className="w-10 h-10 bg-navy-800 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-accent-500" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-navy-400 text-sm mb-1">Completed</p>
              <p className="text-3xl font-bold">{completed}</p>
              <p className="text-navy-500 text-xs mt-1">Reports ready</p>
            </div>
            <div className="w-10 h-10 bg-green-900 bg-opacity-30 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-400" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-navy-400 text-sm mb-1">In Progress</p>
              <p className="text-3xl font-bold">{inProgress}</p>
              <p className="text-navy-500 text-xs mt-1">
                {inProgress > 0 ? 'Auto-updating…' : 'None running'}
              </p>
            </div>
            <div className="w-10 h-10 bg-accent-900 bg-opacity-20 rounded-lg flex items-center justify-center">
              <Clock className={`text-accent-400 ${inProgress > 0 ? 'animate-pulse' : ''}`} size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Recent Research</h2>
          <Link to="/history" className="text-accent-400 hover:text-accent-300 text-sm flex items-center gap-1 transition-colors">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mx-auto"></div>
          </div>
        ) : researches.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-navy-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={28} className="text-navy-500" />
            </div>
            <p className="text-navy-400 mb-2 font-medium">No research yet</p>
            <p className="text-navy-500 text-sm mb-6">Submit your first research question to get started.</p>
            <Link to="/new-research" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Start Research
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {researches.map(r => (
              <Link
                key={r.id}
                to={`/research/${r.id}`}
                className="card hover:border-accent-600 transition-all cursor-pointer block group"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold group-hover:text-accent-400 transition-colors truncate">
                      {r.title}
                    </h3>
                    <p className="text-navy-500 text-xs mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString()} · Depth {r.depth} · Breadth {r.breadth}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                    <ArrowRight size={16} className="text-navy-600 group-hover:text-accent-400 transition-colors" />
                  </div>
                </div>

                {/* Progress bar for running items */}
                {(r.status === 'running' || r.status === 'pending') && (
                  <div>
                    <div className="w-full bg-navy-800 rounded-full h-1.5">
                      <div
                        className="bg-accent-500 h-1.5 rounded-full transition-all duration-1000"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                    <p className="text-navy-500 text-xs mt-1">{r.progress}% · updating every 5s…</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
