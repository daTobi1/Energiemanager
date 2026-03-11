import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEnergyStore } from '../store/useEnergyStore'
import { Sun, Flame, Thermometer, Snowflake, Battery, Plug, Zap, Home, Waypoints, Gauge, Plus } from 'lucide-react'
import type { GeneratorType, StorageType, ConsumerType, CircuitType, MeterType, MeterCategory } from '../types'

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
  deletable?: boolean
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
}

// Energieform-Farben (konsistent im ganzen Diagramm)
const energyColors: Record<string, string> = {
  electricity: '#3b82f6', // blau
  heat: '#dc2626',        // rot
  hot_water: '#ea580c',   // orange-rot (Warmwasser)
  gas: '#d97706',         // orange
  source: '#0891b2',      // cyan (Quellenenergie WP)
  cold: '#2563eb',        // blau
}

// Port-Definitionen pro Erzeuger: welche Energieformen rein/raus
type PortDef = { energy: string; color: string }
type PortLayout = { left: PortDef[]; right: PortDef[] }

// Port-Layout aus konfigurierten EnergyPorts berechnen (Fallback: Defaults pro Typ)
import type { EnergyPort } from '../types'

const portsToLayout = (ports: EnergyPort[]): PortLayout => {
  const left = ports.filter((p) => p.side === 'input').map((p) => ({ energy: p.energy, color: energyColors[p.energy] || '#888' }))
  const right = ports.filter((p) => p.side === 'output').map((p) => ({ energy: p.energy, color: energyColors[p.energy] || '#888' }))
  return { left, right }
}

// Default-Ports pro Erzeugertyp (Fallback wenn ports[] leer)
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
    default:
      return { left: [], right: [] }
  }
}

// Generator-Ports: konfiguriert oder Default
const getGenPortLayout = (gen: { type: string; ports?: EnergyPort[]; coolingCapable?: boolean }): PortLayout => {
  if (gen.ports && gen.ports.length > 0) return portsToLayout(gen.ports)
  return getDefaultPortDefs(gen.type, gen.coolingCapable)
}

// Speicher-Ports: konfiguriert oder Default
const getStorPortLayout = (stor: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (stor.ports && stor.ports.length > 0) return portsToLayout(stor.ports)
  const e = stor.type === 'battery' ? 'electricity' : stor.type === 'heat' ? 'heat' : 'cold'
  const c = energyColors[e] || '#888'
  return { left: [{ energy: e, color: c }], right: [{ energy: e, color: c }] }
}

// Verbraucher-Ports: konfiguriert oder Default
const getConPortLayout = (con: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (con.ports && con.ports.length > 0) return portsToLayout(con.ports)
  if (con.type === 'hvac') return { left: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }], right: [] }
  if (con.type === 'hot_water') return { left: [{ energy: 'electricity', color: energyColors.electricity }, { energy: 'heat', color: energyColors.heat }], right: [] }
  return { left: [{ energy: 'electricity', color: energyColors.electricity }], right: [] }
}

// Heiz-/Kühlkreis-Ports: konfiguriert oder Default
const getCircPortLayout = (circ: { type: string; ports?: EnergyPort[] }): PortLayout => {
  if (circ.ports && circ.ports.length > 0) return portsToLayout(circ.ports)
  if (circ.type === 'combined') return { left: [{ energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }], right: [{ energy: 'heat', color: energyColors.heat }, { energy: 'cold', color: energyColors.cold }] }
  if (circ.type === 'cooling') return { left: [{ energy: 'cold', color: energyColors.cold }], right: [{ energy: 'cold', color: energyColors.cold }] }
  return { left: [{ energy: 'heat', color: energyColors.heat }], right: [{ energy: 'heat', color: energyColors.heat }] }
}

// Zähler-Ports: konfiguriert oder Default
const getMeterPortLayout = (meter: { type: string; direction?: string; ports?: EnergyPort[] }): PortLayout => {
  if (meter.ports && meter.ports.length > 0) return portsToLayout(meter.ports)
  const e = meter.type === 'heat' ? 'heat' : meter.type === 'gas' ? 'gas' : meter.type === 'cold' ? 'cold' : 'electricity'
  const c = energyColors[e] || '#888'
  return { left: [{ energy: e, color: c }], right: [{ energy: e, color: c }] }
}

// Raum-Ports: konfiguriert oder Default
const getRoomPortLayout = (room: { coolingEnabled?: boolean; ports?: EnergyPort[] }): PortLayout => {
  if (room.ports && room.ports.length > 0) return portsToLayout(room.ports)
  const left: PortDef[] = [{ energy: 'heat', color: energyColors.heat }]
  if (room.coolingEnabled) left.push({ energy: 'cold', color: energyColors.cold })
  return { left, right: [] }
}

// Energieform-Farbe für Generator→Ziel-Verbindung bestimmen
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

const nodePathMap: Record<string, string> = {
  generator: '/generators',
  storage: '/storage',
  consumer: '/consumers',
  circuit: '/circuits',
  room: '/rooms',
  meter: '/meters',
}

// 11 Spalten: Energiefluss von links nach rechts
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

// Spalte → Zielseite + Vorauswahl
const columnRoutes: Record<string, { path: string; initialValues?: Record<string, any> }> = {
  sourceM:  { path: '/meters', initialValues: { category: 'source' } },
  gen:      { path: '/generators' },
  genM:     { path: '/meters', initialValues: { category: 'generation' } },
  stor:     { path: '/storage' },
  storM:    { path: '/meters', initialValues: { category: 'consumption' } },
  circuit:  { path: '/circuits' }, // Sonderbehandlung: Heiz-/Kühlkreis-Auswahl
  circM:    { path: '/meters', initialValues: { category: 'circuit' } },
  room:     { path: '/rooms' },
  groupM:   { path: '/meters', initialValues: { category: 'group' } },
  con:      { path: '/consumers' },
  endM:     { path: '/meters', initialValues: { category: 'end' } },
}

export default function EnergyFlowPage() {
  const { generators, storages, consumers, circuits, rooms, meters, settings,
    updateMeter, updateStorage, updateCircuit, updateRoom, updateConsumer } = useEnergyStore()
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const [showCircuitTypeDialog, setShowCircuitTypeDialog] = useState(false)
  const [openColumnPopup, setOpenColumnPopup] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<{
    nodeId: string; type: FlowNode['type']; entityId: string; x: number; y: number; energy?: string
  } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

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
    nodeId: string; startMouseY: number; startOffset: number; moved: boolean
  } | null>(null)

  const handleDragStart = (node: FlowNode, e: React.MouseEvent) => {
    if (connecting) return
    if (node.type === 'grid') return // Hausanschluss nicht verschiebbar
    e.stopPropagation()
    const pt = getSvgPoint(e)
    dragging.current = {
      nodeId: node.id,
      startMouseY: pt.y,
      startOffset: yOffsets[node.id] || 0,
      moved: false,
    }
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const pt = getSvgPoint(e)
    const dy = pt.y - dragging.current.startMouseY
    if (Math.abs(dy) > 3) dragging.current.moved = true
    if (!dragging.current.moved) return
    const newOffset = dragging.current.startOffset + dy
    saveOffsets({ ...yOffsets, [dragging.current.nodeId]: newOffset })
  }

  const handleDragEnd = () => {
    dragging.current = null
  }

  // Globaler mouseup (falls Maus das SVG verlässt)
  useEffect(() => {
    const up = () => { dragging.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const resetPositions = useCallback(() => {
    saveOffsets({})
  }, [saveOffsets])

  const handleNodeClick = (node: FlowNode) => {
    const path = nodePathMap[node.type]
    if (!path) return
    const entityId = node.id.substring(node.id.indexOf('-') + 1)
    navigate(path, { state: { editId: entityId, returnTo: '/energy-flow' } })
  }

  const handleColumnAdd = (colKey: string) => {
    if (colKey === 'circuit') {
      setShowCircuitTypeDialog(true)
      return
    }
    const route = columnRoutes[colKey]
    if (!route) return
    navigate(route.path, { state: { createNew: true, initialValues: route.initialValues, returnTo: '/energy-flow' } })
  }

  const handleCircuitTypeSelect = (type: 'heating' | 'cooling' | 'combined') => {
    setShowCircuitTypeDialog(false)
    navigate('/circuits', { state: { createNew: true, initialValues: { type }, returnTo: '/energy-flow' } })
  }

  // --- Spalten-Überschrift-Klick: Popup mit Elementen ---
  const meterColumnCategories: Record<string, MeterCategory> = {
    sourceM: 'source', genM: 'generation', storM: 'consumption',
    circM: 'circuit', groupM: 'group', endM: 'end',
  }

  const columnLabels: Record<string, string> = {
    sourceM: 'Quellenzähler', gen: 'Erzeuger', genM: 'Erzeugerzähler',
    stor: 'Speicher', storM: 'Heiz-/Kühlkreiszähler', circuit: 'Heiz-/Kühlkreise',
    circM: 'Raumzähler', room: 'Räume', groupM: 'Verbrauchergruppenzähler',
    con: 'Verbraucher', endM: 'Endzähler',
  }

  const shortCategoryLabels: Record<MeterCategory, string> = {
    source: 'Quellen', generation: 'Erzeuger', consumption: 'H/K-Kreis',
    circuit: 'Raum', group: 'Gruppe', end: 'End', unassigned: 'Ohne',
  }

  const getColumnItems = (colKey: string) => {
    if (meterColumnCategories[colKey]) {
      // Zähler-Spalten: alle Zähler zeigen
      return meters.map((m) => ({
        id: m.id,
        name: m.name || m.meterNumber || 'Zähler',
        subType: m.type,
        type: 'meter' as const,
        assigned: m.category === meterColumnCategories[colKey],
        badge: shortCategoryLabels[m.category],
      }))
    }
    // Geräte-Spalten: nur zugehörige Elemente
    switch (colKey) {
      case 'gen': return generators.map((g) => ({ id: g.id, name: g.name || g.type, subType: g.type, type: 'generator' as const, assigned: true, badge: '' }))
      case 'stor': return storages.map((s) => ({ id: s.id, name: s.name || s.type, subType: s.type, type: 'storage' as const, assigned: true, badge: '' }))
      case 'circuit': return circuits.map((c) => ({ id: c.id, name: c.name, subType: c.type, type: 'circuit' as const, assigned: true, badge: '' }))
      case 'room': return rooms.map((r) => ({ id: r.id, name: r.name, subType: r.roomType, type: 'room' as const, assigned: true, badge: '' }))
      case 'con': return consumers.map((c) => ({ id: c.id, name: c.name || c.type, subType: c.type, type: 'consumer' as const, assigned: true, badge: '' }))
      default: return []
    }
  }

  const handleColumnHeaderClick = (colKey: string) => {
    setOpenColumnPopup(openColumnPopup === colKey ? null : colKey)
  }

  const handlePopupItemClick = (colKey: string, item: { id: string; type: string; assigned: boolean }) => {
    if (meterColumnCategories[colKey]) {
      const meter = meters.find((m) => m.id === item.id)
      if (!meter) return
      if (item.assigned) {
        // Abwählen: in "Nicht zugeordnet" verschieben
        updateMeter(item.id, { ...meter, category: 'unassigned' })
      } else {
        // Zähler dieser Spalte zuordnen
        updateMeter(item.id, { ...meter, category: meterColumnCategories[colKey] })
      }
    } else {
      // Geräte-Spalten: zur Bearbeitung navigieren
      const path = nodePathMap[item.type]
      if (path) {
        navigate(path, { state: { editId: item.id, returnTo: '/energy-flow' } })
      }
      setOpenColumnPopup(null)
    }
  }

  // --- Verbindungs-Interaktion: Andockpunkte + Drag-to-Connect ---

  const getSvgPoint = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startConnect = (node: FlowNode, side: 'left' | 'right', e: React.MouseEvent, energy?: string, cy?: number) => {
    e.stopPropagation()
    const entityId = node.id === 'bus' ? 'grid' : node.id.substring(node.id.indexOf('-') + 1)
    setConnecting({
      nodeId: node.id, type: node.type, entityId,
      x: side === 'right' ? node.x + node.w / 2 : node.x - node.w / 2,
      y: cy ?? (node.y + node.h / 2),
      energy,
    })
    setMousePos(getSvgPoint(e))
  }

  const connectTargets: Record<string, string[]> = {
    grid: ['generator', 'storage', 'consumer', 'meter'],
    generator: ['grid', 'storage', 'circuit', 'meter'],
    storage: ['grid', 'generator', 'circuit', 'consumer', 'meter'],
    circuit: ['room', 'meter'],
    room: ['consumer', 'meter'],
    consumer: ['grid', 'storage', 'meter'],
    meter: ['grid', 'generator', 'storage', 'circuit', 'room', 'consumer'],
  }

  // Bidirektional: prüfe ob A→B ODER B→A eine gültige Verbindung ist
  const isValidTarget = (targetNode: FlowNode): boolean => {
    if (!connecting) return false
    if (connecting.nodeId === targetNode.id) return false
    return connectTargets[connecting.type]?.includes(targetNode.type)
      || connectTargets[targetNode.type]?.includes(connecting.type)
      || false
  }

  const finishConnect = (targetNode: FlowNode, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!connecting || !isValidTarget(targetNode)) { setConnecting(null); return }

    const aType = connecting.type
    const aId = connecting.entityId
    const bType = targetNode.type
    const bId = targetNode.id === 'bus' ? 'grid' : targetNode.id.substring(targetNode.id.indexOf('-') + 1)

    // Korrekte Richtung bestimmen: vorwärts (a→b) oder rückwärts (b→a)
    let fromType: string, fromId: string, toType: string, toId: string
    if (connectTargets[aType]?.includes(bType)) {
      fromType = aType; fromId = aId; toType = bType; toId = bId
    } else {
      fromType = bType; fromId = bId; toType = aType; toId = aId
    }

    // Grid ↔ Storage (Batterie lädt/speist vom/ins Netz)
    if ((fromType === 'grid' && toType === 'storage') || (fromType === 'storage' && toType === 'grid')) {
      const storId = fromType === 'storage' ? fromId : toId
      const s = storages.find((s) => s.id === storId)
      if (s && !(s.connectedGeneratorIds || []).includes('grid')) {
        updateStorage(storId, { ...s, connectedGeneratorIds: [...(s.connectedGeneratorIds || []), 'grid'] } as any)
      }
    // Grid ↔ Consumer (Verbraucher am Hausanschluss)
    } else if ((fromType === 'grid' && toType === 'consumer') || (fromType === 'consumer' && toType === 'grid')) {
      const conId = fromType === 'consumer' ? fromId : toId
      const c = consumers.find((c) => c.id === conId)
      if (c && !(c.connectedSourceIds || []).includes('grid')) {
        updateConsumer(conId, { ...c, connectedSourceIds: [...(c.connectedSourceIds || []), 'grid'] })
      }
    // Grid ↔ Generator (Erzeuger speist ins Netz)
    } else if ((fromType === 'grid' && toType === 'generator') || (fromType === 'generator' && toType === 'grid')) {
      // Erzeuger-Netz-Verbindung wird über Zähler modelliert, keine separate Speicherung nötig
    // Generator ↔ Storage
    } else if ((fromType === 'generator' && toType === 'storage') || (fromType === 'storage' && toType === 'generator')) {
      const genId = fromType === 'generator' ? fromId : toId
      const storId = fromType === 'storage' ? fromId : toId
      const s = storages.find((s) => s.id === storId)
      if (s && !(s.connectedGeneratorIds || []).includes(genId)) {
        updateStorage(storId, { ...s, connectedGeneratorIds: [...(s.connectedGeneratorIds || []), genId] } as any)
      }
    // Storage ↔ Consumer
    } else if ((fromType === 'storage' && toType === 'consumer') || (fromType === 'consumer' && toType === 'storage')) {
      const storId = fromType === 'storage' ? fromId : toId
      const conId = fromType === 'consumer' ? fromId : toId
      const s = storages.find((s) => s.id === storId)
      if (s && !(s.connectedConsumerIds || []).includes(conId)) {
        updateStorage(storId, { ...s, connectedConsumerIds: [...(s.connectedConsumerIds || []), conId] } as any)
      }
    } else if (fromType === 'generator' && toType === 'circuit') {
      const c = circuits.find((c) => c.id === toId)
      if (c && !c.generatorIds.includes(fromId)) {
        updateCircuit(toId, { ...c, generatorIds: [...c.generatorIds, fromId] })
      }
    } else if (fromType === 'storage' && toType === 'circuit') {
      const c = circuits.find((c) => c.id === toId)
      if (c && !(c.supplyStorageIds || []).includes(fromId)) {
        updateCircuit(toId, { ...c, supplyStorageIds: [...(c.supplyStorageIds || []), fromId] })
      }
    } else if (fromType === 'circuit' && toType === 'room') {
      const c = circuits.find((c) => c.id === fromId)
      if (c && !c.roomIds.includes(toId)) {
        updateCircuit(fromId, { ...c, roomIds: [...c.roomIds, toId] })
      }
    } else if (fromType === 'room' && toType === 'consumer') {
      const r = rooms.find((r) => r.id === fromId)
      if (r && !r.consumerIds.includes(toId)) {
        updateRoom(fromId, { ...r, consumerIds: [...r.consumerIds, toId] })
      }
    } else if (toType === 'meter' || fromType === 'meter') {
      const meterId = toType === 'meter' ? toId : fromId
      const otherType = toType === 'meter' ? fromType : toType
      const otherId = toType === 'meter' ? fromId : toId
      const m = meters.find((m) => m.id === meterId)
      if (!m) { setConnecting(null); return }

      // Smart: Wenn der Zähler bereits einem Speicher zugeordnet ist und man grid/generator/consumer verbindet,
      // → Durchverbindung statt Neuzuweisung
      if (m.assignedToType === 'storage' && m.assignedToId) {
        const s = storages.find((s) => s.id === m.assignedToId)
        if (s) {
          if (otherType === 'grid') {
            if (!(s.connectedGeneratorIds || []).includes('grid')) {
              updateStorage(s.id, { ...s, connectedGeneratorIds: [...(s.connectedGeneratorIds || []), 'grid'] } as any)
            }
            setConnecting(null); return
          } else if (otherType === 'generator') {
            if (!(s.connectedGeneratorIds || []).includes(otherId)) {
              updateStorage(s.id, { ...s, connectedGeneratorIds: [...(s.connectedGeneratorIds || []), otherId] } as any)
            }
            setConnecting(null); return
          } else if (otherType === 'consumer') {
            if (!(s.connectedConsumerIds || []).includes(otherId)) {
              updateStorage(s.id, { ...s, connectedConsumerIds: [...(s.connectedConsumerIds || []), otherId] } as any)
            }
            setConnecting(null); return
          }
        }
      }
      // Wenn der Zähler einem Erzeuger zugeordnet ist und man grid verbindet → Durchverbindung (Erzeuger → Zähler → Hausanschluss)
      if (m.assignedToType === 'generator' && m.assignedToId && otherType === 'grid') {
        if (m.parentMeterId !== 'grid') {
          updateMeter(meterId, { ...m, parentMeterId: 'grid' })
        }
        setConnecting(null); return
      }
      // Wenn der Zähler einem Verbraucher zugeordnet ist und man grid verbindet → connectedSourceIds + parentMeterId
      if (m.assignedToType === 'consumer' && m.assignedToId && otherType === 'grid') {
        const c = consumers.find((c) => c.id === m.assignedToId)
        if (c && !(c.connectedSourceIds || []).includes('grid')) {
          updateConsumer(c.id, { ...c, connectedSourceIds: [...(c.connectedSourceIds || []), 'grid'] })
        }
        if (m.parentMeterId !== 'grid') {
          updateMeter(meterId, { ...m, parentMeterId: 'grid' })
        }
        setConnecting(null); return
      }

      // Standard: Zähler dem Gerät zuordnen
      const aType = otherType === 'grid' ? 'grid' : otherType as any
      updateMeter(meterId, {
        ...m,
        assignedToType: aType,
        assignedToId: otherType === 'grid' ? 'grid' : otherId,
        ...(otherType === 'grid' ? { parentMeterId: 'grid' } : {}),
      })
    }

    setConnecting(null)
  }

  const deleteEdge = (edge: FlowEdge) => {
    if (!edge.deletable) return
    const parseId = (nid: string) => {
      if (nid === 'bus') return { prefix: 'bus', id: 'grid' }
      const i = nid.indexOf('-')
      return { prefix: nid.substring(0, i), id: nid.substring(i + 1) }
    }
    const from = parseId(edge.from)
    const to = parseId(edge.to)

    // Grid ↔ Storage
    if ((from.prefix === 'bus' && to.prefix === 'stor') || (from.prefix === 'stor' && to.prefix === 'bus')) {
      const storId = from.prefix === 'stor' ? from.id : to.id
      const s = storages.find((s) => s.id === storId)
      if (s) updateStorage(storId, { ...s, connectedGeneratorIds: (s.connectedGeneratorIds || []).filter((id) => id !== 'grid') } as any)
    // Grid ↔ Consumer
    } else if ((from.prefix === 'bus' && to.prefix === 'con') || (from.prefix === 'con' && to.prefix === 'bus')) {
      const conId = from.prefix === 'con' ? from.id : to.id
      const c = consumers.find((c) => c.id === conId)
      if (c) updateConsumer(conId, { ...c, connectedSourceIds: (c.connectedSourceIds || []).filter((id) => id !== 'grid') })
    } else if (from.prefix === 'gen' && to.prefix === 'stor') {
      const s = storages.find((s) => s.id === to.id)
      if (s) updateStorage(to.id, { ...s, connectedGeneratorIds: (s.connectedGeneratorIds || []).filter((id) => id !== from.id) } as any)
    } else if (from.prefix === 'stor' && to.prefix === 'gen') {
      const s = storages.find((s) => s.id === from.id)
      if (s) updateStorage(from.id, { ...s, connectedGeneratorIds: (s.connectedGeneratorIds || []).filter((id) => id !== to.id) } as any)
    } else if (from.prefix === 'stor' && to.prefix === 'con') {
      const s = storages.find((s) => s.id === from.id)
      if (s) updateStorage(from.id, { ...s, connectedConsumerIds: (s.connectedConsumerIds || []).filter((id) => id !== to.id) } as any)
    } else if (from.prefix === 'con' && to.prefix === 'stor') {
      const s = storages.find((s) => s.id === to.id)
      if (s) updateStorage(to.id, { ...s, connectedConsumerIds: (s.connectedConsumerIds || []).filter((id) => id !== from.id) } as any)
    } else if (from.prefix === 'gen' && to.prefix === 'circ') {
      const c = circuits.find((c) => c.id === to.id)
      if (c) updateCircuit(to.id, { ...c, generatorIds: c.generatorIds.filter((id) => id !== from.id) })
    } else if (from.prefix === 'stor' && to.prefix === 'circ') {
      const c = circuits.find((c) => c.id === to.id)
      if (c) updateCircuit(to.id, { ...c, supplyStorageIds: (c.supplyStorageIds || []).filter((id) => id !== from.id) })
    } else if (from.prefix === 'circ' && to.prefix === 'room') {
      const c = circuits.find((c) => c.id === from.id)
      if (c) updateCircuit(from.id, { ...c, roomIds: c.roomIds.filter((id) => id !== to.id) })
    } else if (from.prefix === 'room' && to.prefix === 'con') {
      const r = rooms.find((r) => r.id === from.id)
      if (r) updateRoom(from.id, { ...r, consumerIds: r.consumerIds.filter((id) => id !== to.id) })
    } else if (to.prefix === 'meter' || from.prefix === 'meter') {
      const meterId = to.prefix === 'meter' ? to.id : from.id
      const other = to.prefix === 'meter' ? from : to
      const m = meters.find((m) => m.id === meterId)
      if (!m) return

      // Smart: Wenn Zähler einem Speicher zugeordnet ist, Durchverbindung löschen statt Zähler-Zuweisung
      if (m.assignedToType === 'storage' && m.assignedToId) {
        const s = storages.find((s) => s.id === m.assignedToId)
        if (s) {
          if (other.prefix === 'bus') {
            updateStorage(s.id, { ...s, connectedGeneratorIds: (s.connectedGeneratorIds || []).filter((id) => id !== 'grid') } as any)
            return
          } else if (other.prefix === 'gen') {
            updateStorage(s.id, { ...s, connectedGeneratorIds: (s.connectedGeneratorIds || []).filter((id) => id !== other.id) } as any)
            return
          } else if (other.prefix === 'con') {
            updateStorage(s.id, { ...s, connectedConsumerIds: (s.connectedConsumerIds || []).filter((id) => id !== other.id) } as any)
            return
          }
        }
      }
      // Wenn Zähler einem Erzeuger zugeordnet ist und grid-Kante gelöscht wird → nur parentMeterId löschen
      if (m.assignedToType === 'generator' && m.assignedToId && other.prefix === 'bus') {
        updateMeter(meterId, { ...m, parentMeterId: '' })
        return
      }
      // Wenn Zähler einem Verbraucher zugeordnet ist und grid-Kante gelöscht wird
      if (m.assignedToType === 'consumer' && m.assignedToId && other.prefix === 'bus') {
        const c = consumers.find((c) => c.id === m.assignedToId)
        if (c) {
          updateConsumer(c.id, { ...c, connectedSourceIds: (c.connectedSourceIds || []).filter((id) => id !== 'grid') })
        }
        updateMeter(meterId, { ...m, parentMeterId: '' })
        return
      }

      // Standard: Zähler-Zuweisung löschen (parentMeterId zurücksetzen bei Grid-Verbindung)
      updateMeter(meterId, { ...m, assignedToType: 'none', assignedToId: '', ...(other.prefix === 'bus' ? { parentMeterId: '' } : {}) })
    }
  }

  const { nodes, edges, roomGroups, genPortMap, storPortMap, conPortMap, circPortMap, roomPortMap, meterPortMap } = useMemo(() => {
    const nodes: FlowNode[] = []
    const edges: FlowEdge[] = []

    const rowH = 52
    const startY = 50

    // Y-Tracker pro Spalte
    const colNext: Record<string, number> = {}
    const getY = (col: string) => {
      const y = colNext[col] ?? startY
      colNext[col] = y + rowH
      return y
    }
    // Y reservieren ohne zu incrementen
    const peekY = (col: string) => colNext[col] ?? startY

    const mkNode = (id: string, label: string, type: FlowNode['type'], subType: string, x: number, y: number, color: string, iconColor: string, h = NODE_H): FlowNode =>
      ({ id, label, type, subType, x, y: y + (yOffsets[id] || 0), color, iconColor, w: NODE_W, h })
    const mkMeter = (id: string, label: string, subType: string, x: number, y: number, color: string, iconColor: string): FlowNode =>
      ({ id, label, type: 'meter', subType, x, y: y + (yOffsets[id] || 0), color, iconColor, w: METER_W, h: METER_H })

    // ============================
    // 1) ERZEUGER-SPALTE (col 2)
    // ============================
    // Hausanschluss als Erzeuger behandelt (Spalte 2)
    const busY = getY('gen')
    nodes.push(mkNode('bus', 'Hausanschluss', 'grid', 'grid', cx.gen, busY, '#dbeafe', '#3b82f6'))

    const genYMap: Record<string, number> = {}
    const genPortMap: Record<string, PortLayout> = {} // Port-Layout pro Generator-ID
    generators.forEach((g) => {
      const c = genColors[g.type]
      const y = getY('gen')
      genYMap[g.id] = y
      const ports = getGenPortLayout(g as any)
      genPortMap[g.id] = ports
      const hasDualPorts = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`gen-${g.id}`, g.name || g.type, 'generator', g.type, cx.gen, y, c.bg, c.icon, hasDualPorts ? NODE_H_DUAL : NODE_H))
    })

    // Port-Y-Position für einen Energie-Port an einem Generator-Node
    const portY = (genId: string, energy: string, side: 'left' | 'right'): number | undefined => {
      const layout = genPortMap[genId]
      const node = nodes.find((n) => n.id === `gen-${genId}`)
      if (!layout || !node) return undefined
      const defs = layout[side]
      if (defs.length <= 1) return undefined // kein Offset nötig bei single-port
      const idx = defs.findIndex((p) => p.energy === energy)
      if (idx < 0) return undefined
      return node.y + node.h * ((idx + 0.5) / defs.length)
    }

    // ============================
    // 2) SPEICHER-SPALTE (col 4)
    // ============================
    const storYMap: Record<string, number> = {}
    const storPortMap: Record<string, PortLayout> = {}
    // Thermische Speicher zuerst, dann Batterie (damit Batteriezähler horizontal passt)
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

    // ============================
    // 3) HEIZ-/KÜHLKREISE (col 6)
    // ============================
    const circPortMap: Record<string, PortLayout> = {}
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      const y = getY('circuit')
      const ports = getCircPortLayout(c as any)
      circPortMap[c.id] = ports
      const hasDual = ports.left.length > 1 || ports.right.length > 1
      nodes.push(mkNode(`circ-${c.id}`, c.name, 'circuit', c.type, cx.circuit, y, cc.bg, cc.icon, hasDual ? NODE_H_DUAL : NODE_H))
    })

    // ============================
    // 4) RÄUME (col 8)
    // ============================
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

    // ============================
    // 5) VERBRAUCHER (col 10)
    // ============================
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

    // ============================
    // 6) ZÄHLER in ihre Spalten (direkt über m.category)
    // ============================
    const categoryToCol: Record<string, string> = {
      source: 'sourceM', generation: 'genM', consumption: 'storM',
      circuit: 'circM', group: 'groupM', end: 'endM',
    }
    const meterNodeMap: Record<string, FlowNode> = {}
    const meterPortMap: Record<string, PortLayout> = {}

    // Kollisionserkennung: pro Spalte belegte Y-Positionen tracken
    const meterColUsedY: Record<string, number[]> = {}
    const claimMeterY = (colKey: string, desiredY: number): number => {
      if (!meterColUsedY[colKey]) meterColUsedY[colKey] = []
      const used = meterColUsedY[colKey]
      let y = desiredY
      while (used.some((uy) => Math.abs(uy - y) < rowH)) {
        y += rowH
      }
      used.push(y)
      // colNext-Tracker aktualisieren, damit getY() diese Position nicht nochmal vergibt
      if ((colNext[colKey] ?? startY) <= y) {
        colNext[colKey] = y + rowH
      }
      return y
    }

    meters.forEach((m) => {
      const mc = meterColors[m.type] || meterColors.electricity
      const colKey = categoryToCol[m.category]
      if (!colKey) return

      // Gewünschte Y-Position: horizontal auf Höhe des zugeordneten Geräts
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

    // ============================
    // 7) EDGES — Verbindungen
    // ============================

    // (a) Quellenzähler → Hausanschluss / Erzeuger
    meters.forEach((m) => {
      if (m.category !== 'source') return
      const mc = meterColors[m.type] || meterColors.electricity
      if (m.assignedToType === 'grid') {
        edges.push({ from: `meter-${m.id}`, to: 'bus', color: energyColors[m.type === 'gas' ? 'gas' : 'electricity'], deletable: true, animated: true, bidirectional: m.type === 'electricity' })
      } else {
        const gen = generators.find((g) => g.id === m.assignedToId)
        if (gen) {
          // Quellenzähler → linker Port des Erzeugers (Eingang)
          const leftEnergy = m.type === 'gas' ? 'gas' : m.type === 'heat' ? 'source' : 'electricity'
          const toY = portY(gen.id, leftEnergy, 'left')
          const edgeColor = energyColors[leftEnergy] || mc.icon
          edges.push({ from: `meter-${m.id}`, to: `gen-${gen.id}`, color: edgeColor, deletable: true, animated: true, toY })
        }
      }
    })

    // (b) Erzeuger → Erzeugerzähler (PV/CHP → Zähler)
    meters.forEach((m) => {
      if (m.category !== 'generation') return
      if (m.assignedToType === 'storage') return
      if (m.assignedToType === 'generator') {
        const gen = generators.find((g) => g.id === m.assignedToId)
        if (!gen) return
        // Zählertyp bestimmt den Energie-Port (Stromzähler → Strom-Port, Wärmezähler → Wärme-Port)
        const meterEnergy = m.type === 'electricity' ? 'electricity' : m.type === 'heat' ? 'heat' : m.type === 'cold' ? 'cold' : m.type === 'gas' ? 'gas' : 'electricity'
        const edgeColor = energyColors[meterEnergy] || genColors[gen.type].icon
        const fromY = portY(gen.id, meterEnergy, 'right')
        edges.push({ from: `gen-${gen.id}`, to: `meter-${m.id}`, color: edgeColor, animated: true, deletable: true, fromY })
      } else if (m.assignedToType === 'grid') {
        edges.push({ from: 'bus', to: `meter-${m.id}`, color: energyColors.electricity, animated: true, deletable: true })
      }
    })

    // (c) Erzeuger → Speicher (alle Speichertypen)
    storages.forEach((s) => {
      const connGens = s.connectedGeneratorIds || []
      const storMeter = meters.find((m) => m.assignedToType === 'storage' && m.assignedToId === s.id)
      const isBat = s.type === 'battery'

      connGens.forEach((gid) => {
        if (gid === 'grid') {
          const gridColor = isBat ? energyColors.electricity : storColors[s.type].icon
          if (storMeter) {
            edges.push({ from: 'bus', to: `meter-${storMeter.id}`, color: gridColor, deletable: true, animated: true, bidirectional: isBat })
          } else {
            edges.push({ from: 'bus', to: `stor-${s.id}`, color: gridColor, deletable: true, animated: true, bidirectional: isBat })
          }
          return
        }
        const gen = generators.find((g) => g.id === gid)
        if (!gen) return
        const ee = getGenEdgeEnergy(gen.type, s.type)
        const fromY = portY(gid, ee.energy, 'right')
        if (storMeter) {
          edges.push({ from: `gen-${gid}`, to: `meter-${storMeter.id}`, color: ee.color, deletable: true, animated: true, bidirectional: isBat, fromY })
        } else {
          edges.push({ from: `gen-${gid}`, to: `stor-${s.id}`, color: ee.color, deletable: true, animated: true, bidirectional: isBat, fromY })
        }
      })

      if (storMeter) {
        const mc = meterColors[storMeter.type]
        edges.push({ from: `meter-${storMeter.id}`, to: `stor-${s.id}`, color: mc.icon, deletable: true, animated: true, bidirectional: isBat })
      }

      // Speicher → Verbraucher (bidirektional bei Batterie)
      const connCons = s.connectedConsumerIds || []
      connCons.forEach((cid) => {
        if (!consumers.some((c) => c.id === cid)) return
        edges.push({ from: `stor-${s.id}`, to: `con-${cid}`, color: isBat ? energyColors.electricity : storColors[s.type].icon, deletable: true, animated: true, bidirectional: isBat })
      })
    })

    // (d) Speicher/Erzeuger → Kreise
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      c.supplyStorageIds?.forEach((sid) => edges.push({ from: `stor-${sid}`, to: `circ-${c.id}`, color: cc.icon, deletable: true, animated: true }))
      c.generatorIds.forEach((gid) => {
        // Heiz-/Kühlkreis bekommt Wärme/Kälte-Port
        const energy = c.type === 'cooling' ? 'cold' : 'heat'
        const fromY = portY(gid, energy, 'right')
        edges.push({ from: `gen-${gid}`, to: `circ-${c.id}`, color: cc.icon, deletable: true, animated: true, fromY })
      })
    })

    // (e) Kreise → Räume
    circuits.forEach((c) => {
      const cc = circuitColors[c.type]
      c.roomIds.forEach((rid) => edges.push({ from: `circ-${c.id}`, to: `room-${rid}`, color: cc.icon, deletable: true, animated: true }))
    })

    // (f) Räume → Verbraucher
    rooms.forEach((r) => {
      (r.consumerIds || []).forEach((cid) => {
        if (consumers.some((c) => c.id === cid)) {
          edges.push({ from: `room-${r.id}`, to: `con-${cid}`, color: '#16a34a', deletable: true, animated: true })
        }
      })
    })

    // (g0) Hausanschluss → Verbraucher (über connectedSourceIds, aber nur direkt wenn kein Zähler dazwischen)
    consumers.forEach((c) => {
      if ((c.connectedSourceIds || []).includes('grid')) {
        // Wenn ein Zähler den Weg grid→meter→consumer abbildet, keine Direkt-Kante zeichnen
        const hasMeterRoute = meters.some((m) => m.parentMeterId === 'grid' && m.assignedToType === 'consumer' && m.assignedToId === c.id)
        if (!hasMeterRoute) {
          edges.push({ from: 'bus', to: `con-${c.id}`, color: '#3b82f6', deletable: true, animated: true })
        }
      }
    })

    // (g) Zähler → Verbraucher (über assignedTo)
    meters.forEach((m) => {
      if (m.assignedToType === 'consumer' && m.assignedToId && m.category !== 'end') {
        const mc = meterColors[m.type] || meterColors.electricity
        edges.push({ from: `meter-${m.id}`, to: `con-${m.assignedToId}`, color: mc.icon, deletable: true, animated: true })
      }
    })

    // (h) Raumzähler: Kreis → Raumzähler → Raum
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

    // (i) Endzähler: Verbraucher → Endzähler (oder Meter → Verbraucher wenn grid-connected)
    meters.forEach((m) => {
      if (m.category !== 'end') return
      if (m.assignedToId) {
        const mc = meterColors[m.type] || meterColors.electricity
        if (m.parentMeterId === 'grid') {
          // Grid-connected: Kabel geht grid → meter → consumer
          edges.push({ from: `meter-${m.id}`, to: `con-${m.assignedToId}`, color: mc.icon, deletable: true, animated: true })
        } else {
          edges.push({ from: `con-${m.assignedToId}`, to: `meter-${m.id}`, color: mc.icon, deletable: true, animated: true })
        }
      }
    })

    // (j) Hausanschluss ↔ Zähler (über parentMeterId — Kabel zwischen Netz und Zähler)
    meters.forEach((m) => {
      if (m.parentMeterId !== 'grid') return
      if (!meterNodeMap[m.id]) return
      // Quellen-/Erzeugerzähler die grid-assigned sind werden bereits in (a)/(b) gezeichnet
      if (m.category === 'source' && m.assignedToType === 'grid') return
      if (m.category === 'generation' && m.assignedToType === 'grid') return
      // Storage-zugeordnete Zähler werden in (c) durch connectedGeneratorIds gezeichnet
      if (m.assignedToType === 'storage') return
      const mc = meterColors[m.type] || meterColors.electricity
      if (m.assignedToType === 'generator') {
        // Erzeugerzähler: Erzeuger speist ins Netz → Zähler → Hausanschluss (Einspeisung)
        edges.push({ from: `meter-${m.id}`, to: 'bus', color: energyColors[m.type] || mc.icon, deletable: true, animated: true })
      } else {
        // Verbraucherzähler: Hausanschluss → Zähler → Verbraucher (Bezug)
        edges.push({ from: 'bus', to: `meter-${m.id}`, color: mc.icon, deletable: true, animated: true })
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
        <p className="text-sm text-dark-faded mt-1">Interaktive Darstellung der Energieflüsse — Ziehen zum Verschieben, Doppelklick zum Konfigurieren</p>
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
            {Object.keys(yOffsets).length > 0 && (
              <button onClick={resetPositions} className="ml-auto text-dark-faded hover:text-dark-text transition-colors">
                Positionen zurücksetzen
              </button>
            )}
          </div>

          <svg ref={svgRef} width={svgWidth} height={svgHeight} className="mx-auto"
            onMouseMove={(e) => {
              if (connecting) setMousePos(getSvgPoint(e))
              handleDragMove(e)
            }}
            onMouseUp={handleDragEnd}
            onClick={() => { if (connecting) setConnecting(null) }}>
            <defs />

            {/* Spalten-Überschriften mit + Button */}
            {columns.map((col) => (
              <g key={col.key}>
                {/* Klickbare Spaltenüberschrift */}
                <rect x={col.x - 42} y={0} width={76} height={30}
                  fill="#000" fillOpacity={0} style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleColumnHeaderClick(col.key) }} />
                <text x={col.x} y={col.label2 ? 16 : 22} textAnchor="middle"
                  className="fill-dark-faded font-semibold" style={{ fontSize: 8, cursor: 'pointer', pointerEvents: 'none' }}>
                  <tspan x={col.x} dy="0">{col.label1}</tspan>
                  {col.label2 && <tspan x={col.x} dy="10">{col.label2}</tspan>}
                </text>
                {/* + Button */}
                <circle cx={col.x + 38} cy={col.label2 ? 18 : 20} r={9}
                  fill="#21262d" stroke="#30363d" strokeWidth={1} style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleColumnAdd(col.key) }} />
                <text x={col.x + 38} y={col.label2 ? 22 : 24} textAnchor="middle"
                  fill="#4ade80" style={{ fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>+</text>
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
                  {edge.deletable && !connecting && (
                    <path d={path} fill="none" stroke="transparent" strokeWidth={14}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); deleteEdge(edge) }}>
                      <title>Verbindung löschen</title>
                    </path>
                  )}
                </g>
              )
            })}

            {/* Temporäre Verbindungslinie beim Verbinden */}
            {connecting && (
              <path
                d={`M${connecting.x},${connecting.y} C${(connecting.x + mousePos.x) / 2},${connecting.y} ${(connecting.x + mousePos.x) / 2},${mousePos.y} ${mousePos.x},${mousePos.y}`}
                fill="none" stroke="#4ade80" strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.8}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Nodes */}
            {nodes.map((node) => {
              const Icon = getIcon(node.subType)
              const clickable = node.type !== 'grid'
              const isMeter = node.type === 'meter'
              const validTarget = connecting ? isValidTarget(node) : false
              const isDragging = dragging.current?.nodeId === node.id
              return (
                <g key={node.id}
                  className={clickable && !connecting ? 'cursor-grab flow-node-clickable' : ''}
                  style={isDragging ? { cursor: 'grabbing' } : undefined}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (clickable && !connecting) handleNodeClick(node)
                  }}
                  onMouseDown={(e) => { if (e.button === 0) handleDragStart(node, e) }}
                >
                  <rect x={node.x - node.w / 2} y={node.y} width={node.w} height={node.h}
                    rx={isMeter ? 6 : 8} fill={node.color}
                    stroke={validTarget ? '#4ade80' : node.iconColor}
                    strokeWidth={validTarget ? 2.5 : 1.5} strokeOpacity={validTarget ? 0.8 : 0.4} />
                  <foreignObject x={node.x - node.w / 2} y={node.y} width={node.w} height={node.h} style={{ pointerEvents: 'none' }}>
                    <div className="flex items-center gap-1 h-full px-1.5 pointer-events-none">
                      <Icon style={{ color: node.iconColor, width: isMeter ? 10 : 13, height: isMeter ? 10 : 13, flexShrink: 0 }} />
                      <span className={`font-medium truncate ${isMeter ? 'text-[8px]' : 'text-[9px]'}`} style={{ color: node.iconColor }}>
                        {node.label}
                      </span>
                    </div>
                  </foreignObject>
                  {/* Ports — dynamisch basierend auf Energieform */}
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
                    const portList: Array<{ side: 'left' | 'right'; energy: string; portColor: string; cy: number }> = []
                    if (hasCustomPorts) {
                      const addSide = (side: 'left' | 'right', defs: PortDef[]) => {
                        if (defs.length === 0) return
                        if (defs.length === 1) {
                          portList.push({ side, energy: defs[0].energy, portColor: defs[0].color, cy: node.y + node.h / 2 })
                        } else {
                          defs.forEach((p, idx) => {
                            portList.push({ side, energy: p.energy, portColor: p.color, cy: node.y + node.h * ((idx + 0.5) / defs.length) })
                          })
                        }
                      }
                      addSide('left', ports.left)
                      addSide('right', ports.right)
                    } else {
                      portList.push({ side: 'left', energy: '', portColor: node.iconColor, cy: node.y + node.h / 2 })
                      portList.push({ side: 'right', energy: '', portColor: node.iconColor, cy: node.y + node.h / 2 })
                    }
                    return portList.map((port, pi) => {
                      const pcx = port.side === 'left' ? node.x - node.w / 2 : node.x + node.w / 2
                      const fillColor = validTarget ? '#4ade80' : port.portColor
                      const energyLabel = port.energy === 'electricity' ? '⚡ Strom' : port.energy === 'heat' ? '🔥 Wärme' : port.energy === 'gas' ? '🔶 Gas' : port.energy === 'source' ? '♨ Quelle' : port.energy === 'cold' ? '❄ Kälte' : ''
                      return (
                        <circle key={pi} cx={pcx} cy={port.cy} r={validTarget ? 4 : 3}
                          fill={fillColor} fillOpacity={validTarget ? 0.7 : 0.5}
                          stroke={fillColor} strokeWidth={1} strokeOpacity={validTarget ? 1 : 0.7}
                          style={{ cursor: validTarget || !connecting ? 'crosshair' : 'default' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (validTarget) finishConnect(node, e)
                            else if (!connecting) startConnect(node, port.side, e, port.energy, port.cy)
                          }}>
                          {(validTarget || !connecting) && <title>{validTarget ? 'Hier verbinden' : `${energyLabel ? energyLabel + ' — ' : ''}Verbindung ziehen`}</title>}
                        </circle>
                      )
                    })
                  })()}
                </g>
              )
            })}
          </svg>
        </div>
      {/* Heiz-/Kühlkreis Auswahl-Dialog */}
      {showCircuitTypeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCircuitTypeDialog(false)}>
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-dark-text mb-4">Neuer Kreis anlegen</h3>
            <div className="space-y-2">
              <button onClick={() => handleCircuitTypeSelect('heating')}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:border-red-500/50 hover:bg-red-500/5 transition-colors text-left">
                <Flame className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <span className="font-medium text-dark-text">Heizkreis</span>
                  <p className="text-xs text-dark-faded">Fussbodenheizung, Radiatoren, Warmwasser</p>
                </div>
              </button>
              <button onClick={() => handleCircuitTypeSelect('cooling')}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors text-left">
                <Snowflake className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="font-medium text-dark-text">Kuehlkreis</span>
                  <p className="text-xs text-dark-faded">Kuehldecke, Fan-Coil, Klimaanlage</p>
                </div>
              </button>
              <button onClick={() => handleCircuitTypeSelect('combined')}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors text-left">
                <Waypoints className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <span className="font-medium text-dark-text">Kombiniert</span>
                  <p className="text-xs text-dark-faded">Heizen und Kuehlen (z.B. Waermepumpe reversibel)</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowCircuitTypeDialog(false)} className="mt-4 w-full btn-secondary text-sm">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Spalten-Popup: Elemente anzeigen / Zähler zuordnen */}
      {openColumnPopup && (() => {
        const colKey = openColumnPopup
        const isMeterCol = !!meterColumnCategories[colKey]
        const items = getColumnItems(colKey)
        const colLabel = columnLabels[colKey] || colKey

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOpenColumnPopup(null)}>
            <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-2xl max-w-sm w-full max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-dark-text mb-1">{colLabel}</h3>
              <p className="text-xs text-dark-faded mb-3">
                {isMeterCol
                  ? 'Alle Zähler — klicke zum Zu- oder Abwählen'
                  : 'Klicke auf ein Element zum Bearbeiten'}
              </p>

              <div className="overflow-y-auto flex-1 space-y-1">
                {items.length === 0 && (
                  <p className="text-sm text-dark-faded py-6 text-center">Keine Einträge</p>
                )}
                {items.map((item) => {
                  const Icon = getIcon(item.subType)
                  return (
                    <button
                      key={item.id}
                      onClick={() => handlePopupItemClick(colKey, item)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                        item.assigned
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-dark-border hover:border-dark-muted hover:bg-dark-hover'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${item.assigned ? 'text-emerald-400' : 'text-dark-muted'}`} />
                      <span className={`text-sm truncate flex-1 ${item.assigned ? 'text-emerald-400 font-medium' : 'text-dark-text'}`}>
                        {item.name}
                      </span>
                      {isMeterCol && item.assigned && (
                        <span className="text-xs text-emerald-400/70 shrink-0">✓</span>
                      )}
                      {isMeterCol && !item.assigned && (
                        <span className="text-[10px] text-dark-faded px-1.5 py-0.5 bg-dark-hover rounded shrink-0">{item.badge}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <button onClick={() => setOpenColumnPopup(null)} className="mt-3 w-full btn-secondary text-sm">Schließen</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
