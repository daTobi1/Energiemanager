import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface ThermalStorageNodeData {
  label: string
  entityId: string
  storageType: 'heat' | 'cold'
  volumeLiters?: number
  [key: string]: unknown
}

export default memo(function ThermalStorageNode({ data, selected }: NodeProps) {
  const d = data as ThermalStorageNodeData
  const isHeat = d.storageType !== 'cold'
  const primaryColor = isHeat ? ENERGY_COLORS.heat : ENERGY_COLORS.cold
  const returnColor = isHeat ? ENERGY_COLORS.heat_return : ENERGY_COLORS.cold_return

  return (
    <div className="relative">
      <svg width="80" height="110" viewBox="0 0 80 110">
        {/* Pufferspeicher: Stehender Zylinder (DIN EN 12828) */}
        {/* Körper */}
        <rect x="15" y="15" width="50" height="70" rx="8"
          fill="#1c2333" stroke={selected ? '#22c55e' : primaryColor} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Obere Ellipse */}
        <ellipse cx="40" cy="15" rx="25" ry="8"
          fill="#1c2333" stroke={selected ? '#22c55e' : primaryColor} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Untere Ellipse (nur Bogen unten) */}
        <path d="M15,85 Q15,93 40,93 Q65,93 65,85"
          fill="none" stroke={selected ? '#22c55e' : primaryColor} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Temperatur-Schichtung */}
        <line x1="22" y1="35" x2="58" y2="35" stroke={primaryColor} strokeWidth="0.8" opacity="0.4" />
        <line x1="22" y1="50" x2="58" y2="50" stroke="#8b949e" strokeWidth="0.8" opacity="0.3" />
        <line x1="22" y1="65" x2="58" y2="65" stroke={returnColor} strokeWidth="0.8" opacity="0.4" />
        {/* Warm oben / Kalt unten Label */}
        <text x="40" y="28" textAnchor="middle" fill={primaryColor} fontSize="8" opacity="0.7">
          {isHeat ? '▲ warm' : '▲ kalt'}
        </text>
        <text x="40" y="80" textAnchor="middle" fill={returnColor} fontSize="8" opacity="0.7">
          {isHeat ? '▼ kalt' : '▼ warm'}
        </text>
        <text x="40" y="106" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* VL links oben */}
      <Handle type="source" position={Position.Left} id="heat-L1"
        style={{ background: primaryColor, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '20%' }} />
      {/* RL links unten */}
      <Handle type="source" position={Position.Left} id="heat-ret-L1"
        style={{ background: returnColor, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '70%' }} />
      {/* VL rechts oben */}
      <Handle type="source" position={Position.Right} id="heat-R1"
        style={{ background: primaryColor, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '20%' }} />
      {/* RL rechts unten */}
      <Handle type="source" position={Position.Right} id="heat-ret-R1"
        style={{ background: returnColor, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '70%' }} />
    </div>
  )
})
