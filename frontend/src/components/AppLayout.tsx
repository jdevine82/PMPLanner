import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, Settings, Wrench, LogOut, Building2, BarChart2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/customers',  label: 'Customers',  icon: Building2 },
  { to: '/templates',  label: 'Templates',  icon: FileText },
  { to: '/reports',    label: 'Reports',    icon: BarChart2 },
  { to: '/settings',   label: 'Settings',   icon: Settings, adminOnly: true },
  { to: '/users',      label: 'Users',      icon: Users,    adminOnly: true },
]

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-gray-900 text-white">
        <div className="flex h-14 items-center gap-2 border-b border-gray-700 px-4">
          <Wrench className="h-5 w-5 text-blue-400" />
          <span className="font-semibold tracking-tight">PM Planner</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems
            .filter((item) => !item.adminOnly || user?.user_role === 'Admin')
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-gray-700 p-3">
          <div className="mb-2 px-2 text-xs text-gray-400">
            <span className="block font-medium text-gray-200">{user?.username}</span>
            <span>{user?.user_role}</span>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
