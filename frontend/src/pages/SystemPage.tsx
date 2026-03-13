import { useState, useEffect } from 'react'
import { InputField, Section } from '../components/ui/FormField'
import {
  Clock, Wifi, Bluetooth, Download, Power, RotateCcw,
  RefreshCw, AlertTriangle, WifiOff, Info, Monitor,
  Database, Server, CheckCircle2, XCircle, Radio,
  Play, Square, RotateCw, Thermometer, Unplug, Plug,
  CalendarClock, Zap,
} from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'
import { api } from '../api/client'
import type { LambdaHPStatus, SchedulerStatus } from '../types'

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

  const fetchSchedulerStatus = async () => {
    try {
      const status = await api.scheduler.status()
      setSchedulerStatus(status)
    } catch {
      setSchedulerStatus(null)
    }
  }

  useEffect(() => {
    if (apiConnected) fetchSchedulerStatus()
  }, [apiConnected])

  const handleSchedulerStart = async () => {
    setSchedulerLoading(true)
    try {
      await api.scheduler.start(schedulerInterval, true)
      await fetchSchedulerStatus()
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
      await fetchSchedulerStatus()
    } catch (e) { console.warn(e) }
    setSchedulerLoading(false)
  }

  // Lambda HP Status
  const [lambdaStatus, setLambdaStatus] = useState<LambdaHPStatus | null>(null)
  const [lambdaHost, setLambdaHost] = useState('')
  const [lambdaPort, setLambdaPort] = useState(502)
  const [lambdaLoading, setLambdaLoading] = useState(false)
  const [lambdaValues, setLambdaValues] = useState<Record<string, number> | null>(null)

  const fetchLambdaStatus = async () => {
    try {
      const status = await api.lambdaHp.status()
      setLambdaStatus(status)
    } catch {
      setLambdaStatus(null)
    }
  }

  useEffect(() => {
    if (apiConnected) fetchLambdaStatus()
  }, [apiConnected])

  const handleLambdaConnect = async () => {
    if (!lambdaHost) return
    setLambdaLoading(true)
    try {
      const result = await api.lambdaHp.connect(lambdaHost, lambdaPort)
      if (result.success) {
        await fetchLambdaStatus()
      }
    } catch (e) { console.warn(e) }
    setLambdaLoading(false)
  }

  const handleLambdaDisconnect = async () => {
    setLambdaLoading(true)
    try {
      await api.lambdaHp.disconnect()
      setLambdaStatus(null)
      setLambdaValues(null)
    } catch (e) { console.warn(e) }
    setLambdaLoading(false)
  }

  const handleLambdaReadValues = async () => {
    try {
      const result = await api.lambdaHp.values()
      setLambdaValues(result.values)
    } catch (e) { console.warn(e) }
  }

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
              Erstellt periodisch neue Fahrpläne (Optimierer → Controller → Lambda Bridge)
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
                    {schedulerStatus.stats.lambda_syncs > 0 && (
                      <span className="text-dark-faded ml-1">· {schedulerStatus.stats.lambda_syncs} Lambda-Syncs</span>
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
                  automatisch an Simulator bzw. Lambda-Wärmepumpe gesendet.
                </p>
              </div>
            </div>
          )}
        </Section>

        <Section title="Lambda Wärmepumpe" icon={<Thermometer className="w-4 h-4 text-orange-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Modbus TCP Verbindung</p>
              <span className="flex items-center gap-2 text-sm">
                {lambdaStatus?.connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                    <span className="text-emerald-400">Verbunden</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-dark-faded" />
                    <span className="text-dark-faded">Getrennt</span>
                  </>
                )}
              </span>
            </div>

            {lambdaStatus?.connected ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-faded">Adresse</span>
                  <span className="text-dark-text font-mono text-xs">{lambdaStatus.host}:{lambdaStatus.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-faded">Betriebszustand</span>
                  <span className="text-dark-text">{lambdaStatus.operating_state || '—'}</span>
                </div>
                {lambdaStatus.error !== null && lambdaStatus.error !== undefined && lambdaStatus.error !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-dark-faded">Fehler</span>
                    <span className="text-red-400">#{lambdaStatus.error}</span>
                  </div>
                )}
                {lambdaStatus.modules && (
                  <div className="flex justify-between">
                    <span className="text-dark-faded">Module</span>
                    <span className="text-dark-text text-xs">
                      {lambdaStatus.modules.heat_pumps} WP, {lambdaStatus.modules.boilers} Boiler, {lambdaStatus.modules.buffers} Puffer, {lambdaStatus.modules.heating_circuits} HK
                      {lambdaStatus.modules.solar_modules > 0 && `, ${lambdaStatus.modules.solar_modules} Solar`}
                    </span>
                  </div>
                )}
                {lambdaStatus.auto_pv_surplus && (
                  <div className="flex justify-between">
                    <span className="text-dark-faded">PV-Überschuss</span>
                    <span className="text-emerald-400">{lambdaStatus.current_pv_surplus_w} W (Auto)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-dark-faded">
                  Lambda Eureka EU-L Wärmepumpen (EU08L–EU20L) über Modbus TCP.
                  IP-Adresse des WP-Displays eingeben.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={lambdaHost}
                    onChange={(e) => setLambdaHost(e.target.value)}
                    placeholder="192.168.1.50"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-text text-sm font-mono placeholder:text-dark-border focus:border-orange-500/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={lambdaPort}
                    onChange={(e) => setLambdaPort(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-text text-sm font-mono focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lambdaStatus?.connected ? (
              <>
                <button onClick={handleLambdaDisconnect} disabled={lambdaLoading || !apiConnected} className="btn-secondary flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
                  <Unplug className="w-4 h-4" /> Trennen
                </button>
                <button onClick={handleLambdaReadValues} disabled={!apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" /> Werte lesen
                </button>
                <button onClick={fetchLambdaStatus} disabled={!apiConnected} className="btn-secondary flex items-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" /> Status
                </button>
              </>
            ) : (
              <button onClick={handleLambdaConnect} disabled={lambdaLoading || !apiConnected || !lambdaHost} className="btn-primary flex items-center gap-2 text-sm">
                <Plug className="w-4 h-4" /> {lambdaLoading ? 'Verbinde...' : 'Verbinden'}
              </button>
            )}
          </div>

          {/* Aktuelle Werte */}
          {lambdaValues && Object.keys(lambdaValues).length > 0 && (
            <div className="border border-dark-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-hover text-dark-faded text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Datenpunkt</th>
                    <th className="px-3 py-2 text-right">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(lambdaValues)
                    .filter(([, v]) => typeof v === 'number')
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <tr key={key} className="border-t border-dark-border">
                        <td className="px-3 py-1.5 font-mono text-xs text-dark-muted">{key}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">{typeof value === 'number' ? value.toFixed(2) : String(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
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
