import { useState } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { Link } from 'react-router-dom'
import {
  Sun, Gauge, Plug, Battery, Home, Waypoints, GitBranch, Settings,
  CheckCircle2, AlertCircle, ArrowRight, Database, Trash2,
} from 'lucide-react'
import LiveDashboard from '../components/LiveDashboard'
import type { GeneratorType } from '../types'
import { createBavariaSeedData } from '../data/seedBavaria'

const typeLabels: Record<GeneratorType, string> = {
  pv: 'PV', chp: 'BHKW', heat_pump: 'WP', boiler: 'Kessel', chiller: 'Kälte',
}

export default function DashboardPage() {
  const { generators, meters, consumers, storages, rooms, circuits, settings, loadSeedData, clearAll } = useEnergyStore()
  const [confirmClear, setConfirmClear] = useState(false)

  const configComplete = generators.length > 0 && meters.length > 0 && consumers.length > 0
  const hasHausanschlussZaehler = meters.some((m) => m.assignedToType === 'grid')

  const sections = [
    {
      title: 'Erzeuger', icon: Sun, count: generators.length, to: '/generators',
      color: 'text-amber-400 bg-amber-500/15',
      detail: generators.length > 0
        ? generators.map((g) => `${g.name || typeLabels[g.type]}`).join(', ')
        : 'Noch keine Erzeuger konfiguriert',
    },
    {
      title: 'Speicher', icon: Battery, count: storages.length, to: '/storage',
      color: 'text-purple-400 bg-purple-500/15',
      detail: storages.length > 0
        ? storages.map((s) => s.name || s.type).join(', ')
        : 'Noch keine Speicher konfiguriert',
    },
    {
      title: 'Heizkreise', icon: Waypoints, count: circuits.length, to: '/circuits',
      color: 'text-red-400 bg-red-500/15',
      detail: circuits.length > 0
        ? circuits.map((c) => c.name).join(', ')
        : 'Noch keine Heizkreise konfiguriert',
    },
    {
      title: 'Räume', icon: Home, count: rooms.length, to: '/rooms',
      color: 'text-emerald-400 bg-emerald-500/15',
      detail: rooms.length > 0
        ? `${rooms.length} Räume, ${rooms.reduce((s, r) => s + r.areaM2, 0).toLocaleString()} m² gesamt`
        : 'Noch keine Räume konfiguriert',
    },
    {
      title: 'Verbraucher', icon: Plug, count: consumers.length, to: '/consumers',
      color: 'text-green-400 bg-green-500/15',
      detail: consumers.length > 0
        ? `${consumers.reduce((s, c) => s + c.annualConsumptionKwh, 0).toLocaleString()} kWh/a gesamt`
        : 'Noch keine Verbraucher konfiguriert',
    },
    {
      title: 'Zähler', icon: Gauge, count: meters.length, to: '/meters',
      color: 'text-yellow-400 bg-yellow-500/15',
      detail: meters.length > 0
        ? meters.map((m) => m.name || m.meterNumber).join(', ')
        : 'Noch keine Zähler konfiguriert',
    },
  ]

  const checklistItems = [
    { label: 'Gebäudedaten & Standort eingeben', done: !!settings.buildingName, to: '/settings' },
    { label: 'Stromtarif konfigurieren', done: settings.gridConsumptionCtPerKwh > 0, to: '/settings' },
    { label: 'Wetter-API einrichten', done: !!settings.weatherApiKey || settings.weatherProvider === 'brightsky', to: '/settings' },
    { label: 'Mindestens einen Erzeuger anlegen', done: generators.length > 0, to: '/generators' },
    { label: 'Speicher konfigurieren', done: storages.length > 0, to: '/storage' },
    { label: 'Heizkreise konfigurieren', done: circuits.length > 0, to: '/circuits' },
    { label: 'Räume anlegen und zuordnen', done: rooms.length > 0, to: '/rooms' },
    { label: 'Mindestens einen Verbraucher anlegen', done: consumers.length > 0, to: '/consumers' },
    { label: 'Hausanschluss-Zähler anlegen', done: hasHausanschlussZaehler, to: '/meters' },
    { label: 'Kommunikation der Geräte konfigurieren', done: generators.some((g) => g.communication.ipAddress), to: '/generators' },
  ]

  const completedCount = checklistItems.filter((i) => i.done).length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-header">Dashboard</h1>
        <p className="text-sm text-dark-faded mt-1">
          {settings.buildingName || 'EnergyManager'} — Anlagenkonfiguration
        </p>
      </div>

      {/* Live-Daten */}
      <div className="mb-6">
        <LiveDashboard />
      </div>

      {/* Übersichtskarten */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {sections.map(({ title, icon: Icon, count, to, color, detail }) => (
          <Link key={to} to={to} className="card hover:border-dark-faded transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-dark-text">{count}</span>
            </div>
            <h3 className="font-semibold text-dark-muted">{title}</h3>
            <p className="text-xs text-dark-faded mt-1 truncate">{detail}</p>
            <div className="flex items-center gap-1 mt-3 text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Konfigurieren <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Checkliste */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Einrichtung</h2>
            <span className="text-sm text-dark-faded">{completedCount}/{checklistItems.length}</span>
          </div>
          <div className="w-full bg-dark-hover rounded-full h-2 mb-4">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {checklistItems.map((item, i) => (
              <Link
                key={i}
                to={item.to}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-hover transition-colors"
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-dark-border shrink-0" />
                )}
                <span className={`text-sm ${item.done ? 'text-dark-faded line-through' : 'text-dark-muted'}`}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Schnellzugriff */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-title mb-4">Visualisierungen</h2>
            <div className="space-y-2">
              <Link
                to="/energy-flow"
                className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
              >
                <GitBranch className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="text-sm font-medium text-emerald-400">Energiefluss-Diagramm</span>
                  <p className="text-xs text-emerald-500/70">Interaktive Darstellung aller Energieflüsse</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-500/50 ml-auto" />
              </Link>
              <Link
                to="/sankey"
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
              >
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h4v16H4zM16 4h4v16h-4zM8 6l8 4M8 12l8 0M8 18l8-4" />
                </svg>
                <div>
                  <span className="text-sm font-medium text-blue-400">Sankey-Diagramm</span>
                  <p className="text-xs text-blue-500/70">Energieflussbilanz als Sankey-Darstellung</p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-500/50 ml-auto" />
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title mb-3">System-Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Standort</span>
                <span className="text-dark-muted">{settings.latitude.toFixed(4)}° N, {settings.longitude.toFixed(4)}° E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Strompreis (Bezug)</span>
                <span className="text-dark-muted">{settings.gridConsumptionCtPerKwh} ct/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Einspeisevergütung</span>
                <span className="text-dark-muted">{settings.gridFeedInCtPerKwh} ct/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Hausanschluss</span>
                <span className="text-dark-muted">{settings.gridMaxPowerKw} kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Konfiguration</span>
                <span className={configComplete ? 'text-emerald-400' : 'text-amber-400'}>
                  {configComplete ? 'Vollständig' : 'Unvollständig'}
                </span>
              </div>
            </div>
            <Link to="/settings" className="flex items-center gap-2 mt-4 text-sm text-emerald-400 hover:text-emerald-300">
              <Settings className="w-4 h-4" /> Anlage & Standort
            </Link>
          </div>
        </div>
      </div>

      {/* Beispieldaten & Reset */}
      <div className="mt-8 card border-dashed">
        <h2 className="section-title mb-3">Testdaten</h2>
        <p className="text-sm text-dark-faded mb-4">
          Lade vorkonfigurierte Beispieldaten für ein typisches Mehrfamilienhaus in Bayern
          (6 WE, PV 30 kWp, Gaskessel, Wärmepumpe, Batterie 20 kWh, 2 Wallboxen).
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { loadSeedData(createBavariaSeedData()) }}
            className="btn-primary flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Beispieldaten laden (MFH Bayern)
          </button>
          {(generators.length > 0 || consumers.length > 0) && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">Wirklich alles löschen?</span>
                <button onClick={() => { clearAll(); setConfirmClear(false) }} className="btn-danger">Ja, löschen</button>
                <button onClick={() => setConfirmClear(false)} className="btn-secondary text-sm">Abbrechen</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Alle Daten löschen
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
