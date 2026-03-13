import { memo, useEffect, useState } from 'react'
import { useEdges, useNodes, useStore } from '@xyflow/react'

/**
 * Kreuzungsbogen-Overlay für Schema-Diagramme.
 *
 * Erkennt Leitungskreuzungen (Edges die sich kreuzen aber nicht
 * am selben Knoten verbunden sind) und zeichnet den typischen
 * Halbkreisbogen (eine Leitung "springt" über die andere).
 */

interface CrossingPoint {
  x: number
  y: number
  /** true = jumping edge is horizontal, false = vertical */
  isHorizontal: boolean
  jumpColor: string
  underColor: string
}

/* ── Segment-Intersection (2D) ────────────────────────── */

function segIntersection(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): [number, number] | null {
  const dax = ax2 - ax1, day = ay2 - ay1
  const dbx = bx2 - bx1, dby = by2 - by1
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-10) return null // parallel
  const t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom
  const u = ((bx1 - ax1) * day - (by1 - ay1) * dax) / denom
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null
  return [ax1 + t * dax, ay1 + t * day]
}

/* ── Sample SVG path into line segments ───────────────── */

function samplePath(pathEl: SVGPathElement, step = 5): [number, number][] {
  const len = pathEl.getTotalLength()
  const pts: [number, number][] = []
  for (let d = 0; d <= len; d += step) {
    const p = pathEl.getPointAtLength(d)
    pts.push([p.x, p.y])
  }
  // Always include exact endpoint
  const end = pathEl.getPointAtLength(len)
  if (pts.length === 0 || (pts[pts.length - 1][0] !== end.x || pts[pts.length - 1][1] !== end.y)) {
    pts.push([end.x, end.y])
  }
  return pts
}

/* ── Get stroke color from computed style ─────────────── */

function getVisibleColor(edgeEl: Element): string {
  const paths = edgeEl.querySelectorAll('path')
  for (let i = paths.length - 1; i >= 0; i--) {
    const stroke = paths[i].getAttribute('style')
    if (stroke && !stroke.includes('transparent')) {
      const match = stroke.match(/stroke:\s*(#[0-9a-fA-F]{3,8}|rgb[^)]+\))/)
      if (match) return match[1]
    }
  }
  return '#8b949e'
}

/* ── Main Component ───────────────────────────────────── */

export default memo(function CrossingArcsOverlay() {
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const edges = useEdges()
  const nodes = useNodes()
  const [crossings, setCrossings] = useState<CrossingPoint[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const edgeEls = document.querySelectorAll('.react-flow__edge')
        if (edgeEls.length < 2) { setCrossings([]); return }

        // Build per-edge data: { edgeId, sourceId, targetId, points[], color }
        const edgeInfos: Array<{
          sourceId: string; targetId: string
          points: [number, number][]; color: string
        }> = []

        edgeEls.forEach((el) => {
          // Extract edge ID from data-testid="rf__edge-{id}"
          const testId = el.getAttribute('data-testid') || ''
          const edgeId = testId.replace('rf__edge-', '')
          const edge = edges.find((e) => e.id === edgeId)
          if (!edge) return

          // Get the visible path (last path with non-transparent stroke)
          const paths = el.querySelectorAll('path')
          let visiblePath: SVGPathElement | null = null
          for (let i = paths.length - 1; i >= 0; i--) {
            const style = paths[i].getAttribute('style') || ''
            if (!style.includes('transparent')) {
              visiblePath = paths[i] as SVGPathElement
              break
            }
          }
          if (!visiblePath) {
            visiblePath = paths[0] as SVGPathElement
          }
          if (!visiblePath) return

          const points = samplePath(visiblePath)
          if (points.length < 2) return

          const color = getVisibleColor(el)

          edgeInfos.push({
            sourceId: edge.source,
            targetId: edge.target,
            points,
            color,
          })
        })

        // Find crossings between non-connected edge pairs
        const found: CrossingPoint[] = []

        for (let i = 0; i < edgeInfos.length; i++) {
          for (let j = i + 1; j < edgeInfos.length; j++) {
            const a = edgeInfos[i]
            const b = edgeInfos[j]

            // Skip if edges share a node (they're connected, not crossing)
            if (
              a.sourceId === b.sourceId || a.sourceId === b.targetId ||
              a.targetId === b.sourceId || a.targetId === b.targetId
            ) continue

            // Check segments for intersections
            for (let ai = 1; ai < a.points.length; ai++) {
              for (let bi = 1; bi < b.points.length; bi++) {
                const cross = segIntersection(
                  a.points[ai - 1][0], a.points[ai - 1][1],
                  a.points[ai][0], a.points[ai][1],
                  b.points[bi - 1][0], b.points[bi - 1][1],
                  b.points[bi][0], b.points[bi][1],
                )
                if (!cross) continue

                // Deduplicate nearby crossings
                if (found.some((f) => Math.abs(f.x - cross[0]) < 8 && Math.abs(f.y - cross[1]) < 8)) continue

                // Determine direction of edge B at crossing
                const dx = b.points[bi][0] - b.points[bi - 1][0]
                const dy = b.points[bi][1] - b.points[bi - 1][1]
                const isHorizontal = Math.abs(dx) > Math.abs(dy)

                found.push({
                  x: cross[0],
                  y: cross[1],
                  isHorizontal,
                  jumpColor: b.color,
                  underColor: a.color,
                })
              }
            }
          }
        }

        setCrossings(found)
      })
    }, 200) // Debounce 200ms to avoid recalculating during drag

    return () => clearTimeout(timer)
    // Re-run when edges or node positions change
  }, [edges, nodes])

  if (crossings.length === 0) return null

  const R = 7 // Arc radius

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      <svg width="100%" height="100%">
        <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
          {crossings.map((c, i) =>
            c.isHorizontal ? (
              /* Edge B is horizontal → it jumps over vertical edge A */
              <g key={i}>
                {/* Erase horizontal segment under arc */}
                <rect
                  x={c.x - R - 1} y={c.y - 4}
                  width={(R + 1) * 2} height={8}
                  fill="#0d1117"
                />
                {/* Redraw vertical edge A through crossing */}
                <line
                  x1={c.x} y1={c.y - R - 2}
                  x2={c.x} y2={c.y + R + 2}
                  stroke={c.underColor} strokeWidth={2.5}
                />
                {/* Semicircle arc for horizontal edge B */}
                <path
                  d={`M ${c.x - R} ${c.y} A ${R} ${R} 0 0 1 ${c.x + R} ${c.y}`}
                  fill="none" stroke={c.jumpColor} strokeWidth={2.5}
                />
              </g>
            ) : (
              /* Edge B is vertical → it jumps over horizontal edge A */
              <g key={i}>
                {/* Erase vertical segment under arc */}
                <rect
                  x={c.x - 4} y={c.y - R - 1}
                  width={8} height={(R + 1) * 2}
                  fill="#0d1117"
                />
                {/* Redraw horizontal edge A through crossing */}
                <line
                  x1={c.x - R - 2} y1={c.y}
                  x2={c.x + R + 2} y2={c.y}
                  stroke={c.underColor} strokeWidth={2.5}
                />
                {/* Semicircle arc for vertical edge B */}
                <path
                  d={`M ${c.x} ${c.y - R} A ${R} ${R} 0 0 1 ${c.x} ${c.y + R}`}
                  fill="none" stroke={c.jumpColor} strokeWidth={2.5}
                />
              </g>
            ),
          )}
        </g>
      </svg>
    </div>
  )
})
