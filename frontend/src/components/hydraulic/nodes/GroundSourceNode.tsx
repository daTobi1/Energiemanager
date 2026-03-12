import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Erdsonde / Erdkollektor — Geothermie-Quelle für Sole/Wasser-WP */
export default memo(function GroundSourceNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="80" height="90" viewBox="0 0 80 90">
        {/* Erdschichten */}
        <rect x="5" y="5" width="70" height="60" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#16a34a'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Gras/Oberfläche */}
        <line x1="10" y1="18" x2="70" y2="18" stroke="#4ade80" strokeWidth="1.5" opacity="0.6" />
        {/* Erdschicht 1 */}
        <rect x="10" y="18" width="60" height="14" fill="#78350f" opacity="0.15" />
        {/* Erdschicht 2 (tiefer) */}
        <rect x="10" y="32" width="60" height="14" fill="#78350f" opacity="0.25" />
        {/* Erdschicht 3 */}
        <rect x="10" y="46" width="60" height="14" fill="#78350f" opacity="0.35" />
        {/* Sonde (U-Rohr) */}
        <path d="M30,10 L30,52 Q30,56 34,56 L38,56 Q42,56 42,52 L42,10"
          fill="none" stroke="#16a34a" strokeWidth="2" />
        {/* Punkte für Erdwärme */}
        <circle cx="22" cy="40" r="2" fill="#f59e0b" opacity="0.5" />
        <circle cx="55" cy="35" r="2" fill="#f59e0b" opacity="0.5" />
        <circle cx="60" cy="50" r="2" fill="#f59e0b" opacity="0.5" />
        <circle cx="18" cy="52" r="2" fill="#f59e0b" opacity="0.4" />
        {/* Label */}
        <text x="40" y="80" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links (Temperaturfühler Sole) */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '40%' }} />
      {/* Quelle rechts */}
      <Handle type="source" position={Position.Right} id="source-R1"
        style={{ background: ENERGY_COLORS.source, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '40%' }} />
    </div>
  )
})
