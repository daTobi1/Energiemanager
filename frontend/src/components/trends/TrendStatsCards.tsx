import type { TrendStatsResponse, TrendDataResponse } from '../../hooks/useTrendData'
import type { TrendSeries, TrendInterval, TrendPresetRange } from '../../types'

const RANGE_LABELS: Record<string, string> = {
  '1h': 'Letzte Stunde',
  '6h': 'Letzte 6 Stunden',
  '24h': 'Letzte 24 Stunden',
  '7d': 'Letzte 7 Tage',
  '30d': 'Letzte 30 Tage',
  'custom': 'Benutzerdefiniert',
}

const INTERVAL_LABELS: Record<string, string> = {
  'raw': 'Rohdaten',
  '1min': '1 min',
  '5min': '5 min',
  '15min': '15 min',
  '1h': '1 h',
  '1d': '1 Tag',
}

interface TrendStatsCardsProps {
  stats: TrendStatsResponse
  series: TrendSeries[]
  data?: TrendDataResponse | null
  range?: TrendPresetRange
  interval?: TrendInterval
}

export default function TrendStatsCards({ stats, series, data, range, interval }: TrendStatsCardsProps) {
  const activeSeries = series.filter((s) => {
    const key = `${s.source}.${s.metric}`
    return stats[key] && stats[key].count > 0
  })

  if (activeSeries.length === 0) return null

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-dark-faded uppercase tracking-wide">
          Statistiken
        </h3>
        {(range || interval) && (
          <span className="text-xs text-dark-faded">
            {range && RANGE_LABELS[range]}{interval && ` | ${INTERVAL_LABELS[interval]}`}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left py-2 pr-4 text-dark-faded font-medium">Serie</th>
              <th className="text-right py-2 px-3 text-dark-faded font-medium">Min</th>
              <th className="text-right py-2 px-3 text-dark-faded font-medium">Max</th>
              <th className="text-right py-2 px-3 text-dark-faded font-medium">Durchschnitt</th>
              <th className="text-right py-2 px-3 text-dark-faded font-medium">Summe</th>
              <th className="text-right py-2 pl-3 text-dark-faded font-medium">Messpunkte</th>
            </tr>
          </thead>
          <tbody>
            {activeSeries.map((s) => {
              const key = `${s.source}.${s.metric}`
              const st = stats[key]
              const unit = data?.[key]?.unit || ''
              const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 })
              return (
                <tr key={key} className="border-b border-dark-border/50 last:border-0">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-dark-muted">{s.label || key}</span>
                      {unit && <span className="text-dark-faded text-xs">({unit})</span>}
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-blue-400 tabular-nums">
                    {fmt(st.min)}
                  </td>
                  <td className="text-right py-2 px-3 text-red-400 tabular-nums">
                    {fmt(st.max)}
                  </td>
                  <td className="text-right py-2 px-3 text-emerald-400 tabular-nums">
                    {fmt(st.avg)}
                  </td>
                  <td className="text-right py-2 px-3 text-amber-400 tabular-nums">
                    {st.sum.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="text-right py-2 pl-3 text-dark-faded tabular-nums">
                    {st.count.toLocaleString('de-DE')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
