import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface GridNodeData {
  label: string
  entityId: string
  [key: string]: unknown
}

export default memo(function GridNode({ data, selected }: NodeProps) {
  const d = data as GridNodeData
  return (
    <div className="relative">
      <svg width="100" height="90" viewBox="0 0 100 90">
        {/* Hausanschluss: Strommast-Symbol */}
        {/* Mast */}
        <line x1="50" y1="5" x2="50" y2="60" stroke={selected ? '#22c55e' : '#eab308'} strokeWidth="2.5" />
        {/* Querträger oben */}
        <line x1="25" y1="15" x2="75" y2="15" stroke={selected ? '#22c55e' : '#eab308'} strokeWidth="2" />
        {/* Isolatoren */}
        <line x1="30" y1="15" x2="28" y2="25" stroke="#eab308" strokeWidth="1.2" />
        <line x1="50" y1="15" x2="50" y2="25" stroke="#eab308" strokeWidth="1.2" />
        <line x1="70" y1="15" x2="72" y2="25" stroke="#eab308" strokeWidth="1.2" />
        {/* Blitz */}
        <path d="M45,30 L40,42 L48,40 L43,55" fill="none" stroke="#eab308" strokeWidth="1.5" />
        {/* Erde-Symbol */}
        <line x1="40" y1="60" x2="60" y2="60" stroke="#8b949e" strokeWidth="1.5" />
        <line x1="43" y1="63" x2="57" y2="63" stroke="#8b949e" strokeWidth="1.2" />
        <line x1="46" y1="66" x2="54" y2="66" stroke="#8b949e" strokeWidth="1" />
        <text x="50" y="82" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Bidirektional: Strom rechts (1 Handle) */}
      <Handle type="source" position={Position.Right} id="elec-R1"
        style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '44%' }} />
    </div>
  )
})
