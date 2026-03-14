import { useState, useEffect, useCallback } from 'react'
import {
  Car, RefreshCw, Play, Pause, Square, Zap, Clock, Sun, Info,
  ChevronDown, Battery, Leaf, Euro, BatteryCharging, Gauge,
  Plus, Pencil, Trash2, X,
} from 'lucide-react'
import { api } from '../api/client'
import type {
  ChargingStatus, WallboxWithSession, ChargingSessionInfo,
  ChargingMode, ChargingStatistics, VehicleInfo, Vehicle,
} from '../types'

const modeConfig: Record<ChargingMode, { label: string; desc: string; icon: typeof Zap; color: string }> = {
  max_speed: { label: 'Sofort', desc: 'Max. Leistung', icon: Zap, color: 'text-amber-400' },
  pv_surplus: { label: 'PV', desc: 'Nur Solarstrom', icon: Sun, color: 'text-emerald-400' },
  min_pv: { label: 'Min+PV', desc: 'Minimum + Solar', icon: BatteryCharging, color: 'text-blue-400' },
  target_charge: { label: 'Ziel', desc: 'Ziel + PV-Optimierung', icon: Clock, color: 'text-purple-400' },
}

const statusDot: Record<string, string> = {
  charging: 'bg-emerald-400',
  paused: 'bg-amber-400',
  pending: 'bg-blue-400',
  completed: 'bg-dark-faded',
  cancelled: 'bg-red-400',
}

const statusLabel: Record<string, string> = {
  charging: 'Lädt',
  paused: 'Pausiert',
  pending: 'Wartend',
  completed: 'Fertig',
  cancelled: 'Abgebr.',
}

function fmtDuration(startedAt: string | null, completedAt?: string | null): string {
  if (!startedAt) return '-'
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diff = end - new Date(startedAt).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function estimateRange(energyKwh: number, consumptionPer100km: number | null | undefined): string {
  if (!consumptionPer100km || consumptionPer100km <= 0) return ''
  const km = (energyKwh / consumptionPer100km) * 100
  return `~${Math.round(km)} km`
}

// ----- Donut Chart (Solar%) -----
function SolarDonut({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" className="text-dark-hover" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" className="text-emerald-500"
        strokeWidth={6} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="fill-dark-text text-xs font-bold">{Math.round(pct)}%</text>
    </svg>
  )
}

// ----- SoC Bar -----
function SocBar({ soc, limit, battery }: { soc: number | null; limit: number | null; battery: number | null }) {
  if (soc == null) return null
  const color = soc > 80 ? 'bg-emerald-500' : soc > 30 ? 'bg-blue-500' : 'bg-amber-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-dark-faded flex items-center gap-1">
          <Battery className="w-3.5 h-3.5" /> SoC
        </span>
        <span className="text-dark-text font-medium">
          {soc.toFixed(0)}%{battery ? ` (${battery} kWh)` : ''}
        </span>
      </div>
      <div className="relative h-2.5 bg-dark-hover rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, soc)}%` }} />
        {limit && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-400" style={{ left: `${limit}%` }}
            title={`Limit: ${limit}%`} />
        )}
      </div>
    </div>
  )
}

// ----- Statistik-Karten -----
function StatsCards({ stats }: { stats: ChargingStatistics }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3">
        <SolarDonut pct={stats.avg_solar_pct} />
        <div>
          <p className="text-xs text-dark-faded">Solaranteil</p>
          <p className="text-dark-text font-bold">{stats.avg_solar_pct.toFixed(0)}%</p>
          <p className="text-xs text-dark-faded">{stats.total_solar_kwh.toFixed(0)} kWh Solar</p>
        </div>
      </div>
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-dark-faded">Gesamt geladen</span>
        </div>
        <p className="text-xl font-bold text-dark-text">{stats.total_energy_kwh.toFixed(0)} kWh</p>
        <p className="text-xs text-dark-faded">{stats.total_sessions} Sessions</p>
      </div>
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Euro className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-dark-faded">Kosten</span>
        </div>
        <p className="text-xl font-bold text-dark-text">{(stats.total_cost_ct / 100).toFixed(2)} EUR</p>
        <p className="text-xs text-dark-faded">{stats.avg_cost_ct_per_kwh.toFixed(1)} ct/kWh</p>
      </div>
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-dark-faded">Ersparnis (Solar)</span>
        </div>
        <p className="text-xl font-bold text-emerald-400">
          {(stats.total_solar_kwh * 0.30 / 100).toFixed(2)} EUR
        </p>
        <p className="text-xs text-dark-faded">{stats.total_solar_kwh.toFixed(0)} kWh kostenlos</p>
      </div>
    </div>
  )
}

// ==================== Main Page ====================
export default function ChargingPage() {
  const [status, setStatus] = useState<ChargingStatus | null>(null)
  const [history, setHistory] = useState<ChargingSessionInfo[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showVehicleDialog, setShowVehicleDialog] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [s, h, v] = await Promise.all([
        api.charging.status(),
        api.charging.sessions(false),
        api.charging.vehicles(),
      ])
      setStatus(s)
      setHistory(h.filter(sess => sess.status === 'completed' || sess.status === 'cancelled'))
      setVehicles(v)
    } catch {
      // API not available
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5000)
    return () => clearInterval(iv)
  }, [loadData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.charging.syncWallboxes()
      await loadData()
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  const solarTodayPct = status && status.total_energy_today_kwh > 0
    ? (status.total_solar_today_kwh / status.total_energy_today_kwh) * 100 : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Lademanagement</h1>
            <p className="text-sm text-dark-faded">Wallboxen, Ladesessions & Optimierung</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status && status.active_sessions_count > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-bold">
                {status.total_charging_power_kw.toFixed(1)} kW
              </span>
              <span className="text-dark-faded text-xs">
                {status.active_sessions_count} aktiv
              </span>
            </div>
          )}
          {status && status.total_energy_today_kwh > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-dark-text text-sm font-medium">
                {status.total_energy_today_kwh.toFixed(1)} kWh
              </span>
              {solarTodayPct > 0 && (
                <span className="text-emerald-400 text-xs flex items-center gap-0.5">
                  <Leaf className="w-3 h-3" />{solarTodayPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowVehicleDialog(true)}
            className="flex items-center gap-2 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text hover:bg-dark-hover transition-colors"
          >
            <Car className="w-4 h-4" />
            Fahrzeuge
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text hover:bg-dark-hover transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>

      {/* 30-Tage Statistiken */}
      {status?.statistics_30d && <StatsCards stats={status.statistics_30d} />}

      {/* Wallbox Cards */}
      {!status || status.wallboxes.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center">
          <Car className="w-12 h-12 text-dark-faded mx-auto mb-3" />
          <p className="text-dark-faded mb-2">Keine Wallboxen konfiguriert</p>
          <p className="text-dark-faded text-sm">
            Erstelle einen Verbraucher vom Typ "Wallbox" und klicke "Sync".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {status.wallboxes.map(item => (
            <WallboxCard key={item.wallbox.id} item={item} vehicles={vehicles} onRefresh={loadData} />
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-dark-hover transition-colors"
          >
            <span className="text-dark-text font-medium">Lade-Historie ({history.length})</span>
            <ChevronDown className={`w-5 h-5 text-dark-faded transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          {historyOpen && (
            <div className="border-t border-dark-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border text-dark-faded">
                    <th className="text-left p-3 font-medium">Wallbox</th>
                    <th className="text-left p-3 font-medium">Modus</th>
                    <th className="text-right p-3 font-medium">Energie</th>
                    <th className="text-right p-3 font-medium">Solar</th>
                    <th className="text-right p-3 font-medium">Kosten</th>
                    <th className="text-left p-3 font-medium">Dauer</th>
                    <th className="text-left p-3 font-medium">Zeitraum</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 30).map(sess => {
                    const wb = status?.wallboxes.find(w => w.wallbox.id === sess.wallbox_id)
                    const mc = modeConfig[sess.mode]
                    return (
                      <tr key={sess.id} className="border-b border-dark-border/50 hover:bg-dark-hover/50">
                        <td className="p-3 text-dark-text">{wb?.wallbox.name || `WB #${sess.wallbox_id}`}</td>
                        <td className="p-3">
                          <span className={`text-xs font-medium ${mc?.color || 'text-dark-faded'}`}>
                            {mc?.label || sess.mode}
                          </span>
                        </td>
                        <td className="p-3 text-right text-dark-text font-medium">
                          {sess.energy_charged_kwh.toFixed(1)} kWh
                        </td>
                        <td className="p-3 text-right">
                          {sess.solar_pct > 0 ? (
                            <span className="text-emerald-400 font-medium">{sess.solar_pct.toFixed(0)}%</span>
                          ) : (
                            <span className="text-dark-faded">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-dark-faded">
                          {sess.cost_ct > 0 ? `${(sess.cost_ct / 100).toFixed(2)} EUR` : 'kostenlos'}
                        </td>
                        <td className="p-3 text-dark-faded">
                          {fmtDuration(sess.started_at, sess.completed_at)}
                        </td>
                        <td className="p-3 text-dark-faded text-xs">
                          {fmtTime(sess.started_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-3 text-sm">
            <h3 className="text-dark-text font-medium">Lademodi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.entries(modeConfig) as [ChargingMode, typeof modeConfig.max_speed][]).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                      <span className="text-dark-text font-medium">{cfg.label}</span>
                    </div>
                    <p className="text-dark-faded text-xs">
                      {key === 'max_speed' && 'Maximale Leistung, schnellstes Laden. Nutzt Netzstrom.'}
                      {key === 'pv_surplus' && 'Nur bei Solarstrom. Kostenlos laden, pausiert bei Wolken.'}
                      {key === 'min_pv' && 'Immer Mindestleistung + PV-Boost. Kein Start/Stop-Stress.'}
                      {key === 'target_charge' && 'Reichweite + Abfahrtszeit. MILP optimiert PV vs. Netz.'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Management Dialog */}
      {showVehicleDialog && (
        <VehicleDialog vehicles={vehicles} onClose={() => setShowVehicleDialog(false)} onRefresh={loadData} />
      )}
    </div>
  )
}

// ==================== Wallbox Card ====================
function WallboxCard({ item, vehicles, onRefresh }: { item: WallboxWithSession; vehicles: Vehicle[]; onRefresh: () => void }) {
  const { wallbox, active_session: sess, vehicle_info: vi, assigned_vehicle } = item
  const [mode, setMode] = useState<ChargingMode>('max_speed')
  const [targetKm, setTargetKm] = useState(100)
  const [targetTime, setTargetTime] = useState('')
  const [socLimit, setSocLimit] = useState(80)
  const [socLimitEnabled, setSocLimitEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const isCharging = sess?.status === 'charging'
  const isPaused = sess?.status === 'paused'
  const isPending = sess?.status === 'pending'
  const hasSession = !!sess

  const activeMode = (sess?.mode || mode) as ChargingMode
  const activeModeConf = modeConfig[activeMode] || modeConfig.max_speed
  const ModeIcon = activeModeConf.icon

  // Fortschritt (bei Zielladung)
  const progress = sess?.target_energy_kwh && sess.target_energy_kwh > 0
    ? Math.min(100, (sess.energy_charged_kwh / sess.target_energy_kwh) * 100)
    : null

  // Reichweite aus geladener Energie
  const rangeStr = sess ? estimateRange(sess.energy_charged_kwh, vi?.vehicle_consumption_per_100km) : ''

  const createAndStart = async () => {
    setBusy(true)
    try {
      const data: Record<string, unknown> = { wallbox_id: wallbox.id, mode }
      if (mode === 'target_charge') {
        data.target_km = targetKm
        if (targetTime) data.target_time = new Date(targetTime).toISOString()
      }
      if (socLimitEnabled) data.soc_limit_pct = socLimit
      const s = await api.charging.createSession(data as Parameters<typeof api.charging.createSession>[0])
      await api.charging.startSession(s.id)
      onRefresh()
    } finally { setBusy(false) }
  }

  const startPending = async () => {
    if (!sess) return
    setBusy(true)
    try { await api.charging.startSession(sess.id); onRefresh() } finally { setBusy(false) }
  }

  const pause = async () => {
    if (!sess) return
    setBusy(true)
    try { await api.charging.pauseSession(sess.id); onRefresh() } finally { setBusy(false) }
  }

  const resume = async () => {
    if (!sess) return
    setBusy(true)
    try { await api.charging.resumeSession(sess.id); onRefresh() } finally { setBusy(false) }
  }

  const stop = async () => {
    if (!sess) return
    setBusy(true)
    try { await api.charging.stopSession(sess.id); onRefresh() } finally { setBusy(false) }
  }

  const changeMode = async (m: ChargingMode) => {
    setMode(m)
    if (sess && (isCharging || isPaused || isPending)) {
      setBusy(true)
      try {
        const data: Record<string, unknown> = { mode: m }
        if (m === 'target_charge') {
          data.target_km = targetKm
          if (targetTime) data.target_time = new Date(targetTime).toISOString()
        }
        if (socLimitEnabled) data.soc_limit_pct = socLimit
        await api.charging.updateMode(sess.id, data as Parameters<typeof api.charging.updateMode>[1])
        onRefresh()
      } finally { setBusy(false) }
    }
  }

  return (
    <div className={`bg-dark-card border rounded-xl p-5 space-y-4 ${
      isCharging ? 'border-emerald-500/40' : isPaused ? 'border-amber-500/40' : 'border-dark-border'
    }`}>
      {/* Header: Name + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isCharging ? 'bg-emerald-500/15' : isPaused ? 'bg-amber-500/15' : 'bg-dark-hover'
          }`}>
            <Car className={`w-5 h-5 ${
              isCharging ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-dark-faded'
            }`} />
          </div>
          <div>
            <h3 className="text-dark-text font-semibold">{wallbox.name}</h3>
            <div className="flex items-center gap-2 text-xs text-dark-faded">
              <Gauge className="w-3 h-3" />
              <span>max {wallbox.max_power_kw} kW / {wallbox.phases}P</span>
              {vi?.ocpp_enabled && <span className="text-blue-400">OCPP</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sess && (
            <>
              <span className={`w-2.5 h-2.5 rounded-full ${statusDot[sess.status] || 'bg-dark-faded'} ${isCharging ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-dark-faded">{statusLabel[sess.status]}</span>
            </>
          )}
        </div>
      </div>

      {/* Fahrzeug-Zuweisung (nur ohne aktive Session) */}
      {!hasSession && (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-dark-faded shrink-0" />
          <select
            value={wallbox.assigned_vehicle_id ?? ''}
            onChange={async (e) => {
              const vid = e.target.value ? Number(e.target.value) : null
              setBusy(true)
              try {
                await api.charging.assignVehicle(wallbox.id, vid)
                onRefresh()
              } finally { setBusy(false) }
            }}
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-emerald-500"
          >
            <option value="">Kein Fahrzeug zugewiesen</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.brand && v.model ? `${v.brand} ${v.model}` : v.name}
                {v.license_plate ? ` (${v.license_plate})` : ''}
                {` — ${v.battery_kwh} kWh`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Fahrzeug-Info (zugewiesen) */}
      {assigned_vehicle && !hasSession && (
        <div className="bg-dark-bg rounded-lg p-3 flex items-center gap-3 text-xs text-dark-faded">
          <Battery className="w-4 h-4 shrink-0 text-blue-400" />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span className="text-dark-text font-medium">
              {assigned_vehicle.brand} {assigned_vehicle.model}
            </span>
            <span>{assigned_vehicle.battery_kwh} kWh</span>
            <span>{assigned_vehicle.consumption_per_100km} kWh/100km</span>
            <span>max {assigned_vehicle.max_ac_power_kw} kW AC</span>
            {assigned_vehicle.license_plate && <span>{assigned_vehicle.license_plate}</span>}
          </div>
        </div>
      )}

      {/* Active Session */}
      {hasSession && (
        <div className="space-y-3">
          {/* Leistung + Modus Badge */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-dark-text">
                {sess!.current_power_kw.toFixed(1)}
                <span className="text-lg text-dark-faded ml-1">kW</span>
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-hover`}>
              <ModeIcon className={`w-3.5 h-3.5 ${activeModeConf.color}`} />
              <span className={`text-xs font-medium ${activeModeConf.color}`}>{activeModeConf.label}</span>
            </div>
          </div>

          {/* Metriken Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-dark-bg rounded-lg py-2 px-1">
              <p className="text-xs text-dark-faded">Geladen</p>
              <p className="text-sm font-bold text-dark-text">{sess!.energy_charged_kwh.toFixed(1)} kWh</p>
              {rangeStr && <p className="text-xs text-dark-faded">{rangeStr}</p>}
            </div>
            <div className="bg-dark-bg rounded-lg py-2 px-1">
              <p className="text-xs text-dark-faded">Dauer</p>
              <p className="text-sm font-bold text-dark-text">{fmtDuration(sess!.started_at)}</p>
            </div>
            <div className="bg-dark-bg rounded-lg py-2 px-1">
              <p className="text-xs text-dark-faded">Solar</p>
              <p className="text-sm font-bold text-emerald-400">{sess!.solar_pct.toFixed(0)}%</p>
              {sess!.cost_ct > 0 && (
                <p className="text-xs text-dark-faded">{(sess!.cost_ct / 100).toFixed(2)} EUR</p>
              )}
            </div>
          </div>

          {/* SoC Balken */}
          <SocBar soc={sess!.vehicle_soc_pct} limit={sess!.soc_limit_pct} battery={sess!.vehicle_battery_capacity_kwh} />

          {/* Fortschrittsbalken (Zielladung) */}
          {progress !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-dark-faded">
                <span>Fortschritt zum Ziel</span>
                <span>{progress.toFixed(0)}% ({sess!.energy_charged_kwh.toFixed(1)}/{sess!.target_energy_kwh?.toFixed(1)} kWh)</span>
              </div>
              <div className="h-2 bg-dark-hover rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {sess!.target_time && (
                <p className="text-xs text-dark-faded">Abfahrt: {fmtTime(sess!.target_time)}</p>
              )}
            </div>
          )}

          {/* Fahrzeug-Info während Session */}
          {sess!.vehicle_name && (
            <p className="text-xs text-dark-faded flex items-center gap-1">
              <Car className="w-3 h-3" /> {sess!.vehicle_name}
            </p>
          )}
        </div>
      )}

      {/* Mode Selection (no session) */}
      {!hasSession && (
        <div className="space-y-3">
          {/* Mode Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.entries(modeConfig) as [ChargingMode, typeof modeConfig.max_speed][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              const active = mode === key
              return (
                <button
                  key={key}
                  onClick={() => changeMode(key as ChargingMode)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-dark-hover border border-emerald-500/50 text-dark-text'
                      : 'bg-dark-bg border border-transparent text-dark-faded hover:bg-dark-hover'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? cfg.color : ''}`} />
                  <span className="font-medium">{cfg.label}</span>
                </button>
              )
            })}
          </div>

          {/* Target Charge Inputs */}
          {mode === 'target_charge' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-dark-faded block mb-1">Ziel-km</label>
                <input
                  type="number" value={targetKm} onChange={e => setTargetKm(Number(e.target.value))}
                  min={10} max={1000}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-dark-faded block mb-1">Abfahrtszeit</label>
                <input
                  type="datetime-local" value={targetTime} onChange={e => setTargetTime(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* SoC-Limit */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-dark-faded cursor-pointer">
              <input
                type="checkbox" checked={socLimitEnabled} onChange={e => setSocLimitEnabled(e.target.checked)}
                className="rounded border-dark-border bg-dark-bg text-emerald-500 focus:ring-emerald-500"
              />
              SoC-Limit
            </label>
            {socLimitEnabled && (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="range" min={20} max={100} step={5} value={socLimit}
                  onChange={e => setSocLimit(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 h-1.5"
                />
                <span className="text-xs text-dark-text font-medium w-8">{socLimit}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!hasSession && (
          <button onClick={createAndStart} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> Laden starten
          </button>
        )}
        {isPending && (
          <button onClick={startPending} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> Starten
          </button>
        )}
        {isCharging && (
          <>
            <button onClick={pause} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Pause className="w-4 h-4" /> Pausieren
            </button>
            <button onClick={stop} disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-hover border border-dark-border hover:bg-red-600/20 hover:border-red-500/30 text-dark-text rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Square className="w-4 h-4" /> Stop
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button onClick={resume} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" /> Fortsetzen
            </button>
            <button onClick={stop} disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-hover border border-dark-border hover:bg-red-600/20 hover:border-red-500/30 text-dark-text rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Square className="w-4 h-4" /> Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ==================== Vehicle Dialog ====================
function VehicleDialog({ vehicles, onClose, onRefresh }: {
  vehicles: Vehicle[]; onClose: () => void; onRefresh: () => void
}) {
  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null)
  const [busy, setBusy] = useState(false)

  const emptyVehicle: Partial<Vehicle> = {
    name: '', brand: '', model: '', license_plate: '',
    battery_kwh: 60, consumption_per_100km: 16.7, default_soc_limit_pct: 80,
    max_ac_power_kw: 11, connector_type: 'type2', color: '', year: undefined,
  }

  const save = async () => {
    if (!editing?.name) return
    setBusy(true)
    try {
      if (editing.id) {
        await api.charging.updateVehicle(editing.id, editing)
      } else {
        await api.charging.createVehicle(editing as Omit<Vehicle, 'id' | 'is_active'>)
      }
      setEditing(null)
      onRefresh()
    } finally { setBusy(false) }
  }

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await api.charging.deleteVehicle(id)
      onRefresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-border">
          <h2 className="text-lg font-bold text-dark-text flex items-center gap-2">
            <Car className="w-5 h-5 text-emerald-400" /> Fahrzeuge verwalten
          </h2>
          <button onClick={onClose} className="text-dark-faded hover:text-dark-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Vehicle List */}
          {vehicles.length === 0 && !editing && (
            <p className="text-dark-faded text-sm text-center py-4">
              Noch keine Fahrzeuge angelegt.
            </p>
          )}
          {vehicles.map(v => (
            <div key={v.id} className="flex items-center justify-between bg-dark-bg rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-dark-text font-medium">
                    {v.brand} {v.model}
                    {v.license_plate && <span className="text-dark-faded ml-2 text-xs">({v.license_plate})</span>}
                  </p>
                  <p className="text-xs text-dark-faded">
                    {v.battery_kwh} kWh / {v.consumption_per_100km} kWh/100km / max {v.max_ac_power_kw} kW AC
                    {v.year ? ` / ${v.year}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing({ ...v })}
                  className="p-2 text-dark-faded hover:text-dark-text rounded-lg hover:bg-dark-hover">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(v.id)} disabled={busy}
                  className="p-2 text-dark-faded hover:text-red-400 rounded-lg hover:bg-dark-hover">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Edit/Create Form */}
          {editing ? (
            <div className="bg-dark-bg rounded-lg p-4 space-y-3 border border-emerald-500/30">
              <h3 className="text-dark-text font-medium text-sm">
                {editing.id ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <VInput label="Name" value={editing.name || ''} onChange={v => setEditing({ ...editing, name: v })} />
                <VInput label="Marke" value={editing.brand || ''} onChange={v => setEditing({ ...editing, brand: v })} />
                <VInput label="Modell" value={editing.model || ''} onChange={v => setEditing({ ...editing, model: v })} />
                <VInput label="Kennzeichen" value={editing.license_plate || ''} onChange={v => setEditing({ ...editing, license_plate: v })} />
                <VInput label="Batterie (kWh)" type="number" value={String(editing.battery_kwh ?? 60)} onChange={v => setEditing({ ...editing, battery_kwh: Number(v) })} />
                <VInput label="Verbrauch (kWh/100km)" type="number" value={String(editing.consumption_per_100km ?? 16.7)} onChange={v => setEditing({ ...editing, consumption_per_100km: Number(v) })} />
                <VInput label="Max AC-Leistung (kW)" type="number" value={String(editing.max_ac_power_kw ?? 11)} onChange={v => setEditing({ ...editing, max_ac_power_kw: Number(v) })} />
                <VInput label="SoC-Limit Standard (%)" type="number" value={String(editing.default_soc_limit_pct ?? 80)} onChange={v => setEditing({ ...editing, default_soc_limit_pct: Number(v) })} />
                <VInput label="Baujahr" type="number" value={String(editing.year ?? '')} onChange={v => setEditing({ ...editing, year: v ? Number(v) : undefined })} />
                <VInput label="Farbe" value={editing.color || ''} onChange={v => setEditing({ ...editing, color: v })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm text-dark-faded hover:text-dark-text rounded-lg hover:bg-dark-hover">
                  Abbrechen
                </button>
                <button onClick={save} disabled={busy || !editing.name}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50">
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing({ ...emptyVehicle })}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-dark-border rounded-lg text-sm text-dark-faded hover:text-dark-text hover:border-emerald-500/50 transition-colors">
              <Plus className="w-4 h-4" /> Fahrzeug hinzufuegen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Input Helper ====================
function VInput({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="text-xs text-dark-faded block mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-emerald-500"
      />
    </div>
  )
}
