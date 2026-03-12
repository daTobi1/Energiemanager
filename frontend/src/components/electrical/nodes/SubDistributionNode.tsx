import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'

/** Unterverteilung — Kasten mit mehreren Abgängen */
export default memo(function SubDistributionNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const outputs = (d.outputs as number) || 4
  const width = Math.max(80, outputs * 30 + 20)

  const outHandles = useMemo(() => {
    const h = []
    for (let i = 0; i < outputs; i++) h.push({ id: `elec-B${i + 1}`, pct: ((i + 1) / (outputs + 1)) * 100 })
    return h
  }, [outputs])

  return (
    <div className="relative">
      <svg width={width} height="70" viewBox={`0 0 ${width} 70`}>
        {/* Kasten */}
        <rect x="5" y="10" width={width - 10} height="35" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.phase}
          strokeWidth={selected ? 2.5 : 1.5} />
        {/* Eingangsleitung oben */}
        <line x1={width / 2} y1="2" x2={width / 2} y2="10" stroke={ELEC_COLORS.phase} strokeWidth="2" />
        {/* LS-Schalter Symbole innen */}
        {outHandles.map((h, i) => {
          const x = (h.pct / 100) * width
          return (
            <g key={i}>
              <line x1={x} y1="18" x2={x + 4} y2="30" stroke={ELEC_COLORS.phase} strokeWidth="1.2" />
              <circle cx={x} cy="18" r="1.5" fill={ELEC_COLORS.phase} />
              <circle cx={x} cy="33" r="1.5" fill={ELEC_COLORS.phase} />
              <line x1={x} y1="33" x2={x} y2="45" stroke={ELEC_COLORS.phase} strokeWidth="1" />
            </g>
          )
        })}
        {/* UV Label */}
        <text x={width / 2} y="60" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* oben */}
      <Handle type="source" position={Position.Top} id="elec-T1"
        style={{ background: ELEC_COLORS.phase, width: 10, height: 10, border: '2px solid #30363d', top: -2 }} />
      {/* Abgänge unten */}
      {outHandles.map((h) => (
        <Handle key={h.id} type="source" position={Position.Bottom} id={h.id}
          style={{ background: ELEC_COLORS.phase, width: 8, height: 8, border: '2px solid #30363d', bottom: 6, left: `${h.pct}%` }} />
      ))}
    </div>
  )
})
