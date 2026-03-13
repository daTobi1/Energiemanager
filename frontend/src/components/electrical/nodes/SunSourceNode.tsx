import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'

/** Sonne — Natürliche Energiequelle für PV-Anlagen */
export default memo(function SunSourceNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className="relative">
      <svg width="80" height="85" viewBox="0 0 80 85">
        {/* Sonnenkreis */}
        <circle cx="40" cy="32" r="16" fill="#f59e0b" opacity="0.9"
          stroke={selected ? '#22c55e' : '#f59e0b'} strokeWidth={selected ? 2.5 : 0} />
        {/* Sonnenstrahlen */}
        <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <line x1="40" y1="8" x2="40" y2="2" />
          <line x1="40" y1="56" x2="40" y2="62" />
          <line x1="16" y1="32" x2="10" y2="32" />
          <line x1="64" y1="32" x2="70" y2="32" />
          <line x1="23" y1="15" x2="19" y2="11" />
          <line x1="57" y1="15" x2="61" y2="11" />
          <line x1="23" y1="49" x2="19" y2="53" />
          <line x1="57" y1="49" x2="61" y2="53" />
        </g>
        {/* kW Einstrahlung */}
        {d.irradianceKwm2 && (
          <text x="40" y="68" textAnchor="middle" fill="#8b949e" fontSize="7">
            {String(d.irradianceKwm2)} kW/m²
          </text>
        )}
        <text x="40" y="80" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* Messstelle links (Pyranometer etc.) */}
      <Handle type="source" position={Position.Left} id="meter-L1"
        style={{ background: '#0891b2', width: 8, height: 8, border: '2px solid #30363d', left: -2, top: '38%' }} />
      {/* Energieausgang rechts */}
      <Handle type="source" position={Position.Right} id="elec-R1"
        style={{ background: ELEC_COLORS.generation, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: '38%' }} />
    </div>
  )
})
