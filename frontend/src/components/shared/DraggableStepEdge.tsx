/**
 * Wrapper für Step-Edges mit ziehbarem Eckpunkt.
 *
 * Rendert einen unsichtbaren Drag-Handle an der Biegung der Leitung.
 * Beim Ziehen wird `data.offsetX` aktualisiert → die Biegung verschiebt sich.
 */

import { useCallback, useRef } from 'react'
import { BaseEdge, getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react'

const GRID = 20

interface DraggableStepEdgeProps {
  edge: EdgeProps
  color: string
  strokeWidth: number
  selectedStrokeWidth: number
  dashArray?: string
  filter?: string
}

export default function DraggableStepEdge({
  edge,
  color,
  strokeWidth,
  selectedStrokeWidth,
  dashArray,
  filter,
}: DraggableStepEdgeProps) {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, selected, data,
  } = edge
  const { setEdges } = useReactFlow()

  const offsetX = (data?.offsetX as number) || 0

  // Pfad mit benutzerdefiniertem centerX berechnen
  const defaultCenterX = (sourceX + targetX) / 2
  const defaultCenterY = (sourceY + targetY) / 2

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
    centerX: defaultCenterX + offsetX,
    centerY: defaultCenterY,
  })

  // Drag-State
  const dragging = useRef(false)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const centerXRef = useRef(defaultCenterX)
  centerXRef.current = defaultCenterX

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startOffset.current = offsetX

    const onMouseMove = (me: MouseEvent) => {
      if (!dragging.current) return
      const dx = me.clientX - startX.current
      const svgEl = (e.target as Element).closest('.react-flow')?.querySelector('.react-flow__viewport')
      let scale = 1
      if (svgEl) {
        const transform = svgEl.getAttribute('transform') || ''
        const m = transform.match(/scale\(([^)]+)\)/)
        if (m) scale = parseFloat(m[1]) || 1
      }
      const cx = centerXRef.current
      const rawCenterX = cx + startOffset.current + dx / scale
      const snappedCenterX = Math.round(rawCenterX / GRID) * GRID
      const newOffset = snappedCenterX - cx
      setEdges((eds) =>
        eds.map((ed) =>
          ed.id === id
            ? { ...ed, data: { ...ed.data, offsetX: newOffset } }
            : ed,
        ),
      )
    }

    const onMouseUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [id, offsetX, setEdges])

  // Nur Drag-Handle anzeigen wenn die Leitung eine Biegung hat
  const hasBend = Math.abs(sourceY - targetY) > 5 && Math.abs(sourceX - targetX) > 5

  return (
    <>
      {/* Transparenter Hit-Bereich */}
      <BaseEdge
        path={path}
        style={{ stroke: 'transparent', strokeWidth: 14 }}
      />
      {/* Sichtbare Leitung */}
      <BaseEdge
        path={path}
        style={{
          stroke: color,
          strokeWidth: selected ? selectedStrokeWidth : strokeWidth,
          strokeDasharray: dashArray,
          filter: selected ? filter : undefined,
        }}
      />
      {/* Ziehbarer Eckpunkt */}
      {hasBend && (
        <circle
          cx={labelX}
          cy={labelY}
          r={6}
          fill={color}
          fillOpacity={selected ? 0.8 : 0}
          stroke={color}
          strokeOpacity={selected ? 1 : 0}
          strokeWidth={1.5}
          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
          onMouseDown={onMouseDown}
          onMouseEnter={(e) => {
            const c = e.currentTarget
            c.setAttribute('fill-opacity', '0.6')
            c.setAttribute('stroke-opacity', '1')
          }}
          onMouseLeave={(e) => {
            if (dragging.current) return
            const c = e.currentTarget
            c.setAttribute('fill-opacity', selected ? '0.8' : '0')
            c.setAttribute('stroke-opacity', selected ? '1' : '0')
          }}
        />
      )}
    </>
  )
}
