import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Sun, Gauge, Plug, Battery,
  GitBranch, BarChart3, Settings, Zap,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generators', icon: Sun, label: 'Erzeuger' },
  { to: '/meters', icon: Gauge, label: 'Zähler' },
  { to: '/consumers', icon: Plug, label: 'Verbraucher' },
  { to: '/storage', icon: Battery, label: 'Speicher' },
  { to: '/energy-flow', icon: GitBranch, label: 'Energiefluss' },
  { to: '/sankey', icon: BarChart3, label: 'Sankey-Diagramm' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
]

export default function Layout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">EnergyManager</h1>
              <p className="text-xs text-gray-400">Energiemanagementsystem</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">EnergyManager v0.1.0</p>
          <p className="text-xs text-gray-600">Prototyp</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
