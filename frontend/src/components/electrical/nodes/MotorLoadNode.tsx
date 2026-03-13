import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'
import { isDualSchemaElectricalNode } from '../../shared/crossSchemaUtils'
import { handlePositions } from '../../shared/handlePositions'

/** Motor-Last (WP, Kältemaschine, Lüftung) — IEC: Kreis mit M */
export default memo(function MotorLoadNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const powerKw = d.nominalPowerKw as number | undefined
  const entityId = d.entityId as string | undefined
  const motorType = d.motorType as string | undefined
  const elecLeftCount = (d.portsElecLeft as number) || 1
  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)
  return (
    <div className="relative">
      {entityId && isDualSchemaElectricalNode('motor_load', motorType) && (
        <CrossSchemaBadge entityId={entityId} currentSchema="electrical" />
      )}
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Motor-Kreis (IEC 60617) */}
        <circle cx="40" cy="35" r="24"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.consumption} strokeWidth={selected ? 2.5 : 1.5} />
        {/* M */}
        <text x="40" y="42" textAnchor="middle" fill={ELEC_COLORS.consumption} fontSize="22" fontWeight="bold">M</text>
        {/* 3~ (Drehstrom) */}
        <text x="40" y="53" textAnchor="middle" fill="#8b949e" fontSize="8">3~</text>
        {powerKw && (
          <text x="40" y="18" textAnchor="middle" fill="#8b949e" fontSize="7">{powerKw} kW</text>
        )}
        <text x="40" y="75" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* links */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i+1}`} type="source" position={Position.Left} id={`elec-L${i+1}`}
          style={{ background: ELEC_COLORS.consumption, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
