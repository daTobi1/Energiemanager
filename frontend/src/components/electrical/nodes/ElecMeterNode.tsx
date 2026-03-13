import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** Stromzähler — IEC: Kreis mit kWh */
export default memo(function ElecMeterNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const direction = (d.direction as string) || 'consumption'
  const isBidi = direction === 'bidirectional'
  const elecLeftCount = (d.portsElecLeft as number) || 1
  const elecRightCount = (d.portsElecRight as number) || 1
  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)
  const elecRightPos = handlePositions(elecRightCount, 25, 65)

  return (
    <div className="relative">
      <svg width="60" height="70" viewBox="0 0 60 70">
        {/* Zähler-Kreis */}
        <circle cx="30" cy="30" r="20"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.phase}
          strokeWidth={selected ? 2.5 : 1.5} />
        {/* kWh */}
        <text x="30" y="28" textAnchor="middle" fill={ELEC_COLORS.phase} fontSize="8" fontWeight="bold">kWh</text>
        {/* Richtungspfeil(e) */}
        {isBidi ? (
          <>
            <path d="M20,35 L28,35" stroke="#8b949e" strokeWidth="1" />
            <path d="M26,33 L29,35 L26,37" fill="none" stroke="#8b949e" strokeWidth="0.8" />
            <path d="M40,35 L32,35" stroke="#8b949e" strokeWidth="1" />
            <path d="M34,33 L31,35 L34,37" fill="none" stroke="#8b949e" strokeWidth="0.8" />
          </>
        ) : (
          <>
            <path d="M22,35 L38,35" stroke="#8b949e" strokeWidth="1" />
            <path d="M35,32 L39,35 L35,38" fill="none" stroke="#8b949e" strokeWidth="1" />
          </>
        )}
        <text x="30" y="62" textAnchor="middle" fill="#e6edf3" fontSize="8" fontWeight="500">
          {d.label as string}
        </text>
      </svg>
      {/* Durchgang */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i+1}`} type="source" position={Position.Left} id={`elec-L${i+1}`}
          style={{ background: ELEC_COLORS.phase, width: 8, height: 8, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i+1}`} type="source" position={Position.Right} id={`elec-R${i+1}`}
          style={{ background: ELEC_COLORS.phase, width: 8, height: 8, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
