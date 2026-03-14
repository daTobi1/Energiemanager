import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart3, Download, ChevronDown, ChevronRight,
  Zap, Sun, BatteryCharging, Clock, Car, Euro, Gauge, Leaf,
} from 'lucide-react'
import Plot from 'react-plotly.js'
import { api } from '../api/client'
import type {
  ChargingAnalyticsResponse, ChargingPeriodBucket,
  ChargingPeriodVehicle, ChargingGrouping, ChargingSessionPoint,
} from '../types'

const modeLabels: Record<string, { label: string; color: string }> = {
  max_speed: { label: 'Sofort', color: '#f59e0b' },
  pv_surplus: { label: 'PV', color: '#10b981' },
  min_pv: { label: 'Min+PV', color: '#3b82f6' },
  target_charge: { label: 'Ziel', color: '#a855f7' },
}

const groupingOptions: { value: ChargingGrouping; label: string }[] = [
  { value: 'day', label: 'Tag' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
]

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEur(ct: number): string {
  return (ct / 100).toFixed(2)
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ----- SolarDonut -----
function SolarDonut({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 100) / 100)
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

// ----- Summary Card -----
function SummaryCard({ icon: Icon, label, value, sub, color = 'text-emerald-400' }: {
  icon: typeof Zap; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-dark-faded">{label}</span>
      </div>
      <p className="text-xl font-bold text-dark-text">{value}</p>
      {sub && <p className="text-xs text-dark-faded mt-1">{sub}</p>}
    </div>
  )
}

export default function ChargingAnalyticsPage() {
  const [data, setData] = useState<ChargingAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Toolbar state
  const [preset, setPreset] = useState<'7d' | '30d' | '90d' | '1y' | 'custom'>('30d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [grouping, setGrouping] = useState<ChargingGrouping>('month')
  const [vehicleFilter, setVehicleFilter] = useState<number | null>(null)

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Donut metric toggle
  const [donutMetric, setDonutMetric] = useState<'sessions' | 'energy'>('sessions')

  // Power chart mode
  const [powerChartMode, setPowerChartMode] = useState<'session' | 'period'>('session')

  // Calculate date range from preset
  const getDateRange = useCallback((p: string): { from: string; to: string } => {
    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    let from: string
    switch (p) {
      case '7d': from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10); break
      case '30d': from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10); break
      case '90d': from = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10); break
      case '1y': from = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10); break
      default: from = fromDate || to; break
    }
    return { from, to }
  }, [fromDate])

  // Set initial dates
  useEffect(() => {
    const r = getDateRange('30d')
    setFromDate(r.from)
    setToDate(r.to)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data
  const fetchData = useCallback(async () => {
    const range = preset === 'custom' ? { from: fromDate, to: toDate } : getDateRange(preset)
    if (!range.from || !range.to) return

    setLoading(true)
    setError(null)
    try {
      const res = await api.charging.analytics({ from: range.from, to: range.to, grouping })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [preset, fromDate, toDate, grouping, getDateRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Client-side vehicle filter
  const filteredBuckets = useMemo((): ChargingPeriodBucket[] => {
    if (!data) return []
    if (vehicleFilter === null) return data.buckets

    return data.buckets.map(b => {
      const filtered = b.vehicles.filter(v => v.vehicle_id === vehicleFilter)
      const energy = filtered.reduce((s, v) => s + v.energy_kwh, 0)
      const solar = filtered.reduce((s, v) => s + v.solar_kwh, 0)
      const grid = filtered.reduce((s, v) => s + v.grid_kwh, 0)
      const cost = filtered.reduce((s, v) => s + v.cost_ct, 0)
      const sessions = filtered.reduce((s, v) => s + v.sessions, 0)
      const totalDurMin = filtered.reduce((s, v) =>
        s + v.modes.reduce((sm, m) => sm + m.total_duration_min, 0), 0)
      const durH = totalDurMin / 60
      return {
        ...b,
        sessions,
        energy_kwh: energy,
        solar_kwh: solar,
        grid_kwh: grid,
        cost_ct: cost,
        avg_power_kw: durH > 0 ? +(energy / durH).toFixed(2) : 0,
        avg_solar_pct: energy > 0 ? +(solar / energy * 100).toFixed(1) : 0,
        vehicles: filtered,
      }
    }).filter(b => b.sessions > 0)
  }, [data, vehicleFilter])

  // Filtered summary
  const filteredSummary = useMemo(() => {
    if (!data) return null
    if (vehicleFilter === null) return data.summary

    const energy = filteredBuckets.reduce((s, b) => s + b.energy_kwh, 0)
    const solar = filteredBuckets.reduce((s, b) => s + b.solar_kwh, 0)
    const grid = filteredBuckets.reduce((s, b) => s + b.grid_kwh, 0)
    const cost = filteredBuckets.reduce((s, b) => s + b.cost_ct, 0)
    const sessions = filteredBuckets.reduce((s, b) => s + b.sessions, 0)
    const totalDurMin = filteredBuckets.reduce((s, b) =>
      b.vehicles.reduce((sv, v) =>
        sv + v.modes.reduce((sm, m) => sm + m.total_duration_min, 0), s), 0)
    const durH = totalDurMin / 60

    const modeDist: Record<string, number> = {}
    for (const b of filteredBuckets) {
      for (const v of b.vehicles) {
        for (const m of v.modes) {
          modeDist[m.mode] = (modeDist[m.mode] || 0) + m.sessions
        }
      }
    }

    return {
      sessions,
      energy_kwh: +energy.toFixed(2),
      solar_kwh: +solar.toFixed(2),
      grid_kwh: +grid.toFixed(2),
      cost_ct: +cost.toFixed(2),
      avg_power_kw: durH > 0 ? +(energy / durH).toFixed(2) : 0,
      avg_solar_pct: energy > 0 ? +(solar / energy * 100).toFixed(1) : 0,
      avg_cost_ct_per_kwh: energy > 0 ? +(cost / energy).toFixed(2) : 0,
      mode_distribution: modeDist,
      vehicle_count: 1,
    }
  }, [data, vehicleFilter, filteredBuckets])

  // Filtered session points
  const filteredSessionPoints = useMemo((): ChargingSessionPoint[] => {
    if (!data) return []
    if (vehicleFilter === null) return data.session_points
    return data.session_points.filter(s => s.vehicle_id === vehicleFilter)
  }, [data, vehicleFilter])

  // CSV Export
  const exportCsv = useCallback(() => {
    if (!filteredBuckets.length) return
    const headers = ['Periode', 'Sessions', 'Energie kWh', 'Solar kWh', 'Netz kWh', 'Solar %', 'Kosten EUR', 'Mittlere kW']
    const rows = filteredBuckets.map(b => [
      b.period_label, b.sessions, b.energy_kwh, b.solar_kwh, b.grid_kwh,
      b.avg_solar_pct, (b.cost_ct / 100).toFixed(2), b.avg_power_kw,
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ladeauswertung_${data?.from_date}_${data?.to_date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredBuckets, data])

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handlePreset = (p: typeof preset) => {
    setPreset(p)
    if (p !== 'custom') {
      const r = getDateRange(p)
      setFromDate(r.from)
      setToDate(r.to)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Ladeauswertung</h1>
            <p className="text-sm text-dark-faded">Analyse aller Ladevorgänge</p>
          </div>
        </div>
        <button onClick={exportCsv} disabled={!filteredBuckets.length}
          className="flex items-center gap-2 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-faded hover:text-dark-text disabled:opacity-50">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-dark-card rounded-xl p-4 border border-dark-border flex flex-wrap items-center gap-3">
        {/* Presets */}
        <div className="flex gap-1 bg-dark-bg rounded-lg p-1">
          {(['7d', '30d', '90d', '1y', 'custom'] as const).map(p => (
            <button key={p} onClick={() => handlePreset(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                preset === p ? 'bg-emerald-600 text-white' : 'text-dark-faded hover:text-dark-text'
              }`}>
              {p === 'custom' ? 'Frei' : p === '1y' ? '1 Jahr' : p}
            </button>
          ))}
        </div>

        {/* Custom dates */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text" />
            <span className="text-dark-faded text-sm">—</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text" />
          </div>
        )}

        <div className="w-px h-6 bg-dark-border" />

        {/* Grouping */}
        <div className="flex gap-1 bg-dark-bg rounded-lg p-1">
          {groupingOptions.map(g => (
            <button key={g.value} onClick={() => setGrouping(g.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                grouping === g.value ? 'bg-blue-600 text-white' : 'text-dark-faded hover:text-dark-text'
              }`}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-dark-border" />

        {/* Vehicle filter */}
        <select value={vehicleFilter ?? ''} onChange={e => setVehicleFilter(e.target.value ? Number(e.target.value) : null)}
          className="bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-sm text-dark-text">
          <option value="">Alle Fahrzeuge</option>
          {data?.vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="bg-dark-card rounded-xl p-8 border border-dark-border text-center text-dark-faded">
          Lade Daten...
        </div>
      )}
      {error && (
        <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {filteredSummary && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard icon={Zap} label="Gesamtenergie" color="text-blue-400"
              value={`${filteredSummary.energy_kwh.toFixed(1)} kWh`}
              sub={`${filteredSummary.sessions} Ladevorgänge`} />
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-dark-faded">Solaranteil</span>
              </div>
              <div className="flex items-center gap-3">
                <SolarDonut pct={filteredSummary.avg_solar_pct} size={52} />
                <div>
                  <p className="text-sm font-bold text-dark-text">{filteredSummary.solar_kwh.toFixed(1)} kWh</p>
                  <p className="text-xs text-dark-faded">von {filteredSummary.energy_kwh.toFixed(1)}</p>
                </div>
              </div>
            </div>
            <SummaryCard icon={Euro} label="Kosten" color="text-amber-400"
              value={`${fmtEur(filteredSummary.cost_ct)} EUR`}
              sub={`${filteredSummary.avg_cost_ct_per_kwh.toFixed(1)} ct/kWh`} />
            <SummaryCard icon={Gauge} label="Mittlere Leistung" color="text-purple-400"
              value={`${filteredSummary.avg_power_kw.toFixed(1)} kW`} />
            <SummaryCard icon={Car} label="Fahrzeuge" color="text-blue-400"
              value={`${vehicleFilter !== null ? 1 : filteredSummary.vehicle_count}`}
              sub={vehicleFilter !== null ? data?.vehicles.find(v => v.id === vehicleFilter)?.name : undefined} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Energy Bar Chart */}
            <div className="lg:col-span-2 bg-dark-card rounded-xl p-4 border border-dark-border">
              <h3 className="text-sm font-semibold text-dark-text mb-3">Energie pro Periode</h3>
              {filteredBuckets.length > 0 ? (
                <Plot
                  data={[
                    {
                      x: filteredBuckets.map(b => b.period_label),
                      y: filteredBuckets.map(b => b.solar_kwh),
                      name: 'Solar',
                      type: 'bar',
                      marker: { color: '#10b981' },
                      hovertemplate: '%{y:.1f} kWh<extra>Solar</extra>',
                    },
                    {
                      x: filteredBuckets.map(b => b.period_label),
                      y: filteredBuckets.map(b => b.grid_kwh),
                      name: 'Netz',
                      type: 'bar',
                      marker: { color: '#3b82f6' },
                      hovertemplate: '%{y:.1f} kWh<extra>Netz</extra>',
                    },
                  ]}
                  layout={{
                    barmode: 'stack',
                    height: 280,
                    margin: { t: 10, b: 40, l: 50, r: 10 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#94a3b8', size: 11 },
                    xaxis: { gridcolor: '#1e293b' },
                    yaxis: { title: 'kWh', gridcolor: '#1e293b' },
                    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
                    showlegend: true,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%' }}
                />
              ) : (
                <p className="text-sm text-dark-faded text-center py-10">Keine Daten im Zeitraum</p>
              )}
            </div>

            {/* Mode Distribution Donut */}
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-dark-text">Modus-Verteilung</h3>
                <div className="flex gap-1 bg-dark-bg rounded-md p-0.5">
                  <button onClick={() => setDonutMetric('sessions')}
                    className={`px-2 py-1 text-[10px] rounded ${donutMetric === 'sessions' ? 'bg-dark-hover text-dark-text' : 'text-dark-faded'}`}>
                    Sessions
                  </button>
                  <button onClick={() => setDonutMetric('energy')}
                    className={`px-2 py-1 text-[10px] rounded ${donutMetric === 'energy' ? 'bg-dark-hover text-dark-text' : 'text-dark-faded'}`}>
                    Energie
                  </button>
                </div>
              </div>
              {filteredSummary.sessions > 0 ? (
                <Plot
                  data={[{
                    labels: Object.keys(
                      donutMetric === 'sessions' ? filteredSummary.mode_distribution : _modeEnergy(filteredBuckets)
                    ).map(k => modeLabels[k]?.label || k),
                    values: Object.values(
                      donutMetric === 'sessions' ? filteredSummary.mode_distribution : _modeEnergy(filteredBuckets)
                    ),
                    type: 'pie',
                    hole: 0.55,
                    marker: {
                      colors: Object.keys(
                        donutMetric === 'sessions' ? filteredSummary.mode_distribution : _modeEnergy(filteredBuckets)
                      ).map(k => modeLabels[k]?.color || '#6b7280'),
                    },
                    textinfo: 'percent',
                    textfont: { color: '#e2e8f0', size: 11 },
                    hovertemplate: donutMetric === 'sessions'
                      ? '%{label}: %{value} Sessions<extra></extra>'
                      : '%{label}: %{value:.1f} kWh<extra></extra>',
                  }]}
                  layout={{
                    height: 240,
                    margin: { t: 10, b: 10, l: 10, r: 10 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#94a3b8', size: 11 },
                    showlegend: true,
                    legend: { orientation: 'h', y: -0.1, font: { size: 10, color: '#94a3b8' } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%' }}
                />
              ) : (
                <p className="text-sm text-dark-faded text-center py-10">Keine Daten</p>
              )}
            </div>
          </div>

          {/* Power Chart */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-dark-text">Ladeleistung</h3>
              <div className="flex gap-1 bg-dark-bg rounded-lg p-1">
                <button onClick={() => setPowerChartMode('session')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    powerChartMode === 'session' ? 'bg-purple-600 text-white' : 'text-dark-faded hover:text-dark-text'
                  }`}>
                  Pro Session
                </button>
                <button onClick={() => setPowerChartMode('period')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    powerChartMode === 'period' ? 'bg-purple-600 text-white' : 'text-dark-faded hover:text-dark-text'
                  }`}>
                  Gesamt
                </button>
              </div>
            </div>
            {powerChartMode === 'session' ? (
              filteredSessionPoints.length > 0 ? (
                <Plot
                  data={(() => {
                    // Group sessions by vehicle for separate traces
                    const byVehicle: Record<string, ChargingSessionPoint[]> = {}
                    for (const s of filteredSessionPoints) {
                      const name = s.vehicle_name || 'Unbekannt'
                      ;(byVehicle[name] ??= []).push(s)
                    }
                    const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
                    return Object.entries(byVehicle).map(([name, pts], i) => ({
                      x: pts.map(s => s.started_at),
                      y: pts.map(s => s.avg_power_kw),
                      name,
                      type: 'scatter' as const,
                      mode: 'lines+markers' as const,
                      line: { color: colors[i % colors.length], width: 2 },
                      marker: { size: 7, color: colors[i % colors.length] },
                      hovertemplate: pts.map(s =>
                        `${s.vehicle_name || 'Unbekannt'}<br>` +
                        `${s.avg_power_kw.toFixed(1)} kW<br>` +
                        `${s.energy_kwh.toFixed(1)} kWh in ${fmtDuration(s.duration_min)}<br>` +
                        `Modus: ${modeLabels[s.mode]?.label || s.mode}<extra></extra>`
                      ),
                    }))
                  })()}
                  layout={{
                    height: 280,
                    margin: { t: 10, b: 40, l: 50, r: 10 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#94a3b8', size: 11 },
                    xaxis: { gridcolor: '#1e293b', type: 'date' },
                    yaxis: { title: 'kW', gridcolor: '#1e293b' },
                    legend: { orientation: 'h', y: -0.25, font: { size: 11 } },
                    showlegend: Object.keys(
                      filteredSessionPoints.reduce((a, s) => { a[s.vehicle_name || 'U'] = 1; return a }, {} as Record<string, number>)
                    ).length > 1,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%' }}
                />
              ) : (
                <p className="text-sm text-dark-faded text-center py-10">Keine Sessions im Zeitraum</p>
              )
            ) : (
              filteredBuckets.length > 0 ? (
                <Plot
                  data={[{
                    x: filteredBuckets.map(b => b.period_label),
                    y: filteredBuckets.map(b => b.avg_power_kw),
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: { color: '#a855f7', width: 2.5, shape: 'spline' },
                    marker: { size: 8, color: '#a855f7' },
                    fill: 'tozeroy',
                    fillcolor: 'rgba(168,85,247,0.1)',
                    hovertemplate: '%{x}<br>%{y:.1f} kW<extra></extra>',
                  }]}
                  layout={{
                    height: 280,
                    margin: { t: 10, b: 40, l: 50, r: 10 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#94a3b8', size: 11 },
                    xaxis: { gridcolor: '#1e293b' },
                    yaxis: { title: 'kW', gridcolor: '#1e293b' },
                    showlegend: false,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%' }}
                />
              ) : (
                <p className="text-sm text-dark-faded text-center py-10">Keine Daten im Zeitraum</p>
              )
            )}
          </div>

          {/* Table */}
          <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
            <div className="p-4 border-b border-dark-border">
              <h3 className="text-sm font-semibold text-dark-text">Perioden-Übersicht</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-dark-faded text-xs border-b border-dark-border">
                    <th className="text-left px-4 py-3 w-8"></th>
                    <th className="text-left px-4 py-3">Periode</th>
                    <th className="text-right px-4 py-3">Sessions</th>
                    <th className="text-right px-4 py-3">Energie</th>
                    <th className="text-right px-4 py-3">Solar</th>
                    <th className="text-right px-4 py-3">Netz</th>
                    <th className="text-right px-4 py-3">Solar %</th>
                    <th className="text-right px-4 py-3">Kosten</th>
                    <th className="text-right px-4 py-3">kW</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuckets.map(b => (
                    <BucketRow key={b.period_start} bucket={b}
                      expanded={expandedRows.has(b.period_start)}
                      onToggle={() => toggleRow(b.period_start)} />
                  ))}
                  {filteredBuckets.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-dark-faded">Keine Ladevorgänge im Zeitraum</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Helper: aggregate energy by mode across buckets
function _modeEnergy(buckets: ChargingPeriodBucket[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const b of buckets) {
    for (const v of b.vehicles) {
      for (const m of v.modes) {
        result[m.mode] = (result[m.mode] || 0) + m.energy_kwh
      }
    }
  }
  return result
}

// ----- Bucket Row -----
function BucketRow({ bucket: b, expanded, onToggle }: {
  bucket: ChargingPeriodBucket; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b border-dark-border hover:bg-dark-hover/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          {b.vehicles.length > 0 && (
            expanded ? <ChevronDown className="w-4 h-4 text-dark-faded" /> : <ChevronRight className="w-4 h-4 text-dark-faded" />
          )}
        </td>
        <td className="px-4 py-3 font-medium text-dark-text">{b.period_label}</td>
        <td className="px-4 py-3 text-right text-dark-text">{b.sessions}</td>
        <td className="px-4 py-3 text-right text-dark-text">{b.energy_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-3 text-right text-emerald-400">{b.solar_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-3 text-right text-blue-400">{b.grid_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-3 text-right">
          <span className={b.avg_solar_pct >= 50 ? 'text-emerald-400' : 'text-dark-text'}>
            {b.avg_solar_pct.toFixed(0)}%
          </span>
        </td>
        <td className="px-4 py-3 text-right text-dark-text">{fmtEur(b.cost_ct)} EUR</td>
        <td className="px-4 py-3 text-right text-dark-text">{b.avg_power_kw.toFixed(1)}</td>
      </tr>
      {expanded && b.vehicles.map(v => (
        <VehicleRow key={`${b.period_start}-${v.vehicle_id}`} vehicle={v} />
      ))}
    </>
  )
}

// ----- Vehicle Sub-Row -----
function VehicleRow({ vehicle: v }: { vehicle: ChargingPeriodVehicle }) {
  return (
    <>
      <tr className="bg-dark-bg/50 border-b border-dark-border/50">
        <td className="px-4 py-2"></td>
        <td className="px-4 py-2 pl-10 text-dark-faded flex items-center gap-2">
          <Car className="w-3.5 h-3.5" /> {v.vehicle_name}
        </td>
        <td className="px-4 py-2 text-right text-dark-faded">{v.sessions}</td>
        <td className="px-4 py-2 text-right text-dark-faded">{v.energy_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-2 text-right text-emerald-400/70">{v.solar_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-2 text-right text-blue-400/70">{v.grid_kwh.toFixed(1)} kWh</td>
        <td className="px-4 py-2 text-right text-dark-faded">{v.avg_solar_pct.toFixed(0)}%</td>
        <td className="px-4 py-2 text-right text-dark-faded">{fmtEur(v.cost_ct)} EUR</td>
        <td className="px-4 py-2 text-right text-dark-faded">{v.avg_power_kw.toFixed(1)}</td>
      </tr>
      {v.modes.map(m => (
        <tr key={`${v.vehicle_id}-${m.mode}`} className="bg-dark-bg/30 border-b border-dark-border/30">
          <td className="px-4 py-1.5"></td>
          <td className="px-4 py-1.5 pl-16 text-xs text-dark-faded">
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: modeLabels[m.mode]?.color || '#6b7280' }} />
            {modeLabels[m.mode]?.label || m.mode} — {fmtDuration(m.total_duration_min)}
          </td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{m.sessions}</td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{m.energy_kwh.toFixed(1)} kWh</td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{m.solar_kwh.toFixed(1)}</td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{m.grid_kwh.toFixed(1)}</td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded"></td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{fmtEur(m.cost_ct)}</td>
          <td className="px-4 py-1.5 text-right text-xs text-dark-faded">{m.avg_power_kw.toFixed(1)}</td>
        </tr>
      ))}
    </>
  )
}
