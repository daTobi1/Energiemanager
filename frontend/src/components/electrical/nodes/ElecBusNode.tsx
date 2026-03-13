import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'

/** Sammelschiene — Kupferschiene mit dynamischen Abgängen */

const MIN_WIDTH = 120
const PORT_SPACING = 50

export default memo(function ElecBusNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const portsTop = (d.portsTop as number) || 3
  const portsBottom = (d.portsBottom as number) || 4
  const maxPorts = Math.max(portsTop, portsBottom)
  const width = Math.max(MIN_WIDTH, maxPorts * PORT_SPACING + 40)

  const topHandles = useMemo(() => {
    const h = []
    for (let i = 0; i < portsTop; i++) h.push({ id: `elec-T${i + 1}`, pct: ((i + 1) / (portsTop + 1)) * 100 })
    return h
  }, [portsTop])

  const bottomHandles = useMemo(() => {
    const h = []
    for (let i = 0; i < portsBottom; i++) h.push({ id: `elec-B${i + 1}`, pct: ((i + 1) / (portsBottom + 1)) * 100 })
    return h
  }, [portsBottom])

  return (
    <div className="relative">
      <svg width={width} height="50" viewBox={`0 0 ${width} 50`}>
        <rect x="0" y="10" width={width} height="24" rx="3"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.bus}
          strokeWidth={selected ? 2.5 : 1.5} />
        {/* 3 Phasen L1 L2 L3 */}
        <line x1="8" y1="16" x2={width - 8} y2="16" stroke={ELEC_COLORS.bus} strokeWidth="1.2" opacity="0.5" />
        <line x1="8" y1="22" x2={width - 8} y2="22" stroke={ELEC_COLORS.bus} strokeWidth="1.5" opacity="0.7" />
        <line x1="8" y1="28" x2={width - 8} y2="28" stroke={ELEC_COLORS.bus} strokeWidth="1.2" opacity="0.5" />
        <text x="4" y="18" fill={ELEC_COLORS.bus} fontSize="5" opacity="0.6">L1</text>
        <text x="4" y="24" fill={ELEC_COLORS.bus} fontSize="5" opacity="0.6">L2</text>
        <text x="4" y="30" fill={ELEC_COLORS.bus} fontSize="5" opacity="0.6">L3</text>
        {/* Stubs oben */}
        {topHandles.map((h) => {
          const x = (h.pct / 100) * width
          return <line key={h.id} x1={x} y1="4" x2={x} y2="10" stroke={ELEC_COLORS.bus} strokeWidth="1.5" opacity="0.6" />
        })}
        {/* Stubs unten */}
        {bottomHandles.map((h) => {
          const x = (h.pct / 100) * width
          return <line key={h.id} x1={x} y1="34" x2={x} y2="40" stroke={ELEC_COLORS.bus} strokeWidth="1.5" opacity="0.6" />
        })}
        <text x={width / 2} y="48" textAnchor="middle" fill="#8b949e" fontSize="8">
          {d.label as string}
        </text>
      </svg>
      {topHandles.map((h) => (
        <Handle key={h.id} type="source" position={Position.Top} id={h.id}
          style={{ background: ELEC_COLORS.bus, width: 10, height: 10, border: '2px solid #30363d', top: -2, left: `${h.pct}%` }} />
      ))}
      {bottomHandles.map((h) => (
        <Handle key={h.id} type="source" position={Position.Bottom} id={h.id}
          style={{ background: ELEC_COLORS.bus, width: 10, height: 10, border: '2px solid #30363d', bottom: -2, left: `${h.pct}%` }} />
      ))}
    </div>
  )
})
