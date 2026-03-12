import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface BoilerNodeData {
  label: string
  entityId: string
  nominalPowerKw?: number
  [key: string]: unknown
}

export default memo(function BoilerNode({ data, selected }: NodeProps) {
  const d = data as BoilerNodeData
  return (
    <div className="relative">
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Kessel-Symbol: Rechteck mit Flamme */}
        <rect x="15" y="8" width="90" height="55" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#dc2626'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Flamme */}
        <path d="M60,20 Q55,30 50,35 Q55,32 58,38 Q56,45 60,50 Q64,45 62,38 Q65,32 70,35 Q65,30 60,20Z"
          fill="#dc2626" opacity="0.8" />
        {/* Gas-Eingang Markierung */}
        <text x="18" y="55" fill="#d97706" fontSize="8" fontWeight="bold">Gas</text>
        <text x="60" y="75" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Gas links */}
      <Handle type="source" position={Position.Left} id="gas-L1"
        style={{ background: ENERGY_COLORS.gas, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '44%' }} />
      {/* Vorlauf rechts oben */}
      <Handle type="source" position={Position.Right} id="heat-R1"
        style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '30%' }} />
      {/* Rücklauf rechts unten */}
      <Handle type="source" position={Position.Right} id="heat-ret-R1"
        style={{ background: ENERGY_COLORS.heat_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '58%' }} />
    </div>
  )
})
