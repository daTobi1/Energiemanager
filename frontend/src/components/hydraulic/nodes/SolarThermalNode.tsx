import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Solarthermie-Kollektor — Sonne + Flachkollektor mit Wärme-Handles */
export default memo(function SolarThermalNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="110" height="90" viewBox="0 0 110 90">
        {/* Sonne oben links */}
        <circle cx="25" cy="18" r="8" fill="#f59e0b" opacity="0.9" />
        <g stroke="#f59e0b" strokeWidth="1.5" opacity="0.7">
          <line x1="25" y1="5" x2="25" y2="2" />
          <line x1="25" y1="31" x2="25" y2="34" />
          <line x1="12" y1="18" x2="9" y2="18" />
          <line x1="38" y1="18" x2="41" y2="18" />
          <line x1="16" y1="9" x2="14" y2="7" />
          <line x1="34" y1="9" x2="36" y2="7" />
          <line x1="16" y1="27" x2="14" y2="29" />
          <line x1="34" y1="27" x2="36" y2="29" />
        </g>
        {/* Strahlen zum Kollektor */}
        <line x1="30" y1="28" x2="50" y2="38" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
        <line x1="25" y1="30" x2="60" y2="42" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
        {/* Kollektor-Panel (schräg) */}
        <rect x="40" y="32" width="55" height="30" rx="3"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#dc2626'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Absorber-Streifen */}
        <line x1="48" y1="36" x2="48" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
        <line x1="56" y1="36" x2="56" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
        <line x1="64" y1="36" x2="64" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
        <line x1="72" y1="36" x2="72" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
        <line x1="80" y1="36" x2="80" y2="58" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
        {/* Querleitung (Sammelrohr) */}
        <line x1="44" y1="40" x2="88" y2="40" stroke="#dc2626" strokeWidth="1.2" />
        <line x1="44" y1="54" x2="88" y2="54" stroke="#3b82f6" strokeWidth="1.2" />
        {/* Label */}
        <text x="55" y="80" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links (Pyranometer, Kollektorfühler) */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '50%' }} />
      {/* Vorlauf rechts oben */}
      <Handle type="source" position={Position.Right} id="heat-R1"
        style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '42%' }} />
      {/* Rücklauf rechts unten */}
      <Handle type="source" position={Position.Right} id="heat-ret-R1"
        style={{ background: ENERGY_COLORS.heat_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '62%' }} />
    </div>
  )
})
