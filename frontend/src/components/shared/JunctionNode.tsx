import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

/**
 * Verbindungspunkt (T-Stück / Kreuzung) — kleiner Punkt mit 4 Handles.
 * Wird in Hydraulik- und Stromschema als universeller Knotenpunkt genutzt.
 * data.color bestimmt die Punktfarbe (default: grau).
 */
export default memo(function JunctionNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const color = (d.color as string) || '#8b949e'
  const size = 10

  const handleStyle = (pos: 'top' | 'right' | 'bottom' | 'left') => {
    const base = {
      background: color,
      width: 8,
      height: 8,
      border: `2px solid ${selected ? '#22c55e' : '#30363d'}`,
    }
    switch (pos) {
      case 'top': return { ...base, top: -3 }
      case 'right': return { ...base, right: -3 }
      case 'bottom': return { ...base, bottom: -3 }
      case 'left': return { ...base, left: -3 }
    }
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Punkt */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: selected ? '#22c55e' : color,
          border: `2px solid ${selected ? '#22c55e' : '#30363d'}`,
        }}
      />
      {/* 4 universelle Handles */}
      <Handle type="source" position={Position.Top} id="junction-T1" style={handleStyle('top')} />
      <Handle type="source" position={Position.Right} id="junction-R1" style={handleStyle('right')} />
      <Handle type="source" position={Position.Bottom} id="junction-B1" style={handleStyle('bottom')} />
      <Handle type="source" position={Position.Left} id="junction-L1" style={handleStyle('left')} />
    </div>
  )
})
