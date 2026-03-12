import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface MixerValveNodeData {
  label: string
  circuitId?: string
  [key: string]: unknown
}

export default memo(function MixerValveNode({ data, selected }: NodeProps) {
  const d = data as MixerValveNodeData
  return (
    <div className="relative">
      <svg width="60" height="70" viewBox="0 0 60 70">
        {/* 3-Wege-Mischer: Doppeldreieck (Sanduhr / Bowtie) nach DIN 2481 */}
        {/* Linkes Dreieck */}
        <path d="M10,15 L30,30 L10,45Z"
          fill="none" stroke={selected ? '#22c55e' : ENERGY_COLORS.heat} strokeWidth="1.5" />
        {/* Rechtes Dreieck */}
        <path d="M50,15 L30,30 L50,45Z"
          fill="none" stroke={selected ? '#22c55e' : ENERGY_COLORS.heat_return} strokeWidth="1.5" />
        {/* Bypass unten */}
        <line x1="30" y1="30" x2="30" y2="50" stroke="#8b949e" strokeWidth="1.2" />
        <circle cx="30" cy="50" r="3" fill="none" stroke="#8b949e" strokeWidth="1" />
        <text x="30" y="65" textAnchor="middle" fill="#e6edf3" fontSize="8" fontWeight="500">
          {d.label}
        </text>
      </svg>
      {/* VL links */}
      <Handle type="source" position={Position.Left} id="heat-L1"
        style={{ background: ENERGY_COLORS.heat, width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '43%' }} />
      {/* RL unten */}
      <Handle type="source" position={Position.Bottom} id="heat-ret-B1"
        style={{ background: ENERGY_COLORS.heat_return, width: 8, height: 8, border: '2px solid #30363d', bottom: 14, left: '46%' }} />
      {/* Gemischt rechts */}
      <Handle type="source" position={Position.Right} id="flow-R1"
        style={{ background: '#f97316', width: 8, height: 8, border: '2px solid #30363d', right: -2, top: '43%' }} />
    </div>
  )
})
