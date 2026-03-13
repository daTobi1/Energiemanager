import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** Netzeinspeisung / Trafo — IEC Symbol: Zwei Kreise (Spulen) */
export default memo(function TransformerNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const elecTopCount = (d.portsElecTop as number) || 1
  const elecBottomCount = (d.portsElecBottom as number) || 1
  const elecTopPos = handlePositions(elecTopCount, 25, 75)
  const elecBottomPos = handlePositions(elecBottomCount, 25, 75)
  return (
    <div className="relative">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Netz-Symbol oben */}
        <line x1="50" y1="5" x2="50" y2="20" stroke={ELEC_COLORS.grid} strokeWidth="2" />
        <line x1="35" y1="5" x2="65" y2="5" stroke={ELEC_COLORS.grid} strokeWidth="2.5" />
        <line x1="38" y1="9" x2="62" y2="9" stroke={ELEC_COLORS.grid} strokeWidth="2" />
        <line x1="42" y1="13" x2="58" y2="13" stroke={ELEC_COLORS.grid} strokeWidth="1.5" />
        {/* Primärspule */}
        <circle cx="50" cy="35" r="15"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.grid} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Sekundärspule */}
        <circle cx="50" cy="58" r="15"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.phase} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Wicklungssinn */}
        <circle cx="44" cy="30" r="1.5" fill={ELEC_COLORS.grid} />
        <circle cx="44" cy="53" r="1.5" fill={ELEC_COLORS.phase} />
        {/* Ausgang */}
        <line x1="50" y1="73" x2="50" y2="82" stroke={ELEC_COLORS.phase} strokeWidth="2" />
        <text x="50" y="95" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Netz oben */}
      {elecTopPos.map((pct, i) => (
        <Handle key={`elec-T${i+1}`} type="source" position={Position.Top} id={`elec-T${i+1}`}
          style={{ background: ELEC_COLORS.grid, width: 10, height: 10, border: '2px solid #30363d', top: -2, left: `${pct}%` }} />
      ))}
      {/* Ausgang unten */}
      {elecBottomPos.map((pct, i) => (
        <Handle key={`elec-B${i+1}`} type="source" position={Position.Bottom} id={`elec-B${i+1}`}
          style={{ background: ELEC_COLORS.phase, width: 10, height: 10, border: '2px solid #30363d', bottom: 2, left: `${pct}%` }} />
      ))}
    </div>
  )
})
