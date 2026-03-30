import { useState, useEffect } from 'react'
import { Save, AlertCircle, CheckCircle, ExternalLink, Info } from 'lucide-react'
import { api } from '../lib/api'

interface Settings {
  n8nWebhookUrl: string
  apiKey: string
  theme: 'dark' | 'light'
  notificationsEnabled: boolean
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    n8nWebhookUrl: '',
    apiKey: '',
    theme: 'dark',
    notificationsEnabled: true,
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Settings>('/api/settings')
        setSettings(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.put('/api/settings', settings)
      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-navy-400">Manage integrations and preferences</p>
      </div>

      {error && (
        <div className="p-4 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg text-red-300 flex gap-3 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-900 bg-opacity-20 border border-green-700 rounded-lg text-green-300 flex gap-3 text-sm">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mx-auto"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* n8n Integration */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">n8n Integration</h2>
              <a
                href="https://n8n-aimpact.up.railway.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:text-accent-300 text-xs flex items-center gap-1 transition-colors"
              >
                Open n8n <ExternalLink size={12} />
              </a>
            </div>

            {/* Active webhook info */}
            <div className="p-3 bg-navy-800 rounded-lg border border-navy-700">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-accent-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-navy-300 space-y-1">
                  <p className="font-medium text-white">Active Research Engine</p>
                  <p className="font-mono text-navy-400 break-all">
                    POST /webhook/openresearcher-v2
                  </p>
                  <p className="text-navy-500">
                    Workflow B (s1vD6lUjs91YaKXB) — Depth 2–3 · ~46–90s per research
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="webhook" className="block text-sm font-medium mb-2">
                Custom Webhook Override <span className="text-navy-500 font-normal">(optional)</span>
              </label>
              <input
                id="webhook"
                type="url"
                value={settings.n8nWebhookUrl}
                onChange={e => handleChange('n8nWebhookUrl', e.target.value)}
                placeholder="https://your-n8n-instance.com/webhook/…"
                className="w-full px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:outline-none focus:border-accent-500 transition-colors text-sm"
              />
              <p className="text-navy-500 text-xs mt-1">
                Leave empty to use the default production webhook above.
              </p>
            </div>

            <div>
              <label htmlFor="apikey" className="block text-sm font-medium mb-2">
                API Key <span className="text-navy-500 font-normal">(optional)</span>
              </label>
              <input
                id="apikey"
                type="password"
                value={settings.apiKey}
                onChange={e => handleChange('apiKey', e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:outline-none focus:border-accent-500 transition-colors text-sm"
              />
              <p className="text-navy-500 text-xs mt-1">
                Stored securely; masked in API responses.
              </p>
            </div>
          </div>

          {/* Preferences */}
          <div className="card space-y-4">
            <h2 className="text-xl font-semibold">Preferences</h2>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium mb-2">Theme</label>
              <select
                id="theme"
                value={settings.theme}
                onChange={e => handleChange('theme', e.target.value as 'dark' | 'light')}
                className="w-full px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:outline-none focus:border-accent-500 transition-colors text-sm"
              >
                <option value="dark">Dark (default)</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="notifications"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={e => handleChange('notificationsEnabled', e.target.checked)}
                className="w-4 h-4 rounded bg-navy-800 border-navy-700 cursor-pointer accent-amber-500"
              />
              <label htmlFor="notifications" className="text-sm cursor-pointer">
                Enable browser notifications when research completes
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      )}

      {/* About */}
      <div className="card bg-navy-800 bg-opacity-50 border-navy-700">
        <h3 className="font-semibold mb-3">About OpenResearcher</h3>
        <div className="space-y-1.5 text-navy-400 text-sm">
          <p>AI-powered research dashboard built on n8n workflow automation.</p>
          <p>Reports include web research, source verification, and a Circle of Truth validation pass.</p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-navy-700 text-xs text-navy-500">
            <span>Version 1.1.0</span>
            <span>·</span>
            <span>Stack: React · Express · SQLite · n8n</span>
          </div>
        </div>
      </div>
    </div>
  )
}
