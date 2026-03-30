import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewResearch from './pages/NewResearch'
import History from './pages/History'
import Settings from './pages/Settings'
import ResearchDetail from './pages/ResearchDetail'
import { api, tokenStorage } from './lib/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleLogout = useCallback(() => {
    tokenStorage.clear()
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.get()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        await api.get('/api/auth/status')
        setIsAuthenticated(true)
      } catch {
        // 401 handled inside api.get — token already cleared, stays on /login
        tokenStorage.clear()
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-navy-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500 mx-auto mb-4"></div>
          <p className="text-navy-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/new-research" element={<NewResearch />} />
                  <Route path="/research/:id" element={<ResearchDetail />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  )
}

export default App
