import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEnergyStore } from '../store/useEnergyStore'
import { Sun, Flame, Thermometer, Snowflake, Battery, Plug, Zap, Home, Waypoints, Gauge } from 'lucide-react'
import type { GeneratorType, StorageType, ConsumerType, CircuitType, MeterType } from '../types'

interface FlowNode {
  id: string
  label: string
  type: 'generator' | 'storage' | 'consumer' | 'grid' | 'circuit' | 'room' | 'meter'
  subType: string
  x: number
  y: number
  color: string
  iconColor: string
  w: number
  h: number
}

interface FlowEdge {
  from: string
  to: string
  color: string
  animated?: boolean
  dashed?: boolean
  bidirectional?: boolean
  fromY?: number
  toY?: number
}

const NODE_W = 100
const NODE_H = 36
const NODE_H_DUAL = 48
const METER_W = 84
const METER_H = 30

const genColors: Record<GeneratorType, { bg: string; icon: string }> = {
  grid: { bg: '#dbeafe', icon: '#3b82f6' },
  pv: { bg: '#fef3c7', icon: '#d97706' },
  chp: { bg: '#ffedd5', icon: '#ea580c' },
  heat_pump: { bg: '#fee2e2', icon: '#dc2626' },
  boiler: { bg: '#fee2e2', icon: '#dc2626' },
  chiller: { bg: '#dbeafe', icon: '#2563eb' },
}

const storColors: Record<StorageType, { bg: string; icon: string }> = {
  battery: { bg: '#f3e8ff', icon: '#7c3aed' },
  heat: { bg: '#fee2e2', icon: '#dc2626' },
  cold: { bg: '#dbeafe', icon: '#2563eb' },
}

const circuitColors: Record<CircuitType, { bg: string; icon: string }> = {
  heating: { bg: '#fee2e2', icon: '#dc2626' },
  cooling: { bg: '#dbeafe', icon: '#2563eb' },
  combined: { bg: '#f3e8ff', icon: '#7c3aed' },
}

const conColors: Record<ConsumerType, string> = {
  household: '#16a34a', commercial: '#7c3aed', production: '#ea580c',
  lighting: '#eab308', hvac: '#2563eb', ventilation: '#06b6d4',
  wallbox: '#059669', hot_water: '#dc2626', other: '#6b7280',
}

const meterColors: Record<MeterType, { bg: string; icon: string }> = {
  electricity: { bg: '#ecfeff', icon: '#0891b2' },
  heat: { bg: '#fef2f2', icon: '#dc2626' },
  gas: { bg: '#fff7ed', icon: '#ea580c' },
  water: { bg: '#eff6ff', icon: '#2563eb' },
  cold: { bg: '#eff6ff', icon: '#0891b2' },
  source: { bg: '#ecfeff', icon: '#0891b2' },
}

const energyColors: Record<string, string> = {
  electricity: '#3b82f6',
  heat: '#dc2626',
  hot_water: '#ea580c',
  gas: '#d97706',
  source: '#0891b2',
  cold: '#2563eb',
}

type PortDef = { energy: string; color: string }
type PortLayout = { left: PortDef[]; right: PortDef[] }

import type { EnergyPort } from '../types'

const portsToLayout = (ports: EnergyPort[]): PortLayout => {
  const left = ports.filter((p) => p.side === 'input').map((p) => ({ energy: p.energy, color: energyColors[p.energy] || '#888' }))
  const right = ports.filter((p) => p.side === 'output').map((p) => ({ energy: p.energy, color: energyColors[p.energy] || '#888' }))
  return { left, right }
}

const getDefaultPortDefs = (genType: string, coolingCapable = false): PortLayout => {
  switch (genType) {
    case 'pv':
      return { left: [], right: [{ energy: 'electricity', color: energyColors.electricity }] }
    case 'chp':
      return { left: [{ energy: 'gas', color: energyColors.gas }], right: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'heat', color: energyColors.heat }] }
    case 'heat_pump': {
      const right: PortDef[] = [{ energy: 'heat', color: energyColors.heat }]
      if (coolingCapable) right.push({ energy: 'cold', color: energyColors.cold })
      return { left: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'source', color: energyColors.source }], right }
    }
    case 'boiler':
      return { left: [{ energy: 'gas', color: energyColors.gas }], right: [{ energy: 'heat', color: energyColors.heat }] }
    case 'chiller':
      return { left: [{ energy: 'electricity', color: energyColors.electricity }], right: [{ energy: 'cold', color: energyColors.cold }] }
    case 'grid':
      return { left: [{ energy: 'electricity', color: energyColors.electricity }], right: [{ energy: 'electricity', color: energyColors.electricity }] }
    default:
      return { left: [], right: [] }
  }
}

const getGenPortLayout = (gen: { type: string; ports?: EnergyPort[]; coolingCapable?: boolean }): PortLayout => {
  if (gen.ports && gen.ports.length > 0) return portsToLayout(gen.ports)
  return getDefaultPortDefs(gen.type, gen.coolingCapable)
}

const getStorPortLayout = (stor: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (stor.ports && stor.ports.length > 0) return portsToLayout(stor.ports)
  const e = stor.type === 'battery' ? 'electricity' : stor.type === 'heat' ? 'heat' : 'cold'
  const c = energyColors[e] || '#888'
  return { left: [{ energy: e, color: c }], right: [{ energy: e, color: c }] }
}

const getConPortLayout = (con: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (con.ports && con.ports.length > 0) return portsToLayout(con.ports)
  if (con.type === 'hvac') return { left: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }], right: [] }
  if (con.type === 'hot_water') return { left: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'heat', color: energyColors.heat }], right: [] }
  return { left: [{ energy: 'electricity', color: energyColors.electricity }], right: [] }
}

const getCircPortLayout = (circ: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (circ.ports && circ.ports.length > 0) return portsToLayout(circ.ports)
  if (circ.type === 'combined') return { left: [{ energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }], right: [{ energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }] }
  if (circ.type === 'cooling') return { left: [{ energy: 'cold', color: energyColors.cold }], right: [{ energy: 'cold', color: energyColors.cold }] }
  return { left: [{ energy: 'heat', color: energyColors.heat }], right: [{ energy: 'heat', color: energyColors.heat }] }
}

const getMeterPortLayout = (meter: { type: string; direction?: string; ports?: EnergyPort[] }): PortLayout => {
  if (meter.ports && meter.ports.length > 0) return portsToLayout(meter.ports)
  const e = meter.type === 'heat' ? 'heat' : meter.type === 'gas' ? 'gas' : meter.type === 'cold' ? 'cold' : meter.type === 'source' ? 'source' : meter.type === 'water' ? 'water' : 'electricity'
  const c = energyColors[e] || '#888'
  return { left: [{ energy: e, color: c }], right: [{ energy: e, color: c }] }
}

const getRoomPortLayout = (room: { coolingEnabled?: boolean; ports?: EnergyPort[] }): PortLayout => {
  if (room.ports && room.ports.length > 0) return portsToLayout(room.ports)
  const left: PortDef[] = [{ energy: 'heat', color: energyColors.heat }]
  if (room.coolingEnabled) left.push({ energy: 'cold', color: energyColors.cold })
  return { left, right: [] }
}

const getGenEdgeEnergy = (genType: string, targetStorType?: string): { color: string; energy: string } => {
  if (genType === 'chp') {
    if (targetStorType === 'battery') return { color: energyColors.electricity, energy: 'electricity' }
    return { color: energyColors.heat, energy: 'heat' }
  }
  if (genType === 'pv') return { color: energyColors.electricity, energy: 'electricity' }
  if (genType === 'heat_pump') {
    if (targetStorType === 'cold') return { color: energyColors.cold, energy: 'cold' }
    return { color: energyColors.heat, energy: 'heat' }
  }
  if (genType === 'boiler') return { color: energyColors.heat, energy: 'heat' }
  if (genType === 'chiller') return { color: energyColors.cold, energy: 'cold' }
  return { color: '#888', energy: '' }
}

// Thermal entities → Hydraulikschema, Electrical → Stromschema
// Dual-Schema (WP, BHKW, Kältemaschine) → Hydraulikschema (Primär)
const THERMAL_GEN_TYPES = ['boiler', 'heat_pump', 'chp', 'chiller']
const THERMAL_STOR_TYPES = ['heat', 'cold']

function getSchemaTarget(nodeType: string, subType: string): { path: string; entityId?: string } | null {
  if (nodeType === 'grid') return { path: '/electrical-schema' }
  if (nodeType === 'generator') {
    if (THERMAL_GEN_TYPES.includes(subType)) return { path: '/hydraulic-schema' }
    return { path: '/electrical-schema' }
  }
  if (nodeType === 'storage') {
    if (THERMAL_STOR_TYPES.includes(subType)) return { path: '/hydraulic-schema' }
    return { path: '/electrical-schema' }
  }
  if (nodeType === 'circuit' || nodeType === 'room') return { path: '/hydraulic-schema' }
  if (nodeType === 'consumer') return { path: '/electrical-schema' }
  if (nodeType === 'meter') return { path: '/electrical-schema' }
  return null
}

// 11 columns
const columns = [
  { key: 'sourceM',  x: 60,   label1: 'QUELLEN-',     label2: 'ZÄHLER' },
  { key: 'gen',      x: 170,  label1: 'ERZEUGER',      label2: '' },
  { key: 'genM',     x: 280,  label1: 'ERZEUGER-',     label2: 'ZÄHLER' },
  { key: 'stor',     x: 390,  label1: 'SPEICHER',      label2: '' },
  { key: 'storM',    x: 495,  label1: 'HEIZ-/KÜHL-',   label2: 'KREISZÄHLER' },
  { key: 'circuit',  x: 610,  label1: 'HEIZ-/',        label2: 'KÜHLKREISE' },
  { key: 'circM',    x: 720,  label1: 'RAUM-',         label2: 'ZÄHLER' },
  { key: 'room',     x: 830,  label1: 'RÄUME',         label2: '' },
  { key: 'groupM',   x: 940,  label1: 'VERBRAUCHER-',  label2: 'GRUPPENZ.' },
  { key: 'con',      x: 1055, label1: 'VERBRAUCHER',   label2: '' },
  { key: 'endM',     x: 1160, label1: 'END-',          label2: 'ZÄHLER' },
]

const cx: Record<string, number> = {}
columns.forEach((c) => { cx[c.key] = c.x })

export default function EnergyFlowPage() {
  const { generators, storages, consumers, circuits, rooms, meters, settings } = useEnergyStore()
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)

  // --- Drag-to-reorder: Y-Position manuell verschieben ---
  const LS_KEY = 'energyflow-yoffsets'
  const [yOffsets, setYOffsets] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
  })
  const saveOffsets = useCallback((next: Record<string, number>) => {
    setYOffsets(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }, [])

  const dragging = useRef<{
    nodeId: string; startMouseY: number; startOffset: number; baseY: number; moved: boolean
  } | null>(null)

  const getSvgPoint = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleDragStart = (node: FlowNode, e: React.MouseEvent) => {
    if (node.type === 'grid') return
    e.stopPropagation()
    const pt = getSvgPoint(e)
    const currentOffset = yOffsets[node.id] || 0
    dragging.current = {
      nodeId: node.id,
      startMouseY: pt.y,
      startOffset: currentOffset,
      baseY: node.y - currentOffset,
      moved: false,
    }
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const pt = getSvgPoint(e)
    const dy = pt.y - dragging.current.startMouseY
    if (Math.abs(dy) > 3) dragging.current.moved = true
    if (!dragging.current.moved) return
    const rawOffset = dragging.current.startOffset + dy
    const minY = 38
    const newOffset = Math.max(rawOffset, minY - dragging.current.baseY)
    saveOffsets({ ...yOffsets, [dragging.current.nodeId]: newOffset })
  }

  const handleDragEnd = () => {
    dragging.current = null
  }

  useEffect(() => {
    const up = () => { dragging.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const resetPositions = useCallback(() => {
    saveOffsets({})
  }, [saveOffsets])

  // Node click → navigate to schema page
  const handleNodeClick = (node: FlowNode) => {
    const entityId = node.id === 'bus' ? '' : node.id.substring(node.id.indexOf('-') + 1)
    const target = getSchemaTarget(node.type, node.subType)
    if (!target) return
    if (node.type === 'grid') {
      const gridGen = generators.find((g) => g.type === 'grid')
      navigate(target.path, { state: { focusEntityId: gridGen?.id } })
      return
    }
    navigate(target.path, { state: { focusEntityId: entityId } })
  }

  const { nodes, edges, roomGroups, genPortMap, storPortMap, conPortMap, circPortMap, roomPortMap, meterPortMap } = useMemo(() => {
    const nodes: FlowNode[] = []
    const edges: FlowEdge[] = []

    const rowH = 104
    const startY = 50

    const colNext: Record<string, number> = {}
    const getY = (col: string) => {
      const y = colNext[col] ?? startY
      colNext[col] = y + rowH
      return y
    }
    const peekY = (col: string) => colNext[col] ?? startY

    const minNodeY = startY - 2
    const mkNode = (id: string, label: string, type: FlowNode['type'], subType: string, x: number, y: number, color: string, iconColor: string, h = NODE_H): FlowNode =>
      ({ id, label, type, subType, x, y: Math.max(y + (yOffsets[id] || 0), minNodeY), color, iconColor, w: NODE_W, h })
    const mkMeter = (id: string, label: string, subType: string, x: number, y: number, color: string, iconColor: string): FlowNode =>
      ({ id, label, type: 'meter', subType, x, y: Math.max(y + (yOffsets[id] || 0), minNodeY), color, iconColor, w: METER_W, h: METER_H })

    // 1) ERZEUGER
    const gridGen = generators.find((g) => g.type === 'grid')
    const busY = getY('gen')
    nodes.push(mkNode('bus', gridGen?.name || 'Hausanschluss', 'grid', 'grid', cx.gen, busY, '#dbeafe', '#3b82f6'))

    const genYMap: Record<string, number> = {}
    const genPortMap: Record<string, PortLayout> = {}
    generators.filter((g) => g.type !== 'grid').forEach((g) => {
      const c = genColors[g.type]
      const y = getY('gen')
      genYMap[g.id] = y
      const ports = getGenPortLayout(g as any)
      genPortMap[g.id] = ports
      const hasDualPorts = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`gen-${g.id}`, g.name || g.type, 'generator', g.type, cx.gen, y, c.bg, c.icon, hasDualPorts ? NODE_H_DUAL : NODE_H))
    })

    const portY = (genId: string, energy: string, side: 'left' | 'right'): number | undefined => {
      const layout = genPortMap[genId]
      const node = nodes.find((n) => n.id === `gen-${genId}`)
      if (!layout || !node) return undefined
      const defs = layout[side]
      if (defs.length <= 1) return undefined
      const idx = defs.findIndex((p) => p.energy === energy)
      if (idx < 0) return undefined
      return node.y + node.h * ((idx + 0.5) / defs.length)
    }

    // 2) SPEICHER
    const storYMap: Record<string, number> = {}
    const storPortMap: Record<string, PortLayout> = {}
    const thermStor = storages.filter((s) => s.type !== 'battery')
    const batStor = storages.filter((s) => s.type === 'battery')
    ;[...thermStor, ...batStor].forEach((s) => {
      const c = storColors[s.type]
      const y = getY('stor')
      storYMap[s.id] = y
      const ports = getStorPortLayout(s as any)
      storPortMap[s.id] = ports
      const hasDual = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`stor-${s.id}`, s.name || s.type, 'storage', s.type, cx.stor, y, c.bg, c.icon, hasDual ? NODE_H_DUAL : NODE_H))
    })

    // 3) HEIZ-/KÜHLKREISE
    const circPortMap: Record<string, PortLayout> = {}
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      const y = getY('circuit')
      const ports = getCircPortLayout(c as any)
      circPortMap[c.id] = ports
      const hasDual = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`circ-${c.id}`, c.name, 'circuit', c.type, cx.circuit, y, cc.bg, cc.icon, hasDual ? NODE_H_DUAL : NODE_H))
    })

    // 4) RÄUME
    const roomYMap: Record<string, number> = {}
    const roomPortMap: Record<string, PortLayout> = {}
    rooms.forEach((r) => {
      const y = getY('room')
      roomYMap[r.id] = y
      const ports = getRoomPortLayout(r as any)
      roomPortMap[r.id] = ports
      const hasDual = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`room-${r.id}`, r.name, 'room', r.roomType, cx.room, y, '#ecfdf5', '#16a34a', hasDual ? NODE_H_DUAL : NODE_H))
    })

    // 5) VERBRAUCHER
    const conPortMap: Record<string, PortLayout> = {}
    const consumersInRooms = new Set<string>()
    rooms.forEach((r) => (r.consumerIds || []).forEach((cid) => consumersInRooms.add(cid)))
    const unassignedConsumers = consumers.filter((c) => !consumersInRooms.has(c.id))

    const mkConNode = (consumer: typeof consumers[0]) => {
      const y = getY('con')
      const ports = getConPortLayout(consumer as any)
      conPortMap[consumer.id] = ports
      const hasDual = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`con-${consumer.id}`, consumer.name || consumer.type, 'consumer', consumer.type, cx.con, y, '#f0fdf4', conColors[consumer.type], hasDual ? NODE_H_DUAL : NODE_H))
    }

    interface RoomGroup { roomId: string; roomName: string; y: number; consumerIds: string[] }
    const roomGroupsInner: RoomGroup[] = []

    rooms.forEach((r) => {
      const rCons = (r.consumerIds || []).filter((cid) => consumers.some((c) => c.id === cid))
      if (rCons.length > 0) {
        const groupY = peekY('con')
        roomGroupsInner.push({ roomId: r.id, roomName: r.name, y: groupY, consumerIds: rCons })
        rCons.forEach((cid) => {
          const consumer = consumers.find((c) => c.id === cid)
          if (consumer) mkConNode(consumer)
        })
      }
    })
    unassignedConsumers.forEach((c) => {
      mkConNode(c)
    })

    // 6) ZÄHLER
    const categoryToCol: Record<string, string> = {
      source: 'sourceM', generation: 'genM', consumption: 'storM',
      circuit: 'circM', group: 'groupM', end: 'endM',
    }
    const meterNodeMap: Record<string, FlowNode> = {}
    const meterPortMap: Record<string, PortLayout> = {}

    const meterColUsedY: Record<string, number[]> = {}
    const claimMeterY = (colKey: string, desiredY: number): number => {
      if (!meterColUsedY[colKey]) meterColUsedY[colKey] = []
      const used = meterColUsedY[colKey]
      let y = Math.max(desiredY, startY)
      while (used.some((uy) => Math.abs(uy - y) < rowH)) {
        y += rowH
      }
      used.push(y)
      if ((colNext[colKey] ?? startY) <= y) {
        colNext[colKey] = y + rowH
      }
      return y
    }

    meters.forEach((m) => {
      const mc = meterColors[m.type] || meterColors.electricity
      const colKey = categoryToCol[m.category]
      if (!colKey) return

      let desiredY = colNext[colKey] ?? startY
      if (m.assignedToType === 'grid') {
        desiredY = busY
      } else if (m.assignedToType === 'generator') {
        desiredY = genYMap[m.assignedToId] ?? desiredY
      } else if (m.assignedToType === 'storage') {
        desiredY = storYMap[m.assignedToId] ?? desiredY
      } else if (m.assignedToType === 'consumer') {
        const conNode = nodes.find((n) => n.id === `con-${m.assignedToId}`)
        if (conNode) desiredY = conNode.y
      } else {
        const linkedRoom = rooms.find((r) => (r.meterIds || []).includes(m.id))
        if (linkedRoom && roomYMap[linkedRoom.id] !== undefined) {
          desiredY = roomYMap[linkedRoom.id]
        }
      }

      const meterY = claimMeterY(colKey, desiredY)
      const mid = `meter-${m.id}`
      const ports = getMeterPortLayout(m as any)
      meterPortMap[m.id] = ports
      const node = mkMeter(mid, m.name || m.meterNumber || 'Zähler', m.type, cx[colKey], meterY, mc.bg, mc.icon)
      nodes.push(node)
      meterNodeMap[m.id] = node
    })

    // 7) EDGES
    // (a) Quellenzähler
    meters.forEach((m) => {
      if (m.category !== 'source') return
      if (m.assignedToType === 'grid') {
        edges.push({ from: `meter-${m.id}`, to: 'bus', color: energyColors[m.type === 'gas' ? 'gas' : 'electricity'], animated: true, bidirectional: m.type === 'electricity' })
      } else {
        const gen = generators.find((g) => g.id === m.assignedToId)
        if (gen) {
          const leftEnergy = m.type === 'gas' ? 'gas' : (m.type === 'heat' || m.type === 'source') ? 'source' : 'electricity'
          const toY = portY(gen.id, leftEnergy, 'left')
          const edgeColor = energyColors[leftEnergy] || (meterColors[m.type] || meterColors.electricity).icon
          edges.push({ from: `meter-${m.id}`, to: `gen-${gen.id}`, color: edgeColor, animated: true, toY })
        }
      }
    })

    // (b) Erzeugerzähler
    meters.forEach((m) => {
      if (m.category !== 'generation') return
      if (m.assignedToType === 'storage') return
      if (m.assignedToType === 'generator') {
        const gen = generators.find((g) => g.id === m.assignedToId)
        if (!gen) return
        const meterEnergy = m.type === 'electricity' ? 'electricity' : m.type === 'heat' ? 'heat' : m.type === 'cold' ? 'cold' : m.type === 'gas' ? 'gas' : m.type === 'source' ? 'source' : 'electricity'
        const edgeColor = energyColors[meterEnergy] || genColors[gen.type].icon
        const fromY = portY(gen.id, meterEnergy, 'right')
        edges.push({ from: `gen-${gen.id}`, to: `meter-${m.id}`, color: edgeColor, animated: true, fromY })
      } else if (m.assignedToType === 'grid') {
        edges.push({ from: 'bus', to: `meter-${m.id}`, color: energyColors.electricity, animated: true })
      }
    })

    // (b2) Erzeuger → Hausanschluss direkt
    const gridConnGens: string[] = gridGen?.connectedGeneratorIds || []
    const genHasMeterToGrid = new Set<string>()
    meters.forEach((m) => {
      if (m.parentMeterId === 'grid' && m.assignedToType === 'generator' && m.assignedToId) {
        genHasMeterToGrid.add(m.assignedToId)
      }
    })
    gridConnGens.forEach((gid) => {
      if (gid === 'grid') return
      const gen = generators.find((g) => g.id === gid)
      if (!gen || gen.type === 'grid') return
      if (genHasMeterToGrid.has(gid)) return
      const ee = gen.energyForm === 'electricity' ? energyColors.electricity : energyColors.heat
      const fromY = portY(gid, 'electricity', 'right')
      edges.push({ from: `gen-${gid}`, to: 'bus', color: ee, animated: true, fromY })
    })

    // (b3) Erzeuger → Erzeuger
    generators.filter((g) => g.type !== 'grid').forEach((g) => {
      (g.connectedGeneratorIds || []).forEach((sourceGenId) => {
        if (sourceGenId === 'grid') return
        const sourceGen = generators.find((sg) => sg.id === sourceGenId)
        if (!sourceGen || sourceGen.type === 'grid') return
        const sLayout = genPortMap[sourceGenId]
        const tLayout = genPortMap[g.id]
        let edgeEnergy = 'electricity'
        if (sLayout && tLayout) {
          for (const sp of sLayout.right) {
            if (tLayout.left.some((tp) => tp.energy === sp.energy)) { edgeEnergy = sp.energy; break }
          }
        }
        const fromY = portY(sourceGenId, edgeEnergy, 'right')
        const toY = portY(g.id, edgeEnergy, 'left')
        edges.push({ from: `gen-${sourceGenId}`, to: `gen-${g.id}`, color: energyColors[edgeEnergy] || '#888', animated: true, fromY, toY })
      })
    })

    // (b4) Erzeuger → Verbraucher
    consumers.forEach((c) => {
      (c.connectedSourceIds || []).forEach((sourceId) => {
        if (sourceId === 'grid') return
        const gen = generators.find((g) => g.id === sourceId)
        if (!gen || gen.type === 'grid') return
        const energy = gen.energyForm === 'electricity' || gen.energyForm === 'electricity_heat' ? 'electricity' : gen.energyForm === 'heat' ? 'heat' : gen.energyForm === 'cold' ? 'cold' : 'electricity'
        const fromY = portY(gen.id, energy, 'right')
        edges.push({ from: `gen-${gen.id}`, to: `con-${c.id}`, color: energyColors[energy] || '#888', animated: true, fromY })
      })
    })

    // (c) Erzeuger → Speicher
    storages.forEach((s) => {
      const connGens = s.connectedGeneratorIds || []
      const storMeter = meters.find((m) => m.assignedToType === 'storage' && m.assignedToId === s.id)
      const isBat = s.type === 'battery'

      connGens.forEach((gid) => {
        if (gid === 'grid') {
          const gridColor = isBat ? energyColors.electricity : storColors[s.type].icon
          if (storMeter) {
            edges.push({ from: 'bus', to: `meter-${storMeter.id}`, color: gridColor, animated: true, bidirectional: isBat })
          } else {
            edges.push({ from: 'bus', to: `stor-${s.id}`, color: gridColor, animated: true, bidirectional: isBat })
          }
          return
        }
        const gen = generators.find((g) => g.id === gid)
        if (!gen) return
        const ee = getGenEdgeEnergy(gen.type, s.type)
        const fromY = portY(gid, ee.energy, 'right')
        if (storMeter) {
          edges.push({ from: `gen-${gid}`, to: `meter-${storMeter.id}`, color: ee.color, animated: true, bidirectional: isBat, fromY })
        } else {
          edges.push({ from: `gen-${gid}`, to: `stor-${s.id}`, color: ee.color, animated: true, bidirectional: isBat, fromY })
        }
      })

      if (storMeter) {
        const mc = meterColors[storMeter.type]
        edges.push({ from: `meter-${storMeter.id}`, to: `stor-${s.id}`, color: mc.icon, animated: true, bidirectional: isBat })
      }

      const connCons = s.connectedConsumerIds || []
      connCons.forEach((cid) => {
        if (!consumers.some((c) => c.id === cid)) return
        edges.push({ from: `stor-${s.id}`, to: `con-${cid}`, color: isBat ? energyColors.electricity : storColors[s.type].icon, animated: true, bidirectional: isBat })
      })
    })

    // (d) Speicher/Erzeuger → Kreise
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      c.supplyStorageIds?.forEach((sid) => edges.push({ from: `stor-${sid}`, to: `circ-${c.id}`, color: cc.icon, animated: true }))
      c.generatorIds.forEach((gid) => {
        const energy = c.type === 'cooling' ? 'cold' : 'heat'
        const fromY = portY(gid, energy, 'right')
        edges.push({ from: `gen-${gid}`, to: `circ-${c.id}`, color: cc.icon, animated: true, fromY })
      })
    })

    // (e) Kreise → Räume
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      c.roomIds.forEach((rid) => edges.push({ from: `circ-${c.id}`, to: `room-${rid}`, color: cc.icon, animated: true }))
    })

    // (f) Räume → Verbraucher
    rooms.forEach((r) => {
      (r.consumerIds || []).forEach((cid) => {
        if (consumers.some((c) => c.id === cid)) {
          edges.push({ from: `room-${r.id}`, to: `con-${cid}`, color: '#16a34a', animated: true })
        }
      })
    })

    // (g0) Hausanschluss → Verbraucher
    consumers.forEach((c) => {
      if ((c.connectedSourceIds || []).includes('grid')) {
        const hasMeterRoute = meters.some((m) => m.parentMeterId === 'grid' && m.assignedToType === 'consumer' && m.assignedToId === c.id)
        if (!hasMeterRoute) {
          edges.push({ from: 'bus', to: `con-${c.id}`, color: '#3b82f6', animated: true })
        }
      }
    })

    // (g) Zähler → Verbraucher
    meters.forEach((m) => {
      if (m.assignedToType === 'consumer' && m.assignedToId && m.category !== 'end') {
        const mc = meterColors[m.type] || meterColors.electricity
        edges.push({ from: `meter-${m.id}`, to: `con-${m.assignedToId}`, color: mc.icon, animated: true })
      }
    })

    // (h) Raumzähler
    meters.forEach((m) => {
      if (m.category !== 'circuit') return
      const mc = meterColors[m.type] || meterColors.heat
      rooms.forEach((r) => {
        if (!(r.meterIds || []).includes(m.id)) return
        edges.push({ from: `meter-${m.id}`, to: `room-${r.id}`, color: mc.icon, animated: true })
        if (r.heatingCircuitId) {
          edges.push({ from: `circ-${r.heatingCircuitId}`, to: `meter-${m.id}`, color: mc.icon, animated: true })
        }
        if (r.coolingCircuitId) {
          edges.push({ from: `circ-${r.coolingCircuitId}`, to: `meter-${m.id}`, color: mc.icon, animated: true })
        }
      })
    })

    // (i) Endzähler
    meters.forEach((m) => {
      if (m.category !== 'end') return
      if (m.assignedToId) {
        const mc = meterColors[m.type] || meterColors.electricity
        if (m.parentMeterId === 'grid') {
          edges.push({ from: `meter-${m.id}`, to: `con-${m.assignedToId}`, color: mc.icon, animated: true })
        } else {
          edges.push({ from: `con-${m.assignedToId}`, to: `meter-${m.id}`, color: mc.icon, animated: true })
        }
      }
    })

    // (j) Hausanschluss ↔ Zähler
    meters.forEach((m) => {
      if (m.parentMeterId !== 'grid') return
      if (!meterNodeMap[m.id]) return
      if (m.category === 'source' && m.assignedToType === 'grid') return
      if (m.category === 'generation' && m.assignedToType === 'grid') return
      if (m.assignedToType === 'storage') return
      const mc = meterColors[m.type] || meterColors.electricity
      if (m.assignedToType === 'generator') {
        edges.push({ from: `meter-${m.id}`, to: 'bus', color: energyColors[m.type] || mc.icon, animated: true })
      } else {
        edges.push({ from: 'bus', to: `meter-${m.id}`, color: mc.icon, animated: true })
      }
    })

    return { nodes, edges, roomGroups: roomGroupsInner, genPortMap, storPortMap, conPortMap, circPortMap, roomPortMap, meterPortMap }
  }, [generators, storages, consumers, circuits, rooms, meters, settings, yOffsets])

  const getIcon = (subType: string) => {
    switch (subType) {
      case 'pv': return Sun
      case 'chp': return Flame
      case 'heat_pump': return Thermometer
      case 'boiler': return Flame
      case 'chiller': return Snowflake
      case 'battery': return Battery
      case 'heat': return Thermometer
      case 'cold': return Snowflake
      case 'grid': return Zap
      case 'heating': return Flame
      case 'cooling': return Snowflake
      case 'combined': return Waypoints
      case 'household': return Home
      case 'wallbox': return Zap
      case 'electricity': case 'gas': case 'water': return Gauge
      case 'wohnen': case 'schlafen': case 'kueche': case 'bad': case 'buero': return Home
      case 'flur': case 'lager': case 'technik': case 'sonstige': return Home
      default: return Plug
    }
  }

  const svgWidth = 1230
  const maxNodeY = nodes.reduce((max, n) => Math.max(max, n.y + n.h), 0)
  const svgHeight = Math.max(400, maxNodeY + 60)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-header">Energiefluss-Diagramm</h1>
        <p className="text-sm text-dark-faded mt-1">Gesamtübersicht — Bearbeitung in den Schema-Seiten</p>
      </div>

      <div className="card overflow-x-auto">
          {/* Legende */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs items-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Erzeuger</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> Speicher</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Heizkreis</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Raum</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Verbraucher</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Hausanschluss</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-600" /> Zähler</span>
            <span className="ml-auto flex items-center gap-3">
              {Object.keys(yOffsets).length > 0 && (
                <button onClick={resetPositions} className="text-dark-faded hover:text-dark-text transition-colors">
                  Positionen zurücksetzen
                </button>
              )}
            </span>
          </div>

          <svg ref={svgRef} width={svgWidth} height={svgHeight} className="mx-auto"
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}>
            <defs />

            {/* Spalten-Überschriften */}
            {columns.map((col) => (
              <g key={col.key}>
                <text x={col.x} y={col.label2 ? 16 : 22} textAnchor="middle"
                  className="fill-dark-faded font-semibold" style={{ fontSize: 8 }}>
                  <tspan x={col.x} dy="0">{col.label1}</tspan>
                  {col.label2 && <tspan x={col.x} dy="10">{col.label2}</tspan>}
                </text>
              </g>
            ))}
            {/* Trennlinie unter Überschriften */}
            <line x1={10} y1={35} x2={svgWidth - 10} y2={35} stroke="#30363d" strokeWidth={0.5} strokeOpacity={0.3} />

            {/* Room grouping boxes */}
            {roomGroups.map((rg) => {
              const groupCons = nodes.filter((n) => rg.consumerIds.includes(n.id.replace('con-', '')))
              if (groupCons.length === 0) return null
              const minY = Math.min(...groupCons.map((n) => n.y)) - 6
              const maxY = Math.max(...groupCons.map((n) => n.y)) + NODE_H + 6
              return (
                <g key={`rg-${rg.roomId}`}>
                  <rect x={cx.con - NODE_W / 2 - 8} y={minY} width={NODE_W + 16} height={maxY - minY} rx={6}
                    fill="none" stroke="#22c55e" strokeWidth={1} strokeOpacity={0.2} strokeDasharray="4 3" />
                  <text x={cx.con} y={maxY + 10} textAnchor="middle" className="fill-dark-faded" style={{ fontSize: 8 }}>
                    {rg.roomName}
                  </text>
                </g>
              )
            })}

            {/* Edges */}
            {edges.map((edge, i) => {
              const fn = nodes.find((n) => n.id === edge.from)
              const tn = nodes.find((n) => n.id === edge.to)
              if (!fn || !tn) return null

              const ltr = fn.x <= tn.x
              const x1 = ltr ? fn.x + fn.w / 2 : fn.x - fn.w / 2
              const y1 = edge.fromY ?? (fn.y + fn.h / 2)
              const x2 = ltr ? tn.x - tn.w / 2 : tn.x + tn.w / 2
              const y2 = edge.toY ?? (tn.y + tn.h / 2)
              const midX = (x1 + x2) / 2
              const path = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`
              const pathReverse = `M${x2},${y2} C${midX},${y2} ${midX},${y1} ${x1},${y1}`

              return (
                <g key={i}>
                  <path d={path} fill="none" stroke={edge.color}
                    strokeWidth={edge.bidirectional ? 2 : 1.5} strokeOpacity={0.25}
                    strokeDasharray={edge.dashed ? '5 3' : undefined}
                    />
                  {edge.animated && (
                    <path d={path} fill="none" stroke={edge.color}
                      strokeWidth={edge.bidirectional ? 2 : 1.5} strokeOpacity={0.6} className="energy-flow-line" />
                  )}
                  {edge.bidirectional && (
                    <path d={pathReverse} fill="none" stroke={edge.color}
                      strokeWidth={2} strokeOpacity={0.6} className="energy-flow-line-reverse" />
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const Icon = getIcon(node.subType)
              const isMeter = node.type === 'meter'
              const isDragging = dragging.current?.nodeId === node.id
              return (
                <g key={node.id}
                  className="cursor-pointer"
                  style={isDragging ? { cursor: 'grabbing' } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (dragging.current?.moved) return
                    handleNodeClick(node)
                  }}
                  onMouseDown={(e) => { if (e.button === 0) handleDragStart(node, e) }}
                >
                  <rect x={node.x - node.w / 2} y={node.y} width={node.w} height={node.h}
                    rx={isMeter ? 6 : 8} fill={node.color}
                    stroke={node.iconColor}
                    strokeWidth={1.5} strokeOpacity={0.4} />
                  <foreignObject x={node.x - node.w / 2} y={node.y} width={node.w} height={node.h} style={{ pointerEvents: 'none' }}>
                    <div className="flex items-center gap-1 h-full px-1.5 pointer-events-none">
                      <Icon style={{ color: node.iconColor, width: isMeter ? 10 : 13, height: isMeter ? 10 : 13, flexShrink: 0 }} />
                      <span className={`font-medium truncate ${isMeter ? 'text-[8px]' : 'text-[9px]'}`} style={{ color: node.iconColor }}>
                        {node.label}
                      </span>
                    </div>
                  </foreignObject>
                  {/* Ports — visual only */}
                  {(() => {
                    const entityId = node.id.indexOf('-') >= 0 ? node.id.substring(node.id.indexOf('-') + 1) : ''
                    const ports = node.type === 'generator' ? genPortMap[entityId]
                      : node.type === 'storage' ? storPortMap[entityId]
                      : node.type === 'consumer' ? conPortMap[entityId]
                      : node.type === 'circuit' ? circPortMap[entityId]
                      : node.type === 'room' ? roomPortMap[entityId]
                      : node.type === 'meter' ? meterPortMap[entityId]
                      : undefined
                    const hasCustomPorts = !!ports
                    const portList: Array<{ side: 'left' | 'right'; portColor: string; cy: number }> = []
                    if (hasCustomPorts) {
                      const addSide = (side: 'left' | 'right', defs: PortDef[]) => {
                        if (defs.length === 0) return
                        if (defs.length === 1) {
                          portList.push({ side, portColor: defs[0].color, cy: node.y + node.h / 2 })
                        } else {
                          defs.forEach((p, idx) => {
                            portList.push({ side, portColor: p.color, cy: node.y + node.h * ((idx + 0.5) / defs.length) })
                          })
                        }
                      }
                      addSide('left', ports.left)
                      addSide('right', ports.right)
                    } else {
                      portList.push({ side: 'left', portColor: node.iconColor, cy: node.y + node.h / 2 })
                      portList.push({ side: 'right', portColor: node.iconColor, cy: node.y + node.h / 2 })
                    }
                    return portList.map((port, pi) => {
                      const pcx = port.side === 'left' ? node.x - node.w / 2 : node.x + node.w / 2
                      return (
                        <circle key={pi} cx={pcx} cy={port.cy} r={3}
                          fill={port.portColor} fillOpacity={0.5}
                          stroke={port.portColor} strokeWidth={1} strokeOpacity={0.7}
                          style={{ pointerEvents: 'none' }}
                        />
                      )
                    })
                  })()}
                </g>
              )
            })}
          </svg>
        </div>
    </div>
  )
}
