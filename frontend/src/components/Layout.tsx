import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Gauge, Sun, Plug, Battery,
  Home, Waypoints, Monitor, Target, Bell, Brain, Car,
  GitBranch, BarChart3, Zap, Wifi, WifiOff, PenTool,
  Mountain, Activity, TrendingUp, Cloud, ChevronDown,
} from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'

interface NavItem {
  to: string
  icon: typeof LayoutDashboard
  label: string
}

interface NavGroup {
  key: string
  title: string
  icon: typeof LayoutDashboard
  collapsible: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    key: 'main',
    title: '',
    icon: LayoutDashboard,
    collapsible: false,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    key: 'viz',
    title: 'Visualisierung',
    icon: TrendingUp,
    collapsible: true,
    items: [
      { to: '/hydraulic-schema', icon: PenTool, label: 'Hydraulikschema' },
      { to: '/electrical-schema', icon: Zap, label: 'Stromschema' },
      { to: '/energy-flow', icon: GitBranch, label: 'Energiefluss' },
      { to: '/sankey', icon: BarChart3, label: 'Sankey' },
      { to: '/trends', icon: TrendingUp, label: 'Trends' },
      { to: '/weather', icon: Cloud, label: 'Wetter & Prognose' },
    ],
  },
  {
    key: 'opt',
    title: 'Steuerung',
    icon: Target,
    collapsible: true,
    items: [
      { to: '/optimizer', icon: Target, label: 'Optimierer' },
      { to: '/self-learning', icon: Brain, label: 'Selbstlernung' },
    ],
  },
  {
    key: 'ev',
    title: 'E-Mobilität',
    icon: Car,
    collapsible: true,
    items: [
      { to: '/charging', icon: Car, label: 'Lademanagement' },
      { to: '/charging/analytics', icon: BarChart3, label: 'Ladeauswertung' },
    ],
  },
  {
    key: 'config',
    title: 'Anlage',
    icon: Settings,
    collapsible: true,
    items: [
      { to: '/settings', icon: Settings, label: 'Standort & Gebäude' },
      { to: '/generators', icon: Sun, label: 'Erzeuger' },
      { to: '/storage', icon: Battery, label: 'Speicher' },
      { to: '/circuits', icon: Waypoints, label: 'Heiz-/Kältekreise' },
      { to: '/rooms', icon: Home, label: 'Räume' },
      { to: '/consumers', icon: Plug, label: 'Verbraucher' },
      { to: '/meters', icon: Gauge, label: 'Zähler' },
      { to: '/sources', icon: Mountain, label: 'Quellen' },
      { to: '/sensors', icon: Activity, label: 'Sensoren' },
    ],
  },
  {
    key: 'sys',
    title: 'System',
    icon: Monitor,
    collapsible: true,
    items: [
      { to: '/system', icon: Monitor, label: 'Systemverwaltung' },
      { to: '/alarms', icon: Bell, label: 'Alarme' },
    ],
  },
]

function useGroupHasActive(items: NavItem[]): boolean {
  const { pathname } = useLocation()
  return items.some(i => i.to === '/' ? pathname === '/' : pathname.startsWith(i.to))
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const hasActive = useGroupHasActive(group.items)
  const [open, setOpen] = useState(hasActive)

  // Non-collapsible: always show items
  if (!group.collapsible) {
    return (
      <div>
        {group.items.map(item => (
          <NavItem key={item.to} item={item} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
          hasActive && !open
            ? 'text-emerald-400'
            : 'text-dark-faded hover:text-dark-text hover:bg-dark-hover/50'
        }`}
      >
        <group.icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{group.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${
        open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="ml-2 pl-2.5 border-l border-dark-border/50 space-y-0.5 py-1">
          {group.items.map(item => (
            <NavItem key={item.to} item={item} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

function NavItem({ item, compact }: { item: NavItem; compact?: boolean }) {
  const { to, icon: Icon, label } = item
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg transition-colors ${
          compact ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm'
        } ${
          isActive
            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
            : 'text-dark-faded hover:bg-dark-hover hover:text-dark-text'
        }`
      }
    >
      <Icon className={`shrink-0 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const apiConnected = useEnergyStore((s) => s.apiConnected)
  const syncing = useEnergyStore((s) => s.syncing)

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* Sidebar */}
      <aside className="w-60 bg-dark-card text-dark-text flex flex-col shrink-0 border-r border-dark-border">
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">EnergyManager</h1>
              <p className="text-[10px] text-dark-faded">Energiemanagementsystem</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
          {navGroups.map(group => (
            <NavGroupSection key={group.key} group={group} />
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-dark-border">
          <div className="flex items-center gap-2">
            {syncing ? (
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            ) : apiConnected ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-dark-faded" />
            )}
            <span className="text-[11px] text-dark-faded">
              {syncing ? 'Synchronisiere...' : apiConnected ? 'Verbunden' : 'Offline'}
            </span>
            <span className="text-[10px] text-dark-faded/50 ml-auto">v0.1</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
