/**
 * Syncs React Flow edge changes to the Zustand store connection arrays.
 *
 * When edges are created/deleted in the schema, this updates the store so that
 * config pages, EnergyFlow, and Sankey diagrams stay in sync.
 */
import type { Node, Edge } from '@xyflow/react'
import { useEnergyStore } from '../../store/useEnergyStore'

// --- Node type categories ---

const GENERATOR_TYPES = new Set([
  // Hydraulic
  'boiler', 'heat_pump', 'chp', 'chiller',
  // Electrical
  'transformer', 'pv_inverter', 'generator', 'wind_turbine',
])

const SOURCE_TYPES = new Set([
  'solar_thermal', 'ground_source', 'air_source', 'well_source',
])

const STORAGE_TYPES = new Set([
  'thermal_heat', 'thermal_cold', 'battery_system',
])

const CIRCUIT_TYPES = new Set(['circuit'])
const ROOM_TYPES = new Set(['room'])

const CONSUMER_TYPES = new Set([
  'consumer', 'consumer_load', 'wallbox',
])

// motor_load is a Generator entity that consumes electricity
const MOTOR_LOAD_TYPES = new Set(['motor_load'])

const METER_TYPES = new Set(['meter', 'sensor', 'elec_meter'])

type Category = 'generator' | 'motor' | 'source' | 'storage' | 'circuit' | 'room' | 'consumer' | 'meter' | 'infra'

interface NodeInfo {
  nodeType: string
  entityId: string | undefined
  category: Category
}

function getNodeInfo(nodeId: string, nodes: Node[]): NodeInfo | null {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const nodeType = node.type || ''
  const entityId = (node.data as Record<string, unknown>)?.entityId as string | undefined
  let category: Category = 'infra'
  if (GENERATOR_TYPES.has(nodeType)) category = 'generator'
  else if (MOTOR_LOAD_TYPES.has(nodeType)) category = 'motor'
  else if (SOURCE_TYPES.has(nodeType)) category = 'source'
  else if (STORAGE_TYPES.has(nodeType)) category = 'storage'
  else if (CIRCUIT_TYPES.has(nodeType)) category = 'circuit'
  else if (ROOM_TYPES.has(nodeType)) category = 'room'
  else if (CONSUMER_TYPES.has(nodeType)) category = 'consumer'
  else if (METER_TYPES.has(nodeType)) category = 'meter'
  return { nodeType, entityId, category }
}

// --- Store array helpers ---

function modifyGeneratorArray(entityId: string, field: string, valueId: string, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const entity = s.generators.find((g) => g.id === entityId)
  if (!entity) return
  const arr = ((entity as any)[field] as string[]) || []
  const updated = action === 'add'
    ? arr.includes(valueId) ? arr : [...arr, valueId]
    : arr.filter((id) => id !== valueId)
  s.updateGenerator(entityId, { ...entity, [field]: updated })
}

function modifyStorageArray(entityId: string, field: string, valueId: string, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const entity = s.storages.find((st) => st.id === entityId)
  if (!entity) return
  const arr = ((entity as any)[field] as string[]) || []
  const updated = action === 'add'
    ? arr.includes(valueId) ? arr : [...arr, valueId]
    : arr.filter((id) => id !== valueId)
  s.updateStorage(entityId, { ...entity, [field]: updated })
}

function modifyConsumerArray(entityId: string, field: string, valueId: string, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const entity = s.consumers.find((c) => c.id === entityId)
  if (!entity) return
  const arr = ((entity as any)[field] as string[]) || []
  const updated = action === 'add'
    ? arr.includes(valueId) ? arr : [...arr, valueId]
    : arr.filter((id) => id !== valueId)
  s.updateConsumer(entityId, { ...entity, [field]: updated })
}

function modifyCircuitArray(entityId: string, field: string, valueId: string, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const entity = s.circuits.find((c) => c.id === entityId)
  if (!entity) return
  const arr = ((entity as any)[field] as string[]) || []
  const updated = action === 'add'
    ? arr.includes(valueId) ? arr : [...arr, valueId]
    : arr.filter((id) => id !== valueId)
  s.updateCircuit(entityId, { ...entity, [field]: updated })
}

function modifyRoomField(entityId: string, field: string, value: string, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const entity = s.rooms.find((r) => r.id === entityId)
  if (!entity) return
  s.updateRoom(entityId, { ...entity, [field]: action === 'add' ? value : '' })
}

function modifyMeterAssignment(meterId: string, targetInfo: NodeInfo, action: 'add' | 'remove') {
  const s = useEnergyStore.getState()
  const meter = s.meters.find((m) => m.id === meterId)
  if (!meter) return
  if (action === 'add' && targetInfo.entityId) {
    const assignedToType = targetInfo.category === 'generator' || targetInfo.category === 'motor'
      ? 'generator' as const
      : targetInfo.category === 'storage' ? 'storage' as const
      : targetInfo.category === 'consumer' ? 'consumer' as const
      : 'none' as const
    s.updateMeter(meterId, { ...meter, assignedToType, assignedToId: targetInfo.entityId })
  } else {
    s.updateMeter(meterId, { ...meter, assignedToType: 'none', assignedToId: '' })
  }
}

// --- Main sync function ---

/**
 * Sync a single edge change to the Zustand store.
 * Call after adding or removing an edge in the schema.
 */
export function syncEdgeToStore(edge: Edge, nodes: Node[], action: 'add' | 'remove') {
  const srcInfo = getNodeInfo(edge.source, nodes)
  const tgtInfo = getNodeInfo(edge.target, nodes)
  if (!srcInfo || !tgtInfo) return

  // Both infrastructure → no store sync needed
  if (srcInfo.category === 'infra' && tgtInfo.category === 'infra') return

  // Normalize: sort into (a, b) so we can match patterns regardless of edge direction
  syncPair(srcInfo, tgtInfo, action)
}

function syncPair(a: NodeInfo, b: NodeInfo, action: 'add' | 'remove') {
  // Ensure a and b have entityIds for the relevant operations
  const aId = a.entityId
  const bId = b.entityId

  // --- Generator → Storage ---
  if (a.category === 'generator' && b.category === 'storage' && aId && bId) {
    modifyStorageArray(bId, 'connectedGeneratorIds', aId, action)
    return
  }
  if (b.category === 'generator' && a.category === 'storage' && bId && aId) {
    modifyStorageArray(aId, 'connectedGeneratorIds', bId, action)
    return
  }

  // --- Generator → Circuit ---
  if (a.category === 'generator' && b.category === 'circuit' && aId && bId) {
    modifyCircuitArray(bId, 'generatorIds', aId, action)
    return
  }
  if (b.category === 'generator' && a.category === 'circuit' && bId && aId) {
    modifyCircuitArray(aId, 'generatorIds', bId, action)
    return
  }

  // --- Storage → Circuit ---
  if (a.category === 'storage' && b.category === 'circuit' && aId && bId) {
    modifyCircuitArray(bId, 'supplyStorageIds', aId, action)
    return
  }
  if (b.category === 'storage' && a.category === 'circuit' && bId && aId) {
    modifyCircuitArray(aId, 'supplyStorageIds', bId, action)
    return
  }

  // --- Circuit → Room ---
  if (a.category === 'circuit' && b.category === 'room' && aId && bId) {
    modifyCircuitArray(aId, 'roomIds', bId, action)
    modifyRoomField(bId, 'heatingCircuitId', aId, action)
    return
  }
  if (b.category === 'circuit' && a.category === 'room' && bId && aId) {
    modifyCircuitArray(bId, 'roomIds', aId, action)
    modifyRoomField(aId, 'heatingCircuitId', bId, action)
    return
  }

  // --- Generator → Consumer ---
  if (a.category === 'generator' && b.category === 'consumer' && aId && bId) {
    modifyConsumerArray(bId, 'connectedSourceIds', aId, action)
    return
  }
  if (b.category === 'generator' && a.category === 'consumer' && bId && aId) {
    modifyConsumerArray(aId, 'connectedSourceIds', bId, action)
    return
  }

  // --- Storage → Consumer ---
  if (a.category === 'storage' && b.category === 'consumer' && aId && bId) {
    modifyConsumerArray(bId, 'connectedSourceIds', aId, action)
    modifyStorageArray(aId, 'connectedConsumerIds', bId, action)
    return
  }
  if (b.category === 'storage' && a.category === 'consumer' && bId && aId) {
    modifyConsumerArray(aId, 'connectedSourceIds', bId, action)
    modifyStorageArray(bId, 'connectedConsumerIds', aId, action)
    return
  }

  // --- Generator → Motor (motor_load = heat_pump/chiller consuming electricity) ---
  if (a.category === 'generator' && b.category === 'motor' && aId && bId) {
    modifyGeneratorArray(bId, 'connectedGeneratorIds', aId, action)
    return
  }
  if (b.category === 'generator' && a.category === 'motor' && bId && aId) {
    modifyGeneratorArray(aId, 'connectedGeneratorIds', bId, action)
    return
  }

  // --- Generator ↔ Generator (e.g., PV → Grid bidirectional) ---
  if (a.category === 'generator' && b.category === 'generator' && aId && bId) {
    // Add supplier to receiver's connectedGeneratorIds
    // Convention: target receives from source
    modifyGeneratorArray(bId, 'connectedGeneratorIds', aId, action)
    return
  }

  // --- Meter → any entity ---
  if (a.category === 'meter' && b.category !== 'meter' && b.category !== 'infra' && aId) {
    modifyMeterAssignment(aId, b, action)
    // Also add meter to entity's assignedMeterIds
    if (bId) addMeterToEntity(aId, b, action)
    return
  }
  if (b.category === 'meter' && a.category !== 'meter' && a.category !== 'infra' && bId) {
    modifyMeterAssignment(bId, a, action)
    if (aId) addMeterToEntity(bId, a, action)
    return
  }
}

function addMeterToEntity(meterId: string, entityInfo: NodeInfo, action: 'add' | 'remove') {
  if (!entityInfo.entityId) return
  const eid = entityInfo.entityId

  switch (entityInfo.category) {
    case 'generator':
    case 'motor':
      modifyGeneratorArray(eid, 'assignedMeterIds', meterId, action)
      break
    case 'storage':
      modifyStorageArray(eid, 'assignedMeterIds', meterId, action)
      break
    case 'consumer':
      modifyConsumerArray(eid, 'assignedMeterIds', meterId, action)
      break
    case 'circuit': {
      const s = useEnergyStore.getState()
      const circuit = s.circuits.find((c) => c.id === eid)
      if (!circuit) break
      const arr = circuit.meterIds || []
      const updated = action === 'add'
        ? arr.includes(meterId) ? arr : [...arr, meterId]
        : arr.filter((id) => id !== meterId)
      s.updateCircuit(eid, { ...circuit, meterIds: updated })
      break
    }
    case 'room': {
      const s = useEnergyStore.getState()
      const room = s.rooms.find((r) => r.id === eid)
      if (!room) break
      const arr = room.meterIds || []
      const updated = action === 'add'
        ? arr.includes(meterId) ? arr : [...arr, meterId]
        : arr.filter((id) => id !== meterId)
      s.updateRoom(eid, { ...room, meterIds: updated })
      break
    }
  }
}

// --- Edge localStorage persistence ---

export function saveEdges(key: string, edges: Edge[]) {
  const serializable = edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
    type: e.type,
    data: e.data,
    deletable: e.deletable,
  }))
  localStorage.setItem(key, JSON.stringify(serializable))
}

export function loadEdges(key: string): Edge[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
  } catch {
    return null
  }
}
