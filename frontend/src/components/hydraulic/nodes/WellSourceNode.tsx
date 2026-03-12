import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Brunnen / Grundwasser — Wasserquelle für Wasser/Wasser-WP */
export default memo(function WellSourceNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="80" height="90" viewBox="0 0 80 90">
        {/* Brunnengehäuse */}
        <rect x="8" y="5" width="64" height="60" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#3b82f6'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Brunnenring oben */}
        <rect x="22" y="8" width="36" height="8" rx="2" fill="none" stroke="#8b949e" strokeWidth="1.2" />
        {/* Brunnenrohr */}
        <rect x="34" y="16" width="12" height="30" fill="none" stroke="#8b949e" strokeWidth="1" />
        {/* Wasserspiegel */}
        <path d="M16,38 Q24,34 32,38 Q40,42 48,38 Q56,34 64,38" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        {/* Wasser unten */}
        <rect x="14" y="38" width="52" height="22" rx="2" fill="#3b82f6" opacity="0.12" />
        {/* Wasserbewegung */}
        <path d="M20,48 Q28,45 36,48 Q44,51 52,48" fill="none" stroke="#3b82f6" strokeWidth="0.8" opacity="0.5" />
        <path d="M24,55 Q32,52 40,55 Q48,58 56,55" fill="none" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
        {/* Pumpen-Pfeil hoch */}
        <path d="M40,42 L40,22" fill="none" stroke="#16a34a" strokeWidth="1.5" />
        <path d="M37,26 L40,20 L43,26" fill="none" stroke="#16a34a" strokeWidth="1.5" />
        {/* Label */}
        <text x="40" y="80" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Quelle rechts */}
      <Handle type="source" position={Position.Right} id="source-R1"
        style={{ background: ENERGY_COLORS.source, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '40%' }} />
    </div>
  )
})
