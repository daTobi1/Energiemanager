import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface PVNodeData {
  label: string
  entityId: string
  peakPowerKwp?: number
  [key: string]: unknown
}

export default memo(function PVNode({ data, selected }: NodeProps) {
  const d = data as PVNodeData

  const elecRightCount = (d.portsElecRight as number) || 1
  const elecRightPos = handlePositions(elecRightCount, 25, 65)

  return (
    <div className="relative">
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Solarpanel-Symbol: Parallelogramm mit diagonalen Linien */}
        <rect x="10" y="10" width="100" height="50" rx="3"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#f59e0b'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Diagonale Zellen-Linien */}
        <line x1="35" y1="10" x2="25" y2="60" stroke="#f59e0b" strokeWidth="0.8" opacity="0.5" />
        <line x1="60" y1="10" x2="50" y2="60" stroke="#f59e0b" strokeWidth="0.8" opacity="0.5" />
        <line x1="85" y1="10" x2="75" y2="60" stroke="#f59e0b" strokeWidth="0.8" opacity="0.5" />
        <line x1="10" y1="35" x2="110" y2="35" stroke="#f59e0b" strokeWidth="0.8" opacity="0.5" />
        {/* Sonnen-Icon */}
        <circle cx="100" cy="14" r="7" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
        <circle cx="100" cy="14" r="3" fill="#f59e0b" />
        {/* Label */}
        <text x="60" y="75" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Strom rechts */}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i+1}`} type="source" position={Position.Right} id={`elec-R${i+1}`}
          style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
