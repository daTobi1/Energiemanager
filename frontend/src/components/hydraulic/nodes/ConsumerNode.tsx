import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'

export interface ConsumerNodeData {
  label: string
  entityId: string
  consumerType: string
  nominalPowerKw?: number
  [key: string]: unknown
}

const typeIcons: Record<string, { symbol: string; color: string }> = {
  household: { symbol: '⌂', color: '#16a34a' },
  commercial: { symbol: '◻', color: '#7c3aed' },
  production: { symbol: '⚙', color: '#ea580c' },
  lighting: { symbol: '💡', color: '#eab308' },
  hvac: { symbol: '❄', color: '#2563eb' },
  ventilation: { symbol: '◎', color: '#06b6d4' },
  wallbox: { symbol: '⚡', color: '#059669' },
  hot_water: { symbol: '♨', color: '#dc2626' },
  other: { symbol: '○', color: '#6b7280' },
}

export default memo(function ConsumerNode({ data, selected }: NodeProps) {
  const d = data as ConsumerNodeData
  const icon = typeIcons[d.consumerType] || typeIcons.other

  const dd = data as Record<string, unknown>
  const elecLeftCount = (dd.portsElecLeft as number) || 1
  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)

  return (
    <div className="relative">
      <CrossSchemaBadge entityId={d.entityId} currentSchema="hydraulic" />
      <svg width="100" height="70" viewBox="0 0 100 70">
        {/* Verbraucher: Abgerundetes Rechteck mit Typ-Symbol */}
        <rect x="10" y="5" width="80" height="45" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : icon.color} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Typ-Symbol */}
        <text x="50" y="35" textAnchor="middle" fill={icon.color} fontSize="18">
          {icon.symbol}
        </text>
        {/* Leistung */}
        {d.nominalPowerKw && (
          <text x="85" y="16" textAnchor="end" fill="#8b949e" fontSize="7">
            {d.nominalPowerKw}kW
          </text>
        )}
        <text x="50" y="62" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Strom links */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i + 1}`} type="source" position={Position.Left} id={`elec-L${i + 1}`}
          style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* Optional: Wärme (für HVAC/HotWater) */}
      {(d.consumerType === 'hvac' || d.consumerType === 'hot_water') && (
        <Handle type="source" position={Position.Top} id="heat-T1"
          style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', top: -2, left: '50%' }} />
      )}
    </div>
  )
})
