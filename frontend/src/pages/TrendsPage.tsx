import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { TrendingUp, Download, Settings2, Loader2, Activity, RefreshCw } from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'
import { api } from '../api/client'
import TrendToolbar from '../components/trends/TrendToolbar'
import TrendChart from '../components/trends/TrendChart'
import TrendStatsCards from '../components/trends/TrendStatsCards'
import TrendManagementModal from '../components/trends/TrendManagementModal'
import type { TrendDefinition, TrendInterval, TrendPresetRange, TrendSeries } from '../types'
import type { TrendDataResponse, TrendStatsResponse } from '../hooks/useTrendData'

// Farb-Palette fuer automatische Zuweisung
const SOURCE_COLORS = [
  '#eab308', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#f43f5e',
  '#a855f7', '#84cc16', '#0ea5e9', '#d946ef',
]

// Einheiten-Mapping fuer Y-Achse
const RIGHT_AXIS_UNITS = new Set(['%', '\u00b0C'])

const DEFAULT_TRENDS: TrendDefinition[] = [
  {
    id: 'default-power',
    name: 'Stromuebersicht',
    series: [
      { source: 'pv', metric: 'power_kw', color: '#eab308', label: 'PV' },
      { source: 'grid', metric: 'power_kw', color: '#3b82f6', label: 'Netz' },
      { source: 'load', metric: 'power_kw', color: '#ef4444', label: 'Last' },
      { source: 'battery', metric: 'power_kw', color: '#22c55e', label: 'Batterie' },
    ],
    defaultInterval: '5min', defaultRange: '24h', isDefault: true,
  },
  {
    id: 'default-thermal',
    name: 'Thermik',
    series: [
      { source: 'heat_pump', metric: 'heat_kw', color: '#ef4444', label: 'WP Waerme' },
      { source: 'boiler', metric: 'heat_kw', color: '#f97316', label: 'Kessel' },
      { source: 'heat_storage', metric: 'temperature_c', color: '#8b5cf6', yAxisId: 'right', label: 'Speicher' },
      { source: 'outdoor', metric: 'temperature_c', color: '#06b6d4', yAxisId: 'right', label: 'Aussen' },
    ],
    defaultInterval: '15min', defaultRange: '24h', isDefault: true,
  },
  {
    id: 'default-battery',
    name: 'Batterie',
    series: [
      { source: 'battery', metric: 'power_kw', color: '#22c55e', label: 'Leistung' },
      { source: 'battery', metric: 'soc_pct', color: '#8b5cf6', yAxisId: 'right', label: 'SOC %' },
    ],
    defaultInterval: '5min', defaultRange: '24h', isDefault: true,
  },
  {
    id: 'default-autarky',
    name: 'Autarkie',
    series: [
      { source: 'system', metric: 'self_sufficiency_pct', color: '#22c55e', label: 'Autarkie %' },
      { source: 'system', metric: 'self_consumption_kw', color: '#eab308', label: 'Eigenverbrauch' },
      { source: 'grid', metric: 'import_kwh', color: '#ef4444', yAxisId: 'right', label: 'Bezug kWh' },
      { source: 'grid', metric: 'export_kwh', color: '#3b82f6', yAxisId: 'right', label: 'Einspeisung kWh' },
    ],
    defaultInterval: '1h', defaultRange: '7d', isDefault: true,
  },
]

const ADHOC_ID = '__adhoc__'

// Auto-Intervall: passt sich automatisch an den Zeitbereich an
const AUTO_INTERVAL: Record<string, TrendInterval> = {
  '1h': 'raw',
  '6h': '1min',
  '24h': '5min',
  '7d': '1h',
  '30d': '1d',
}

const RANGE_MS: Record<string, number> = {
  '1h': 3600e3,
  '6h': 6 * 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 24 * 3600e3,
  '30d': 30 * 24 * 3600e3,
}

// Lesbarer Label fuer source.metric
function formatSourceLabel(source: string, metric: string): string {
  const sourceLabels: Record<string, string> = {
    pv: 'PV', grid: 'Netz', load: 'Last', battery: 'Batterie',
    heat_pump: 'Waermepumpe', boiler: 'Kessel', outdoor: 'Aussen',
    heat_storage: 'Puffer', system: 'System',
  }
  const metricLabels: Record<string, string> = {
    power_kw: 'Leistung', heat_kw: 'Waerme', temperature_c: 'Temperatur',
    soc_pct: 'SOC', self_sufficiency_pct: 'Autarkie',
    self_consumption_kw: 'Eigenverbr.', import_kwh: 'Bezug', export_kwh: 'Einspeise.',
  }
  return `${sourceLabels[source] || source} ${metricLabels[metric] || metric}`
}

export default function TrendsPage() {
  const { trendDefinitions, addTrendDefinition, updateTrendDefinition, removeTrendDefinition } = useEnergyStore()

  // Merge default + custom definitions
  const allDefinitions = useMemo(() => {
    const customDefs = trendDefinitions.filter((d) => !d.isDefault)
    return [...DEFAULT_TRENDS, ...customDefs]
  }, [trendDefinitions])

  const [selectedId, setSelectedId] = useState(DEFAULT_TRENDS[0].id)
  const [range, setRange] = useState<TrendPresetRange>('24h')
  const [interval, setInterval] = useState<TrendInterval>('5min')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [availableSources, setAvailableSources] = useState<{ source: string; metric: string; unit: string }[]>([])
  const [autoInterval, setAutoInterval] = useState(true)

  // Data state — managed directly, not via hook
  const [data, setData] = useState<TrendDataResponse | null>(null)
  const [stats, setStats] = useState<TrendStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef(0)

  // Ad-hoc mode: manually selected sources
  const [adhocSources, setAdhocSources] = useState<Set<string>>(new Set())

  const isAdhoc = selectedId === ADHOC_ID

  // Build ad-hoc TrendSeries from selected sources
  const adhocSeries = useMemo((): TrendSeries[] => {
    return [...adhocSources].map((key, i) => {
      const [source, metric] = key.split('.', 2)
      const src = availableSources.find((s) => s.source === source && s.metric === metric)
      return {
        source,
        metric,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
        label: formatSourceLabel(source, metric),
        yAxisId: src && RIGHT_AXIS_UNITS.has(src.unit) ? 'right' as const : 'left' as const,
      }
    })
  }, [adhocSources, availableSources])

  const selectedDef = isAdhoc
    ? { id: ADHOC_ID, name: 'Einzelquellen', series: adhocSeries, defaultInterval: '5min' as const, defaultRange: '24h' as const, isDefault: false }
    : (allDefinitions.find((d) => d.id === selectedId) || allDefinitions[0])

  // Build source.metric keys
  const sourceKeys = useMemo(
    () => selectedDef.series.map((s) => `${s.source}.${s.metric}`),
    [selectedDef],
  )

  // Fetch trend data — uses time-range endpoint to get actual data bounds, then queries
  const fetchData = useCallback(async (sources: string[], rangePreset: TrendPresetRange, intervalVal: string, cFrom: string, cTo: string) => {
    if (sources.length === 0) return

    const id = ++fetchRef.current
    setLoading(true)

    try {
      // 1. Zeitbereich bestimmen
      let fromTs: string
      let toTs: string

      if (rangePreset === 'custom') {
        fromTs = cFrom ? new Date(cFrom).toISOString() : new Date().toISOString()
        toTs = cTo ? new Date(cTo).toISOString() : new Date().toISOString()
      } else {
        // Letzten Datenpunkt vom Backend holen
        const tr = await api.trends.timeRange()
        const endTime = tr.max ? new Date(tr.max.replace(' ', 'T')) : new Date()
        const rangeMs = RANGE_MS[rangePreset] || 24 * 3600e3
        fromTs = new Date(endTime.getTime() - rangeMs).toISOString()
        toTs = endTime.toISOString()
      }

      if (id !== fetchRef.current) return // stale

      // 2. Daten + Statistiken parallel laden
      const sourcesStr = sources.join(',')
      const [trendData, trendStats] = await Promise.all([
        api.trends.data({ sources: sourcesStr, from: fromTs, to: toTs, interval: intervalVal }),
        api.trends.statistics({ sources: sourcesStr, from: fromTs, to: toTs }),
      ])

      if (id !== fetchRef.current) return // stale

      setData(trendData)
      setStats(trendStats)
    } catch (err) {
      console.warn('[Trends] Fehler:', err)
      if (id === fetchRef.current) {
        setData(null)
        setStats(null)
      }
    } finally {
      if (id === fetchRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Load available sources beim Mount
  useEffect(() => {
    api.trends.sources()
      .then(setAvailableSources)
      .catch(() => {})
  }, [])

  // Fetch data when sources, range or interval change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(sourceKeys, range, interval, customFrom, customTo)
    }, 300) // debounce
    return () => clearTimeout(timer)
  }, [sourceKeys.join(','), range, interval, customFrom, customTo, fetchData])

  // When selecting a definition, apply its default range + interval
  const handleSelectDefinition = useCallback((id: string) => {
    setSelectedId(id)
    if (id === ADHOC_ID) {
      setRange('24h')
      setInterval('5min')
      return
    }
    const def = allDefinitions.find((d) => d.id === id)
    if (def) {
      setRange(def.defaultRange)
      setInterval(def.defaultInterval)
    }
  }, [allDefinitions])

  // Toggle source in ad-hoc mode
  const toggleAdhocSource = useCallback((key: string) => {
    setAdhocSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    // Auto-switch to adhoc mode
    if (selectedId !== ADHOC_ID) {
      setSelectedId(ADHOC_ID)
    }
  }, [selectedId])

  const handleRangeChange = (newRange: TrendPresetRange) => {
    setRange(newRange)
    if (autoInterval && AUTO_INTERVAL[newRange]) {
      setInterval(AUTO_INTERVAL[newRange])
    }
    if (newRange === 'custom' && !customFrom) {
      // Fuer Custom: Defaults basierend auf letztem bekannten Datenpunkt
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 3600e3)
      setCustomFrom(yesterday.toISOString().slice(0, 16))
      setCustomTo(now.toISOString().slice(0, 16))
    }
  }

  const handleIntervalChange = (newInterval: TrendInterval) => {
    setInterval(newInterval)
    setAutoInterval(false)
  }

  const handleRefresh = () => {
    fetchData(sourceKeys, range, interval, customFrom, customTo)
  }

  const handleSaveDefinition = (def: TrendDefinition) => {
    const existing = trendDefinitions.find((d) => d.id === def.id)
    if (existing) {
      updateTrendDefinition(def.id, def)
    } else {
      addTrendDefinition(def)
    }
  }

  const handleDeleteDefinition = (id: string) => {
    removeTrendDefinition(id)
    if (selectedId === id) setSelectedId(DEFAULT_TRENDS[0].id)
  }

  // CSV Export
  const handleExportCsv = () => {
    if (!data) return
    const keys = Object.keys(data)
    if (keys.length === 0) return

    const firstKey = keys[0]
    const timestamps = data[firstKey].timestamps

    let csv = 'Zeitstempel,' + keys.map((k) => {
      const s = selectedDef.series.find((s) => `${s.source}.${s.metric}` === k)
      return s?.label || k
    }).join(',') + '\n'

    for (let i = 0; i < timestamps.length; i++) {
      csv += timestamps[i] + ',' + keys.map((k) => data[k].values[i] ?? '').join(',') + '\n'
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trend_${selectedDef.name.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = data && Object.keys(data).length > 0 && Object.values(data).some((d) => d.values.length > 0)

  // Group available sources by source name
  const groupedSources = useMemo(() => {
    const groups: Record<string, { source: string; metric: string; unit: string }[]> = {}
    for (const s of availableSources) {
      if (!groups[s.source]) groups[s.source] = []
      groups[s.source].push(s)
    }
    return groups
  }, [availableSources])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Trends</h1>
          <p className="text-sm text-dark-faded mt-1">Historische Messdaten visualisieren und analysieren</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-dark-border text-dark-faded hover:text-dark-text hover:bg-dark-hover transition-colors"
            title="Daten aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Definition Dropdown */}
          <select
            value={selectedId}
            onChange={(e) => handleSelectDefinition(e.target.value)}
            className="select"
          >
            <optgroup label="Vordefiniert">
              {allDefinitions.filter((d) => d.isDefault).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </optgroup>
            {allDefinitions.some((d) => !d.isDefault) && (
              <optgroup label="Eigene">
                {allDefinitions.filter((d) => !d.isDefault).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Sensor-Auswahl">
              <option value={ADHOC_ID}>Einzelquellen...</option>
            </optgroup>
          </select>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
            <Settings2 className="w-4 h-4" />
            Verwalten
          </button>
        </div>
      </div>

      {/* Source Browser */}
      {(isAdhoc || availableSources.length > 0) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-dark-muted">
              Verfuegbare Messquellen ({availableSources.length})
            </span>
            {!isAdhoc && (
              <span className="text-xs text-dark-faded ml-auto">
                Klicke auf eine Quelle um zur Einzelansicht zu wechseln
              </span>
            )}
            {isAdhoc && adhocSources.size > 0 && (
              <button
                onClick={() => setAdhocSources(new Set())}
                className="text-xs text-dark-faded hover:text-dark-text ml-auto"
              >
                Alle abwaehlen
              </button>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(groupedSources).map(([sourceName, metrics]) => (
              <div key={sourceName} className="flex items-start gap-2">
                <span className="text-xs text-dark-faded w-24 shrink-0 pt-1.5 text-right">
                  {formatSourceLabel(sourceName, '').trim() || sourceName}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {metrics.map((m) => {
                    const key = `${m.source}.${m.metric}`
                    const isActive = isAdhoc && adhocSources.has(key)
                    const isInCurrentDef = !isAdhoc && selectedDef.series.some(
                      (s) => s.source === m.source && s.metric === m.metric
                    )
                    return (
                      <button
                        key={key}
                        onClick={() => toggleAdhocSource(key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border ${
                          isActive
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : isInCurrentDef
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-dark-bg border-dark-border text-dark-faded hover:text-dark-text hover:border-dark-faded'
                        }`}
                      >
                        {isActive && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[[...adhocSources].indexOf(key) % SOURCE_COLORS.length] }}
                          />
                        )}
                        {m.metric.replace(/_/g, ' ')}
                        <span className="text-dark-faded">{m.unit}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="card p-3">
        <TrendToolbar
          range={range}
          interval={interval}
          customFrom={customFrom}
          customTo={customTo}
          onRangeChange={handleRangeChange}
          onIntervalChange={handleIntervalChange}
          onCustomRange={(f, t) => { setCustomFrom(f); setCustomTo(t) }}
          autoInterval={autoInterval}
          onAutoIntervalToggle={() => setAutoInterval((v) => !v)}
        />
      </div>

      {/* Chart */}
      <div className="card p-2">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : hasData ? (
          <TrendChart data={data!} series={selectedDef.series} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-dark-faded">
            <TrendingUp className="w-16 h-16 text-dark-border mb-4" />
            {isAdhoc && adhocSources.size === 0 ? (
              <>
                <p className="text-lg">Keine Quellen ausgewaehlt</p>
                <p className="text-sm mt-1">Waehle oben eine oder mehrere Messquellen aus</p>
              </>
            ) : (
              <>
                <p className="text-lg">Keine Daten im gewaehlten Zeitraum</p>
                <p className="text-sm mt-1">Starte den Simulator um Messdaten zu erzeugen</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      {stats && Object.keys(stats).length > 0 && (
        <TrendStatsCards stats={stats} series={selectedDef.series} data={data} range={range} interval={interval} />
      )}

      {/* Export */}
      {hasData && (
        <div className="flex justify-end">
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 text-sm px-3 py-2 text-dark-faded hover:text-dark-text bg-dark-card border border-dark-border rounded-lg hover:bg-dark-hover transition-colors">
            <Download className="w-4 h-4" />
            CSV herunterladen
          </button>
        </div>
      )}

      {/* Management Modal */}
      <TrendManagementModal
        open={showModal}
        onClose={() => setShowModal(false)}
        definitions={allDefinitions}
        availableSources={availableSources}
        onSave={handleSaveDefinition}
        onDelete={handleDeleteDefinition}
      />
    </div>
  )
}
