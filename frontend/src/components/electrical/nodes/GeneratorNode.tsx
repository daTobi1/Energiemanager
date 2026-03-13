import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'
import { handlePositions } from '../../shared/handlePositions'

/** Generator (BHKW) — IEC: Kreis mit G */
export default memo(function GeneratorNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const entityId = d.entityId as string | undefined
  const elecRightCount = (d.portsElecRight as number) || 1
  const elecRightPos = handlePositions(elecRightCount, 25, 65)
  return (
    <div className="relative">
      {entityId && <CrossSchemaBadge entityId={entityId} currentSchema="electrical" />}
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Generator-Kreis (IEC 60617) */}
        <circle cx="40" cy="35" r="24"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.generation} strokeWidth={selected ? 2.5 : 1.5} />
        {/* G */}
        <text x="40" y="42" textAnchor="middle" fill={ELEC_COLORS.generation} fontSize="22" fontWeight="bold">G</text>
        {/* Welle */}
        <path d="M28,57 Q34,63 40,57 Q46,51 52,57" fill="none" stroke={ELEC_COLORS.generation} strokeWidth="1.2" opacity="0.5" />
        <text x="40" y="75" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* rechts */}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i+1}`} type="source" position={Position.Right} id={`elec-R${i+1}`}
          style={{ background: ELEC_COLORS.generation, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
