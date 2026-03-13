import type { TrendInterval, TrendPresetRange } from '../../types'

interface TrendToolbarProps {
  range: TrendPresetRange
  interval: TrendInterval
  customFrom: string
  customTo: string
  onRangeChange: (range: TrendPresetRange) => void
  onIntervalChange: (interval: TrendInterval) => void
  onCustomRange: (from: string, to: string) => void
  autoInterval?: boolean
  onAutoIntervalToggle?: () => void
}

const PRESETS: { value: TrendPresetRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
]

const INTERVALS: { value: TrendInterval; label: string }[] = [
  { value: 'raw', label: 'Roh' },
  { value: '1min', label: '1 min' },
  { value: '5min', label: '5 min' },
  { value: '15min', label: '15 min' },
  { value: '1h', label: '1 h' },
  { value: '1d', label: '1 Tag' },
]

export default function TrendToolbar({
  range, interval, customFrom, customTo,
  onRangeChange, onIntervalChange, onCustomRange,
  autoInterval, onAutoIntervalToggle,
}: TrendToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset Buttons */}
        <div className="flex rounded-lg overflow-hidden border border-dark-border">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onRangeChange(p.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                range === p.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-dark-card text-dark-faded hover:bg-dark-hover hover:text-dark-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Interval Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value as TrendInterval)}
            className="select text-sm"
          >
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
          {/* Auto-Intervall Toggle */}
          {onAutoIntervalToggle && (
            <button
              onClick={onAutoIntervalToggle}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                autoInterval
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-dark-card border-dark-border text-dark-faded hover:text-dark-text'
              }`}
              title={autoInterval ? 'Auto-Intervall aktiv: passt sich dem Zeitbereich an' : 'Auto-Intervall deaktiviert'}
            >
              Auto
            </button>
          )}
        </div>
      </div>

      {/* Custom Range Inputs */}
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-dark-faded">Von:</label>
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => onCustomRange(e.target.value, customTo)}
            className="input text-sm"
          />
          <label className="text-sm text-dark-faded">Bis:</label>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => onCustomRange(customFrom, e.target.value)}
            className="input text-sm"
          />
        </div>
      )}
    </div>
  )
}
