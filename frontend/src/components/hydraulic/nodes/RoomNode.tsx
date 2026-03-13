import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface RoomNodeData {
  label: string
  entityId: string
  floor?: string
  areaM2?: number
  targetTempC?: number
  [key: string]: unknown
}

export default memo(function RoomNode({ data, selected }: NodeProps) {
  const d = data as RoomNodeData

  const dd = data as Record<string, unknown>
  const circuitLeftCount = (dd.portsCircuitLeft as number) || 1
  const elecRightCount = (dd.portsElecRight as number) || 1
  const circuitLeftPos = handlePositions(circuitLeftCount, 25, 65)
  const elecRightPos = handlePositions(elecRightCount, 25, 65)

  return (
    <div className="relative">
      <svg width="100" height="70" viewBox="0 0 100 70">
        {/* Raum: Haus-Symbol mit Dach */}
        {/* Wände */}
        <rect x="15" y="22" width="70" height="32" rx="2"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#8b949e'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Dach */}
        <path d="M10,24 L50,5 L90,24"
          fill="none" stroke={selected ? '#22c55e' : '#8b949e'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Temperatur */}
        {d.targetTempC && (
          <text x="50" y="40" textAnchor="middle" fill="#dc2626" fontSize="12" fontWeight="bold">
            {d.targetTempC}°C
          </text>
        )}
        {/* Fläche */}
        {d.areaM2 && (
          <text x="80" y="50" textAnchor="end" fill="#8b949e" fontSize="7">
            {d.areaM2}m²
          </text>
        )}
        {/* Stockwerk */}
        {d.floor && (
          <text x="20" y="50" fill="#8b949e" fontSize="7">{d.floor}</text>
        )}
        <text x="50" y="65" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Heizkreis links */}
      {circuitLeftPos.map((pct, i) => (
        <Handle key={`circuit-L${i + 1}`} type="source" position={Position.Left} id={`circuit-L${i + 1}`}
          style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* Verbraucher rechts */}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i + 1}`} type="source" position={Position.Right} id={`elec-R${i + 1}`}
          style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
