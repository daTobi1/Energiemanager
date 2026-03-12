/**
 * Konvertiert die Zustand-Store-Daten in React Flow Nodes & Edges
 * für das hydraulische Schema (nur thermisch relevante Komponenten).
 *
 * Rein elektrische Komponenten (PV, Grid, Batterie, Sammelschiene) werden
 * im Stromschema angezeigt — hier nur Wärme/Kälte/Hydraulik.
 *
 * Layout-Strategie:
 *   Spalte 1: BHKW, Kessel, Wärmepumpe, Kältemaschine
 *   Spalte 2: Hydraulische Weiche
 *   Spalte 3: Pufferspeicher, Kältespeicher
 *   Spalte 4: Heiz-/Kühlkreise
 *   Spalte 5: Räume
 *   Spalte 6: Verbraucher
 */
import type { Node, Edge } from '@xyflow/react'
import type { Generator, Storage, Consumer, HeatingCoolingCircuit, Room, Meter } from '../../../types'

const LS_KEY = 'hydraulic-schema-positions'
const LS_ROTATIONS_KEY = 'hydraulic-schema-rotations'

export function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function savePositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(LS_KEY, JSON.stringify(positions))
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

// Spalten-X-Positionen
const COL = {
  generators: 50,
  storage: 300,
  circuits: 500,
  rooms: 700,
  consumers: 900,
  meters: 0,       // Zähler werden neben ihrem zugeordneten Gerät platziert
}

const ROW_GAP = 140
const START_Y = 60

interface StoreData {
  generators: Generator[]
  storages: Storage[]
  consumers: Consumer[]
  circuits: HeatingCoolingCircuit[]
  rooms: Room[]
  meters: Meter[]
}

export function buildNodes(store: StoreData, savedPositions: Record<string, { x: number; y: number }>, savedRotations: Record<string, number> = {}): Node[] {
  const nodes: Node[] = []
  let genRow = 0
  let storRow = 0
  let circRow = 0
  let roomRow = 0
  let conRow = 0
  let meterRow = 0

  const pos = (id: string, defaultX: number, defaultY: number) =>
    savedPositions[id] || { x: defaultX, y: defaultY }
  const rot = (id: string) => savedRotations[id] || 0

  // --- Erzeuger (nur thermisch relevante: Kessel, WP, BHKW, Kältemaschine) ---
  const thermalGens = store.generators.filter((g) =>
    g.type === 'boiler' || g.type === 'heat_pump' || g.type === 'chp' || g.type === 'chiller'
  )

  for (const g of thermalGens) {
    const id = `gen-${g.id}`
    nodes.push({
      id,
      type: g.type,
      position: pos(id, COL.generators, START_Y + genRow * ROW_GAP),
      data: {
        label: g.name,
        entityId: g.id,
        rotation: rot(id),
        nominalPowerKw: g.type === 'boiler' ? (g as any).nominalPowerKw :
          g.type === 'heat_pump' ? (g as any).heatingPowerKw :
          g.type === 'chp' ? (g as any).electricalPowerKw :
          g.type === 'chiller' ? (g as any).coolingPowerKw : undefined,
        coolingCapable: g.type === 'heat_pump' ? (g as any).coolingCapable : undefined,
      },
    })
    genRow++
  }

  // --- Speicher (nur thermisch: Puffer, Kälte — keine Batterie) ---
  const thermalStorages = store.storages.filter((s) => s.type !== 'battery')
  for (const s of thermalStorages) {
    const id = `stor-${s.id}`
    const nodeType = s.type === 'cold' ? 'thermal_cold' : 'thermal_heat'
    nodes.push({
      id,
      type: nodeType,
      position: pos(id, COL.storage, START_Y + storRow * ROW_GAP),
      data: {
        label: s.name,
        entityId: s.id,
        rotation: rot(id),
        storageType: s.type,
        volumeLiters: (s as any).volumeLiters,
      },
    })
    storRow++
  }

  // --- Heiz-/Kühlkreise ---
  for (const c of store.circuits) {
    const id = `circ-${c.id}`
    nodes.push({
      id,
      type: 'circuit',
      position: pos(id, COL.circuits, START_Y + circRow * ROW_GAP),
      data: {
        label: c.name,
        entityId: c.id,
        rotation: rot(id),
        circuitType: c.type,
        distributionType: c.distributionType,
        flowTempC: c.flowTemperatureC,
        returnTempC: c.returnTemperatureC,
      },
    })
    circRow++
  }

  // --- Räume ---
  for (const r of store.rooms) {
    const id = `room-${r.id}`
    nodes.push({
      id,
      type: 'room',
      position: pos(id, COL.rooms, START_Y + roomRow * ROW_GAP),
      data: {
        label: r.name,
        entityId: r.id,
        rotation: rot(id),
        floor: r.floor,
        areaM2: r.areaM2,
        targetTempC: r.targetTemperatureC,
      },
    })
    roomRow++
  }

  // --- Verbraucher ---
  for (const c of store.consumers) {
    const id = `con-${c.id}`
    nodes.push({
      id,
      type: 'consumer',
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

  // --- Zähler (nur Wärme/Kälte/Gas — keine Strom) ---
  const thermalMeters = store.meters.filter((m) => m.type !== 'electricity')
  for (const m of thermalMeters) {
    const id = `meter-${m.id}`
    // Versuche Zähler neben zugeordnetem Gerät zu platzieren
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
      type: 'meter',
      position: pos(id, defaultX, defaultY),
      data: {
        label: m.name,
        entityId: m.id,
        rotation: rot(id),
        meterType: m.type,
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

  const addEdge = (source: string, sourceHandle: string, target: string, targetHandle: string, type: string, data?: Record<string, unknown>) => {
    edges.push({
      id: `e-${edgeId++}`,
      source,
      sourceHandle,
      target,
      targetHandle,
      type,
      data,
      deletable: true,
    })
  }

  /** Fügt ein VL/RL-Paar als separate Leitungen hinzu */
  const addThermalPair = (
    source: string, target: string,
    pipeType: 'heat' | 'cold',
    vlOutHandle: string, vlInHandle: string,
    rlOutHandle: string, rlInHandle: string,
  ) => {
    // Vorlauf: source → target
    addEdge(source, vlOutHandle, target, vlInHandle, 'thermal', { pipeType, isReturn: false })
    // Rücklauf: target → source
    addEdge(target, rlOutHandle, source, rlInHandle, 'thermal', { pipeType, isReturn: true })
  }

  // Kurzform für Standard-Thermal-Paar (heat-R/L + heat-ret-R/L)
  const addStdThermalPair = (source: string, target: string, pipeType: 'heat' | 'cold') => {
    addThermalPair(source, target, pipeType, 'heat-R1', 'heat-L1', 'heat-ret-L1', 'heat-ret-R1')
  }

  // --- Generator → Thermischer Speicher (VL+RL) ---
  for (const s of store.storages) {
    if (s.type === 'battery') continue
    for (const gId of s.connectedGeneratorIds) {
      const gen = store.generators.find((g) => g.id === gId)
      if (!gen) continue
      // Nur thermisch relevante Erzeuger
      if (gen.type === 'pv' || gen.type === 'grid') continue
      const pt = s.type === 'cold' ? 'cold' as const : 'heat' as const
      addStdThermalPair(`gen-${gId}`, `stor-${s.id}`, pt)
    }
  }

  // --- Circuit ← Generator/Storage (Wärmeversorgung) ---
  for (const c of store.circuits) {
    const pt = c.type === 'cooling' ? 'cold' as const : 'heat' as const
    for (const gId of c.generatorIds) {
      const gen = store.generators.find((g) => g.id === gId)
      if (gen) {
        addStdThermalPair(`gen-${gId}`, `circ-${c.id}`, pt)
      }
    }
    for (const sId of c.supplyStorageIds) {
      addStdThermalPair(`stor-${sId}`, `circ-${c.id}`, pt)
    }
  }

  // --- Circuit → Room ---
  for (const c of store.circuits) {
    const pt = c.type === 'cooling' ? 'cold' as const : 'heat' as const
    for (const rId of c.roomIds) {
      addEdge(`circ-${c.id}`, 'circuit-R1', `room-${rId}`, 'circuit-L1', 'thermal', { pipeType: pt, isReturn: false })
    }
  }

  // --- Meter-Zuordnungen (nur Wärme/Kälte/Gas — Strom im Stromschema) ---
  for (const m of store.meters) {
    if (m.type === 'electricity') continue
    if (!m.assignedToId || m.assignedToType === 'none') continue
    // Überspringe Zuordnungen zu rein elektrischen Entitäten
    if (m.assignedToType === 'grid') continue
    const prefix = m.assignedToType === 'generator' ? 'gen' :
      m.assignedToType === 'storage' ? 'stor' :
      m.assignedToType === 'consumer' ? 'con' : null
    if (!prefix) continue
    const edgeType = m.type === 'heat' || m.type === 'cold' ? 'thermal' : 'gas'
    addEdge(`${prefix}-${m.assignedToId}`, 'heat-R1',
      `meter-${m.id}`, 'meter-L1', edgeType)
  }

  return edges
}
