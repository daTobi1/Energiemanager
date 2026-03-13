import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** Luft-Quelle — Umgebungsluft als Wärmequelle für Luft/Wasser-WP */
export default memo(function AirSourceNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const sourceRightCount = (d.portsSourceRight as number) || 1
  const sourceRightPos = handlePositions(sourceRightCount, 25, 65)
  return (
    <div className="relative">
      <svg width="80" height="85" viewBox="0 0 80 85">
        {/* Gehäuse */}
        <rect x="5" y="8" width="70" height="55" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#60a5fa'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Windströmung (3 geschwungene Linien) */}
        <path d="M15,22 Q25,18 35,22 Q45,26 55,22" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18,35 Q30,30 42,35 Q54,40 66,35" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15,48 Q25,44 35,48 Q45,52 55,48" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        {/* Temperatur-Symbol */}
        <text x="66" y="52" textAnchor="middle" fill="#60a5fa" fontSize="10">°C</text>
        {/* Label */}
        <text x="40" y="78" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '42%' }} />
      {/* Quelle rechts */}
      {sourceRightPos.map((pct, i) => (
        <Handle key={`source-R${i+1}`} type="source" position={Position.Right} id={`source-R${i+1}`}
          style={{ background: ENERGY_COLORS.source, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
