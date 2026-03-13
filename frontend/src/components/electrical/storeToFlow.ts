/**
 * Konvertiert die Zustand-Store-Daten in React Flow Nodes & Edges
 * für das elektrische Stromnetz-Schema.
 *
 * Nur elektrisch relevante Entitäten werden angezeigt:
 *   - Hausanschluss (Grid) → transformer
 *   - PV → pv_inverter
 *   - BHKW → generator
 *   - Batterie → battery_system
 *   - WP, Kältemaschine → motor_load
 *   - Verbraucher → consumer_load / wallbox
 *   - Stromzähler → elec_meter
 */
import type { Node, Edge } from '@xyflow/react'
import type { Generator, Storage, Consumer, Meter } from '../../../types'
import { LS_POSITIONS_KEY, LS_ROTATIONS_KEY } from './constants'

export function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(LS_POSITIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function savePositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(LS_POSITIONS_KEY, JSON.stringify(positions))
}

export function loadRotations(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_ROTATIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveRotations(rotations: Record<string, number>) {
  localStorage.setItem(LS_ROTATIONS_KEY, JSON.stringify(rotations))
}

const COL = {
  grid: 50,
  generators: 300,
  storage: 550,
  consumers: 800,
  meters: 0,
}

const ROW_GAP = 140
const START_Y = 60

interface StoreData {
  generators: Generator[]
  storages: Storage[]
  consumers: Consumer[]
  meters: Meter[]
}

export function buildNodes(
  store: StoreData,
  savedPositions: Record<string, { x: number; y: number }>,
  savedRotations: Record<string, number> = {},
): Node[] {
  const nodes: Node[] = []
  let genRow = 0
  let storRow = 0
  let conRow = 0
  let meterRow = 0

  const pos = (id: string, defaultX: number, defaultY: number) =>
    savedPositions[id] || { x: defaultX, y: defaultY }
  const rot = (id: string) => savedRotations[id] || 0

  // --- Hausanschluss (Grid) → Transformer ---
  const gridGens = store.generators.filter((g) => g.type === 'grid')
  for (const g of gridGens) {
    const id = `egen-${g.id}`
    nodes.push({
      id,
      type: 'transformer',
      position: pos(id, COL.grid, START_Y + genRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        nominalPowerKw: (g as any).gridMaxPowerKw,
      },
    })
    genRow++
  }

  // --- PV → PV-Inverter ---
  const pvGens = store.generators.filter((g) => g.type === 'pv')
  for (const g of pvGens) {
    const id = `egen-${g.id}`
    nodes.push({
      id,
      type: 'pv_inverter',
      position: pos(id, COL.generators, START_Y + genRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        peakPowerKwp: (g as any).peakPowerKwp,
      },
    })
    genRow++
  }

  // --- BHKW → Generator ---
  const chpGens = store.generators.filter((g) => g.type === 'chp')
  for (const g of chpGens) {
    const id = `egen-${g.id}`
    nodes.push({
      id,
      type: 'generator',
      position: pos(id, COL.generators, START_Y + genRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        nominalPowerKw: (g as any).electricalPowerKw,
      },
    })
    genRow++
  }

  // --- Windrad → Wind Turbine ---
  const windGens = store.generators.filter((g) => g.type === 'wind_turbine')
  for (const g of windGens) {
    const id = `egen-${g.id}`
    nodes.push({
      id,
      type: 'wind_turbine',
      position: pos(id, COL.generators, START_Y + genRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        nominalPowerKw: (g as any).nominalPowerKw,
      },
    })
    genRow++
  }

  // --- Wärmepumpe / Kältemaschine → Motor-Last (Strom-Verbraucher) ---
  const motorGens = store.generators.filter((g) => g.type === 'heat_pump' || g.type === 'chiller')
  for (const g of motorGens) {
    const id = `egen-${g.id}`
    nodes.push({
      id,
      type: 'motor_load',
      position: pos(id, COL.consumers, START_Y + conRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        motorType: g.type === 'heat_pump' ? 'heat_pump' : 'chiller',
        nominalPowerKw: g.type === 'heat_pump' ? (g as any).electricalPowerKw : (g as any).electricalPowerKw,
      },
    })
    conRow++
  }

  // --- Batterie → Battery System ---
  const batteries = store.storages.filter((s) => s.type === 'battery')
  for (const s of batteries) {
    const id = `estor-${s.id}`
    nodes.push({
      id,
      type: 'battery_system',
      position: pos(id, COL.storage, START_Y + storRow * ROW_GAP),
      data: {
        label: s.name,
        entityId: s.id,
        rotation: rot(id),
        capacityKwh: (s as any).capacityKwh,
      },
    })
    storRow++
  }

  // --- Verbraucher → Consumer Load / Wallbox ---
  for (const c of store.consumers) {
    const id = `econ-${c.id}`
    const isWallbox = c.type === 'ev_charger' || ((c as any).wallboxMaxPowerKw && (c as any).wallboxMaxPowerKw > 0 && c.type === 'ev_charger')
    nodes.push({
      id,
      type: isWallbox ? 'wallbox' : 'consumer_load',
      position: pos(id, COL.consumers, START_Y + conRow * ROW_GAP),
      data: {
        label: c.name,
        entityId: c.id,
        rotation: rot(id),
        consumerType: c.type,
        nominalPowerKw: c.nominalPowerKw,
      },
    })
    conRow++
  }

  // --- Stromzähler ---
  const elecMeters = store.meters.filter((m) => m.type === 'electricity')
  for (const m of elecMeters) {
    const id = `emeter-${m.id}`
    let defaultX = 150
    let defaultY = START_Y + meterRow * 80
    if (m.assignedToId && m.assignedToType) {
      const refNode = nodes.find((n) => {
        const eid = (n.data as any).entityId
        return eid === m.assignedToId
      })
      if (refNode) {
        defaultX = refNode.position.x + 140
        defaultY = refNode.position.y + 10
      }
    }
    nodes.push({
      id,
      type: 'elec_meter',
      position: pos(id, defaultX, defaultY),
      data: {
        label: m.name,
        entityId: m.id,
        rotation: rot(id),
        direction: m.direction,
      },
    })
    meterRow++
  }

  return nodes
}

export function buildEdges(store: StoreData): Edge[] {
  const edges: Edge[] = []
  let edgeId = 0

  const addEdge = (source: string, sourceHandle: string, target: string, targetHandle: string) => {
    edges.push({
      id: `ee-${edgeId++}`,
      source,
      sourceHandle,
      target,
      targetHandle,
      type: 'electrical',
      deletable: true,
    })
  }

  // Handle-ID basierend auf Generator-Typ (Quell-Seite)
  const genOutHandle = (gen: Generator) =>
    gen.type === 'grid' ? 'elec-B1' : 'elec-R1' // pv, chp, wind_turbine all use elec-R1

  // Handle-ID basierend auf Generator-Typ (Ziel-Seite, z.B. WP = Motor mit elec-L1)
  const genInHandle = (gen: Generator) =>
    gen.type === 'grid' ? 'elec-T1' : 'elec-L1'

  // Handle-ID für Consumer (Ziel-Seite)
  const conInHandle = (con: Consumer) => {
    const isWallbox = con.type === 'ev_charger' || ((con as any).wallboxMaxPowerKw && (con as any).wallboxMaxPowerKw > 0 && con.type === 'ev_charger')
    return isWallbox ? 'elec-L1' : 'elec-T1'
  }

  // --- Generator → Battery (Strom) ---
  for (const s of store.storages) {
    if (s.type !== 'battery') continue
    for (const gId of s.connectedGeneratorIds) {
      const gen = store.generators.find((g) => g.id === gId)
      if (!gen) continue
      if (gen.type === 'pv' || gen.type === 'chp' || gen.type === 'grid' || gen.type === 'wind_turbine') {
        addEdge(`egen-${gId}`, genOutHandle(gen), `estor-${s.id}`, 'elec-R1')
      }
    }
  }

  // --- Generator ↔ Generator (z.B. PV → WP) ---
  for (const g of store.generators) {
    for (const connId of g.connectedGeneratorIds) {
      const source = store.generators.find((s) => s.id === connId)
      if (!source) continue
      if (source.type === 'pv' || source.type === 'chp' || source.type === 'grid' || source.type === 'wind_turbine') {
        addEdge(`egen-${connId}`, genOutHandle(source), `egen-${g.id}`, genInHandle(g))
      }
    }
  }

  // --- Generator / Storage → Consumer ---
  for (const c of store.consumers) {
    const tgtHandle = conInHandle(c)
    for (const srcId of c.connectedSourceIds) {
      const gen = store.generators.find((g) => g.id === srcId)
      if (gen && (gen.type === 'pv' || gen.type === 'chp' || gen.type === 'grid' || gen.type === 'wind_turbine')) {
        addEdge(`egen-${srcId}`, genOutHandle(gen), `econ-${c.id}`, tgtHandle)
        continue
      }
      const stor = store.storages.find((s) => s.id === srcId)
      if (stor && stor.type === 'battery') {
        addEdge(`estor-${srcId}`, 'elec-R1', `econ-${c.id}`, tgtHandle)
      }
    }
  }

  // --- Battery → Consumer (direkt) ---
  for (const s of store.storages) {
    if (s.type !== 'battery') continue
    for (const cId of (s as any).connectedConsumerIds || []) {
      const con = store.consumers.find((c) => c.id === cId)
      const tgtHandle = con ? conInHandle(con) : 'elec-T1'
      addEdge(`estor-${s.id}`, 'elec-R1', `econ-${cId}`, tgtHandle)
    }
  }

  // --- Meter-Zuordnungen (nur Strom) ---
  for (const m of store.meters) {
    if (m.type !== 'electricity') continue
    if (!m.assignedToId || m.assignedToType === 'none') continue
    const prefix = m.assignedToType === 'generator' || m.assignedToType === 'grid' ? 'egen' :
      m.assignedToType === 'storage' ? 'estor' :
      m.assignedToType === 'consumer' ? 'econ' : null
    if (!prefix) continue
    // Bestimme Source-Handle basierend auf Entitätstyp
    let srcHandle = 'elec-R1'
    if (m.assignedToType === 'generator' || m.assignedToType === 'grid') {
      const gen = store.generators.find((g) => g.id === m.assignedToId)
      if (gen) srcHandle = genOutHandle(gen)
    }
    addEdge(`${prefix}-${m.assignedToId}`, srcHandle, `emeter-${m.id}`, 'elec-L1')
  }

  return edges
}
