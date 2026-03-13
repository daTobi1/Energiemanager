import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { handlePositions } from '../../shared/handlePositions'

const sensorTypeColors: Record<string, string> = {
  temperature: '#dc2626',
  pressure: '#8b5cf6',
  flow: '#3b82f6',
  level: '#06b6d4',
  power: '#eab308',
  energy: '#f59e0b',
  humidity: '#64748b',
  radiation: '#f59e0b',
  wind_speed: '#60a5fa',
  wind_direction: '#60a5fa',
  outdoor_temp: '#16a34a',
}

const sensorSymbols: Record<string, string> = {
  temperature: 'T',
  pressure: 'P',
  flow: 'F',
  level: 'L',
  power: 'W',
  energy: 'E',
  humidity: 'H',
  radiation: 'S',
  wind_speed: 'v',
  wind_direction: 'd',
  outdoor_temp: 'T',
}

export default memo(function SensorNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const sType = (d.sensorType as string) || 'temperature'
  const color = sensorTypeColors[sType] || '#8b949e'
  const symbol = sensorSymbols[sType] || '?'

  const meterLeftCount = (d.portsMeterLeft as number) || 1
  const meterRightCount = (d.portsMeterRight as number) || 1
  const meterLeftPos = handlePositions(meterLeftCount, 25, 60)
  const meterRightPos = handlePositions(meterRightCount, 25, 60)

  return (
    <div className="relative">
      <svg width="50" height="54" viewBox="0 0 50 54">
        {/* Sensor: Kreis mit Kreuz-Symbol (DIN) */}
        <circle cx="25" cy="22" r="16"
          fill="#1c2333" stroke={selected ? '#22c55e' : color}
          strokeWidth={selected ? 2.5 : 1.5} />
        {/* Messgröße-Symbol */}
        <text x="25" y="27" textAnchor="middle" fill={color}
          fontSize="14" fontWeight="bold" fontFamily="serif">
          {symbol}
        </text>
        {/* Label */}
        <text x="25" y="48" textAnchor="middle" fill="#e6edf3" fontSize="7" fontWeight="500">
          {d.label as string}
        </text>
      </svg>
      {/* Anschluss-Handle (universell, auf Leitung setzbar) */}
      {meterLeftPos.map((pct, i) => (
        <Handle key={`meter-L${i + 1}`} type="source" position={Position.Left} id={`meter-L${i + 1}`}
          style={{ background: color, width: 7, height: 7, border: '2px solid #30363d', left: -1, top: `${pct}%` }} />
      ))}
      {meterRightPos.map((pct, i) => (
        <Handle key={`meter-R${i + 1}`} type="source" position={Position.Right} id={`meter-R${i + 1}`}
          style={{ background: color, width: 7, height: 7, border: '2px solid #30363d', right: -1, top: `${pct}%` }} />
      ))}
    </div>
  )
})
