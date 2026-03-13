/**
 * Hook für automatische Verbindungspunkt-Logik in Schema-Editoren:
 *
 * 1. Linie auf Linie droppen → Junction automatisch einfügen + Edge splitten
 * 2. Junction löschen → gegenüberliegende Leitungen automatisch reconnecten
 */

import { useCallback, useRef } from 'react'
import type { Node, Edge, InternalNode } from '@xyflow/react'
import { Position, useReactFlow } from '@xyflow/react'
import { v4 as uuid } from 'uuid'

interface AutoJunctionConfig {
  edges: Edge[]
  setNodes: (fn: (nds: Node[]) => Node[]) => void
  setEdges: (fn: (eds: Edge[]) => Edge[]) => void
  pushUndo: () => void
  gridSize: number
  /** Edge-Typ + Daten aus Handle-IDs ableiten. Bei originalEdge dessen Properties übernehmen. */
  createEdgeProps: (
    srcHandle: string,
    tgtHandle: string,
    originalEdge?: Edge,
  ) => { type: string; data?: Record<string, unknown> }
}

/* ── Nächsten Punkt auf einem SVG-Pfad finden ──────────── */

export function findNearestOnPath(
  pathEl: SVGPathElement,
  target: { x: number; y: number },
): { point: { x: number; y: number }; dist: number; isHorizontal: boolean; len: number } {
  const totalLen = pathEl.getTotalLength()
  let bestDist = Infinity
  let bestLen = 0

  // Grobe Suche (Schritt 5px)
  for (let d = 0; d <= totalLen; d += 5) {
    const p = pathEl.getPointAtLength(d)
    const dist = Math.hypot(p.x - target.x, p.y - target.y)
    if (dist < bestDist) {
      bestDist = dist
      bestLen = d
    }
  }

  // Feinsuche (±5px, Schritt 1px)
  for (let d = Math.max(0, bestLen - 5); d <= Math.min(totalLen, bestLen + 5); d += 1) {
    const p = pathEl.getPointAtLength(d)
    const dist = Math.hypot(p.x - target.x, p.y - target.y)
    if (dist < bestDist) {
      bestDist = dist
      bestLen = d
    }
  }

  const pt = pathEl.getPointAtLength(bestLen)
  const p1 = pathEl.getPointAtLength(Math.max(0, bestLen - 5))
  const p2 = pathEl.getPointAtLength(Math.min(totalLen, bestLen + 5))
  const isHorizontal = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y)

  return { point: { x: pt.x, y: pt.y }, dist: bestDist, isHorizontal, len: bestLen }
}

/* ── Segment-Grenzen entlang eines Pfads finden ────────── */

/**
 * Findet Start- und Endpunkt eines geraden Segments (horizontal oder vertikal)
 * auf einem SVG-Pfad, ausgehend von einem Punkt in der Nähe.
 */
export function findSegmentBounds(
  pathEl: SVGPathElement,
  nearLength: number,
  isHorizontal: boolean,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const totalLen = pathEl.getTotalLength()
  const step = 2
  const sample = 4

  // Rückwärts suchen bis Richtung wechselt
  let startLen = nearLength
  for (let d = nearLength; d >= 0; d -= step) {
    const p1 = pathEl.getPointAtLength(d)
    const p2 = pathEl.getPointAtLength(Math.max(0, d - sample))
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)
    if (dx + dy < 0.5) continue
    if ((dx > dy) !== isHorizontal) break
    startLen = d
  }

  // Vorwärts suchen bis Richtung wechselt
  let endLen = nearLength
  for (let d = nearLength; d <= totalLen; d += step) {
    const p1 = pathEl.getPointAtLength(d)
    const p2 = pathEl.getPointAtLength(Math.min(totalLen, d + sample))
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)
    if (dx + dy < 0.5) continue
    if ((dx > dy) !== isHorizontal) break
    endLen = d
  }

  const sp = pathEl.getPointAtLength(startLen)
  const ep = pathEl.getPointAtLength(endLen)
  return { start: { x: sp.x, y: sp.y }, end: { x: ep.x, y: ep.y } }
}

/* ── Sichtbaren Edge-Path aus dem DOM holen ────────────── */

export function getVisiblePath(edgeEl: Element): SVGPathElement | null {
  const paths = edgeEl.querySelectorAll('path')
  // Letzten nicht-transparenten Pfad nehmen (der sichtbare)
  for (let i = paths.length - 1; i >= 0; i--) {
    const style = paths[i].getAttribute('style') || ''
    if (!style.includes('transparent')) return paths[i] as SVGPathElement
  }
  return (paths[0] as SVGPathElement) || null
}

/* ── Nächste Edge an einem Punkt finden (für Drop-on-Edge) ── */

export function findNearestEdgeAtPoint(
  point: { x: number; y: number },
  edges: Edge[],
  excludeNodeIds: string[] = [],
  threshold = 20,
): { edge: Edge; point: { x: number; y: number }; dist: number } | null {
  const edgeEls = document.querySelectorAll('.react-flow__edge')
  let bestEdge: Edge | null = null
  let bestPoint = { x: 0, y: 0 }
  let bestDist = Infinity

  edgeEls.forEach((el) => {
    const testId = el.getAttribute('data-testid') || ''
    const edgeId = testId.replace('rf__edge-', '')
    const edge = edges.find((e) => e.id === edgeId)
    if (!edge) return
    if (excludeNodeIds.includes(edge.source) || excludeNodeIds.includes(edge.target)) return

    const pathEl = getVisiblePath(el)
    if (!pathEl) return

    const result = findNearestOnPath(pathEl, point)
    if (result.dist < bestDist) {
      bestDist = result.dist
      bestPoint = result.point
      bestEdge = edge
    }
  })

  if (!bestEdge || bestDist > threshold) return null
  return { edge: bestEdge, point: bestPoint, dist: bestDist }
}

/* ── Mathematische Edge-Erkennung (kein DOM nötig) ───── */

/** Kürzester Abstand von Punkt zu Liniensegment + nächster Punkt */
function distToSeg(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
): { dist: number; point: { x: number; y: number } } {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return { dist: Math.hypot(px - x1, py - y1), point: { x: x1, y: y1 } }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  const projX = x1 + t * dx, projY = y1 + t * dy
  return { dist: Math.hypot(px - projX, py - projY), point: { x: projX, y: projY } }
}

/** Handle-Position in Flow-Koordinaten aus InternalNode lesen */
function getHandlePos(
  node: InternalNode,
  handleId: string,
): { x: number; y: number; position: Position } | null {
  const bounds = (node as any).internals?.handleBounds
  if (!bounds) return null
  const allHandles = [...(bounds.source || []), ...(bounds.target || [])]
  const h = allHandles.find((hh: any) => hh.id === handleId)
  if (!h) return null
  return {
    x: node.position.x + h.x + h.width / 2,
    y: node.position.y + h.y + h.height / 2,
    position: h.position,
  }
}

/**
 * Findet die nächste Edge an einem Flow-Punkt — rein mathematisch,
 * ohne DOM-Queries oder getPointAtLength(). Berechnet den Step-Edge-Pfad
 * aus den Handle-Positionen der Quell-/Zielknoten.
 */
export function findNearestEdgeMath(
  point: { x: number; y: number },
  edges: Edge[],
  getInternalNode: (id: string) => InternalNode | undefined,
  threshold = 40,
): { edge: Edge; point: { x: number; y: number }; dist: number } | null {
  let bestEdge: Edge | null = null
  let bestPoint = { x: 0, y: 0 }
  let bestDist = Infinity

  for (const edge of edges) {
    const srcNode = getInternalNode(edge.source)
    const tgtNode = getInternalNode(edge.target)
    if (!srcNode || !tgtNode) continue

    const srcH = edge.sourceHandle ? getHandlePos(srcNode, edge.sourceHandle) : null
    const tgtH = edge.targetHandle ? getHandlePos(tgtNode, edge.targetHandle) : null
    if (!srcH || !tgtH) continue

    const offsetX = ((edge.data as Record<string, unknown>)?.offsetX as number) || 0

    // Step-Edge-Pfad: 3 Segmente
    const isVerticalRoute =
      (srcH.position === Position.Top || srcH.position === Position.Bottom) &&
      (tgtH.position === Position.Top || tgtH.position === Position.Bottom)

    let segments: Array<[number, number, number, number]>
    if (isVerticalRoute) {
      const cy = (srcH.y + tgtH.y) / 2
      segments = [
        [srcH.x, srcH.y, srcH.x, cy],
        [srcH.x, cy, tgtH.x, cy],
        [tgtH.x, cy, tgtH.x, tgtH.y],
      ]
    } else {
      const cx = (srcH.x + tgtH.x) / 2 + offsetX
      segments = [
        [srcH.x, srcH.y, cx, srcH.y],
        [cx, srcH.y, cx, tgtH.y],
        [cx, tgtH.y, tgtH.x, tgtH.y],
      ]
    }

    for (const [x1, y1, x2, y2] of segments) {
      const result = distToSeg(point.x, point.y, x1, y1, x2, y2)
      if (result.dist < bestDist) {
        bestDist = result.dist
        bestPoint = result.point
        bestEdge = edge
      }
    }
  }

  if (!bestEdge || bestDist > threshold) return null
  return { edge: bestEdge, point: bestPoint, dist: bestDist }
}

/* ── Hook ──────────────────────────────────────────────── */

export function useAutoJunction({
  edges,
  setNodes,
  setEdges,
  pushUndo,
  gridSize,
  createEdgeProps,
}: AutoJunctionConfig) {
  const { screenToFlowPosition } = useReactFlow()
  const connectStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null)
  const connectionMadeRef = useRef(false)

  /* Beim Start einer Verbindung Source merken */
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null }) => {
      connectStartRef.current = params
      connectionMadeRef.current = false
    },
    [],
  )

  /* In onConnect aufrufen um zu signalisieren, dass die Verbindung geklappt hat */
  const markConnectionMade = useCallback(() => {
    connectionMadeRef.current = true
  }, [])

  /* Am Ende einer Verbindung prüfen, ob wir auf einer Edge gelandet sind */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (connectionMadeRef.current || !connectStartRef.current) return
      const { nodeId: srcNodeId, handleId: srcHandleId } = connectStartRef.current
      if (!srcNodeId || !srcHandleId) return

      // Mausposition → Flow-Koordinaten
      let cx: number, cy: number
      if ('clientX' in event) {
        cx = event.clientX
        cy = event.clientY
      } else if (event.changedTouches?.length) {
        cx = event.changedTouches[0].clientX
        cy = event.changedTouches[0].clientY
      } else {
        return
      }
      const dropPos = screenToFlowPosition({ x: cx, y: cy })

      // Nächste Edge im DOM finden
      const edgeEls = document.querySelectorAll('.react-flow__edge')
      let bestEdge: Edge | null = null
      let bestResult = { point: { x: 0, y: 0 }, dist: Infinity, isHorizontal: true }

      edgeEls.forEach((el) => {
        const testId = el.getAttribute('data-testid') || ''
        const edgeId = testId.replace('rf__edge-', '')
        const edge = edges.find((e) => e.id === edgeId)
        if (!edge) return
        // Keine Edges die am Source-Node hängen
        if (edge.source === srcNodeId || edge.target === srcNodeId) return

        const pathEl = getVisiblePath(el)
        if (!pathEl) return

        const result = findNearestOnPath(pathEl, dropPos)
        if (result.dist < bestResult.dist) {
          bestResult = result
          bestEdge = edge
        }
      })

      // Schwellwert: 20px in Flow-Koordinaten
      if (!bestEdge || bestResult.dist > 20) return

      pushUndo()

      const origEdge = bestEdge as Edge
      const junctionId = `schema-${uuid()}`

      // Junction exakt auf der Linie platzieren (10×10px, Handle in der Mitte)
      const junctionPos = { x: bestResult.point.x - 5, y: bestResult.point.y - 5 }

      // Handles für den Split bestimmen
      let splitA: string, splitB: string, connHandle: string
      if (bestResult.isHorizontal) {
        splitA = 'junction-L1'
        splitB = 'junction-R1'
        connHandle = dropPos.y < bestResult.point.y ? 'junction-T1' : 'junction-B1'
      } else {
        splitA = 'junction-T1'
        splitB = 'junction-B1'
        connHandle = dropPos.x < bestResult.point.x ? 'junction-L1' : 'junction-R1'
      }

      // Split-Edges übernehmen Typ/Daten der Original-Edge
      const splitProps = createEdgeProps(
        origEdge.sourceHandle || '',
        origEdge.targetHandle || '',
        origEdge,
      )

      const edge1: Edge = {
        id: `e-${uuid()}`,
        source: origEdge.source,
        sourceHandle: origEdge.sourceHandle,
        target: junctionId,
        targetHandle: splitA,
        type: splitProps.type,
        data: splitProps.data,
        deletable: true,
      }

      const edge2: Edge = {
        id: `e-${uuid()}`,
        source: junctionId,
        sourceHandle: splitB,
        target: origEdge.target,
        targetHandle: origEdge.targetHandle,
        type: splitProps.type,
        data: splitProps.data,
        deletable: true,
      }

      // Neue Verbindungs-Edge
      const connProps = createEdgeProps(srcHandleId, connHandle)
      const newConn: Edge = {
        id: `e-${uuid()}`,
        source: srcNodeId,
        sourceHandle: srcHandleId,
        target: junctionId,
        targetHandle: connHandle,
        type: connProps.type,
        data: connProps.data,
        deletable: true,
      }

      setNodes((nds) => [
        ...nds,
        { id: junctionId, type: 'junction', position: junctionPos, data: { label: 'Verbindung' } },
      ])

      setEdges((eds) => [
        ...eds.filter((e) => e.id !== origEdge.id),
        edge1, edge2, newConn,
      ])
    },
    [edges, screenToFlowPosition, pushUndo, setNodes, setEdges, gridSize, createEdgeProps],
  )

  /**
   * Junction löschen und gegenüberliegende Leitungen auto-reconnecten.
   *
   * Gegenüberliegende Handles (T↔B, L↔R) werden zu einer direkten Leitung zusammengefasst.
   * Nicht-gepaarte Leitungen (z.B. der T-Stück-Abzweig) werden entfernt.
   */
  const deleteJunction = useCallback(
    (junctionNodeId: string) => {
      pushUndo()

      const connectedEdges = edges.filter(
        (e) => e.source === junctionNodeId || e.target === junctionNodeId,
      )

      // Map: junction-Handle → { anderer Knoten, anderes Handle, Original-Edge }
      const connections = connectedEdges.map((e) => {
        if (e.source === junctionNodeId) {
          return {
            junctionHandle: e.sourceHandle || '',
            otherNode: e.target,
            otherHandle: e.targetHandle || '',
            edge: e,
          }
        }
        return {
          junctionHandle: e.targetHandle || '',
          otherNode: e.source,
          otherHandle: e.sourceHandle || '',
          edge: e,
        }
      })

      // Gegenüberliegende Handle-Paare suchen und reconnecten
      const opposites: Record<string, string> = {
        'junction-T1': 'junction-B1',
        'junction-B1': 'junction-T1',
        'junction-L1': 'junction-R1',
        'junction-R1': 'junction-L1',
        // Meter/Sensor Handles (Hydraulik)
        'meter-L1': 'meter-R1',
        'meter-R1': 'meter-L1',
        // Elec-Meter Handles (Strom)
        'elec-L1': 'elec-R1',
        'elec-R1': 'elec-L1',
        'elec-T1': 'elec-B1',
        'elec-B1': 'elec-T1',
      }

      const reconnected: Edge[] = []
      const matched = new Set<string>()

      for (const conn of connections) {
        if (matched.has(conn.junctionHandle)) continue
        const oppHandle = opposites[conn.junctionHandle]
        const oppConn = connections.find(
          (c) => c.junctionHandle === oppHandle && !matched.has(c.junctionHandle),
        )
        if (oppConn) {
          const props = createEdgeProps(conn.otherHandle, oppConn.otherHandle, conn.edge)
          reconnected.push({
            id: `e-${uuid()}`,
            source: conn.otherNode,
            sourceHandle: conn.otherHandle,
            target: oppConn.otherNode,
            targetHandle: oppConn.otherHandle,
            type: props.type,
            data: props.data,
            deletable: true,
          })
          matched.add(conn.junctionHandle)
          matched.add(oppConn.junctionHandle)
        }
      }

      const connEdgeIds = new Set(connectedEdges.map((e) => e.id))
      setNodes((nds) => nds.filter((n) => n.id !== junctionNodeId))
      setEdges((eds) => [...eds.filter((e) => !connEdgeIds.has(e.id)), ...reconnected])
    },
    [edges, pushUndo, setNodes, setEdges, createEdgeProps],
  )

  return { onConnectStart, markConnectionMade, onConnectEnd, deleteJunction }
}
