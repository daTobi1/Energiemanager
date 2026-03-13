import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'
import { handlePositions } from '../../shared/handlePositions'

export interface ChillerNodeData {
  label: string
  entityId: string
  [key: string]: unknown
}

export default memo(function ChillerNode({ data, selected }: NodeProps) {
  const d = data as ChillerNodeData

  const elecLeftCount = (d.portsElecLeft as number) || 1
  const coldRightCount = (d.portsColdRight as number) || 1

  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)
  const coldRightVlPos = handlePositions(coldRightCount, 15, 42)
  const coldRightRlPos = handlePositions(coldRightCount, 55, 78)

  return (
    <div className="relative">
      <CrossSchemaBadge entityId={d.entityId} currentSchema="hydraulic" />
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Kältemaschine: Rechteck mit Schneeflocke */}
        <rect x="10" y="8" width="100" height="55" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#06b6d4'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Schneeflocke */}
        <line x1="60" y1="18" x2="60" y2="52" stroke="#06b6d4" strokeWidth="1.5" />
        <line x1="43" y1="26" x2="77" y2="44" stroke="#06b6d4" strokeWidth="1.5" />
        <line x1="43" y1="44" x2="77" y2="26" stroke="#06b6d4" strokeWidth="1.5" />
        {/* Kristall-Arme */}
        <line x1="57" y1="20" x2="54" y2="23" stroke="#06b6d4" strokeWidth="1" />
        <line x1="63" y1="20" x2="66" y2="23" stroke="#06b6d4" strokeWidth="1" />
        <line x1="57" y1="50" x2="54" y2="47" stroke="#06b6d4" strokeWidth="1" />
        <line x1="63" y1="50" x2="66" y2="47" stroke="#06b6d4" strokeWidth="1" />
        <text x="60" y="75" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Strom links */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i+1}`} type="source" position={Position.Left} id={`elec-L${i+1}`}
          style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* Kälte-Vorlauf rechts */}
      {coldRightVlPos.map((pct, i) => (
        <Handle key={`cold-R${i+1}`} type="source" position={Position.Right} id={`cold-R${i+1}`}
          style={{ background: ENERGY_COLORS.cold, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
      {/* Kälte-Rücklauf rechts */}
      {coldRightRlPos.map((pct, i) => (
        <Handle key={`cold-ret-R${i+1}`} type="source" position={Position.Right} id={`cold-ret-R${i+1}`}
          style={{ background: ENERGY_COLORS.cold_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
