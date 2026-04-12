import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, Settings, History, Plus } from 'lucide-react'
import { api } from '../lib/api'

interface LayoutProps {
  children: ReactNode
  onLogout: () => void
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore — clear token regardless
    }
    onLogout()
  }

  const navItems = [
    { path: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { path: '/new-research', label: 'New Research',  icon: Plus },
    { path: '/history',      label: 'History',       icon: History },
    { path: '/settings',     label: 'Settings',      icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-navy-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-navy-900 border-r border-navy-800 transition-all duration-300 flex flex-col flex-shrink-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center text-navy-950 font-bold flex-shrink-0">
              OR
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold leading-tight">OpenResearcher</h1>
                <p className="text-navy-500 text-xs">Powered by n8n</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`sidebar-item flex items-center gap-3 ${isActive(path) ? 'active' : ''}`}
            >
              <Icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-navy-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full sidebar-item flex items-center gap-3 text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-20"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 hover:bg-navy-800 rounded-lg transition-colors flex items-center justify-center"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X size={18} className="text-navy-400" /> : <Menu size={18} className="text-navy-400" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
