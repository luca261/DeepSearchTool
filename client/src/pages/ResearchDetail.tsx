import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Clock, CheckCircle, XCircle, BarChart2 } from 'lucide-react'
import { api } from '../lib/api'
import MarkdownRenderer from '../components/MarkdownRenderer'
import ProgressStages from '../components/ProgressStages'

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
  retry_count?: number
  error_message?: string
  createdAt: string
  updatedAt: string
}

interface StatusResponse {
  status: string
  progress: number
  results?: string
  confidence_score?: string
  retry_count?: number
  retrying?: boolean
  error_message?: string
  message?: string
}

export default function ResearchDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [research, setResearch]   = useState<Research | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [retrying, setRetrying]   = useState(false)
  const [retryMsg, setRetryMsg]   = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const fetchStatus = async () => {
    if (!id) return
    try {
      const data = await api.get<StatusResponse>(`/api/research/${id}/status`)
      setResearch(prev =>
        prev ? { ...prev, ...data, status: data.status as Research['status'] } : null
      )
      if (data.retrying) {
        setRetryMsg(data.message || 'Auto-retrying…')
      } else {
        setRetryMsg('')
      }
      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling()
        setRetrying(false)
      }
    } catch (err) {
      console.error('Status poll error:', err)
    }
  }

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await api.get<Research>(`/api/research/${id}`)
        setResearch(data)

        if (data.status === 'running' || data.status === 'pending') {
          // Start polling every 5 seconds
          pollRef.current = setInterval(fetchStatus, 5_000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load research')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => stopPolling()
  }, [id])

  const handleManualRetry = async () => {
    if (!research || retrying) return
    setRetrying(true)
    setRetryMsg('Resubmitting to research engine…')
    setError('')
    try {
      await api.post(`/api/research/${research.id}/retry`)
      setResearch(prev => prev ? { ...prev, status: 'running', progress: 0 } : null)
      // Resume polling
      stopPolling()
      pollRef.current = setInterval(fetchStatus, 5_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
      setRetrying(false)
      setRetryMsg('')
    }
  }

  const handleDelete = async () => {
    if (!research || !confirm('Delete this research permanently?')) return
    try {
      await api.delete(`/api/research/${research.id}`)
      navigate('/history')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleExport = async () => {
    if (!research) return
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

  const confidencePercent = research?.confidence_score
    ? Math.round(parseFloat(research.confidence_score) * 100)
    : null

  const depthLabel = { 2: 'Standard', 3: 'Deep' }[research?.depth ?? 2] ?? 'Standard'
  const breadthLabel = { 1: 'Focused', 2: 'Balanced', 3: 'Broad' }[research?.breadth ?? 2] ?? 'Balanced'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-500"></div>
      </div>
    )
  }

  if (error || !research) {
    return (
      <div className="max-w-3xl">
        <div className="card text-center py-12">
          <XCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-300">{error || 'Research not found'}</p>
          <Link to="/history" className="btn-secondary inline-flex items-center gap-2 mt-4 text-sm">
            <ArrowLeft size={16} /> Back to History
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/history"
            className="text-navy-400 hover:text-white text-sm flex items-center gap-1 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to History
          </Link>
          <h1 className="text-4xl font-bold mb-2 leading-tight">{research.title}</h1>
          <p className="text-navy-400 text-sm">
            Started {new Date(research.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          {research.status === 'completed' && (
            <span className="flex items-center gap-2 px-4 py-2 bg-green-900 bg-opacity-30 border border-green-700 rounded-full text-green-300 text-sm font-semibold">
              <CheckCircle size={16} /> Completed
            </span>
          )}
          {research.status === 'running' && (
            <span className="flex items-center gap-2 px-4 py-2 bg-accent-900 bg-opacity-20 border border-accent-700 rounded-full text-accent-300 text-sm font-semibold">
              <Clock size={16} className="animate-pulse" /> Running
            </span>
          )}
          {research.status === 'failed' && (
            <span className="flex items-center gap-2 px-4 py-2 bg-red-900 bg-opacity-30 border border-red-700 rounded-full text-red-300 text-sm font-semibold">
              <XCircle size={16} /> Failed
            </span>
          )}
          {research.status === 'pending' && (
            <span className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-navy-700 rounded-full text-navy-300 text-sm font-semibold">
              <Clock size={16} /> Pending
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata + Progress */}
        <div className="space-y-4">
          {/* Query */}
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-400 uppercase tracking-wide mb-2">Research Query</h3>
            <p className="text-sm text-navy-200 leading-relaxed">{research.query}</p>
          </div>

          {/* Parameters */}
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-400 uppercase tracking-wide mb-3">Parameters</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-navy-400">Search Depth</span>
                <span className="font-medium">{depthLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-400">Breadth</span>
                <span className="font-medium">{breadthLabel}</span>
              </div>
              {confidencePercent !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-navy-400 flex items-center gap-1">
                    <BarChart2 size={14} /> Confidence
                  </span>
                  <span className={`font-medium ${
                    confidencePercent >= 70 ? 'text-green-400' :
                    confidencePercent >= 40 ? 'text-accent-400' : 'text-red-400'
                  }`}>
                    {confidencePercent}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress / Stages */}
          {(research.status === 'running' || research.status === 'pending') && (
            <div className="card">
              <h3 className="text-sm font-semibold text-navy-400 uppercase tracking-wide mb-3">Progress</h3>
              {/* Progress bar */}
              <div className="w-full bg-navy-800 rounded-full h-2 mb-4">
                <div
                  className="bg-accent-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${research.progress}%` }}
                />
              </div>
              <p className="text-xs text-navy-400 mb-4">{research.progress}% — typically completes in ~50s</p>
              <ProgressStages progress={research.progress} status={research.status} />
            </div>
          )}

          {/* Actions */}
          {research.status === 'completed' && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-navy-400 uppercase tracking-wide mb-3">Actions</h3>
              <button
                onClick={handleExport}
                className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
              >
                <Download size={16} /> Export JSON
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 bg-red-900 bg-opacity-20 hover:bg-opacity-30 text-red-300 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 size={16} /> Delete Research
              </button>
            </div>
          )}
        </div>

        {/* Right: Report */}
        <div className="lg:col-span-2">
          {research.status === 'completed' && research.results ? (
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-navy-800">Research Report</h2>
              <MarkdownRenderer content={research.results} className="prose-report" />
            </div>
          ) : research.status === 'failed' ? (
            <div className="card text-center py-12">
              <XCircle size={48} className="text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Research Failed</h3>
              {research.error_message && (
                <p className="text-red-300 text-sm mb-3 max-w-md mx-auto">{research.error_message}</p>
              )}
              {(research.retry_count ?? 0) > 0 && (
                <p className="text-navy-500 text-xs mb-3">Auto-retried {research.retry_count} time{research.retry_count === 1 ? '' : 's'}</p>
              )}
              <ul className="text-navy-500 text-xs mb-6 space-y-1 max-w-md mx-auto text-left list-disc list-inside">
                <li>Keep your query under 800 characters — very long prompts cause the engine to stall</li>
                <li>Be specific but concise: one focused question beats a full brief</li>
                <li>Try <strong className="text-navy-300">Standard</strong> depth if <strong className="text-navy-300">Deep</strong> keeps failing</li>
                <li>The n8n engine occasionally has transient issues — retrying often succeeds</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleManualRetry}
                  disabled={retrying}
                  className="btn-primary inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {retrying ? (
                    <><span className="animate-spin h-4 w-4 border-b-2 border-navy-950 rounded-full inline-block"></span> Retrying…</>
                  ) : (
                    <>↻ Retry Same Query</>
                  )}
                </button>
                <Link
                  to="/new-research"
                  state={{ prefillTitle: research.title, prefillQuery: research.query?.slice(0, 800) }}
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-sm"
                >
                  Edit &amp; Try Again
                </Link>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">
                {(research.retry_count ?? 0) > 0 ? `Retrying… (attempt ${(research.retry_count ?? 0) + 1} of 6)` : 'Research in Progress'}
              </h3>
              {retryMsg ? (
                <p className="text-accent-400 text-sm max-w-sm mx-auto font-medium">{retryMsg}</p>
              ) : (research.retry_count ?? 0) > 0 ? (
                <div className="space-y-2">
                  <p className="text-accent-400 text-sm max-w-sm mx-auto">
                    {research.error_message || `The research engine is being retried automatically.`}
                  </p>
                  <p className="text-navy-500 text-xs max-w-sm mx-auto">
                    The background worker will keep retrying every 2 minutes. You can leave this page and come back — the result will be saved when it completes.
                  </p>
                </div>
              ) : (
                <p className="text-navy-400 text-sm max-w-sm mx-auto">
                  n8n is searching, analysing, and verifying sources. Updates every 5 seconds.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
