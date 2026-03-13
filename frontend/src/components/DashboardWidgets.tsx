import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Cloud, Sun, Droplets, Wind, Thermometer, Zap,
  CloudRain, Snowflake, CloudLightning, CloudFog,
  ArrowRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { api } from '../api/client'
import type { WeatherCurrent, PvForecastResponse } from '../types'

// WMO Weather Code -> Icon
const WMO_ICONS: Record<number, typeof Sun> = {
  0: Sun, 1: Sun, 2: Cloud, 3: Cloud,
  45: CloudFog, 48: CloudFog,
  51: CloudRain, 53: CloudRain, 55: CloudRain,
  61: CloudRain, 63: CloudRain, 65: CloudRain,
  71: Snowflake, 73: Snowflake, 75: Snowflake,
  80: CloudRain, 81: CloudRain, 82: CloudRain,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
}

const WMO_LABELS: Record<number, string> = {
  0: 'Klar', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt',
  45: 'Nebel', 48: 'Nebel', 51: 'Nieselregen', 53: 'Nieselregen', 55: 'Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starkregen',
  71: 'Schneefall', 73: 'Schneefall', 75: 'Schneefall',
  80: 'Schauer', 81: 'Schauer', 82: 'Starker Schauer',
  95: 'Gewitter', 96: 'Gewitter', 99: 'Gewitter',
}

// Mini-Sparkline (SVG)
function Sparkline({ values, color, height = 40, width = 120 }: {
  values: number[]
  color: string
  height?: number
  width?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface TrendMiniData {
  pv: number[]
  load: number[]
  battery_soc: number[]
  grid: number[]
  timestamps: string[]
}

export default function DashboardWidgets() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null)
  const [pvForecast, setPvForecast] = useState<PvForecastResponse | null>(null)
  const [trendMini, setTrendMini] = useState<TrendMiniData | null>(null)
  const [dailyKpis, setDailyKpis] = useState<{
    pvKwh: number; importKwh: number; exportKwh: number; autarkyPct: number
  } | null>(null)

  const fetchAll = useCallback(async () => {
    // Weather + PV Forecast
    const [w, pv] = await Promise.all([
      api.weather.current().catch(() => null),
      api.weather.pvForecast(48).catch(() => null),
    ])
    setWeather(w)
    setPvForecast(pv)

    // 24h trend data for sparklines + KPIs
    try {
      const tr = await api.trends.timeRange()
      if (tr.max && tr.count > 0) {
        const endTime = new Date(tr.max.replace(' ', 'T'))
        const startTime = new Date(endTime.getTime() - 24 * 3600e3)
        const sources = 'pv.power_kw,load.power_kw,battery.soc_pct,grid.power_kw'

        const [trendData, stats] = await Promise.all([
          api.trends.data({
            sources, from: startTime.toISOString(), to: endTime.toISOString(), interval: '15min',
          }),
          api.trends.statistics({
            sources: 'pv.power_kw,grid.import_kwh,grid.export_kwh,system.self_sufficiency_pct',
            from: startTime.toISOString(), to: endTime.toISOString(),
          }),
        ])

        setTrendMini({
          pv: trendData['pv.power_kw']?.values || [],
          load: trendData['load.power_kw']?.values || [],
          battery_soc: trendData['battery.soc_pct']?.values || [],
          grid: trendData['grid.power_kw']?.values || [],
          timestamps: trendData['pv.power_kw']?.timestamps || [],
        })

        // KPIs from statistics
        const pvStats = stats['pv.power_kw']
        const importStats = stats['grid.import_kwh']
        const exportStats = stats['grid.export_kwh']
        const autarkyStats = stats['system.self_sufficiency_pct']

        if (pvStats) {
          // Approximate kWh: avg_kw * 24h (for the period)
          setDailyKpis({
            pvKwh: pvStats.avg * 24,
            importKwh: importStats ? importStats.max - importStats.min : 0,
            exportKwh: exportStats ? exportStats.max - exportStats.min : 0,
            autarkyPct: autarkyStats ? autarkyStats.avg : 0,
          })
        }
      }
    } catch {
      // Trend data not available
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const WeatherIcon = weather ? (WMO_ICONS[weather.weather_code] || Cloud) : Cloud
  const weatherLabel = weather ? (WMO_LABELS[weather.weather_code] || `Code ${weather.weather_code}`) : ''

  // Daily PV forecast sums
  const dailySums = pvForecast?.daily_summary
    ? Object.entries(pvForecast.daily_summary).slice(0, 3)
    : []
  const dayLabels: Record<number, string> = { 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' }

  return (
    <div className="space-y-4">
      {/* Row 1: Weather + PV Forecast + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Weather Card */}
        <Link to="/weather" className="card p-4 hover:border-dark-faded transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <WeatherIcon className="w-5 h-5 text-sky-400" />
              <span className="text-xs text-dark-faded">Wetter</span>
            </div>
            <ArrowRight className="w-3 h-3 text-dark-faded opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {weather ? (
            <>
              <div className="text-xl font-bold text-dark-text">
                {weather.temperature_c?.toFixed(1)}°C
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-dark-faded">
                <span>{weatherLabel}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-dark-faded">
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" /> {weather.wind_speed_ms?.toFixed(1)} m/s
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> {weather.humidity_pct?.toFixed(0)}%
                </span>
                <span className="flex items-center gap-1">
                  <Sun className="w-3 h-3" /> {weather.ghi_wm2?.toFixed(0)} W/m²
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-dark-faded mt-2">Laden...</div>
          )}
        </Link>

        {/* PV Forecast Daily */}
        {dailySums.length > 0 ? dailySums.slice(0, 2).map(([day, kwh], i) => (
          <Link key={day} to="/weather" className="card p-4 hover:border-dark-faded transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-xs text-dark-faded">PV {dayLabels[i] || day}</span>
              </div>
              <ArrowRight className="w-3 h-3 text-dark-faded opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-yellow-400">{kwh}</span>
              <span className="text-xs text-dark-faded">kWh</span>
            </div>
            {pvForecast && (
              <div className="text-xs text-dark-faded mt-1">
                {pvForecast.total_peak_kwp} kWp installiert
              </div>
            )}
          </Link>
        )) : (
          // Placeholder if no PV forecast
          <div className="card p-4 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400/50" />
              <span className="text-xs text-dark-faded">PV-Prognose</span>
            </div>
            <div className="text-sm text-dark-faded">Keine PV-Daten verfügbar</div>
          </div>
        )}

        {/* Daily KPIs */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-5 h-5 text-emerald-400" />
            <span className="text-xs text-dark-faded">Tages-KPIs (24h)</span>
          </div>
          {dailyKpis ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-dark-faded">Autarkie</span>
                <span className="text-emerald-400 font-medium">{dailyKpis.autarkyPct.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-faded">PV-Ertrag</span>
                <span className="text-yellow-400 font-medium">{dailyKpis.pvKwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-faded">Bezug</span>
                <span className="text-red-400 font-medium">{dailyKpis.importKwh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-faded">Einspeisung</span>
                <span className="text-blue-400 font-medium">{dailyKpis.exportKwh.toFixed(1)} kWh</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-dark-faded mt-2">Keine Daten</div>
          )}
        </div>
      </div>

      {/* Row 2: Sparklines */}
      {trendMini && trendMini.pv.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/trends" className="card p-3 hover:border-dark-faded transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-dark-faded mb-1">PV (24h)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-yellow-400">
                    {trendMini.pv[trendMini.pv.length - 1]?.toFixed(1)}
                  </span>
                  <span className="text-xs text-dark-faded">kW</span>
                </div>
              </div>
              <Sparkline values={trendMini.pv} color="#eab308" />
            </div>
          </Link>

          <Link to="/trends" className="card p-3 hover:border-dark-faded transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-dark-faded mb-1">Last (24h)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-blue-400">
                    {trendMini.load[trendMini.load.length - 1]?.toFixed(1)}
                  </span>
                  <span className="text-xs text-dark-faded">kW</span>
                </div>
              </div>
              <Sparkline values={trendMini.load} color="#3b82f6" />
            </div>
          </Link>

          <Link to="/trends" className="card p-3 hover:border-dark-faded transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-dark-faded mb-1">Batterie SOC (24h)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-purple-400">
                    {trendMini.battery_soc[trendMini.battery_soc.length - 1]?.toFixed(0)}
                  </span>
                  <span className="text-xs text-dark-faded">%</span>
                </div>
              </div>
              <Sparkline values={trendMini.battery_soc} color="#8b5cf6" />
            </div>
          </Link>

          <Link to="/trends" className="card p-3 hover:border-dark-faded transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-dark-faded mb-1">Netz (24h)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-red-400">
                    {trendMini.grid[trendMini.grid.length - 1]?.toFixed(1)}
                  </span>
                  <span className="text-xs text-dark-faded">kW</span>
                  {(() => {
                    const last = trendMini.grid[trendMini.grid.length - 1] ?? 0
                    if (last > 0.5) return <TrendingDown className="w-3 h-3 text-red-400 ml-1" />
                    if (last < -0.5) return <TrendingUp className="w-3 h-3 text-emerald-400 ml-1" />
                    return <Minus className="w-3 h-3 text-dark-faded ml-1" />
                  })()}
                </div>
              </div>
              <Sparkline values={trendMini.grid} color="#ef4444" />
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
