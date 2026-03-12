import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'

/** Windrad — Windkraftanlage als Stromquelle */
export default memo(function WindTurbineNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="80" height="95" viewBox="0 0 80 95">
        {/* Turm */}
        <line x1="40" y1="38" x2="40" y2="72" stroke="#8b949e" strokeWidth="3" />
        <line x1="38" y1="72" x2="42" y2="72" stroke="#8b949e" strokeWidth="2" />
        {/* Fundament */}
        <line x1="32" y1="72" x2="48" y2="72" stroke="#8b949e" strokeWidth="2" />
        {/* Nabe */}
        <circle cx="40" cy="32" r="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#22c55e'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Rotorblatt 1 (oben) */}
        <path d="M40,28 Q42,14 40,4 Q38,14 40,28Z"
          fill="#22c55e" opacity="0.8" stroke="#22c55e" strokeWidth="0.5" />
        {/* Rotorblatt 2 (rechts unten) */}
        <path d="M43,34 Q54,42 62,48 Q52,38 43,34Z"
          fill="#22c55e" opacity="0.8" stroke="#22c55e" strokeWidth="0.5" />
        {/* Rotorblatt 3 (links unten) */}
        <path d="M37,34 Q26,42 18,48 Q28,38 37,34Z"
          fill="#22c55e" opacity="0.8" stroke="#22c55e" strokeWidth="0.5" />
        {/* Windlinien */}
        <path d="M5,20 Q12,17 19,20" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
        <path d="M3,28 Q10,25 17,28" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.4" />
        <path d="M7,36 Q14,33 21,36" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.3" />
        {/* kW */}
        {d.nominalPowerKw && (
          <text x="40" y="80" textAnchor="middle" fill="#8b949e" fontSize="7">
            {String(d.nominalPowerKw)} kW
          </text>
        )}
        <text x="40" y="92" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links (Anemometer etc.) */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '36%' }} />
      {/* Strom rechts */}
      <Handle type="source" position={Position.Right} id="elec-R1"
        style={{ background: ELEC_COLORS.generation, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '36%' }} />
    </div>
  )
})
