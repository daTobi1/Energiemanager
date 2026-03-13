import { useCallback, useRef, useState, useEffect } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { Section } from '../components/ui/FormField'
import {
  Target, Leaf, Coins, Thermometer, Sun, Zap,
  RotateCcw, Info, CalendarClock, Loader2, Battery, TrendingDown,
  Settings2, ShieldAlert, Play, Hand, Power, Gauge,
} from 'lucide-react'
import { api } from '../api/client'
import type { OptimizerWeights, OptimizationSchedule, ControllerStatus, ControllerHistoryEntry } from '../types'
import { createDefaultOptimizerWeights } from '../types'

let Plotly: typeof import('plotly.js-dist-min') | null = null

const AXES: { key: keyof OptimizerWeights; label: string; shortLabel: string; icon: typeof Leaf; color: string; description: string }[] = [
  { key: 'co2Reduction', label: 'CO\u2082-Einsparung', shortLabel: 'CO\u2082', icon: Leaf, color: '#22c55e', description: 'Minimiert den CO\u2082-Aussto\u00df durch bevorzugten Einsatz erneuerbarer Energien' },
  { key: 'economy', label: 'Wirtschaftlichkeit', shortLabel: '\u20ac', icon: Coins, color: '#eab308', description: 'Minimiert Energiekosten durch g\u00fcnstigen Einkauf und maximale Einspeiseverg\u00fctung' },
  { key: 'comfort', label: 'Komfort', shortLabel: 'Komf.', icon: Thermometer, color: '#f97316', description: 'Priorisiert Raumtemperatur, Warmwasser und schnelles E-Auto-Laden' },
  { key: 'selfConsumption', label: 'Eigenverbrauch', shortLabel: 'Eigen', icon: Sun, color: '#3b82f6', description: 'Maximiert den Anteil selbst erzeugter Energie am Gesamtverbrauch' },
  { key: 'gridFriendly', label: 'Netzdienlich', shortLabel: 'Netz', icon: Zap, color: '#a855f7', description: 'Gl\u00e4ttet Lastspitzen und vermeidet hohe Bezugsleistung' },
]

const PRESETS: { name: string; description: string; weights: OptimizerWeights }[] = [
  {
    name: 'Ausgewogen',
    description: 'Gleichm\u00e4\u00dfige Gewichtung aller Ziele',
    weights: { co2Reduction: 60, economy: 60, comfort: 60, selfConsumption: 60, gridFriendly: 60 },
  },
  {
    name: 'Kostenoptimiert',
    description: 'Minimale Energiekosten, Komfort und CO\u2082 nachrangig',
    weights: { co2Reduction: 30, economy: 100, comfort: 40, selfConsumption: 70, gridFriendly: 20 },
  },
  {
    name: 'Klimafreundlich',
    description: 'Maximale CO\u2082-Einsparung und Eigenverbrauch',
    weights: { co2Reduction: 100, economy: 40, comfort: 50, selfConsumption: 90, gridFriendly: 50 },
  },
  {
    name: 'Maximaler Komfort',
    description: 'Raumklima und Warmwasser haben h\u00f6chste Priorit\u00e4t',
    weights: { co2Reduction: 40, economy: 50, comfort: 100, selfConsumption: 40, gridFriendly: 20 },
  },
  {
    name: 'Autark',
    description: 'M\u00f6glichst unabh\u00e4ngig vom Stromnetz',
    weights: { co2Reduction: 70, economy: 50, comfort: 50, selfConsumption: 100, gridFriendly: 40 },
  },
]

// SVG Radar chart dimensions
const CX = 200
const CY = 200
const R_MAX = 160
const RINGS = [20, 40, 60, 80, 100]

function polarToCart(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

function getAngle(i: number) {
  return (360 / AXES.length) * i
}

function getPointOnAxis(i: number, value: number) {
  const r = (value / 100) * R_MAX
  return polarToCart(getAngle(i), r)
}

interface RadarChartProps {
  weights: OptimizerWeights
  onChange: (key: keyof OptimizerWeights, value: number) => void
}

function RadarChart({ weights, onChange }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<keyof OptimizerWeights | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null)

  const handlePointerEvent = useCallback(
    (e: React.PointerEvent, axisKey: keyof OptimizerWeights, axisIndex: number) => {
      if (!svgRef.current) return
      const svg = svgRef.current
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      const dx = svgP.x - CX
      const dy = svgP.y - CY
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Project onto axis direction
      const angle = getAngle(axisIndex)
      const rad = ((angle - 90) * Math.PI) / 180
      const axisX = Math.cos(rad)
      const axisY = Math.sin(rad)
      const projection = dx * axisX + dy * axisY
      const projectedDist = Math.max(0, projection)

      const value = Math.round(Math.min(100, Math.max(0, (projectedDist / R_MAX) * 100)))
      onChange(axisKey, value)
    },
    [onChange],
  )

  const onPointerDown = (axisIndex: number) => (e: React.PointerEvent) => {
    const key = AXES[axisIndex].key
    setDragging(key)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    handlePointerEvent(e, key, axisIndex)
  }

  const onPointerMove = (axisIndex: number) => (e: React.PointerEvent) => {
    if (dragging === AXES[axisIndex].key) {
      handlePointerEvent(e, dragging, axisIndex)
    }
  }

  const onPointerUp = () => {
    setDragging(null)
  }

  // Build polygon points
  const polygonPoints = AXES.map((_, i) => {
    const p = getPointOnAxis(i, weights[AXES[i].key])
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 400"
      className="w-full max-w-lg mx-auto select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Background rings */}
      {RINGS.map((ringVal) => {
        const r = (ringVal / 100) * R_MAX
        const ringPoints = AXES.map((_, i) => {
          const p = polarToCart(getAngle(i), r)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <polygon
            key={ringVal}
            points={ringPoints}
            fill="none"
            stroke="#374151"
            strokeWidth={ringVal === 100 ? 1.5 : 0.5}
            opacity={0.6}
          />
        )
      })}

      {/* Ring labels */}
      {RINGS.map((ringVal) => {
        const r = (ringVal / 100) * R_MAX
        return (
          <text
            key={ringVal}
            x={CX + 4}
            y={CY - r + 4}
            fill="#6b7280"
            fontSize="9"
            opacity={0.6}
          >
            {ringVal}
          </text>
        )
      })}

      {/* Axis lines */}
      {AXES.map((axis, i) => {
        const end = polarToCart(getAngle(i), R_MAX)
        return (
          <line
            key={axis.key}
            x1={CX} y1={CY} x2={end.x} y2={end.y}
            stroke="#4b5563"
            strokeWidth={0.5}
          />
        )
      })}

      {/* Filled area */}
      <polygon
        points={polygonPoints}
        fill="url(#radarGradient)"
        stroke="#10b981"
        strokeWidth={2}
        opacity={0.85}
      />

      {/* Gradient */}
      <defs>
        <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.35} />
        </radialGradient>
      </defs>

      {/* Axis labels */}
      {AXES.map((axis, i) => {
        const labelR = R_MAX + 28
        const p = polarToCart(getAngle(i), labelR)
        const Icon = axis.icon
        const iconPos = polarToCart(getAngle(i), R_MAX + 14)
        const isHovered = hoveredAxis === i
        return (
          <g key={axis.key}>
            <foreignObject x={iconPos.x - 8} y={iconPos.y - 8} width={16} height={16}>
              <Icon
                style={{ width: 14, height: 14, color: axis.color }}
              />
            </foreignObject>
            <text
              x={p.x}
              y={p.y}
              fill={isHovered ? axis.color : '#d1d5db'}
              fontSize="12"
              fontWeight={isHovered ? 700 : 500}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {axis.shortLabel}
            </text>
          </g>
        )
      })}

      {/* Draggable control points */}
      {AXES.map((axis, i) => {
        const val = weights[axis.key]
        const p = getPointOnAxis(i, val)
        const isActive = dragging === axis.key || hoveredAxis === i
        return (
          <g key={axis.key}>
            {/* Invisible wider hit area along axis */}
            <line
              x1={CX} y1={CY} x2={polarToCart(getAngle(i), R_MAX).x} y2={polarToCart(getAngle(i), R_MAX).y}
              stroke="transparent"
              strokeWidth={24}
              style={{ cursor: 'pointer' }}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onPointerUp={onPointerUp}
              onPointerEnter={() => setHoveredAxis(i)}
              onPointerLeave={() => { if (!dragging) setHoveredAxis(null) }}
            />
            {/* Visible point */}
            <circle
              cx={p.x} cy={p.y}
              r={isActive ? 8 : 6}
              fill={axis.color}
              stroke="#1f2937"
              strokeWidth={2}
              style={{ cursor: 'grab', transition: 'r 0.15s' }}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onPointerUp={onPointerUp}
              onPointerEnter={() => setHoveredAxis(i)}
              onPointerLeave={() => { if (!dragging) setHoveredAxis(null) }}
            />
            {/* Value label */}
            {isActive && (
              <text
                x={p.x}
                y={p.y - 14}
                fill={axis.color}
                fontSize="12"
                fontWeight={700}
                textAnchor="middle"
              >
                {val}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function OptimizerPage() {
  const { settings, updateSettings } = useEnergyStore()
  const weights = settings.optimizerWeights ?? createDefaultOptimizerWeights()

  const [schedule, setSchedule] = useState<OptimizationSchedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const scheduleChartRef = useRef<HTMLDivElement>(null)
  const socChartRef = useRef<HTMLDivElement>(null)

  // Controller state
  const [ctrlStatus, setCtrlStatus] = useState<ControllerStatus | null>(null)
  const [ctrlHistory, setCtrlHistory] = useState<ControllerHistoryEntry[]>([])
  const deviationChartRef = useRef<HTMLDivElement>(null)

  const setWeight = (key: keyof OptimizerWeights, value: number) => {
    updateSettings({
      optimizerWeights: { ...weights, [key]: value },
    })
  }

  const applyPreset = (preset: OptimizerWeights) => {
    updateSettings({ optimizerWeights: { ...preset } })
  }

  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true)
    try {
      const data = await api.optimizer.schedule(24)
      setSchedule(data)
    } catch {
      setSchedule(null)
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  // Fetch schedule on mount and when weights change (debounced)
  useEffect(() => {
    const timer = setTimeout(fetchSchedule, 1000)
    return () => clearTimeout(timer)
  }, [weights.economy, weights.co2Reduction, weights.comfort, weights.selfConsumption, weights.gridFriendly])

  // Controller polling
  const fetchController = useCallback(async () => {
    try {
      const [status, hist] = await Promise.all([
        api.controller.status(),
        api.controller.history(48),
      ])
      setCtrlStatus(status)
      setCtrlHistory(hist.entries)
    } catch { /* backend may not be running */ }
  }, [])

  useEffect(() => {
    fetchController()
    const iv = setInterval(fetchController, 5000)
    return () => clearInterval(iv)
  }, [fetchController])

  const handleModeChange = async (mode: string) => {
    try {
      await api.controller.setMode(mode)
      fetchController()
    } catch { /* ignore */ }
  }

  // Render schedule charts
  useEffect(() => {
    if (!schedule?.hourly?.length) return
    let cancelled = false

    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled) return

      const times = schedule.hourly.map(h => h.time)

      // Power balance chart
      if (scheduleChartRef.current) {
        const traces: any[] = [
          {
            type: 'scatter', x: times, y: schedule.hourly.map(h => h.pv_forecast_kw),
            mode: 'lines', name: 'PV', line: { color: '#eab308', width: 2 },
            fill: 'tozeroy', fillcolor: 'rgba(234, 179, 8, 0.1)',
          },
          {
            type: 'scatter', x: times, y: schedule.hourly.map(h => h.load_forecast_kw),
            mode: 'lines', name: 'Last', line: { color: '#ef4444', width: 2 },
          },
          {
            type: 'bar', x: times, y: schedule.hourly.map(h => h.battery_setpoint_kw),
            name: 'Batterie', marker: {
              color: schedule.hourly.map(h => h.battery_setpoint_kw >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.5)'),
            },
          },
          {
            type: 'scatter', x: times, y: schedule.hourly.map(h => h.grid_kw),
            mode: 'lines', name: 'Netz', line: { color: '#3b82f6', width: 1.5, dash: 'dot' },
          },
        ]
        const layout: Record<string, any> = {
          font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
          paper_bgcolor: '#0d1117', plot_bgcolor: '#161b22',
          margin: { t: 10, l: 50, r: 20, b: 40 }, height: 300,
          legend: { orientation: 'h', y: -0.18, x: 0.5, xanchor: 'center', font: { size: 11 } },
          hovermode: 'x unified',
          hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
          xaxis: { type: 'date', gridcolor: '#21262d', linecolor: '#30363d', tickfont: { size: 10 } },
          yaxis: {
            title: 'kW', gridcolor: '#21262d', linecolor: '#30363d', zeroline: true,
            zerolinecolor: '#4b5563',
          },
          barmode: 'relative',
        }
        Plotly!.newPlot(scheduleChartRef.current, traces, layout, { responsive: true, displayModeBar: false })
      }

      // SOC + Cost chart
      if (socChartRef.current) {
        const traces: any[] = [
          {
            type: 'scatter', x: times, y: schedule.hourly.map(h => h.battery_soc_pct),
            mode: 'lines', name: 'SOC %', line: { color: '#22c55e', width: 2 },
            fill: 'tozeroy', fillcolor: 'rgba(34, 197, 94, 0.08)',
          },
          {
            type: 'bar', x: times, y: schedule.hourly.map(h => h.cost_ct),
            name: 'Kosten ct', yaxis: 'y2',
            marker: {
              color: schedule.hourly.map(h => h.cost_ct >= 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'),
            },
          },
        ]
        const layout: Record<string, any> = {
          font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
          paper_bgcolor: '#0d1117', plot_bgcolor: '#161b22',
          margin: { t: 10, l: 50, r: 50, b: 40 }, height: 250,
          legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 11 } },
          hovermode: 'x unified',
          hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
          xaxis: { type: 'date', gridcolor: '#21262d', linecolor: '#30363d', tickfont: { size: 10 } },
          yaxis: { title: '%', gridcolor: '#21262d', linecolor: '#30363d', range: [0, 100], titlefont: { color: '#22c55e' } },
          yaxis2: { title: 'ct', overlaying: 'y', side: 'right', gridcolor: '#21262d', zeroline: true, zerolinecolor: '#4b5563', titlefont: { color: '#ef4444' } },
        }
        Plotly!.newPlot(socChartRef.current, traces, layout, { responsive: true, displayModeBar: false })
      }
    }

    render()
    return () => {
      cancelled = true
      if (scheduleChartRef.current && Plotly) try { Plotly.purge(scheduleChartRef.current) } catch {}
      if (socChartRef.current && Plotly) try { Plotly.purge(socChartRef.current) } catch {}
    }
  }, [schedule])

  // Render deviation chart
  useEffect(() => {
    if (!ctrlHistory.length) return
    let cancelled = false

    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled || !deviationChartRef.current) return

      const times = ctrlHistory.map(h => h.timestamp)
      const traces: any[] = [
        {
          type: 'scatter', x: times, y: ctrlHistory.map(h => h.setpoint_battery_kw),
          mode: 'lines', name: 'Soll Bat.', line: { color: '#22c55e', width: 2 },
        },
        {
          type: 'scatter', x: times, y: ctrlHistory.map(h => h.actual_battery_kw),
          mode: 'lines', name: 'Ist Bat.', line: { color: '#22c55e', width: 1, dash: 'dot' },
        },
        {
          type: 'scatter', x: times, y: ctrlHistory.map(h => h.setpoint_hp_kw),
          mode: 'lines', name: 'Soll WP', line: { color: '#f97316', width: 2 },
        },
        {
          type: 'scatter', x: times, y: ctrlHistory.map(h => h.actual_hp_kw),
          mode: 'lines', name: 'Ist WP', line: { color: '#f97316', width: 1, dash: 'dot' },
        },
        {
          type: 'bar', x: times, y: ctrlHistory.map(h => h.deviation_pct),
          name: 'Abweichung %', yaxis: 'y2',
          marker: { color: ctrlHistory.map(h => h.deviation_pct > 20 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.3)') },
        },
      ]
      const layout: Record<string, any> = {
        font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
        paper_bgcolor: '#0d1117', plot_bgcolor: '#161b22',
        margin: { t: 10, l: 50, r: 50, b: 40 }, height: 250,
        legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 11 } },
        hovermode: 'x unified',
        hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
        xaxis: { type: 'date', gridcolor: '#21262d', linecolor: '#30363d', tickfont: { size: 10 } },
        yaxis: { title: 'kW', gridcolor: '#21262d', linecolor: '#30363d' },
        yaxis2: { title: '%', overlaying: 'y', side: 'right', gridcolor: '#21262d', range: [0, 100] },
      }
      Plotly!.newPlot(deviationChartRef.current, traces, layout, { responsive: true, displayModeBar: false })
    }

    render()
    return () => {
      cancelled = true
      if (deviationChartRef.current && Plotly) try { Plotly.purge(deviationChartRef.current) } catch {}
    }
  }, [ctrlHistory])

  const s = schedule?.summary

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-7 h-7 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Optimierer</h1>
          <p className="text-sm text-dark-faded">Zielvorgaben f&uuml;r die Energieoptimierung</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Section title="Optimierungsziele" icon={<Target className="w-4 h-4 text-emerald-400" />} defaultOpen={true}>
          <div className="bg-dark-hover rounded-xl border border-dark-border p-4">
            <RadarChart weights={weights} onChange={setWeight} />
            <p className="text-xs text-dark-faded text-center mt-2">
              Punkte auf den Achsen ziehen um die Gewichtung anzupassen
            </p>
          </div>

          {/* Reset */}
          <div className="flex justify-end mt-3">
            <button
              onClick={() => applyPreset(createDefaultOptimizerWeights())}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <RotateCcw className="w-3 h-3" /> Zur&uuml;cksetzen
            </button>
          </div>
        </Section>

        {/* Slider + Details */}
        <div className="space-y-4">
          <Section title="Feineinstellung" icon={<Info className="w-4 h-4 text-cyan-400" />} defaultOpen={true}>
            <div className="space-y-4">
              {AXES.map((axis) => {
                const val = weights[axis.key]
                const Icon = axis.icon
                return (
                  <div key={axis.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: axis.color }} />
                        <span className="text-sm font-medium text-dark-text">{axis.label}</span>
                      </div>
                      <span className="text-sm font-mono font-bold" style={{ color: axis.color }}>{val}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={val}
                      onChange={(e) => setWeight(axis.key, Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${axis.color} 0%, ${axis.color} ${val}%, #374151 ${val}%, #374151 100%)`,
                      }}
                    />
                    <p className="text-xs text-dark-faded mt-0.5">{axis.description}</p>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Vorlagen" icon={<Target className="w-4 h-4 text-amber-400" />} defaultOpen={true}>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((preset) => {
                const isActive = AXES.every((a) => weights[a.key] === preset.weights[a.key])
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset.weights)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-dark-border bg-dark-hover hover:border-dark-faded'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isActive ? 'text-emerald-400' : 'text-dark-text'}`}>
                        {preset.name}
                      </span>
                      {isActive && <span className="text-xs text-emerald-400">Aktiv</span>}
                    </div>
                    <p className="text-xs text-dark-faded mt-0.5">{preset.description}</p>
                  </button>
                )
              })}
            </div>
          </Section>
        </div>
      </div>

      {/* === Fahrplan === */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-dark-text">Einsatzfahrplan (24h)</h2>
            {schedule && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {schedule.strategy}
              </span>
            )}
          </div>
          <button onClick={fetchSchedule} disabled={scheduleLoading} className="btn-primary flex items-center gap-2 text-sm">
            {scheduleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            Neu berechnen
          </button>
        </div>

        {schedule?.strategy_description && (
          <p className="text-xs text-dark-faded">{schedule.strategy_description}</p>
        )}

        {/* KPI Cards */}
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-dark-faded">Kosten</span>
              </div>
              <span className="text-lg font-bold text-yellow-400">
                {(s.net_cost_ct / 100).toFixed(2)} &euro;
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Leaf className="w-4 h-4 text-green-400" />
                <span className="text-xs text-dark-faded">CO&sup2;</span>
              </div>
              <span className="text-lg font-bold text-green-400">{s.total_co2_kg.toFixed(1)} kg</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-dark-faded">Eigenverbr.</span>
              </div>
              <span className="text-lg font-bold text-amber-400">{s.avg_self_consumption_pct.toFixed(0)} %</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-dark-faded">PV-Ertrag</span>
              </div>
              <span className="text-lg font-bold text-blue-400">{s.total_pv_kwh.toFixed(1)} kWh</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-dark-faded">Netzbezug</span>
              </div>
              <span className="text-lg font-bold text-red-400">{s.total_grid_import_kwh.toFixed(1)} kWh</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-dark-faded">Bat. Zyklen</span>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                {s.total_battery_charged_kwh.toFixed(1)} kWh
              </span>
            </div>
          </div>
        )}

        {/* Schedule Power Chart */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-dark-text mb-2">Leistungsbilanz</h3>
          <div ref={scheduleChartRef} style={{ minHeight: 300 }} />
          {scheduleLoading && !schedule && (
            <div className="flex items-center justify-center h-[300px] text-dark-faded">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Fahrplan wird berechnet...
            </div>
          )}
        </div>

        {/* SOC + Cost Chart */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-dark-text mb-2">Batterie-SOC & Kosten</h3>
          <div ref={socChartRef} style={{ minHeight: 250 }} />
        </div>

        {/* Hourly Strategy Table */}
        {schedule?.hourly && schedule.hourly.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-medium text-dark-text mb-3">Stundenstrategie</h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-dark-card">
                  <tr className="border-b border-dark-border text-dark-faded">
                    <th className="text-left py-2 px-2">Zeit</th>
                    <th className="text-right px-2">PV</th>
                    <th className="text-right px-2">Last</th>
                    <th className="text-right px-2">Batterie</th>
                    <th className="text-right px-2">SOC</th>
                    <th className="text-right px-2">Netz</th>
                    <th className="text-right px-2">Kosten</th>
                    <th className="text-left px-2">Strategie</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.hourly.map((h) => (
                    <tr key={h.time} className="border-b border-dark-border/30 hover:bg-dark-hover/50">
                      <td className="py-1.5 px-2 text-dark-muted tabular-nums">{h.time.slice(11, 16)}</td>
                      <td className="text-right px-2 text-yellow-400 tabular-nums">{h.pv_forecast_kw.toFixed(1)}</td>
                      <td className="text-right px-2 text-red-400 tabular-nums">{h.load_forecast_kw.toFixed(1)}</td>
                      <td className={`text-right px-2 tabular-nums ${h.battery_setpoint_kw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {h.battery_setpoint_kw > 0 ? '+' : ''}{h.battery_setpoint_kw.toFixed(1)}
                      </td>
                      <td className="text-right px-2 text-emerald-400 tabular-nums">{h.battery_soc_pct.toFixed(0)}%</td>
                      <td className={`text-right px-2 tabular-nums ${h.grid_kw > 0 ? 'text-blue-400' : 'text-cyan-400'}`}>
                        {h.grid_kw > 0 ? '+' : ''}{h.grid_kw.toFixed(1)}
                      </td>
                      <td className={`text-right px-2 tabular-nums ${h.cost_ct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {h.cost_ct.toFixed(1)} ct
                      </td>
                      <td className="px-2 text-dark-faded truncate max-w-[200px]">{h.strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* === Controller (Regelung) === */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-dark-text">Regelung</h2>
          {ctrlStatus?.safety_active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> {ctrlStatus.safety_active}
            </span>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-dark-text mb-3">Betriebsmodus</h3>
          <div className="grid grid-cols-3 gap-3">
            {([
              { mode: 'auto', icon: Play, label: 'Automatik', desc: 'Fahrplan wird automatisch ausgefuehrt', color: 'emerald' },
              { mode: 'manual', icon: Hand, label: 'Manuell', desc: 'Nur manuelle Overrides, kein Fahrplan', color: 'amber' },
              { mode: 'off', icon: Power, label: 'Aus', desc: 'Simulator laeuft mit eigener Heuristik', color: 'gray' },
            ] as const).map(({ mode, icon: Icon, label, desc, color }) => {
              const isActive = ctrlStatus?.mode === mode
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    isActive
                      ? `border-${color}-500 bg-${color}-500/10`
                      : 'border-dark-border bg-dark-hover hover:border-dark-faded'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isActive ? `text-${color}-400` : 'text-dark-faded'}`} />
                    <span className={`text-sm font-medium ${isActive ? `text-${color}-400` : 'text-dark-text'}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-dark-faded">{desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Active Setpoints */}
        {ctrlStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Battery className="w-4 h-4 text-green-400" />
                <span className="text-xs text-dark-faded">Batterie</span>
              </div>
              <span className={`text-lg font-bold ${ctrlStatus.active_setpoints.battery_kw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {ctrlStatus.active_setpoints.battery_kw > 0 ? '+' : ''}{ctrlStatus.active_setpoints.battery_kw.toFixed(1)} kW
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-dark-faded">WP Modul.</span>
              </div>
              <span className="text-lg font-bold text-orange-400">
                {ctrlStatus.active_setpoints.hp_modulation_pct.toFixed(0)} %
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Thermometer className="w-4 h-4 text-red-400" />
                <span className="text-xs text-dark-faded">WP therm.</span>
              </div>
              <span className="text-lg font-bold text-red-400">
                {ctrlStatus.active_setpoints.hp_thermal_kw.toFixed(1)} kW
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-dark-faded">Kessel</span>
              </div>
              <span className="text-lg font-bold text-amber-400">
                {ctrlStatus.active_setpoints.boiler_kw.toFixed(1)} kW
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-dark-faded">Vorlauf</span>
              </div>
              <span className="text-lg font-bold text-cyan-400">
                {ctrlStatus.active_setpoints.flow_temp_c.toFixed(0)} °C
              </span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Settings2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-dark-faded">Quelle</span>
              </div>
              <span className="text-sm font-medium text-purple-400">
                {ctrlStatus.active_setpoints.source}
              </span>
              <p className="text-xs text-dark-faded truncate">{ctrlStatus.active_setpoints.strategy}</p>
            </div>
          </div>
        )}

        {/* Controller Info */}
        {ctrlStatus && (
          <div className="card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-dark-faded">Fahrplan geladen</span>
                <span className={`ml-2 font-medium ${ctrlStatus.schedule_loaded ? 'text-emerald-400' : 'text-dark-faded'}`}>
                  {ctrlStatus.schedule_loaded ? `Ja (${ctrlStatus.schedule_hours}h)` : 'Nein'}
                </span>
              </div>
              <div>
                <span className="text-dark-faded">Abweichung (1h)</span>
                <span className={`ml-2 font-medium ${ctrlStatus.avg_deviation_pct > 20 ? 'text-red-400' : ctrlStatus.avg_deviation_pct > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {ctrlStatus.avg_deviation_pct.toFixed(1)} %
                </span>
              </div>
              <div>
                <span className="text-dark-faded">Historie-Eintraege</span>
                <span className="ml-2 font-medium text-dark-text">{ctrlStatus.history_count}</span>
              </div>
              <div>
                <span className="text-dark-faded">Sicherheit</span>
                <span className={`ml-2 font-medium ${ctrlStatus.safety_active ? 'text-red-400' : 'text-emerald-400'}`}>
                  {ctrlStatus.safety_active || 'Inaktiv'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deviation Chart */}
        {ctrlHistory.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-medium text-dark-text mb-2">Soll-Ist-Vergleich</h3>
            <div ref={deviationChartRef} style={{ minHeight: 250 }} />
          </div>
        )}
      </div>
    </div>
  )
}
