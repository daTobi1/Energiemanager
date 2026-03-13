import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

export interface CircuitNodeData {
  label: string
  entityId: string
  circuitType: 'heating' | 'cooling' | 'combined'
  distributionType?: string
  flowTempC?: number
  returnTempC?: number
  [key: string]: unknown
}

const distLabels: Record<string, string> = {
  floor_heating: 'FBH',
  radiator: 'HK',
  fan_coil: 'GK',
  ceiling_cooling: 'DK',
  mixed: 'MIX',
}

export default memo(function CircuitNode({ data, selected }: NodeProps) {
  const d = data as CircuitNodeData
  const isHeating = d.circuitType !== 'cooling'
  const isCooling = d.circuitType === 'cooling' || d.circuitType === 'combined'
  const primaryColor = isHeating ? ENERGY_COLORS.heat : ENERGY_COLORS.cold
  const distLabel = distLabels[d.distributionType || ''] || ''

  const dd = data as Record<string, unknown>
  const heatLeftCount = (dd.portsHeatLeft as number) || 1
  const circuitRightCount = (dd.portsCircuitRight as number) || 1
  const heatLeftPos = handlePositions(heatLeftCount, 15, 40)
  const heatRetLeftPos = handlePositions(heatLeftCount, 50, 75)
  const circuitRightPos = handlePositions(circuitRightCount, 25, 65)

  return (
    <div className="relative">
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Heizkreis: Rechteck mit Heizschlangen-Symbol */}
        <rect x="10" y="8" width="100" height="50" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : primaryColor} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Heizschlange / Kühlfläche */}
        {isHeating ? (
          <>
            <path d="M25,22 Q35,18 35,28 Q35,38 45,34 Q55,30 55,40 Q55,50 65,46"
              fill="none" stroke={ENERGY_COLORS.heat} strokeWidth="1.5" />
            <path d="M70,22 Q80,18 80,28 Q80,38 90,34"
              fill="none" stroke={ENERGY_COLORS.heat} strokeWidth="1.5" />
          </>
        ) : (
          <>
            <line x1="25" y1="25" x2="95" y2="25" stroke={ENERGY_COLORS.cold} strokeWidth="1" />
            <line x1="25" y1="33" x2="95" y2="33" stroke={ENERGY_COLORS.cold} strokeWidth="1" />
            <line x1="25" y1="41" x2="95" y2="41" stroke={ENERGY_COLORS.cold} strokeWidth="1" />
          </>
        )}
        {/* Temperatur-Info */}
        {d.flowTempC && (
          <text x="105" y="20" textAnchor="end" fill={primaryColor} fontSize="7" opacity="0.8">
            {d.flowTempC}/{d.returnTempC}°C
          </text>
        )}
        {/* Distribution-Type Badge */}
        {distLabel && (
          <text x="105" y="52" textAnchor="end" fill="#8b949e" fontSize="8">{distLabel}</text>
        )}
        <text x="60" y="72" textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600">
          {d.label}
        </text>
      </svg>
      {/* VL links oben */}
      {heatLeftPos.map((pct, i) => (
        <Handle key={`heat-L${i + 1}`} type="source" position={Position.Left} id={`heat-L${i + 1}`}
          style={{ background: primaryColor, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* RL links unten */}
      {heatRetLeftPos.map((pct, i) => (
        <Handle key={`heat-ret-L${i + 1}`} type="source" position={Position.Left} id={`heat-ret-L${i + 1}`}
          style={{ background: isHeating ? ENERGY_COLORS.heat_return : ENERGY_COLORS.cold_return, width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
      {/* Weiter zu Räumen rechts */}
      {circuitRightPos.map((pct, i) => (
        <Handle key={`circuit-R${i + 1}`} type="source" position={Position.Right} id={`circuit-R${i + 1}`}
          style={{ background: primaryColor, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
