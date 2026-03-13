import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface BoilerNodeData {
  label: string
  entityId: string
  nominalPowerKw?: number
  [key: string]: unknown
}

export default memo(function BoilerNode({ data, selected }: NodeProps) {
  const d = data as BoilerNodeData

  const gasLeftCount = (d.portsGasLeft as number) || 1
  const heatRightCount = (d.portsHeatRight as number) || 1

  const gasLeftPos = handlePositions(gasLeftCount, 25, 65)
  const heatRightVlPos = handlePositions(heatRightCount, 15, 42)
  const heatRightRlPos = handlePositions(heatRightCount, 55, 78)

  return (
    <div className="relative">
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Kessel-Symbol: Rechteck mit Flamme */}
        <rect x="15" y="8" width="90" height="55" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#dc2626'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Flamme */}
        <path d="M60,20 Q55,30 50,35 Q55,32 58,38 Q56,45 60,50 Q64,45 62,38 Q65,32 70,35 Q65,30 60,20Z"
          fill="#dc2626" opacity="0.8" />
        {/* Gas-Eingang Markierung */}
        <text x="18" y="55" fill="#d97706" fontSize="8" fontWeight="bold">Gas</text>
        <text x="60" y="75" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Gas links */}
      {gasLeftPos.map((pct, i) => (
        <Handle key={`gas-L${i+1}`} type="source" position={Position.Left} id={`gas-L${i+1}`}
          style={{ background: ENERGY_COLORS.gas, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* Vorlauf rechts */}
      {heatRightVlPos.map((pct, i) => (
        <Handle key={`heat-R${i+1}`} type="source" position={Position.Right} id={`heat-R${i+1}`}
          style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
      {/* Rücklauf rechts */}
      {heatRightRlPos.map((pct, i) => (
        <Handle key={`heat-ret-R${i+1}`} type="source" position={Position.Right} id={`heat-ret-R${i+1}`}
          style={{ background: ENERGY_COLORS.heat_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
