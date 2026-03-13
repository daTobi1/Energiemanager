import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface MeterNodeData {
  label: string
  entityId: string
  meterType: string
  direction?: string
  [key: string]: unknown
}

const meterTypeColors: Record<string, string> = {
  electricity: ENERGY_COLORS.electricity,
  heat: ENERGY_COLORS.heat,
  gas: ENERGY_COLORS.gas,
  water: ENERGY_COLORS.water,
  cold: ENERGY_COLORS.cold,
  source: ENERGY_COLORS.source,
}

export default memo(function MeterNode({ data, selected }: NodeProps) {
  const d = data as MeterNodeData
  const color = meterTypeColors[d.meterType] || '#8b949e'

  const dd = data as Record<string, unknown>
  const meterLeftCount = (dd.portsMeterLeft as number) || 1
  const meterRightCount = (dd.portsMeterRight as number) || 1
  const meterLeftPos = handlePositions(meterLeftCount, 25, 65)
  const meterRightPos = handlePositions(meterRightCount, 25, 65)

  return (
    <div className="relative">
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* Zähler: Kreis mit gestricheltem Rand (Messpunkt) */}
        <circle cx="30" cy="28" r="20"
          fill="#1c2333" stroke={selected ? '#22c55e' : color}
          strokeWidth={selected ? 2.5 : 1.5} strokeDasharray="4 2" />
        {/* Zeiger */}
        <line x1="30" y1="28" x2="30" y2="14" stroke={color} strokeWidth="1.5" />
        <line x1="30" y1="28" x2="40" y2="25" stroke={color} strokeWidth="1" />
        {/* Punkt Mitte */}
        <circle cx="30" cy="28" r="2.5" fill={color} />
        {/* kWh / m³ */}
        <text x="30" y="38" textAnchor="middle" fill={color} fontSize="6" fontWeight="bold">
          {d.meterType === 'electricity' ? 'kWh' : d.meterType === 'gas' ? 'm³' : d.meterType === 'water' ? 'm³' : 'kWh'}
        </text>
        <text x="30" y="56" textAnchor="middle" fill="#e6edf3" fontSize="8" fontWeight="500">
          {d.label}
        </text>
      </svg>
      {/* Durchgangs-Handles */}
      {meterLeftPos.map((pct, i) => (
        <Handle key={`meter-L${i + 1}`} type="source" position={Position.Left} id={`meter-L${i + 1}`}
          style={{ background: color, width: 8, height: 8, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {meterRightPos.map((pct, i) => (
        <Handle key={`meter-R${i + 1}`} type="source" position={Position.Right} id={`meter-R${i + 1}`}
          style={{ background: color, width: 8, height: 8, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
