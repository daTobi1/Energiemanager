import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import CrossSchemaBadge from '../../shared/CrossSchemaBadge'
import { handlePositions } from '../../shared/handlePositions'

/** Wallbox / Ladestation — Stecker-Symbol mit Auto */
export default memo(function WallboxNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const entityId = d.entityId as string | undefined
  const elecLeftCount = (d.portsElecLeft as number) || 1
  const elecLeftPos = handlePositions(elecLeftCount, 25, 65)
  return (
    <div className="relative">
      {entityId && <CrossSchemaBadge entityId={entityId} currentSchema="electrical" />}
      <svg width="80" height="85" viewBox="0 0 80 85">
        {/* Gehäuse */}
        <rect x="15" y="8" width="50" height="50" rx="6"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#059669'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Blitz (Laden) */}
        <path d="M36,16 L30,33 L38,31 L32,50" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
        {/* Stecker rechts */}
        <rect x="48" y="24" width="12" height="18" rx="2" fill="none" stroke="#059669" strokeWidth="1.2" />
        <line x1="52" y1="28" x2="52" y2="32" stroke="#059669" strokeWidth="1.5" />
        <line x1="56" y1="28" x2="56" y2="32" stroke="#059669" strokeWidth="1.5" />
        <line x1="54" y1="35" x2="54" y2="38" stroke="#059669" strokeWidth="1.5" />
        {/* kW */}
        {d.nominalPowerKw && (
          <text x="40" y="65" textAnchor="middle" fill="#8b949e" fontSize="7">{String(d.nominalPowerKw)} kW</text>
        )}
        <text x="40" y="80" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* links */}
      {elecLeftPos.map((pct, i) => (
        <Handle key={`elec-L${i+1}`} type="source" position={Position.Left} id={`elec-L${i+1}`}
          style={{ background: '#059669', width: 10, height: 10, border: '2px solid #30363d', left: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
