import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'

/** Verbraucher-Last — IEC: Dreieck nach unten (Last-Symbol) */

const subTypeConfig: Record<string, { symbol: string; color: string }> = {
  household:   { symbol: '⌂', color: '#16a34a' },
  commercial:  { symbol: '◻', color: '#7c3aed' },
  production:  { symbol: '⚙', color: '#ea580c' },
  lighting:    { symbol: '☀', color: '#eab308' },
  hvac:        { symbol: 'M', color: '#2563eb' },
  ventilation: { symbol: '⊕', color: '#06b6d4' },
  hot_water:   { symbol: '♨', color: '#dc2626' },
  other:       { symbol: '○', color: '#6b7280' },
}

export default memo(function ConsumerLoadNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const cfg = subTypeConfig[(d.consumerType as string) || 'household'] || subTypeConfig.household

  const entityId = d.entityId as string | undefined
  return (
    <div className="relative">
      {entityId && <CrossSchemaBadge entityId={entityId} currentSchema="electrical" />}
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Last-Dreieck (IEC 60617 — allg. Verbraucher) */}
        <path d="M20,15 L60,15 L40,52Z"
          fill="#1c2333" stroke={selected ? '#22c55e' : cfg.color} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Anschluss oben */}
        <line x1="40" y1="5" x2="40" y2="15" stroke={cfg.color} strokeWidth="2" />
        {/* Typ-Symbol */}
        <text x="40" y="40" textAnchor="middle" fill={cfg.color} fontSize="14">
          {cfg.symbol}
        </text>
        {/* kW */}
        {d.nominalPowerKw && (
          <text x="40" y="62" textAnchor="middle" fill="#8b949e" fontSize="7">{String(d.nominalPowerKw)} kW</text>
        )}
        <text x="40" y="75" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* oben */}
      <Handle type="source" position={Position.Top} id="elec-T1"
        style={{ background: cfg.color, width: 10, height: 10, border: '2px solid #30363d', top: -2 }} />
    </div>
  )
})
