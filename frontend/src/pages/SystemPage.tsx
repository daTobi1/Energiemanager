import { useState, useEffect, useRef } from 'react'
import { InputField, Section } from '../components/ui/FormField'
import {
  Clock, Wifi, Bluetooth, Download, Power, RotateCcw,
  RefreshCw, AlertTriangle, WifiOff, Info, Monitor,
  Database, Server, CheckCircle2, XCircle, Radio,
  Play, Square, RotateCw,
  CalendarClock, Zap, BarChart3, Trash2,
} from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'
import { api } from '../api/client'
import { createBavariaSeedData } from '../data/seedBavaria'
import type { SchedulerStatus, SchedulerHistoryEntry, AlarmEvent } from '../types'

let Plotly: typeof import('plotly.js-dist-min') | null = null

function TestDataSection() {
  const { generators, consumers, loadSeedData, clearAll } = useEnergyStore()
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <Section title="Testdaten" icon={<Database className="w-4 h-4 text-blue-400" />} defaultOpen={false}>
      <p className="text-sm text-dark-faded mb-4">
        Lade vorkonfigurierte Beispieldaten für ein typisches Mehrfamilienhaus in Bayern
        (6 WE, PV 30 kWp, Gaskessel, Wärmepumpe, Batterie 20 kWh, 2 Wallboxen).
      </p>
      <div className="flex gap-3 flex-wrap">
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
    </Section>
  )
}

export default function SystemPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const apiConnected = useEnergyStore((s) => s.apiConnected)
  const syncing = useEnergyStore((s) => s.syncing)
  const syncFromApi = useEnergyStore((s) => s.syncFromApi)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmShutdown, setConfirmShutdown] = useState(false)

  // DAQ Status
  const [daqStatus, setDaqStatus] = useState<{
    running: boolean
    targets: number
    details: { source: string; entity_type: string; protocol: string; interval_seconds: number; data_points: string[]; errors: number }[]
  } | null>(null)
  const [daqLoading, setDaqLoading] = useState(false)

  const fetchDaqStatus = async () => {
    try {
      const status = await api.daq.status()
      setDaqStatus(status)
    } catch {
      setDaqStatus(null)
    }
  }

  useEffect(() => {
    if (apiConnected) fetchDaqStatus()
  }, [apiConnected])

  const handleDaqStart = async () => {
    setDaqLoading(true)
    try {
      await api.daq.start()
      await fetchDaqStatus()
    } catch (e) { console.warn(e) }
    setDaqLoading(false)
  }

  const handleDaqStop = async () => {
    setDaqLoading(true)
    try {
      await api.daq.stop()
      await fetchDaqStatus()
    } catch (e) { console.warn(e) }
    setDaqLoading(false)
  }

  const handleDaqReload = async () => {
    setDaqLoading(true)
    try {
      await api.daq.reload()
      await fetchDaqStatus()
    } catch (e) { console.warn(e) }
    setDaqLoading(false)
  }

  // Scheduler Status
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [schedulerInterval, setSchedulerInterval] = useState(900)
  const [schedulerHistory, setSchedulerHistory] = useState<SchedulerHistoryEntry[]>([])
  const durationChartRef = useRef<HTMLDivElement>(null)
  const kpiChartRef = useRef<HTMLDivElement>(null)
  const successChartRef = useRef<HTMLDivElement>(null)

  const fetchSchedulerStatus = async () => {
    try {
      const status = await api.scheduler.status()
      setSchedulerStatus(status)
    } catch {
      setSchedulerStatus(null)
    }
  }

  const fetchSchedulerHistory = async () => {
    try {
      const result = await api.scheduler.history(100)
      setSchedulerHistory(result.entries)
    } catch {
      setSchedulerHistory([])
    }
  }

  useEffect(() => {
    if (apiConnected) {
      fetchSchedulerStatus()
      fetchSchedulerHistory()
    }
  }, [apiConnected])

  // Auto-refresh history when scheduler is running
  useEffect(() => {
    if (!schedulerStatus?.running) return
    const iv = setInterval(fetchSchedulerHistory, 30_000)
    return () => clearInterval(iv)
  }, [schedulerStatus?.running])

  const handleSchedulerStart = async () => {
    setSchedulerLoading(true)
    try {
      await api.scheduler.start(schedulerInterval, true)
      await Promise.all([fetchSchedulerStatus(), fetchSchedulerHistory()])
    } catch (e) { console.warn(e) }
    setSchedulerLoading(false)
  }

  const handleSchedulerStop = async () => {
    setSchedulerLoading(true)
    try {
      await api.scheduler.stop()
      await fetchSchedulerStatus()
    } catch (e) { console.warn(e) }
    setSchedulerLoading(false)
  }

  const handleSchedulerTrigger = async () => {
    setSchedulerLoading(true)
    try {
      await api.scheduler.trigger()
      await Promise.all([fetchSchedulerStatus(), fetchSchedulerHistory()])
    } catch (e) { console.warn(e) }
    setSchedulerLoading(false)
  }

  // DeviceManager Status
  const [deviceStatus, setDeviceStatus] = useState<{
    running: boolean; device_count: number; connected_count: number;
    devices: { entity_id: string; name: string; preset_id: string | null; protocol: string; connected: boolean; modules: Record<string, number>; values: number; errors: number }[]
  } | null>(null)
  const [deviceLoading, setDeviceLoading] = useState(false)

  const fetchDeviceStatus = async () => {
    try {
      const status = await api.devices.status()
      setDeviceStatus(status)
    } catch { setDeviceStatus(null) }
  }

  useEffect(() => {
    if (apiConnected) fetchDeviceStatus()
  }, [apiConnected])

  const handleDeviceStart = async () => {
    setDeviceLoading(true)
    try { await api.devices.start(); await fetchDeviceStatus() } catch (e) { console.warn(e) }
    setDeviceLoading(false)
  }
  const handleDeviceStop = async () => {
    setDeviceLoading(true)
    try { await api.devices.stop(); await fetchDeviceStatus() } catch (e) { console.warn(e) }
    setDeviceLoading(false)
  }
  const handleDeviceReload = async () => {
    setDeviceLoading(true)
    try { await api.devices.reload(); await fetchDeviceStatus() } catch (e) { console.warn(e) }
    setDeviceLoading(false)
  }

  // Active Alarms (mini-Anzeige)
  const [activeAlarms, setActiveAlarms] = useState<AlarmEvent[]>([])
  useEffect(() => {
    if (!apiConnected) return
    const fetch = async () => { try { setActiveAlarms(await api.alarms.active()) } catch {} }
    fetch()
    const iv = setInterval(fetch, 15_000)
    return () => clearInterval(iv)
  }, [apiConnected])

  // ── Scheduler Charts ───────────────────────────────────────
  const darkLayout = {
    font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
    paper_bgcolor: '#0d1117',
    plot_bgcolor: '#161b22',
    hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
    legend: { orientation: 'h' as const, y: -0.2, x: 0.5, xanchor: 'center' as const, font: { size: 11, color: '#b1bac4' } },
  }
  const axisStyle = { gridcolor: '#21262d', linecolor: '#30363d', zeroline: false }

  // Chart 1: Optimierungs-Laufzeiten
  useEffect(() => {
    if (!durationChartRef.current || schedulerHistory.length === 0) return
    let cancelled = false
    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled) return

      const ts = schedulerHistory.map(e => e.timestamp)
      const durations = schedulerHistory.map(e => e.duration_ms)
      const colors = schedulerHistory.map(e => e.success ? '#8b5cf6' : '#ef4444')
      const hoverTexts = schedulerHistory.map(e =>
        e.success
          ? `${e.duration_ms.toFixed(0)}ms · ${e.strategy} (${e.solver})`
          : `FEHLER: ${e.error}`
      )

      const traces: any[] = [{
        type: 'bar',
        x: ts,
        y: durations,
        marker: { color: colors, line: { width: 0 } },
        text: hoverTexts,
        hoverinfo: 'text+x',
        name: 'Laufzeit',
        showlegend: false,
      }]

      Plotly!.newPlot(durationChartRef.current!, traces, {
        ...darkLayout,
        margin: { t: 8, l: 50, r: 12, b: 40 },
        height: 180,
        xaxis: { ...axisStyle, type: 'date', tickfont: { size: 10 } },
        yaxis: { ...axisStyle, title: { text: 'ms', font: { size: 11 } }, tickfont: { size: 10 } },
        bargap: 0.15,
      }, { responsive: true, displayModeBar: false })
    }
    render()
    return () => { cancelled = true; if (durationChartRef.current && Plotly) try { Plotly.purge(durationChartRef.current) } catch {} }
  }, [schedulerHistory])

  // Chart 2: KPIs pro Lauf (Kosten, CO2, Eigenverbrauch)
  useEffect(() => {
    if (!kpiChartRef.current || schedulerHistory.length === 0) return
    let cancelled = false
    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled) return

      const successful = schedulerHistory.filter(e => e.success)
      if (successful.length === 0) return
      const ts = successful.map(e => e.timestamp)

      const traces: any[] = [
        {
          type: 'scatter', mode: 'lines+markers', x: ts,
          y: successful.map(e => e.net_cost_ct / 100),
          name: 'Kosten (€)', line: { color: '#f97316', width: 2 },
          marker: { size: 4 }, yaxis: 'y',
        },
        {
          type: 'scatter', mode: 'lines+markers', x: ts,
          y: successful.map(e => e.total_co2_kg),
          name: 'CO₂ (kg)', line: { color: '#3b82f6', width: 2 },
          marker: { size: 4 }, yaxis: 'y',
        },
        {
          type: 'scatter', mode: 'lines+markers', x: ts,
          y: successful.map(e => e.avg_self_consumption_pct),
          name: 'Eigenverbrauch (%)', line: { color: '#22c55e', width: 2 },
          marker: { size: 4 }, yaxis: 'y2',
        },
      ]

      Plotly!.newPlot(kpiChartRef.current!, traces, {
        ...darkLayout,
        margin: { t: 8, l: 50, r: 50, b: 40 },
        height: 200,
        xaxis: { ...axisStyle, type: 'date', tickfont: { size: 10 } },
        yaxis: { ...axisStyle, title: { text: '€ / kg', font: { size: 11 } }, tickfont: { size: 10 } },
        yaxis2: { ...axisStyle, title: { text: '%', font: { size: 11 } }, overlaying: 'y', side: 'right', tickfont: { size: 10 }, range: [0, 100] },
        hovermode: 'x unified',
      }, { responsive: true, displayModeBar: false })
    }
    render()
    return () => { cancelled = true; if (kpiChartRef.current && Plotly) try { Plotly.purge(kpiChartRef.current) } catch {} }
  }, [schedulerHistory])

  // Chart 3: Erfolgsrate + kumulative Fehler
  useEffect(() => {
    if (!successChartRef.current || schedulerHistory.length === 0) return
    let cancelled = false
    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled) return

      const ts = schedulerHistory.map(e => e.timestamp)
      // Rolling success rate (last 10 runs)
      const windowSize = Math.min(10, schedulerHistory.length)
      const successRate = schedulerHistory.map((_, i) => {
        const start = Math.max(0, i - windowSize + 1)
        const window = schedulerHistory.slice(start, i + 1)
        return (window.filter(e => e.success).length / window.length) * 100
      })
      // Cumulative errors
      let cumErrors = 0
      const cumulativeErrors = schedulerHistory.map(e => { if (!e.success) cumErrors++; return cumErrors })

      const traces: any[] = [
        {
          type: 'scatter', mode: 'lines', x: ts, y: successRate,
          name: `Erfolgsrate (${windowSize}-Lauf)`, line: { color: '#22c55e', width: 2 },
          fill: 'tozeroy', fillcolor: 'rgba(34, 197, 94, 0.1)',
        },
        {
          type: 'scatter', mode: 'lines', x: ts, y: cumulativeErrors,
          name: 'Fehler (kumulativ)', line: { color: '#ef4444', width: 2, dash: 'dot' },
          yaxis: 'y2',
        },
      ]

      Plotly!.newPlot(successChartRef.current!, traces, {
        ...darkLayout,
        margin: { t: 8, l: 50, r: 50, b: 40 },
        height: 180,
        xaxis: { ...axisStyle, type: 'date', tickfont: { size: 10 } },
        yaxis: { ...axisStyle, title: { text: '%', font: { size: 11 } }, tickfont: { size: 10 }, range: [0, 105] },
        yaxis2: { ...axisStyle, title: { text: 'Fehler', font: { size: 11 } }, overlaying: 'y', side: 'right', tickfont: { size: 10 } },
        hovermode: 'x unified',
      }, { responsive: true, displayModeBar: false })
    }
    render()
    return () => { cancelled = true; if (successChartRef.current && Plotly) try { Plotly.purge(successChartRef.current) } catch {} }
  }, [schedulerHistory])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="page-header">System</h1>
        <p className="text-sm text-dark-faded mt-1">Raspberry Pi Systemverwaltung, Netzwerk und Updates</p>
      </div>

      <div className="space-y-4">
        <Section title="Backend-Verbindung" icon={<Server className="w-4 h-4 text-emerald-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">API-Status</p>
              <span className="flex items-center gap-2 text-sm">
                {syncing ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-400">Synchronisiere...</span>
                  </>
                ) : apiConnected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Verbunden</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-dark-faded" />
                    <span className="text-dark-faded">Nicht verbunden</span>
                  </>
                )}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Backend-URL</span>
                <span className="text-dark-text font-mono text-xs">{import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Datenspeicherung</span>
                <span className={apiConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {apiConnected ? 'PostgreSQL (Backend)' : 'localStorage (Browser)'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => syncFromApi()} className="btn-secondary flex items-center gap-2 text-sm" disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Verbindung prüfen
            </button>
            {!apiConnected && (
              <p className="text-xs text-dark-faded">Frontend arbeitet im Offline-Modus mit localStorage. Starte das Backend um Daten in PostgreSQL zu speichern.</p>
            )}
          </div>
        </Section>

        <Section title="Datenerfassung (DAQ)" icon={<Radio className="w-4 h-4 text-amber-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Status</p>
              <span className="flex items-center gap-2 text-sm">
                {daqStatus?.running ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                    <span className="text-emerald-400">Aktiv — {daqStatus.targets} Targets</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-dark-faded" />
                    <span className="text-dark-faded">Gestoppt</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-dark-faded">
              Pollt alle Entities mit aktivierter Kommunikation (Modbus TCP, MQTT, HTTP REST)
              und schreibt Messwerte in die Datenbank. Konfiguration erfolgt pro Entity unter
              Erzeuger / Zähler / Speicher → Kommunikation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {daqStatus?.running ? (
              <>
                <button onClick={handleDaqStop} disabled={daqLoading || !apiConnected} className="btn-secondary flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
                  <Square className="w-4 h-4" /> Stoppen
                </button>
                <button onClick={handleDaqReload} disabled={daqLoading || !apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
                  <RotateCw className="w-4 h-4" /> Config neu laden
                </button>
              </>
            ) : (
              <button onClick={handleDaqStart} disabled={daqLoading || !apiConnected} className="btn-primary flex items-center gap-2 text-sm">
                <Play className="w-4 h-4" /> Starten
              </button>
            )}
            <button onClick={fetchDaqStatus} disabled={!apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Status
            </button>
          </div>

          {/* Target-Details */}
          {daqStatus?.details && daqStatus.details.length > 0 && (
            <div className="border border-dark-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-hover text-dark-faded text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Quelle</th>
                    <th className="px-3 py-2 text-left">Typ</th>
                    <th className="px-3 py-2 text-left">Protokoll</th>
                    <th className="px-3 py-2 text-right">Intervall</th>
                    <th className="px-3 py-2 text-left">Datenpunkte</th>
                    <th className="px-3 py-2 text-right">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {daqStatus.details.map((d) => (
                    <tr key={d.source} className="border-t border-dark-border">
                      <td className="px-3 py-2 font-mono text-xs">{d.source}</td>
                      <td className="px-3 py-2 text-dark-faded">{d.entity_type}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 bg-dark-hover rounded text-xs">{d.protocol}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{d.interval_seconds}s</td>
                      <td className="px-3 py-2 text-dark-faded text-xs">{d.data_points.join(', ')}</td>
                      <td className="px-3 py-2 text-right">
                        {d.errors > 0 ? (
                          <span className="text-red-400">{d.errors}</span>
                        ) : (
                          <span className="text-dark-faded">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(!daqStatus?.details || daqStatus.details.length === 0) && !daqStatus?.running && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  Keine Entities mit aktivierter Kommunikation gefunden. Aktiviere die Kommunikation
                  bei mindestens einem Erzeuger, Zähler oder Speicher (Kommunikation → Aktiviert = An,
                  IP-Adresse und Port setzen).
                </p>
              </div>
            </div>
          )}
        </Section>

        <Section title="Scheduler (Automatische Optimierung)" icon={<CalendarClock className="w-4 h-4 text-violet-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Autonomer Betrieb</p>
              <span className="flex items-center gap-2 text-sm">
                {schedulerStatus?.running ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shadow-sm shadow-violet-400/50" />
                    <span className="text-violet-400">Aktiv</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-dark-faded" />
                    <span className="text-dark-faded">Gestoppt</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-dark-faded mb-3">
              Erstellt periodisch neue Fahrpläne (Optimierer → Controller → DeviceManager)
              und trainiert ML-Modelle automatisch nach.
            </p>

            {schedulerStatus && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-faded">Controller-Modus</span>
                  <span className={schedulerStatus.controller_mode === 'auto' ? 'text-emerald-400' : schedulerStatus.controller_mode === 'manual' ? 'text-amber-400' : 'text-dark-faded'}>
                    {schedulerStatus.controller_mode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-faded">Optimierungs-Intervall</span>
                  <span className="text-dark-text">{Math.round(schedulerStatus.intervals.optimization_s / 60)} min</span>
                </div>
                {schedulerStatus.stats.last_optimization_at && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-dark-faded">Letzte Optimierung</span>
                      <span className="text-dark-text text-xs font-mono">
                        {new Date(schedulerStatus.stats.last_optimization_at).toLocaleTimeString('de-DE')}
                        {' '}({schedulerStatus.stats.last_optimization_duration_ms.toFixed(0)}ms)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-faded">Fahrplan</span>
                      <span className="text-dark-text text-xs">
                        {schedulerStatus.stats.last_schedule_hours}h — {schedulerStatus.stats.last_schedule_strategy}
                        <span className="text-dark-faded ml-1">({schedulerStatus.stats.last_schedule_solver})</span>
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-dark-faded">Statistik</span>
                  <span className="text-dark-text text-xs">
                    {schedulerStatus.stats.optimization_runs} Läufe
                    {schedulerStatus.stats.optimization_errors > 0 && (
                      <span className="text-red-400 ml-1">({schedulerStatus.stats.optimization_errors} Fehler)</span>
                    )}
                    {schedulerStatus.stats.device_syncs > 0 && (
                      <span className="text-dark-faded ml-1">· {schedulerStatus.stats.device_syncs} Device-Syncs</span>
                    )}
                  </span>
                </div>
                {schedulerStatus.stats.last_error && (
                  <div className="p-2 bg-red-500/10 rounded border border-red-500/20 text-xs text-red-400">
                    {schedulerStatus.stats.last_error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {schedulerStatus?.running ? (
              <>
                <button onClick={handleSchedulerStop} disabled={schedulerLoading || !apiConnected} className="btn-secondary flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
                  <Square className="w-4 h-4" /> Stoppen
                </button>
                <button onClick={handleSchedulerTrigger} disabled={schedulerLoading || !apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4" /> Jetzt optimieren
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleSchedulerStart} disabled={schedulerLoading || !apiConnected} className="btn-primary flex items-center gap-2 text-sm">
                  <Play className="w-4 h-4" /> {schedulerLoading ? 'Starte...' : 'Starten'}
                </button>
                <select
                  value={schedulerInterval}
                  onChange={(e) => setSchedulerInterval(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-text text-sm focus:border-violet-500/50 focus:outline-none"
                >
                  <option value={60}>1 min</option>
                  <option value={300}>5 min</option>
                  <option value={900}>15 min</option>
                  <option value={1800}>30 min</option>
                  <option value={3600}>60 min</option>
                </select>
              </div>
            )}
            <button onClick={fetchSchedulerStatus} disabled={!apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Status
            </button>
          </div>

          {!schedulerStatus?.running && (
            <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-300">
                  Der Scheduler startet den Controller im Auto-Modus: Prognosen werden erstellt,
                  der MILP-Optimierer berechnet den optimalen Fahrplan und die Stellgrößen werden
                  automatisch an Simulator bzw. verbundene Geräte gesendet.
                </p>
              </div>
            </div>
          )}

          {/* Scheduler Charts */}
          {schedulerHistory.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mt-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-dark-faded uppercase tracking-wider">Optimierungs-Historie ({schedulerHistory.length} Läufe)</span>
              </div>

              {/* Chart 1: Laufzeiten */}
              <div className="bg-dark-hover rounded-lg border border-dark-border overflow-hidden">
                <div className="px-3 py-2 border-b border-dark-border">
                  <span className="text-xs text-dark-muted">Optimierungs-Laufzeiten</span>
                  <span className="text-xs text-dark-faded ml-2">— Violett = Erfolg, Rot = Fehler</span>
                </div>
                <div ref={durationChartRef} />
              </div>

              {/* Chart 2: KPIs */}
              <div className="bg-dark-hover rounded-lg border border-dark-border overflow-hidden">
                <div className="px-3 py-2 border-b border-dark-border">
                  <span className="text-xs text-dark-muted">Fahrplan-KPIs pro Optimierung</span>
                  <span className="text-xs text-dark-faded ml-2">— Kosten, CO₂, Eigenverbrauch</span>
                </div>
                <div ref={kpiChartRef} />
              </div>

              {/* Chart 3: Erfolgsrate */}
              <div className="bg-dark-hover rounded-lg border border-dark-border overflow-hidden">
                <div className="px-3 py-2 border-b border-dark-border">
                  <span className="text-xs text-dark-muted">Scheduler-Performance</span>
                  <span className="text-xs text-dark-faded ml-2">— Erfolgsrate + kumulative Fehler</span>
                </div>
                <div ref={successChartRef} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Zeit & Datum" icon={<Clock className="w-4 h-4 text-cyan-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-faded uppercase tracking-wider mb-1">Aktuelle Systemzeit</p>
                <p className="text-2xl font-bold font-mono text-dark-text">
                  {currentTime.toLocaleTimeString('de-DE')}
                </p>
                <p className="text-sm text-dark-muted">
                  {currentTime.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <Clock className="w-10 h-10 text-dark-border" />
            </div>
          </div>
          <InputField label="NTP-Server" value="pool.ntp.org" onChange={() => {}} placeholder="pool.ntp.org" info="Network Time Protocol Server für automatische Zeitsynchronisation. Standard: pool.ntp.org" disabled />
          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300">Die Systemzeit wird automatisch über NTP synchronisiert. Manuelle Zeiteinstellung ist nur bei fehlender Internetverbindung erforderlich und über die Backend-API möglich.</p>
            </div>
          </div>
        </Section>

        <Section title="WLAN" icon={<Wifi className="w-4 h-4 text-blue-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Verbindungsstatus</p>
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span className="text-emerald-400">Verbunden</span>
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Netzwerk (SSID)</span>
                <span className="text-dark-text font-medium">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">IP-Adresse</span>
                <span className="text-dark-text font-mono">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Signalstärke</span>
                <span className="text-dark-text">—</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Netzwerke scannen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border text-center">
            <WifiOff className="w-8 h-8 text-dark-border mx-auto mb-2" />
            <p className="text-sm text-dark-faded">WLAN-Verwaltung verfügbar nach Backend-Anbindung</p>
            <p className="text-xs text-dark-border mt-1">API: GET /api/v1/system/wifi/scan, POST /api/v1/system/wifi/connect</p>
          </div>
        </Section>

        <Section title="Bluetooth" icon={<Bluetooth className="w-4 h-4 text-blue-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Bluetooth-Status</p>
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-dark-faded" />
                <span className="text-dark-faded">Nicht verfügbar</span>
              </span>
            </div>
            <p className="text-sm text-dark-faded">
              Bluetooth wird für die direkte Kommunikation mit kompatiblen Geräten verwendet (z.B. SMA Wechselrichter via Bluetooth, BLE-Sensoren).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Geräte suchen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300">Bluetooth-Gerätesuche und -Kopplung werden nach der Backend-Anbindung über die System-API verfügbar sein.</p>
            </div>
          </div>
        </Section>

        <Section title="Update & Rollback" icon={<Download className="w-4 h-4 text-amber-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Aktuelle Version</p>
              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded-full font-mono">v0.1.0</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Branch</span>
                <span className="text-dark-text font-mono">master</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Letztes Update</span>
                <span className="text-dark-text">—</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Auf Updates prüfen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>

          <div className="border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-dark-hover">
              <h4 className="text-sm font-semibold text-dark-muted flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Rollback
              </h4>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-dark-faded">
                Bei Problemen nach einem Update kann auf eine vorherige Version zurückgesetzt werden. Alle Konfigurationsdaten bleiben erhalten.
              </p>
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300">Rollback setzt die Software auf eine frühere Version zurück. Datenbank-Migrationen werden dabei nicht rückgängig gemacht. Erstelle vor einem Update immer ein Backup.</p>
                </div>
              </div>
              <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
                <RotateCcw className="w-4 h-4" /> Versionshistorie laden
              </button>
            </div>
          </div>
        </Section>

        {/* DeviceManager */}
        <Section title="Geraeteverwaltung (DeviceManager)" icon={<Radio className="w-4 h-4 text-cyan-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${deviceStatus?.running ? 'bg-emerald-400 animate-pulse' : 'bg-dark-faded'}`} />
                <span className="text-sm text-dark-text">
                  {deviceStatus?.running ? `Aktiv — ${deviceStatus.connected_count}/${deviceStatus.device_count} verbunden` : 'Gestoppt'}
                </span>
              </div>
              <div className="flex gap-2">
                {deviceStatus?.running ? (
                  <>
                    <button onClick={handleDeviceReload} disabled={deviceLoading} className="btn-secondary flex items-center gap-1 text-xs"><RefreshCw className="w-3 h-3" /> Reload</button>
                    <button onClick={handleDeviceStop} disabled={deviceLoading} className="btn-secondary flex items-center gap-1 text-xs text-red-400"><Square className="w-3 h-3" /> Stop</button>
                  </>
                ) : (
                  <button onClick={handleDeviceStart} disabled={deviceLoading || !apiConnected} className="btn-primary flex items-center gap-1 text-xs"><Play className="w-3 h-3" /> Start</button>
                )}
                <button onClick={fetchDeviceStatus} disabled={!apiConnected} className="btn-secondary flex items-center gap-1 text-xs"><RotateCw className="w-3 h-3" /></button>
              </div>
            </div>

            {deviceStatus && deviceStatus.devices.length > 0 ? (
              <div className="space-y-2">
                {deviceStatus.devices.map(d => (
                  <div key={d.entity_id} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg border border-dark-border">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${d.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div>
                        <span className="text-sm text-dark-text font-medium">{d.name}</span>
                        {d.preset_id && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{d.preset_id}</span>
                        )}
                        <div className="text-xs text-dark-faded mt-0.5">
                          {d.protocol} · {d.values} Werte
                          {Object.keys(d.modules).length > 0 && (
                            <span> · Module: {Object.entries(d.modules).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(', ')}</span>
                          )}
                          {d.errors > 0 && <span className="text-red-400"> · {d.errors} Fehler</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs ${d.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                      {d.connected ? 'Verbunden' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-dark-faded">
                {deviceStatus?.running ? 'Keine Geraete mit aktivierter Kommunikation gefunden.' : 'DeviceManager starten um Geraete zu verbinden.'}
              </p>
            )}
          </div>

          <div className="p-3 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-dark-faded mt-0.5 shrink-0" />
              <p className="text-xs text-dark-faded">
                Der DeviceManager verbindet sich automatisch mit allen Geraeten die ein Geraeteprofil (Preset) und eine aktivierte Kommunikation haben. Presets definieren Register-Maps, Schreibzugriffe und Setpoint-Routing.
              </p>
            </div>
          </div>
        </Section>

        {/* Aktive Alarme (Mini-Uebersicht) */}
        {activeAlarms.length > 0 && (
          <Section title={`Aktive Alarme (${activeAlarms.length})`} icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} defaultOpen={true}>
            <div className="space-y-2">
              {activeAlarms.slice(0, 5).map(a => (
                <div key={a.id} className={`p-3 rounded-lg border ${
                  a.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' : a.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`} />
                    <span className="text-sm text-dark-text">{a.message}</span>
                  </div>
                  <p className="text-xs text-dark-faded mt-1">{new Date(a.timestamp).toLocaleString('de-DE')}</p>
                </div>
              ))}
              {activeAlarms.length > 5 && <p className="text-xs text-dark-faded text-center">+{activeAlarms.length - 5} weitere Alarme</p>}
            </div>
          </Section>
        )}

        <TestDataSection />

        <Section title="System-Steuerung" icon={<Power className="w-4 h-4 text-red-400" />} defaultOpen={false}>
          <p className="text-sm text-dark-faded mb-4">Raspberry Pi Systemfunktionen. Diese Aktionen erfordern eine aktive Backend-Verbindung.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-text">Pi neustarten</h4>
                  <p className="text-xs text-dark-faded">System wird neu gestartet (~30s)</p>
                </div>
              </div>
              {confirmRestart ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400">Wirklich neustarten? Laufende Prozesse werden beendet.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmRestart(false)}
                      className="btn-secondary text-sm flex-1"
                      disabled
                    >
                      Neustart bestätigen
                    </button>
                    <button onClick={() => setConfirmRestart(false)} className="btn-secondary text-sm">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRestart(true)}
                  className="btn-secondary flex items-center gap-2 text-sm w-full justify-center"
                  disabled
                >
                  <RefreshCw className="w-4 h-4" /> Neustart
                </button>
              )}
            </div>

            <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
              <div className="flex items-center gap-3 mb-3">
                <Power className="w-5 h-5 text-red-400" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-text">Pi herunterfahren</h4>
                  <p className="text-xs text-dark-faded">System wird sicher heruntergefahren</p>
                </div>
              </div>
              {confirmShutdown ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">Wirklich herunterfahren? Das System ist danach nicht mehr erreichbar!</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmShutdown(false)}
                      className="text-sm flex-1 px-3 py-1.5 rounded-lg font-medium text-red-100 transition-colors"
                      style={{ background: '#7b1a18' }}
                      disabled
                    >
                      Herunterfahren bestätigen
                    </button>
                    <button onClick={() => setConfirmShutdown(false)} className="btn-secondary text-sm">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmShutdown(true)}
                  className="btn-secondary flex items-center gap-2 text-sm w-full justify-center text-red-400 hover:text-red-300"
                  disabled
                >
                  <Power className="w-4 h-4" /> Herunterfahren
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-dark-faded mt-0.5 shrink-0" />
              <p className="text-xs text-dark-faded">Systemsteuerung ist nach der Backend-Anbindung verfügbar. API-Endpoints: POST /api/v1/system/reboot, POST /api/v1/system/shutdown</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
