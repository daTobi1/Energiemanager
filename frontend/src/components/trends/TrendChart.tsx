import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, AlertTriangle } from 'lucide-react'
import type { TrendSeries } from '../../types'
import type { TrendDataResponse } from '../../hooks/useTrendData'

let Plotly: typeof import('plotly.js-dist-min') | null = null

interface TrendChartProps {
  data: TrendDataResponse
  series: TrendSeries[]
}

export default function TrendChart({ data, series }: TrendChartProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    if (!plotRef.current || !data) return

    let cancelled = false

    const renderPlot = async () => {
      try {
        if (!Plotly) {
          Plotly = await import('plotly.js-dist-min')
        }

        if (cancelled) return

        const traces: any[] = []

        for (const s of series) {
          const key = `${s.source}.${s.metric}`
          const d = data[key]
          if (!d || d.values.length === 0) continue

          const yaxis = s.yAxisId === 'right' ? 'y2' : 'y'

          // Min/Max band
          const hasMinMax = d.min && d.max && d.min.some((v, i) => v !== d.max[i])
          if (hasMinMax) {
            traces.push({
              type: 'scatter',
              x: d.timestamps,
              y: d.max,
              mode: 'lines',
              line: { width: 0 },
              yaxis,
              showlegend: false,
              hoverinfo: 'skip',
            })
            traces.push({
              type: 'scatter',
              x: d.timestamps,
              y: d.min,
              mode: 'lines',
              line: { width: 0 },
              fill: 'tonexty',
              fillcolor: s.color + '15',
              yaxis,
              showlegend: false,
              hoverinfo: 'skip',
            })
          }

          // Main trace
          traces.push({
            type: 'scatter',
            x: d.timestamps,
            y: d.values,
            mode: 'lines',
            name: s.label || key,
            line: { color: s.color, width: 2 },
            yaxis,
            hovertemplate:
              `<b>${s.label || key}</b>: %{y:.2f} ${d.unit}<extra></extra>`,
          })
        }

        if (traces.length === 0) {
          setError('Keine Traces erstellt')
          return
        }

        // Axis units
        const leftUnits = new Set<string>()
        const rightUnits = new Set<string>()
        for (const s of series) {
          const key = `${s.source}.${s.metric}`
          const d = data[key]
          if (!d) continue
          if (s.yAxisId === 'right') rightUnits.add(d.unit)
          else leftUnits.add(d.unit)
        }

        const layout: Record<string, any> = {
          font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
          paper_bgcolor: '#0d1117',
          plot_bgcolor: '#161b22',
          margin: { t: 10, l: 60, r: rightUnits.size > 0 ? 60 : 20, b: 40 },
          height: 450,
          legend: {
            orientation: 'h',
            y: -0.15,
            x: 0.5,
            xanchor: 'center',
            font: { size: 11, color: '#b1bac4' },
          },
          hovermode: 'x unified',
          hoverlabel: {
            bgcolor: '#1c2128',
            bordercolor: '#30363d',
            font: { size: 12, color: '#e6edf3' },
          },
          xaxis: {
            type: 'date',
            gridcolor: '#21262d',
            linecolor: '#30363d',
            tickfont: { size: 10 },
            showspikes: true,
            spikemode: 'across',
            spikethickness: 1,
            spikecolor: '#484f58',
            spikedash: 'dot',
          },
          yaxis: {
            title: [...leftUnits].join(' / '),
            gridcolor: '#21262d',
            linecolor: '#30363d',
            zeroline: false,
            showspikes: true,
            spikemode: 'across',
            spikethickness: 1,
            spikecolor: '#484f58',
            spikedash: 'dot',
          },
        }

        if (rightUnits.size > 0) {
          layout.yaxis2 = {
            title: [...rightUnits].join(' / '),
            overlaying: 'y',
            side: 'right',
            gridcolor: '#21262d',
            linecolor: '#30363d',
            zeroline: false,
          }
        }

        if (cancelled) return

        Plotly!.newPlot(plotRef.current!, traces, layout, {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'] as any[],
        })

        setRendered(true)
        setError(null)
      } catch (e: any) {
        console.error('[TrendChart] Render error:', e)
        setError(e.message || String(e))
      }
    }

    renderPlot()

    return () => {
      cancelled = true
      if (plotRef.current && Plotly) {
        try { Plotly.purge(plotRef.current) } catch {}
      }
      setRendered(false)
    }
  }, [data, series])

  const handleExportPng = useCallback(async () => {
    if (!plotRef.current || !Plotly) return
    const dataUrl = await (Plotly as any).toImage(plotRef.current, {
      format: 'png', width: 1200, height: 600, scale: 2,
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'trend_export.png'
    a.click()
  }, [])

  return (
    <div className="relative">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm mb-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Chart-Fehler: {error}</span>
        </div>
      )}
      <div ref={plotRef} style={{ minHeight: 450 }} />
      {rendered && (
        <button
          onClick={handleExportPng}
          className="absolute top-2 right-2 p-1.5 rounded bg-dark-hover/80 text-dark-faded hover:text-dark-text border border-dark-border/50 transition-colors z-10"
          title="Als PNG speichern"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
