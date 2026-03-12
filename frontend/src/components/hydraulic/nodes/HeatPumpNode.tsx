import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'

export interface HeatPumpNodeData {
  label: string
  entityId: string
  coolingCapable?: boolean
  [key: string]: unknown
}

export default memo(function HeatPumpNode({ data, selected }: NodeProps) {
  const d = data as HeatPumpNodeData
  return (
    <div className="relative">
      <CrossSchemaBadge entityId={d.entityId} currentSchema="hydraulic" />
      <svg width="140" height="90" viewBox="0 0 140 90">
        {/* Wärmepumpe: Kreis mit WP-Text (VDI 4645-ähnlich) */}
        <rect x="10" y="5" width="120" height="65" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#dc2626'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Kältekreis-Symbol: Kreis */}
        <circle cx="45" cy="38" r="18" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
        {/* Pfeil im Kreis (Kompressor) */}
        <path d="M38,45 L45,28 L52,45Z" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
        {/* Wärmetauscher rechts */}
        <path d="M70,22 Q80,30 70,38 Q80,46 70,54" fill="none" stroke="#dc2626" strokeWidth="1.8" />
        {/* WP Label */}
        <text x="105" y="42" textAnchor="middle" fill="#8b949e" fontSize="12" fontWeight="bold">WP</text>
        <text x="70" y="82" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* Strom links oben */}
      <Handle type="source" position={Position.Left} id="elec-L1"
        style={{ background: ENERGY_COLORS.electricity, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '25%' }} />
      {/* Quelle links unten */}
      <Handle type="source" position={Position.Left} id="source-L1"
        style={{ background: ENERGY_COLORS.source, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: '55%' }} />
      {/* Vorlauf rechts oben */}
      <Handle type="source" position={Position.Right} id="heat-R1"
        style={{ background: ENERGY_COLORS.heat, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '25%' }} />
      {/* Rücklauf rechts unten */}
      <Handle type="source" position={Position.Right} id="heat-ret-R1"
        style={{ background: ENERGY_COLORS.heat_return, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '55%' }} />
    </div>
  )
})
