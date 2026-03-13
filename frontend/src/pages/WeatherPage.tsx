import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Cloud, Sun, Droplets, Wind, Thermometer, Eye,
  RefreshCw, AlertTriangle, Zap, CloudRain, Snowflake,
  CloudLightning, CloudFog, Camera,
} from 'lucide-react'
import { api } from '../api/client'
import type { WeatherCurrent, WeatherForecast, PvForecastResponse } from '../types'

let Plotly: typeof import('plotly.js-dist-min') | null = null

// WMO Weather Codes -> German labels + icons
const WMO_CODES: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: 'Klar', icon: Sun },
  1: { label: 'Überwiegend klar', icon: Sun },
  2: { label: 'Teilweise bewölkt', icon: Cloud },
  3: { label: 'Bedeckt', icon: Cloud },
  45: { label: 'Nebel', icon: CloudFog },
  48: { label: 'Nebel (Reif)', icon: CloudFog },
  51: { label: 'Leichter Nieselregen', icon: CloudRain },
  53: { label: 'Nieselregen', icon: CloudRain },
  55: { label: 'Starker Nieselregen', icon: CloudRain },
  61: { label: 'Leichter Regen', icon: CloudRain },
  63: { label: 'Regen', icon: CloudRain },
  65: { label: 'Starkregen', icon: CloudRain },
  71: { label: 'Leichter Schneefall', icon: Snowflake },
  73: { label: 'Schneefall', icon: Snowflake },
  75: { label: 'Starker Schneefall', icon: Snowflake },
  80: { label: 'Regenschauer', icon: CloudRain },
  81: { label: 'Mäßiger Schauer', icon: CloudRain },
  82: { label: 'Starker Schauer', icon: CloudRain },
  95: { label: 'Gewitter', icon: CloudLightning },
  96: { label: 'Gewitter mit Hagel', icon: CloudLightning },
  99: { label: 'Schweres Gewitter', icon: CloudLightning },
}

function getWeatherInfo(code: number) {
  return WMO_CODES[code] || { label: `Code ${code}`, icon: Cloud }
}

export default function WeatherPage() {
  const [current, setCurrent] = useState<WeatherCurrent | null>(null)
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [pvForecast, setPvForecast] = useState<PvForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const weatherChartRef = useRef<HTMLDivElement>(null)
  const pvChartRef = useRef<HTMLDivElement>(null)
  const [chartsRendered, setChartsRendered] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [cur, fc, pv] = await Promise.all([
        api.weather.current().catch(() => null),
        api.weather.forecast(72).catch(() => null),
        api.weather.pvForecast(72).catch(() => null),
      ])
      setCurrent(cur)
      setForecast(fc as WeatherForecast | null)
      setPvForecast(pv)
    } catch (e: any) {
      setError(e.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Render charts
  useEffect(() => {
    if (!forecast?.hourly?.length) return
    let cancelled = false

    const render = async () => {
      if (!Plotly) Plotly = await import('plotly.js-dist-min')
      if (cancelled) return

      const h = forecast.hourly
      const times = h.map(d => d.time)

      // Weather chart: Temperature + GHI + Cloud cover
      if (weatherChartRef.current) {
        const traces: any[] = [
          {
            type: 'scatter', x: times, y: h.map(d => d.temperature_c),
            mode: 'lines', name: 'Temperatur °C',
            line: { color: '#ef4444', width: 2 }, yaxis: 'y',
            hovertemplate: '<b>Temperatur</b>: %{y:.1f} °C<extra></extra>',
          },
          {
            type: 'scatter', x: times, y: h.map(d => d.ghi_wm2),
            mode: 'lines', name: 'Einstrahlung W/m²',
            line: { color: '#eab308', width: 2 }, yaxis: 'y2',
            hovertemplate: '<b>GHI</b>: %{y:.0f} W/m²<extra></extra>',
          },
          {
            type: 'bar', x: times, y: h.map(d => d.precipitation_mm),
            name: 'Niederschlag mm', marker: { color: '#3b82f6', opacity: 0.5 },
            yaxis: 'y3',
            hovertemplate: '<b>Niederschlag</b>: %{y:.1f} mm<extra></extra>',
          },
        ]
        const layout: Record<string, any> = {
          font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
          paper_bgcolor: '#0d1117', plot_bgcolor: '#161b22',
          margin: { t: 10, l: 55, r: 55, b: 40 }, height: 350,
          legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: 11 } },
          hovermode: 'x unified',
          hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
          xaxis: { type: 'date', gridcolor: '#21262d', linecolor: '#30363d', tickfont: { size: 10 } },
          yaxis: {
            title: '°C', gridcolor: '#21262d', linecolor: '#30363d', zeroline: false,
            titlefont: { color: '#ef4444' },
          },
          yaxis2: {
            title: 'W/m²', overlaying: 'y', side: 'right',
            gridcolor: '#21262d', linecolor: '#30363d', zeroline: false,
            titlefont: { color: '#eab308' }, rangemode: 'tozero',
          },
          yaxis3: {
            title: 'mm', overlaying: 'y', side: 'right', position: 0.95,
            showgrid: false, zeroline: false, visible: false,
            rangemode: 'tozero',
          },
        }
        Plotly!.newPlot(weatherChartRef.current, traces, layout, {
          responsive: true, displayModeBar: false,
        })
      }

      // PV Forecast chart
      if (pvChartRef.current && pvForecast?.hourly?.length) {
        const pvTimes = pvForecast.hourly.map(d => d.time)
        const traces: any[] = [
          {
            type: 'scatter', x: pvTimes, y: pvForecast.hourly.map(d => d.power_kw),
            mode: 'lines', name: 'PV-Prognose kW',
            line: { color: '#eab308', width: 2 },
            fill: 'tozeroy', fillcolor: 'rgba(234, 179, 8, 0.15)',
            hovertemplate: '<b>PV</b>: %{y:.2f} kW<extra></extra>',
          },
          {
            type: 'scatter', x: pvTimes, y: pvForecast.hourly.map(d => d.ghi_wm2),
            mode: 'lines', name: 'GHI W/m²',
            line: { color: '#f97316', width: 1, dash: 'dot' }, yaxis: 'y2',
            hovertemplate: '<b>GHI</b>: %{y:.0f} W/m²<extra></extra>',
          },
        ]
        const layout: Record<string, any> = {
          font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
          paper_bgcolor: '#0d1117', plot_bgcolor: '#161b22',
          margin: { t: 10, l: 55, r: 55, b: 40 }, height: 350,
          legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: 11 } },
          hovermode: 'x unified',
          hoverlabel: { bgcolor: '#1c2128', bordercolor: '#30363d', font: { size: 12, color: '#e6edf3' } },
          xaxis: { type: 'date', gridcolor: '#21262d', linecolor: '#30363d', tickfont: { size: 10 } },
          yaxis: {
            title: 'kW', gridcolor: '#21262d', linecolor: '#30363d', zeroline: false,
            rangemode: 'tozero', titlefont: { color: '#eab308' },
          },
          yaxis2: {
            title: 'W/m²', overlaying: 'y', side: 'right',
            gridcolor: '#21262d', linecolor: '#30363d', zeroline: false,
            rangemode: 'tozero', titlefont: { color: '#f97316' },
          },
        }
        Plotly!.newPlot(pvChartRef.current, traces, layout, {
          responsive: true, displayModeBar: false,
        })
      }

      setChartsRendered(true)
    }

    render()
    return () => {
      cancelled = true
      if (weatherChartRef.current && Plotly) try { Plotly.purge(weatherChartRef.current) } catch {}
      if (pvChartRef.current && Plotly) try { Plotly.purge(pvChartRef.current) } catch {}
      setChartsRendered(false)
    }
  }, [forecast, pvForecast])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.weather.refresh()
      await fetchData()
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportPng = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, name: string) => {
    if (!ref.current || !Plotly) return
    const dataUrl = await (Plotly as any).toImage(ref.current, {
      format: 'png', width: 1200, height: 600, scale: 2,
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${name}.png`
    a.click()
  }, [])

  const weatherInfo = current ? getWeatherInfo(current.weather_code) : null
  const WeatherIcon = weatherInfo?.icon || Cloud

  // Daily energy sums
  const dailySummary = pvForecast?.daily_summary
    ? Object.entries(pvForecast.daily_summary).slice(0, 3)
    : []

  const dayLabels: Record<number, string> = { 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="w-7 h-7 text-sky-400" />
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Wetter & PV-Prognose</h1>
            {current?.updated_at && (
              <p className="text-xs text-dark-faded">
                Aktualisiert: {new Date(current.updated_at).toLocaleString('de-DE')}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !current && (
        <div className="text-center py-12 text-dark-faded">Wetterdaten werden geladen...</div>
      )}

      {/* Current Weather Cards */}
      {current && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <WeatherIcon className="w-5 h-5 text-sky-400" />
              <span className="text-xs text-dark-faded">Wetter</span>
            </div>
            <div className="text-lg font-bold text-dark-text">{weatherInfo?.label}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-5 h-5 text-red-400" />
              <span className="text-xs text-dark-faded">Temperatur</span>
            </div>
            <div className="text-lg font-bold text-dark-text">
              {current.temperature_c?.toFixed(1)} °C
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-dark-faded">Luftfeuchtigkeit</span>
            </div>
            <div className="text-lg font-bold text-dark-text">
              {current.humidity_pct?.toFixed(0)} %
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-5 h-5 text-emerald-400" />
              <span className="text-xs text-dark-faded">Wind</span>
            </div>
            <div className="text-lg font-bold text-dark-text">
              {current.wind_speed_ms?.toFixed(1)} m/s
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-5 h-5 text-purple-400" />
              <span className="text-xs text-dark-faded">Bewölkung</span>
            </div>
            <div className="text-lg font-bold text-dark-text">
              {current.cloud_cover_pct?.toFixed(0)} %
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-dark-faded">Einstrahlung</span>
            </div>
            <div className="text-lg font-bold text-dark-text">
              {current.ghi_wm2?.toFixed(0)} W/m²
            </div>
          </div>
        </div>
      )}

      {/* Weather Forecast Chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-text">Wettervorhersage (72h)</h3>
          {chartsRendered && (
            <button
              onClick={() => handleExportPng(weatherChartRef, 'wettervorhersage')}
              className="p-1.5 rounded bg-dark-hover/80 text-dark-faded hover:text-dark-text border border-dark-border/50 transition-colors"
              title="Als PNG speichern"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>
        <div ref={weatherChartRef} style={{ minHeight: 350 }} />
        {!forecast?.hourly?.length && !loading && (
          <div className="flex items-center justify-center h-[350px] text-dark-faded text-sm">
            Keine Wetterdaten verfügbar. Standort in Einstellungen konfiguriert?
          </div>
        )}
      </div>

      {/* PV Forecast */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-medium text-dark-text">PV-Ertragsprognose</h3>
            {pvForecast && (
              <span className="text-xs text-dark-faded">
                {pvForecast.total_peak_kwp} kWp installiert
              </span>
            )}
          </div>
          {chartsRendered && (
            <button
              onClick={() => handleExportPng(pvChartRef, 'pv_prognose')}
              className="p-1.5 rounded bg-dark-hover/80 text-dark-faded hover:text-dark-text border border-dark-border/50 transition-colors"
              title="Als PNG speichern"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>
        <div ref={pvChartRef} style={{ minHeight: 350 }} />
        {pvForecast?.error && (
          <div className="text-center py-4 text-amber-400 text-sm">{pvForecast.error}</div>
        )}
        {!pvForecast?.hourly?.length && !pvForecast?.error && !loading && (
          <div className="flex items-center justify-center h-[350px] text-dark-faded text-sm">
            Keine PV-Anlagen konfiguriert.
          </div>
        )}
      </div>

      {/* Daily Energy Summary */}
      {dailySummary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {dailySummary.map(([day, kwh], i) => (
            <div key={day} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-dark-faded">{dayLabels[i] || day}</span>
                <span className="text-xs text-dark-faded">{day}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-yellow-400">{kwh}</span>
                <span className="text-sm text-dark-faded">kWh</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PV Panels Info */}
      {pvForecast?.panels && pvForecast.panels.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-medium text-dark-faded uppercase tracking-wide mb-3">
            PV-Anlagen
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-2 pr-4 text-dark-faded font-medium">Name</th>
                  <th className="text-right py-2 px-3 text-dark-faded font-medium">Leistung</th>
                  <th className="text-right py-2 px-3 text-dark-faded font-medium">Neigung</th>
                  <th className="text-right py-2 px-3 text-dark-faded font-medium">Ausrichtung</th>
                </tr>
              </thead>
              <tbody>
                {pvForecast.panels.map((p) => (
                  <tr key={p.id} className="border-b border-dark-border/50 last:border-0">
                    <td className="py-2 pr-4 text-dark-muted">{p.name}</td>
                    <td className="text-right py-2 px-3 text-yellow-400 tabular-nums">
                      {p.peak_kwp} kWp
                    </td>
                    <td className="text-right py-2 px-3 text-dark-muted tabular-nums">
                      {p.tilt}°
                    </td>
                    <td className="text-right py-2 px-3 text-dark-muted tabular-nums">
                      {p.azimuth}° {p.azimuth === 180 ? '(Süd)' : p.azimuth === 0 ? '(Nord)' : p.azimuth === 90 ? '(Ost)' : p.azimuth === 270 ? '(West)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
