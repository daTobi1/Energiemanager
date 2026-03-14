import { useState, useEffect, useCallback } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Play, Square, Activity, Calendar, Shield, Bell, Cloud,
} from 'lucide-react'
import LiveDashboard from '../components/LiveDashboard'
import DashboardWidgets from '../components/DashboardWidgets'
import { api } from '../api/client'
import type { SchedulerStatus, ControllerStatus } from '../types'

/** Compact status bar showing system service states */
function StatusBar() {
  const [simRunning, setSimRunning] = useState(false)
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
  const [controller, setController] = useState<ControllerStatus | null>(null)
  const [alarmCount, setAlarmCount] = useState(0)
  const [weatherOk, setWeatherOk] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    const [sim, sched, ctrl, alarms, weather] = await Promise.all([
      api.simulator.status().catch(() => null),
      api.scheduler.status().catch(() => null),
      api.controller.status().catch(() => null),
      api.alarms.active().catch(() => null),
      api.weather.current().catch(() => null),
    ])
    setSimRunning(!!(sim as any)?.running)
    setScheduler(sched)
    setController(ctrl)
    setAlarmCount(alarms?.length ?? 0)
    setWeatherOk(weather !== null)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const iv = setInterval(refresh, 30_000)
    return () => clearInterval(iv)
  }, [refresh])

  const items = [
    {
      label: 'Simulator',
      icon: Play,
      active: simRunning,
      color: simRunning ? 'text-emerald-400' : 'text-dark-faded',
      to: '/system',
    },
    {
      label: 'Scheduler',
      icon: Calendar,
      active: scheduler?.running ?? false,
      color: scheduler?.running ? 'text-emerald-400' : 'text-dark-faded',
      to: '/system',
    },
    {
      label: 'Controller',
      icon: Shield,
      active: controller?.mode !== undefined && controller?.mode !== 'off',
      color: controller?.mode === 'auto' ? 'text-emerald-400' : controller?.mode === 'manual' ? 'text-amber-400' : 'text-dark-faded',
      detail: controller?.mode ?? 'off',
      to: '/optimizer',
    },
    {
      label: 'Alarme',
      icon: Bell,
      active: alarmCount > 0,
      color: alarmCount > 0 ? 'text-amber-400' : 'text-dark-faded',
      detail: alarmCount > 0 ? `${alarmCount}` : '0',
      to: '/alarms',
    },
    {
      label: 'Wetter',
      icon: Cloud,
      active: weatherOk === true,
      color: weatherOk ? 'text-sky-400' : 'text-dark-faded',
      to: '/weather',
    },
  ]

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(({ label, icon: Icon, active, color, detail, to }) => (
        <Link
          key={label}
          to={to}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-hover border border-dark-border hover:border-dark-faded transition-colors text-xs"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-dark-faded'}`} />
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-dark-muted">{label}</span>
          {detail && <span className={`font-medium ${color}`}>{detail}</span>}
        </Link>
      ))}
    </div>
  )
}

/** Collapsible setup checklist — hidden once complete */
function SetupBanner() {
  const { generators, meters, consumers, storages, rooms, circuits, settings } = useEnergyStore()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const gridGen = generators.find((g) => g.type === 'grid')
  const hasHausanschlussZaehler = meters.some((m) => m.assignedToType === 'grid')

  const checklistItems = [
    { label: 'Gebäudedaten & Standort eingeben', done: !!settings.buildingName, to: '/settings' },
    { label: 'Stromtarif konfigurieren', done: settings.gridConsumptionCtPerKwh > 0, to: '/settings' },
    { label: 'Wetter-API einrichten', done: !!settings.weatherApiKey || settings.weatherProvider === 'brightsky' || settings.weatherProvider === 'openmeteo', to: '/settings' },
    { label: 'Hausanschluss konfigurieren', done: !!gridGen, to: '/generators' },
    { label: 'Mindestens einen Erzeuger anlegen', done: generators.length > 0, to: '/generators' },
    { label: 'Speicher konfigurieren', done: storages.length > 0, to: '/storage' },
    { label: 'Heizkreise konfigurieren', done: circuits.length > 0, to: '/circuits' },
    { label: 'Räume anlegen und zuordnen', done: rooms.length > 0, to: '/rooms' },
    { label: 'Mindestens einen Verbraucher anlegen', done: consumers.length > 0, to: '/consumers' },
    { label: 'Hausanschluss-Zähler anlegen', done: hasHausanschlussZaehler, to: '/meters' },
    { label: 'Kommunikation der Geräte konfigurieren', done: generators.some((g) => g.communication.ipAddress), to: '/generators' },
  ]

  const completedCount = checklistItems.filter((i) => i.done).length
  const allDone = completedCount === checklistItems.length

  // Fully complete or dismissed → hide
  if ((allDone && !open) || dismissed) return null

  const pct = (completedCount / checklistItems.length) * 100

  return (
    <div className="card border-dashed border-amber-500/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-dark-muted">
            Einrichtung — {completedCount}/{checklistItems.length} erledigt
          </span>
          <div className="w-24 bg-dark-hover rounded-full h-1.5">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
              className="text-xs text-dark-faded hover:text-dark-muted"
            >
              Ausblenden
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-dark-faded" /> : <ChevronDown className="w-4 h-4 text-dark-faded" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-dark-border grid grid-cols-2 gap-1.5">
          {checklistItems.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-hover transition-colors"
            >
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-dark-border shrink-0" />
              )}
              <span className={`text-xs ${item.done ? 'text-dark-faded line-through' : 'text-dark-muted'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const settings = useEnergyStore((s) => s.settings)

  return (
    <div className="p-6 space-y-4">
      {/* Header + Status Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="text-sm text-dark-faded mt-0.5">
            {settings.buildingName || 'EnergyManager'}
          </p>
        </div>
        <StatusBar />
      </div>

      {/* Setup Banner (collapsible, hides when complete) */}
      <SetupBanner />

      {/* Wetter, PV-Prognose, KPIs, Sparklines */}
      <DashboardWidgets />

      {/* Live-Daten */}
      <LiveDashboard />
    </div>
  )
}
