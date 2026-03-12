import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

export interface HydraulicSeparatorNodeData {
  label: string
  portsLeft: number   // Erzeuger-Seite (VL rein + RL raus)
  portsRight: number  // Verbraucher-Seite (VL raus + RL rein)
  [key: string]: unknown
}

const SEP_WIDTH = 50
const MIN_HEIGHT = 120
const PORT_PAIR_SPACING = 60 // Abstand pro VL/RL-Paar

export default memo(function HydraulicSeparatorNode({ data, selected }: NodeProps) {
  const d = data as HydraulicSeparatorNodeData
  const portsLeft = d.portsLeft || 1
  const portsRight = d.portsRight || 3

  const maxPairs = Math.max(portsLeft, portsRight)
  const height = Math.max(MIN_HEIGHT, maxPairs * PORT_PAIR_SPACING + 40)
  const svgH = height + 20 // Platz für Label

  // VL-Zone (obere Hälfte), RL-Zone (untere Hälfte)
  const midY = height / 2

  // Erzeuger-Seite links: VL oben, RL unten
  const leftHandles = useMemo(() => {
    const handles: Array<{ id: string; y: number; type: 'vl' | 'rl' }> = []
    for (let i = 0; i < portsLeft; i++) {
      const vlY = 15 + (i / Math.max(portsLeft, 1)) * (midY - 30)
      const rlY = midY + 15 + (i / Math.max(portsLeft, 1)) * (midY - 30)
      handles.push({ id: `heat-L${i + 1}`, y: vlY, type: 'vl' })
      handles.push({ id: `heat-ret-L${i + 1}`, y: rlY, type: 'rl' })
    }
    return handles
  }, [portsLeft, midY])

  // Verbraucher-Seite rechts: VL oben, RL unten
  const rightHandles = useMemo(() => {
    const handles: Array<{ id: string; y: number; type: 'vl' | 'rl' }> = []
    for (let i = 0; i < portsRight; i++) {
      const vlY = 15 + (i / Math.max(portsRight - 1, 1)) * (midY - 30)
      const rlY = midY + 15 + (i / Math.max(portsRight - 1, 1)) * (midY - 30)
      handles.push({ id: `heat-R${i + 1}`, y: vlY, type: 'vl' })
      handles.push({ id: `heat-ret-R${i + 1}`, y: rlY, type: 'rl' })
    }
    return handles
  }, [portsRight, midY])

  return (
    <div className="relative">
      <svg width={SEP_WIDTH} height={svgH} viewBox={`0 0 ${SEP_WIDTH} ${svgH}`}>
        {/* Zylinder-Körper */}
        <rect x="10" y="5" width="30" height={height} rx="15"
          fill="#1c2333" stroke={selected ? '#22c55e' : '#8b949e'} strokeWidth={selected ? 2.5 : 1.5} />
        {/* Trennlinie VL/RL */}
        <line x1="13" y1={midY} x2="37" y2={midY}
          stroke="#8b949e" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
        {/* VL-Bereich (oben) */}
        <text x="25" y={midY - 8} textAnchor="middle" fill={ENERGY_COLORS.heat} fontSize="7" opacity="0.6">VL</text>
        {/* RL-Bereich (unten) */}
        <text x="25" y={midY + 16} textAnchor="middle" fill={ENERGY_COLORS.heat_return} fontSize="7" opacity="0.6">RL</text>
        {/* Strömungspfeil */}
        <path d={`M22,${midY - 25} L25,${midY - 15} L28,${midY - 25}`}
          fill="none" stroke="#8b949e" strokeWidth="0.8" opacity="0.3" />
        <path d={`M22,${midY + 15} L25,${midY + 25} L28,${midY + 15}`}
          fill="none" stroke="#8b949e" strokeWidth="0.8" opacity="0.3" />
        {/* Anschluss-Stubs links */}
        {leftHandles.map((h) => (
          <line key={h.id} x1="2" y1={h.y} x2="10" y2={h.y}
            stroke={h.type === 'vl' ? ENERGY_COLORS.heat : ENERGY_COLORS.heat_return}
            strokeWidth="1.5" opacity="0.6" />
        ))}
        {/* Anschluss-Stubs rechts */}
        {rightHandles.map((h) => (
          <line key={h.id} x1="40" y1={h.y} x2="48" y2={h.y}
            stroke={h.type === 'vl' ? ENERGY_COLORS.heat : ENERGY_COLORS.heat_return}
            strokeWidth="1.5" opacity="0.6" />
        ))}
        {/* Label */}
        <text x="25" y={height + 16} textAnchor="middle" fill="#8b949e" fontSize="8" fontWeight="500">
          {d.label}
        </text>
      </svg>
      {/* Dynamische Handles links */}
      {leftHandles.map((h) => (
        <Handle key={h.id}
          type="source"
          position={Position.Left} id={h.id}
          style={{
            background: h.type === 'vl' ? ENERGY_COLORS.heat : ENERGY_COLORS.heat_return,
            width: 10, height: 10, border: '2px solid #30363d',
            left: -2, top: h.y,
          }} />
      ))}
      {/* Dynamische Handles rechts */}
      {rightHandles.map((h) => (
        <Handle key={h.id}
          type="source"
          position={Position.Right} id={h.id}
          style={{
            background: h.type === 'vl' ? ENERGY_COLORS.heat : ENERGY_COLORS.heat_return,
            width: 10, height: 10, border: '2px solid #30363d',
            right: -2, top: h.y,
          }} />
      ))}
    </div>
  )
})
