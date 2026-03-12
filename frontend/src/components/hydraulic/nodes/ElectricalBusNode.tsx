import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface ElectricalBusNodeData {
  label: string
  portsTop: number    // Eingänge oben (Einspeiser)
  portsBottom: number // Abgänge unten (Verbraucher)
  [key: string]: unknown
}

const MIN_WIDTH = 120
const PORT_SPACING = 50
const BAR_HEIGHT = 24
const TOTAL_HEIGHT = 50

export default memo(function ElectricalBusNode({ data, selected }: NodeProps) {
  const d = data as ElectricalBusNodeData
  const portsTop = d.portsTop || 3
  const portsBottom = d.portsBottom || 4

  const maxPorts = Math.max(portsTop, portsBottom)
  const width = Math.max(MIN_WIDTH, maxPorts * PORT_SPACING + 40)

  // Handle-Positionen berechnen
  const topHandles = useMemo(() => {
    const handles = []
    for (let i = 0; i < portsTop; i++) {
      const pct = ((i + 1) / (portsTop + 1)) * 100
      handles.push({ id: `elec-T${i + 1}`, pct })
    }
    return handles
  }, [portsTop])

  const bottomHandles = useMemo(() => {
    const handles = []
    for (let i = 0; i < portsBottom; i++) {
      const pct = ((i + 1) / (portsBottom + 1)) * 100
      handles.push({ id: `elec-B${i + 1}`, pct })
    }
    return handles
  }, [portsBottom])

  return (
    <div className="relative">
      <svg width={width} height={TOTAL_HEIGHT} viewBox={`0 0 ${width} ${TOTAL_HEIGHT}`}>
        {/* Sammelschiene: Kupferschiene mit 3 Phasen */}
        <rect x="0" y="10" width={width} height={BAR_HEIGHT} rx="3"
          fill="#1c2333" stroke={selected ? '#22c55e' : ENERGY_COLORS.electricity}
          strokeWidth={selected ? 2.5 : 1.5} />
        {/* 3 Phasen-Linien (L1, L2, L3) */}
        <line x1="8" y1="16" x2={width - 8} y2="16"
          stroke={ENERGY_COLORS.electricity} strokeWidth="1.2" opacity="0.5" />
        <line x1="8" y1="22" x2={width - 8} y2="22"
          stroke={ENERGY_COLORS.electricity} strokeWidth="1.5" opacity="0.7" />
        <line x1="8" y1="28" x2={width - 8} y2="28"
          stroke={ENERGY_COLORS.electricity} strokeWidth="1.2" opacity="0.5" />
        {/* Phasen-Labels */}
        <text x="4" y="18" fill={ENERGY_COLORS.electricity} fontSize="5" opacity="0.6">L1</text>
        <text x="4" y="24" fill={ENERGY_COLORS.electricity} fontSize="5" opacity="0.6">L2</text>
        <text x="4" y="30" fill={ENERGY_COLORS.electricity} fontSize="5" opacity="0.6">L3</text>
        {/* Anschluss-Markierungen oben */}
        {topHandles.map((h) => {
          const x = (h.pct / 100) * width
          return <line key={h.id} x1={x} y1="4" x2={x} y2="10"
            stroke={ENERGY_COLORS.electricity} strokeWidth="1.5" opacity="0.6" />
        })}
        {/* Anschluss-Markierungen unten */}
        {bottomHandles.map((h) => {
          const x = (h.pct / 100) * width
          return <line key={h.id} x1={x} y1="34" x2={x} y2="40"
            stroke={ENERGY_COLORS.electricity} strokeWidth="1.5" opacity="0.6" />
        })}
        {/* Label */}
        <text x={width / 2} y="48" textAnchor="middle" fill="#8b949e" fontSize="8">
          {d.label}
        </text>
      </svg>
      {/* Dynamische Handles oben */}
      {topHandles.map((h) => (
        <Handle key={h.id} type="source" position={Position.Top} id={h.id}
          style={{
            background: ENERGY_COLORS.electricity, width: 10, height: 10,
            border: '2px solid #30363d', top: -2, left: `${h.pct}%`,
          }} />
      ))}
      {/* Dynamische Handles unten (Abgänge) */}
      {bottomHandles.map((h) => (
        <Handle key={h.id} type="source" position={Position.Bottom} id={h.id}
          style={{
            background: ENERGY_COLORS.electricity, width: 10, height: 10,
            border: '2px solid #30363d', bottom: -2, left: `${h.pct}%`,
          }} />
      ))}
    </div>
  )
})
