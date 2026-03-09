import { useEnergyStore } from '../store/useEnergyStore'
import { Link } from 'react-router-dom'
import {
  Sun, Gauge, Plug, Battery, GitBranch, Settings,
  CheckCircle2, AlertCircle, ArrowRight,
} from 'lucide-react'
import type { GeneratorType } from '../types'

const typeLabels: Record<GeneratorType, string> = {
  pv: 'PV', chp: 'BHKW', heat_pump: 'WP', boiler: 'Kessel', chiller: 'Kälte',
}

export default function DashboardPage() {
  const { generators, meters, consumers, storages, settings } = useEnergyStore()

  const configComplete = generators.length > 0 && meters.length > 0 && consumers.length > 0
  const hasMainMeter = meters.some((m) => m.category === 'main')

  const sections = [
    {
      title: 'Erzeuger', icon: Sun, count: generators.length, to: '/generators',
      color: 'text-amber-600 bg-amber-50',
      detail: generators.length > 0
        ? generators.map((g) => `${g.name || typeLabels[g.type]}`).join(', ')
        : 'Noch keine Erzeuger konfiguriert',
    },
    {
      title: 'Zähler', icon: Gauge, count: meters.length, to: '/meters',
      color: 'text-yellow-600 bg-yellow-50',
      detail: meters.length > 0
        ? `${meters.filter((m) => m.category === 'main').length} Haupt, ${meters.filter((m) => m.category === 'sub').length} Unter`
        : 'Noch keine Zähler konfiguriert',
    },
    {
      title: 'Verbraucher', icon: Plug, count: consumers.length, to: '/consumers',
      color: 'text-green-600 bg-green-50',
      detail: consumers.length > 0
        ? `${consumers.reduce((s, c) => s + c.annualConsumptionKwh, 0).toLocaleString()} kWh/a gesamt`
        : 'Noch keine Verbraucher konfiguriert',
    },
    {
      title: 'Speicher', icon: Battery, count: storages.length, to: '/storage',
      color: 'text-purple-600 bg-purple-50',
      detail: storages.length > 0
        ? storages.map((s) => s.name || s.type).join(', ')
        : 'Noch keine Speicher konfiguriert',
    },
  ]

  const checklistItems = [
    { label: 'Gebäudedaten eingeben', done: !!settings.buildingName, to: '/settings' },
    { label: 'Standort konfigurieren', done: settings.latitude !== 51.1657 || settings.longitude !== 10.4515, to: '/settings' },
    { label: 'Hauptzähler anlegen', done: hasMainMeter, to: '/meters' },
    { label: 'Mindestens einen Erzeuger anlegen', done: generators.length > 0, to: '/generators' },
    { label: 'Mindestens einen Verbraucher anlegen', done: consumers.length > 0, to: '/consumers' },
    { label: 'Stromtarif konfigurieren', done: settings.gridConsumptionCtPerKwh > 0, to: '/settings' },
    { label: 'Wetter-API einrichten', done: !!settings.weatherApiKey || settings.weatherProvider === 'brightsky', to: '/settings' },
    { label: 'Kommunikation der Geräte konfigurieren', done: generators.some((g) => g.communication.ipAddress), to: '/generators' },
  ]

  const completedCount = checklistItems.filter((i) => i.done).length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-header">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {settings.buildingName || 'EnergyManager'} — Anlagenkonfiguration
        </p>
      </div>

      {/* Übersichtskarten */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {sections.map(({ title, icon: Icon, count, to, color, detail }) => (
          <Link key={to} to={to} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{count}</span>
            </div>
            <h3 className="font-semibold text-gray-700">{title}</h3>
            <p className="text-xs text-gray-400 mt-1 truncate">{detail}</p>
            <div className="flex items-center gap-1 mt-3 text-xs text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <span className="text-sm text-gray-500">{completedCount}/{checklistItems.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
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
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-300 shrink-0" />
                )}
                <span className={`text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
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
                className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <GitBranch className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="text-sm font-medium text-emerald-700">Energiefluss-Diagramm</span>
                  <p className="text-xs text-emerald-500">Interaktive Darstellung aller Energieflüsse</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400 ml-auto" />
              </Link>
              <Link
                to="/sankey"
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h4v16H4zM16 4h4v16h-4zM8 6l8 4M8 12l8 0M8 18l8-4" />
                </svg>
                <div>
                  <span className="text-sm font-medium text-blue-700">Sankey-Diagramm</span>
                  <p className="text-xs text-blue-500">Energieflussbilanz als Sankey-Darstellung</p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 ml-auto" />
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title mb-3">System-Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Standort</span>
                <span className="text-gray-700">{settings.latitude.toFixed(4)}° N, {settings.longitude.toFixed(4)}° E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Strompreis (Bezug)</span>
                <span className="text-gray-700">{settings.gridConsumptionCtPerKwh} ct/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Einspeisevergütung</span>
                <span className="text-gray-700">{settings.gridFeedInCtPerKwh} ct/kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Netzanschluss</span>
                <span className="text-gray-700">{settings.gridMaxPowerKw} kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Konfiguration</span>
                <span className={configComplete ? 'text-emerald-600' : 'text-amber-600'}>
                  {configComplete ? 'Vollständig' : 'Unvollständig'}
                </span>
              </div>
            </div>
            <Link to="/settings" className="flex items-center gap-2 mt-4 text-sm text-emerald-600 hover:text-emerald-700">
              <Settings className="w-4 h-4" /> Einstellungen anpassen
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
