import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface PumpNodeData {
  label: string
  circuitId?: string
  pumpType?: string
  [key: string]: unknown
}

export default memo(function PumpNode({ data, selected }: NodeProps) {
  const d = data as PumpNodeData
  return (
    <div className="relative">
      <svg width="60" height="70" viewBox="0 0 60 70">
        {/* Umwälzpumpe: Kreis mit Dreieck (DIN 2481) */}
        <circle cx="30" cy="30" r="22"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#8b949e'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Dreieck (Förderrichtung) */}
        <path d="M20,42 L30,18 L40,42Z"
          fill="none" stroke={selected ? '#22c55e' : '#e6edf3'} strokeWidth="1.5" />
        <text x="30" y="62" textAnchor="middle" fill="#e6edf3" fontSize="8" fontWeight="500">
          {d.label}
        </text>
      </svg>
      {/* links */}
      <Handle type="source" position={Position.Left} id="flow-L1"
        style={{ background: ENERGY_COLORS.heat, width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '43%' }} />
      {/* rechts */}
      <Handle type="source" position={Position.Right} id="flow-R1"
        style={{ background: ENERGY_COLORS.heat, width: 8, height: 8, border: '2px solid #30363d', right: -2, top: '43%' }} />
    </div>
  )
})
