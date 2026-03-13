import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Gauge, Sun, Plug, Battery,
  Home, Waypoints, Monitor, Target,
  GitBranch, BarChart3, Zap, Wifi, WifiOff, PenTool,
  Mountain, Activity, TrendingUp, Cloud,
} from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'

interface NavGroup {
  title: string
  items: { to: string; icon: typeof LayoutDashboard; label: string }[]
}

const navGroups: NavGroup[] = [
  {
    title: '',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'VISUALISIERUNG',
    items: [
      { to: '/hydraulic-schema', icon: PenTool, label: 'Hydraulikschema' },
      { to: '/electrical-schema', icon: Zap, label: 'Stromschema' },
      { to: '/energy-flow', icon: GitBranch, label: 'Energiefluss' },
      { to: '/trends', icon: TrendingUp, label: 'Trends' },
      { to: '/weather', icon: Cloud, label: 'Wetter & Prognose' },
      { to: '/sankey', icon: BarChart3, label: 'Sankey-Diagramm' },
    ],
  },
  {
    title: 'OPTIMIERUNG',
    items: [
      { to: '/optimizer', icon: Target, label: 'Optimierer' },
    ],
  },
  {
    title: 'KONFIGURATION',
    items: [
      { to: '/settings', icon: Settings, label: 'Anlage & Standort' },
      { to: '/generators', icon: Sun, label: 'Erzeuger' },
      { to: '/storage', icon: Battery, label: 'Speicher' },
      { to: '/circuits', icon: Waypoints, label: 'Heiz- & Kältekreise' },
      { to: '/rooms', icon: Home, label: 'Räume' },
      { to: '/consumers', icon: Plug, label: 'Verbraucher' },
      { to: '/meters', icon: Gauge, label: 'Zähler' },
      { to: '/sources', icon: Mountain, label: 'Quellen' },
      { to: '/sensors', icon: Activity, label: 'Sensoren' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/system', icon: Monitor, label: 'Systemverwaltung' },
    ],
  },
]

export default function Layout() {
  const apiConnected = useEnergyStore((s) => s.apiConnected)
  const syncing = useEnergyStore((s) => s.syncing)

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-card text-dark-text flex flex-col shrink-0 border-r border-dark-border">
        <div className="p-5 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">EnergyManager</h1>
              <p className="text-xs text-dark-faded">Energiemanagementsystem</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.title && (
                <p className="px-4 mb-1 text-[10px] font-semibold text-dark-faded tracking-widest uppercase">{group.title}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'text-dark-faded hover:bg-dark-hover hover:text-dark-text'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center gap-2 mb-1">
            {syncing ? (
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            ) : apiConnected ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-dark-faded" />
            )}
            <span className="text-xs text-dark-faded">
              {syncing ? 'Synchronisiere...' : apiConnected ? 'Backend verbunden' : 'Offline-Modus'}
            </span>
          </div>
          <p className="text-xs text-dark-faded">EnergyManager v0.1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
