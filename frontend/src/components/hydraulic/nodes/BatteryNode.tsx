import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface BatteryNodeData {
  label: string
  entityId: string
  capacityKwh?: number
  [key: string]: unknown
}

export default memo(function BatteryNode({ data, selected }: NodeProps) {
  const d = data as BatteryNodeData

  const elecLeftCount = (d.portsElecLeft as number) || 1
  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)

  return (
    <div className="relative">
      <svg width="100" height="80" viewBox="0 0 100 80">
        {/* Batterie-Symbol (IEC) */}
        {/* Große Platte links */}
        <line x1="30" y1="15" x2="30" y2="55" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="4" />
        {/* Kleine Platte rechts */}
        <line x1="45" y1="22" x2="45" y2="48" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="2.5" />
        {/* Große Platte */}
        <line x1="55" y1="15" x2="55" y2="55" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="4" />
        {/* Kleine Platte */}
        <line x1="70" y1="22" x2="70" y2="48" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="2.5" />
        {/* Anschluss links */}
        <line x1="15" y1="35" x2="30" y2="35" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="1.5" />
        {/* Anschluss rechts */}
        <line x1="70" y1="35" x2="85" y2="35" stroke={selected ? '#22c55e' : '#8b5cf6'} strokeWidth="1.5" />
        {/* + Pol */}
        <text x="20" y="28" fill="#8b5cf6" fontSize="12" fontWeight="bold">+</text>
        {/* - Pol */}
        <text x="77" y="30" fill="#8b5cf6" fontSize="14" fontWeight="bold">−</text>
        <text x="50" y="75" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Bidirektional: Strom links */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i+1}`} type="source" position={Position.Left} id={`elec-L${i+1}`}
          style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
