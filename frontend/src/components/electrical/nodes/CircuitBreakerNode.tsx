import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** Leitungsschutzschalter (LS) — IEC-Symbol */
export default memo(function CircuitBreakerNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const elecTopCount = (d.portsElecTop as number) || 1
  const elecBottomCount = (d.portsElecBottom as number) || 1
  const elecTopPos = handlePositions(elecTopCount, 25, 75)
  const elecBottomPos = handlePositions(elecBottomCount, 25, 75)
  return (
    <div className="relative">
      <svg width="50" height="70" viewBox="0 0 50 70">
        {/* Zuleitung */}
        <line x1="25" y1="5" x2="25" y2="18" stroke={ELEC_COLORS.phase} strokeWidth="2" />
        {/* Schalter (offene Stellung = Linie schräg) */}
        <line x1="25" y1="18" x2="32" y2="38"
          stroke={selected ? '#22c55e' : ELEC_COLORS.phase} strokeWidth={selected ? 2.5 : 2} />
        {/* Festpunkt oben */}
        <circle cx="25" cy="18" r="2.5" fill={ELEC_COLORS.phase} />
        {/* Festpunkt unten */}
        <circle cx="25" cy="42" r="2.5" fill={ELEC_COLORS.phase} />
        {/* Therm. Auslöser (Bimetall) */}
        <rect x="20" y="42" width="10" height="6" fill="none" stroke={ELEC_COLORS.consumption} strokeWidth="1" />
        {/* Ableitung */}
        <line x1="25" y1="48" x2="25" y2="58" stroke={ELEC_COLORS.phase} strokeWidth="2" />
        <text x="25" y="67" textAnchor="middle" fill="#e6edf3" fontSize="7" fontWeight="500">
          {d.label as string}
        </text>
      </svg>
      {/* oben */}
      {elecTopPos.map((pct, i) => (
        <Handle key={`elec-T${i+1}`} type="source" position={Position.Top} id={`elec-T${i+1}`}
          style={{ background: ELEC_COLORS.phase, width: 8, height: 8, border: '2px solid #30363d', top: -2, left: `${pct}%` }} />
      ))}
      {/* unten */}
      {elecBottomPos.map((pct, i) => (
        <Handle key={`elec-B${i+1}`} type="source" position={Position.Bottom} id={`elec-B${i+1}`}
          style={{ background: ELEC_COLORS.phase, width: 8, height: 8, border: '2px solid #30363d', bottom: 6, left: `${pct}%` }} />
      ))}
    </div>
  )
})
