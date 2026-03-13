import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'

/** Wind — Natürliche Energiequelle für Windkraftanlagen */
export default memo(function WindSourceNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Hintergrund */}
        <rect x="5" y="5" width="70" height="55" rx="8"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#60a5fa'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Windströmung — mehrere Bögen */}
        <path d="M14,16 Q26,11 38,16 Q46,20 52,16" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <path d="M12,28 Q28,22 44,28 Q56,34 68,28" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14,40 Q30,34 46,40 Q58,46 68,40" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M18,50 Q30,45 42,50 Q50,54 58,50" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        {/* Label */}
        <text x="40" y="74" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '42%' }} />
      {/* Energieausgang rechts */}
      <Handle type="source" position={Position.Right} id="elec-R1"
        style={{ background: ELEC_COLORS.generation, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '42%' }} />
    </div>
  )
})
