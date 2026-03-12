import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'

export interface CHPNodeData {
  label: string
  entityId: string
  [key: string]: unknown
}

export default memo(function CHPNode({ data, selected }: NodeProps) {
  const d = data as CHPNodeData
  return (
    <div className="relative">
      <CrossSchemaBadge entityId={d.entityId} currentSchema="hydraulic" />
      <svg width="140" height="90" viewBox="0 0 140 90">
        {/* BHKW: Rechteck mit Motor-Symbol + Blitz + Flamme */}
        <rect x="10" y="5" width="120" height="65" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#ea580c'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Motor-Block */}
        <rect x="25" y="18" width="35" height="30" rx="2" fill="none" stroke="#ea580c" strokeWidth="1.2" />
        {/* Kolben-Linien */}
        <line x1="32" y1="22" x2="32" y2="44" stroke="#ea580c" strokeWidth="0.8" />
        <line x1="42" y1="22" x2="42" y2="44" stroke="#ea580c" strokeWidth="0.8" />
        <line x1="52" y1="22" x2="52" y2="44" stroke="#ea580c" strokeWidth="0.8" />
        {/* Blitz für Strom */}
        <path d="M80,15 L75,32 L82,30 L77,50" fill="none" stroke="#eab308" strokeWidth="1.5" />
        {/* Flamme für Wärme */}
        <path d="M105,22 Q102,30 100,34 Q104,38 105,42 Q106,38 110,34 Q108,30 105,22Z"
          fill="#dc2626" opacity="0.7" />
        <text x="70" y="82" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Gas links */}
      <Handle type="source" position={Position.Left} id="gas-L1"
        style={{ background: ENERGY_COLORS.gas, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '40%' }} />
      {/* Strom rechts oben */}
      <Handle type="source" position={Position.Right} id="elec-R1"
        style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '22%' }} />
      {/* Vorlauf rechts mitte */}
      <Handle type="source" position={Position.Right} id="heat-R1"
        style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '44%' }} />
      {/* Rücklauf rechts unten */}
      <Handle type="source" position={Position.Right} id="heat-ret-R1"
        style={{ background: ENERGY_COLORS.heat_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '62%' }} />
    </div>
  )
})
