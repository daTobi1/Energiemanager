import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react'
import { useLocation } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { useEnergyStore } from '../store/useEnergyStore'
import { nodeTypes } from '../components/hydraulic/nodeTypes'
import { edgeTypes } from '../components/hydraulic/edgeTypes'
import { buildNodes, buildEdges, loadPositions, savePositions, loadRotations, saveRotations } from '../components/hydraulic/storeToFlow'
import ComponentPalette from '../components/hydraulic/panels/ComponentPalette'
import PropertiesPanel from '../components/hydraulic/panels/PropertiesPanel'
import { GRID_SIZE } from '../components/hydraulic/constants'
import { v4 as uuid } from 'uuid'
import { Undo2, RotateCcw, Maximize, RotateCw } from 'lucide-react'

import type {
  Generator, BoilerGenerator, HeatPumpGenerator,
  ChpGenerator, ChillerGenerator,
  ThermalStorage,
  Consumer, HeatingCoolingCircuit, Room, Meter,
  Source, Sensor,
} from '../types'
import {
  createDefaultCommunication,
  createDefaultCircuit,
  createDefaultRoom,
  createDefaultSource,
  createDefaultSensor,
} from '../types'

import {
  resolveEdgeType,
  isReturnHandle,
  isColdHandle,
  isValidConnection as checkHandleCompat,
} from '../components/shared/portUtils'
import CrossingArcsOverlay from '../components/shared/CrossingArcsOverlay'
import { useAutoJunction, findNearestEdgeMath, findNearestOnPath, getVisiblePath } from '../components/shared/useAutoJunction'
import { syncEdgeToStore, saveEdges, loadEdges } from '../components/shared/edgeSync'

export default function HydraulicSchemaPage() {
  const store = useEnergyStore()
  const {
    generators, storages, consumers, circuits, rooms, meters, sources, sensors,
    addGenerator, addStorage, addConsumer, addCircuit, addRoom, addMeter, addSource, addSensor,
    removeGenerator, removeStorage, removeConsumer, removeCircuit, removeRoom, removeMeter, removeSource, removeSensor,
  } = store

  // Build initial nodes/edges from store
  const savedPositions = useRef(loadPositions())
  const savedRotationsRef = useRef(loadRotations())
  const initialNodes = useMemo(() =>
    buildNodes({ generators, storages, consumers, circuits, rooms, meters }, savedPositions.current, savedRotationsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // only on mount
  )
  const initialEdges = useMemo(() =>
    loadEdges('hydraulic-schema-edges') || buildEdges({ generators, storages, consumers, circuits, rooms, meters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // --- Focus-on-navigate (von anderem Schema kommend) ---
  useEffect(() => {
    const state = location.state as { focusEntityId?: string } | null
    if (!state?.focusEntityId) return
    const targetEntityId = state.focusEntityId
    // State sofort räumen, damit bei Zurück-Navigation nicht erneut fokussiert wird
    window.history.replaceState({}, '')
    const timer = setTimeout(() => {
      const targetNode = nodes.find((n) => {
        const data = n.data as Record<string, unknown>
        return data.entityId === targetEntityId
      })
      if (!targetNode) return
      setCenter(targetNode.position.x + 60, targetNode.position.y + 40, { zoom: 1.5, duration: 600 })
      setSelectedNode(targetNode)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // --- Undo ---
  const undoStack = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([])
  const pushUndo = useCallback(() => {
    undoStack.current.push({ nodes: [...nodes], edges: [...edges] })
    if (undoStack.current.length > 30) undoStack.current.shift()
  }, [nodes, edges])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (prev) {
      setNodes(prev.nodes)
      setEdges(prev.edges)
    }
  }, [setNodes, setEdges])

  // --- Persist edges ---
  useEffect(() => {
    saveEdges('hydraulic-schema-edges', edges)
  }, [edges])

  // --- Persist positions on node drag ---
  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    savedPositions.current[node.id] = { x: node.position.x, y: node.position.y }
    savePositions(savedPositions.current)
  }, [])

  // --- Rotation ---
  const rotateNode = useCallback((nodeId: string, direction: 'cw' | 'ccw' = 'cw') => {
    pushUndo()
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n
        const current = ((n.data as Record<string, unknown>).rotation as number) || 0
        const next = direction === 'cw'
          ? (current + 90) % 360
          : (current - 90 + 360) % 360
        // Persist
        savedRotationsRef.current[nodeId] = next
        saveRotations(savedRotationsRef.current)
        return { ...n, data: { ...n.data, rotation: next } }
      })
    )
    // Update selectedNode if it's the rotated one
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev
      const current = ((prev.data as Record<string, unknown>).rotation as number) || 0
      const next = direction === 'cw'
        ? (current + 90) % 360
        : (current - 90 + 360) % 360
      return { ...prev, data: { ...prev.data, rotation: next } }
    })
  }, [pushUndo, setNodes])

  // --- Node Data updaten (z.B. Anschluss-Anzahl) ---
  const updateNodeData = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    pushUndo()
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n
        return { ...n, data: { ...n.data, ...patch } }
      })
    )
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev
      return { ...prev, data: { ...prev.data, ...patch } }
    })
  }, [pushUndo, setNodes])

  // --- Selection ---
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // --- Edge-Typ aus Handle-IDs ableiten ---
  const createEdgeProps = useCallback(
    (srcHandle: string, tgtHandle: string, originalEdge?: Edge) => {
      if (originalEdge) {
        return { type: originalEdge.type || 'thermal', data: originalEdge.data as Record<string, unknown> | undefined }
      }
      const et = resolveEdgeType(srcHandle, tgtHandle)
      if (et === 'thermal') {
        return {
          type: 'thermal',
          data: {
            pipeType: (isColdHandle(srcHandle) || isColdHandle(tgtHandle)) ? 'cold' : 'heat',
            isReturn: isReturnHandle(srcHandle) || isReturnHandle(tgtHandle),
          },
        }
      }
      return { type: et }
    },
    [],
  )

  // --- Auto-Junction (Linie auf Linie droppen / Junction löschen → reconnect) ---
  const {
    onConnectStart: handleConnectStart,
    markConnectionMade,
    onConnectEnd: handleConnectEnd,
    deleteJunction,
  } = useAutoJunction({ edges, setNodes, setEdges, pushUndo, gridSize: GRID_SIZE, createEdgeProps })

  // --- Connection: Neue Edge erstellen ---
  const onConnect = useCallback((params: Connection) => {
    markConnectionMade()
    pushUndo()
    const src = params.sourceHandle || ''
    const tgt = params.targetHandle || ''
    const edgeType = resolveEdgeType(src, tgt)
    let edgeData: Record<string, unknown> | undefined
    if (edgeType === 'thermal') {
      edgeData = {
        pipeType: (isColdHandle(src) || isColdHandle(tgt)) ? 'cold' : 'heat',
        isReturn: isReturnHandle(src) || isReturnHandle(tgt),
      }
    }
    const newEdge: Edge = {
      id: `e-${uuid()}`,
      ...params,
      source: params.source!,
      target: params.target!,
      type: edgeType,
      data: edgeData,
      deletable: true,
    }
    setEdges((eds) => addEdge(newEdge, eds))
    // Sync to store (nur Vorlauf-Verbindungen, nicht Rücklauf-Duplikate)
    if (!edgeData?.isReturn) {
      syncEdgeToStore(newEdge, nodes, 'add')
    }
  }, [setEdges, pushUndo, markConnectionMade, nodes])

  // --- Verbindungs-Validierung ---
  const handleIsValidConnection = useCallback((connection: Connection) => {
    const src = connection.sourceHandle || ''
    const tgt = connection.targetHandle || ''
    // Keine Selbstverbindung
    if (connection.source === connection.target) return false
    return checkHandleCompat(src, tgt)
  }, [])

  // --- Edge reconnect ---
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    pushUndo()
    // Remove old connection from store
    if (!(oldEdge.data as Record<string, unknown>)?.isReturn) {
      syncEdgeToStore(oldEdge, nodes, 'remove')
    }
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
    // Add new connection to store
    const reconnected: Edge = {
      ...oldEdge,
      source: newConnection.source!,
      target: newConnection.target!,
      sourceHandle: newConnection.sourceHandle,
      targetHandle: newConnection.targetHandle,
    }
    if (!(reconnected.data as Record<string, unknown>)?.isReturn) {
      syncEdgeToStore(reconnected, nodes, 'add')
    }
  }, [setEdges, pushUndo, nodes])

  // --- Edges löschen ---
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    pushUndo()
    for (const edge of deletedEdges) {
      if (!(edge.data as Record<string, unknown>)?.isReturn) {
        syncEdgeToStore(edge, nodes, 'remove')
      }
    }
  }, [pushUndo, nodes])

  // --- useReactFlow (muss vor Callbacks stehen die screenToFlowPosition nutzen) ---
  const { screenToFlowPosition, setCenter, getInternalNode } = useReactFlow()

  // --- Doppelklick auf Edge → Junction einfügen (Wegpunkt) ---
  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const edgeEl = document.querySelector(`[data-testid="rf__edge-${edge.id}"]`)
    if (!edgeEl) return
    const visPath = getVisiblePath(edgeEl)
    if (!visPath) return

    const flowPos = screenToFlowPosition({ x: _event.clientX, y: _event.clientY })
    const result = findNearestOnPath(visPath, flowPos)
    pushUndo()

    const splitProps = createEdgeProps(edge.sourceHandle || '', edge.targetHandle || '', edge)

    const junctionId = `schema-${uuid()}`
    setNodes((nds) => [
      ...nds,
      { id: junctionId, type: 'junction', position: { x: result.point.x - 5, y: result.point.y - 5 }, data: { label: 'Verbindung' } },
    ])
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== edge.id),
      { id: `e-${uuid()}`, source: edge.source, sourceHandle: edge.sourceHandle, target: junctionId, targetHandle: 'junction-L1', type: splitProps.type, data: splitProps.data, deletable: true },
      { id: `e-${uuid()}`, source: junctionId, sourceHandle: 'junction-R1', target: edge.target, targetHandle: edge.targetHandle, type: splitProps.type, data: splitProps.data, deletable: true },
    ])
  }, [screenToFlowPosition, pushUndo, setNodes, setEdges, createEdgeProps])

  // --- Nodes löschen ---
  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    // Junction / Meter / Sensor: auto-reconnect gegenüberliegender Leitungen
    const inlineTypes = ['junction', 'meter', 'sensor']
    if (inlineTypes.includes(node.type || '')) {
      const entityId = (node.data as Record<string, unknown>).entityId as string | undefined
      deleteJunction(nodeId)
      if (entityId) {
        if (node.type === 'meter') removeMeter(entityId)
        if (node.type === 'sensor') removeSensor(entityId)
      }
      setSelectedNode(null)
      return
    }

    pushUndo()
    const entityId = (node.data as any).entityId as string | undefined

    // Store-Entity entfernen
    if (entityId) {
      const type = node.type || ''
      if (['boiler', 'heat_pump', 'chp', 'chiller'].includes(type)) {
        removeGenerator(entityId)
      } else if (['thermal_heat', 'thermal_cold'].includes(type)) {
        removeStorage(entityId)
      } else if (type === 'consumer') {
        removeConsumer(entityId)
      } else if (type === 'circuit') {
        removeCircuit(entityId)
      } else if (type === 'room') {
        removeRoom(entityId)
      } else if (['solar_thermal', 'ground_source', 'air_source', 'well_source'].includes(type)) {
        removeSource(entityId)
      }
    }

    // Sync edge removals to store before deleting
    const affectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId)
    for (const edge of affectedEdges) {
      if (!(edge.data as Record<string, unknown>)?.isReturn) {
        syncEdgeToStore(edge, nodes, 'remove')
      }
    }

    // Node + zugehörige Edges entfernen
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }, [nodes, edges, setNodes, setEdges, pushUndo, removeGenerator, removeStorage, removeConsumer, removeCircuit, removeRoom, removeMeter, removeSource, removeSensor, deleteJunction])

  // --- Drop from palette ---
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/hydraulic-node')
    if (!raw) return

    const { type } = JSON.parse(raw) as { type: string }
    const rawPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    // Snap to grid (für normale Nodes)
    const position = {
      x: Math.round(rawPosition.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(rawPosition.y / GRID_SIZE) * GRID_SIZE,
    }

    pushUndo()
    const id = uuid()

    // Entität im Store anlegen + Node auf Canvas
    if (['boiler', 'heat_pump', 'chp', 'chiller'].includes(type)) {
      const base = {
        id,
        name: nextName(typeLabel(type), nodes),
        type: type as any,
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
      }
      let gen: Generator
      switch (type) {
        case 'boiler':
          gen = { ...base, type: 'boiler', energyForm: 'heat', fuelType: 'natural_gas', nominalPowerKw: 24, efficiency: 0.95, modulationMinPercent: 30, modulationMaxPercent: 100, condensing: true, flowTemperatureMaxC: 80, returnTemperatureMinC: 30, minimumRunTimeMin: 5, fuelCostCtPerKwh: 8, flueGasLosses: 0.05 } as BoilerGenerator
          break
        case 'heat_pump':
          gen = { ...base, type: 'heat_pump', energyForm: 'heat', heatPumpType: 'air_water', heatingPowerKw: 12, coolingCapable: false, coolingPowerKw: 0, electricalPowerKw: 3, copRated: 4.0, copCurve: [], minOutdoorTempC: -20, maxOutdoorTempC: 40, flowTemperatureC: 35, returnTemperatureC: 28, modulationMinPercent: 30, modulationMaxPercent: 100, defrostPowerKw: 1, sgReadyEnabled: true, bivalencePointC: -5, refrigerant: 'R290' } as HeatPumpGenerator
          break
        case 'chp':
          gen = { ...base, type: 'chp', energyForm: 'electricity_heat', electricalPowerKw: 5, thermalPowerKw: 12, fuelType: 'natural_gas', electricalEfficiency: 0.30, thermalEfficiency: 0.60, overallEfficiency: 0.90, modulationMinPercent: 50, modulationMaxPercent: 100, minimumRunTimeMin: 30, minimumOffTimeMin: 15, startCostEur: 0.5, maintenanceIntervalHours: 4000, currentOperatingHours: 0, fuelCostCtPerKwh: 8, powerToHeatRatio: 0.42 } as ChpGenerator
          break
        default: // chiller
          gen = { ...base, type: 'chiller', energyForm: 'cold', coolingPowerKw: 20, electricalPowerKw: 6, eerRated: 3.3, seerRated: 5.0, coolantType: 'Wasser', refrigerant: 'R410A', flowTemperatureC: 6, returnTemperatureC: 12, modulationMinPercent: 25, modulationMaxPercent: 100, minOutdoorTempC: -10, maxOutdoorTempC: 45 } as ChillerGenerator
          break
      }
      addGenerator(gen)
      const nodeId = `gen-${id}`
      setNodes((nds) => [...nds, {
        id: nodeId,
        type,
        position,
        data: { label: gen.name, entityId: id },
      }])
    } else if (type === 'thermal_heat' || type === 'thermal_cold') {
      const sType = type === 'thermal_cold' ? 'cold' as const : 'heat' as const
      const storName = nextName(sType === 'cold' ? 'Kältespeicher' : 'Pufferspeicher', nodes)
      const s: ThermalStorage = {
        id, name: storName, type: sType,
        volumeLiters: 500, heightMm: 1600, diameterMm: 650,
        maxTemperatureC: sType === 'cold' ? 20 : 90, minTemperatureC: sType === 'cold' ? 2 : 20,
        targetTemperatureC: sType === 'cold' ? 6 : 55, hysteresisK: 3,
        heatLossCoefficientWPerK: 2.5, insulationThicknessMm: 80,
        insulationMaterial: 'PU-Schaum', ambientTemperatureC: 20,
        specificHeatCapacity: 4186, temperatureSensors: [],
        connectedGeneratorIds: [], connectedConsumerIds: [],
        assignedMeterIds: [], ports: [],
        stratificationEnabled: true, numberOfLayers: 4,
        hasElectricalHeatingElement: false, heatingElementPowerKw: 0,
        communication: createDefaultCommunication(), notes: '',
      }
      addStorage(s)
      setNodes((nds) => [...nds, { id: `stor-${id}`, type, position, data: { label: s.name, entityId: id, storageType: sType, volumeLiters: s.volumeLiters } }])
    } else if (type === 'consumer') {
      const c: Consumer = {
        id, name: nextName('Verbraucher', nodes), type: 'household', nominalPowerKw: 1,
        annualConsumptionKwh: 3500, loadProfile: 'H0',
        controllable: false, sheddable: false, priority: 5,
        connectedSourceIds: [], assignedMeterIds: [],
        communication: createDefaultCommunication(), ports: [], notes: '',
        wallboxMaxPowerKw: 0, wallboxPhases: 3, wallboxMinCurrentA: 6,
        vehicleBatteryKwh: 0, vehicleConsumptionPer100km: 0, ocppEnabled: false,
      }
      addConsumer(c)
      setNodes((nds) => [...nds, { id: `con-${id}`, type: 'consumer', position, data: { label: c.name, entityId: id, consumerType: c.type } }])
    } else if (type === 'circuit') {
      const c = { ...createDefaultCircuit(), id, name: nextName('Heizkreis', nodes) }
      addCircuit(c)
      // Heizkreis-Node
      const circNode = { id: `circ-${id}`, type: 'circuit', position, data: { label: c.name, entityId: id, circuitType: c.type, distributionType: c.distributionType, flowTempC: c.flowTemperatureC, returnTempC: c.returnTemperatureC } }
      // Automatisch Pumpe + verknüpften Verbraucher erstellen
      const pumpConsumerId = uuid()
      const pumpConsumer: Consumer = {
        id: pumpConsumerId, name: nextName('HK-Pumpe (Strom)', nodes), type: 'hvac' as any, nominalPowerKw: 0.05,
        annualConsumptionKwh: 200, loadProfile: 'G1',
        controllable: false, sheddable: false, priority: 3,
        connectedSourceIds: [], assignedMeterIds: [],
        communication: createDefaultCommunication(), ports: [], notes: `Heizkreispumpe für ${c.name}`,
        wallboxMaxPowerKw: 0, wallboxPhases: 1, wallboxMinCurrentA: 0,
        vehicleBatteryKwh: 0, vehicleConsumptionPer100km: 0, ocppEnabled: false,
      }
      addConsumer(pumpConsumer)
      const pumpNodeId = `schema-${uuid()}`
      const pumpNode = {
        id: pumpNodeId, type: 'pump',
        position: { x: position.x - 80, y: position.y },
        data: { label: nextName('HK-Pumpe', nodes), linkedConsumerId: pumpConsumerId },
      }
      setNodes((nds) => [...nds, circNode, pumpNode])
    } else if (type === 'room') {
      const r = { ...createDefaultRoom(), id, name: nextName('Raum', nodes) }
      addRoom(r)
      setNodes((nds) => [...nds, { id: `room-${id}`, type: 'room', position, data: { label: r.name, entityId: id, floor: r.floor, areaM2: r.areaM2, targetTempC: r.targetTemperatureC } }])
    } else if (type === 'meter') {
      const m: Meter = {
        id, name: nextName('Zähler', nodes), type: 'electricity', meterNumber: '',
        direction: 'consumption', category: 'unassigned', parentMeterId: '',
        phases: 3, nominalCurrentA: 63, nominalVoltageV: 400,
        ctRatio: 1, vtRatio: 1, pulsesPerUnit: 0,
        assignedToType: 'none', assignedToId: '',
        communication: createDefaultCommunication(), registerMappings: [],
        ports: [], notes: '',
      }
      addMeter(m)
      const nodeId = `meter-${id}`
      const nodeData = { label: m.name, entityId: id, meterType: m.type }
      const nearest = findNearestEdgeMath(rawPosition, edges, getInternalNode, 40)
      if (nearest) {
        // Exakte Position auf der Linie: Handles bei top:45% von 60px Höhe = 27px
        const snappedPos = { x: nearest.point.x - 30, y: nearest.point.y - 27 }
        const origEdge = nearest.edge
        const splitProps = createEdgeProps(origEdge.sourceHandle || '', origEdge.targetHandle || '', origEdge)
        setNodes((nds) => [...nds, { id: nodeId, type: 'meter', position: snappedPos, data: nodeData }])
        setEdges((eds) => [
          ...eds.filter((e) => e.id !== origEdge.id),
          { id: `e-${uuid()}`, source: origEdge.source, sourceHandle: origEdge.sourceHandle, target: nodeId, targetHandle: 'meter-L1', type: splitProps.type, data: splitProps.data, deletable: true },
          { id: `e-${uuid()}`, source: nodeId, sourceHandle: 'meter-R1', target: origEdge.target, targetHandle: origEdge.targetHandle, type: splitProps.type, data: splitProps.data, deletable: true },
        ])
      } else {
        setNodes((nds) => [...nds, { id: nodeId, type: 'meter', position, data: nodeData }])
      }
    } else if (type === 'junction') {
      const nodeId = `schema-${uuid()}`
      setNodes((nds) => [...nds, { id: nodeId, type: 'junction', position, data: { label: 'Verbindung' } }])
    } else if (['solar_thermal', 'ground_source', 'air_source', 'well_source'].includes(type)) {
      const sourceLabels: Record<string, string> = { solar_thermal: 'Solarthermie', ground_source: 'Erdsonde', air_source: 'Luft (Umgebung)', well_source: 'Brunnen' }
      const s: Source = { ...createDefaultSource(type as any), id, name: nextName(sourceLabels[type] || type, nodes) }
      addSource(s)
      setNodes((nds) => [...nds, { id: `source-${id}`, type, position, data: { label: s.name, entityId: id, sourceType: s.type } }])
    } else if (type === 'sensor') {
      const s: Sensor = { ...createDefaultSensor(), id, name: nextName('Sensor', nodes) }
      addSensor(s)
      const nodeId = `sensor-${id}`
      const nodeData = { label: s.name, entityId: id, sensorType: s.sensorType }
      const nearest = findNearestEdgeMath(rawPosition, edges, getInternalNode, 40)
      if (nearest) {
        // Exakte Position auf der Linie: Handles bei top:41% von 54px Höhe ≈ 22px
        const snappedPos = { x: nearest.point.x - 25, y: nearest.point.y - 22 }
        const origEdge = nearest.edge
        const splitProps = createEdgeProps(origEdge.sourceHandle || '', origEdge.targetHandle || '', origEdge)
        setNodes((nds) => [...nds, { id: nodeId, type: 'sensor', position: snappedPos, data: nodeData }])
        setEdges((eds) => [
          ...eds.filter((e) => e.id !== origEdge.id),
          { id: `e-${uuid()}`, source: origEdge.source, sourceHandle: origEdge.sourceHandle, target: nodeId, targetHandle: 'meter-L1', type: splitProps.type, data: splitProps.data, deletable: true },
          { id: `e-${uuid()}`, source: nodeId, sourceHandle: 'meter-R1', target: origEdge.target, targetHandle: origEdge.targetHandle, type: splitProps.type, data: splitProps.data, deletable: true },
        ])
      } else {
        setNodes((nds) => [...nds, { id: nodeId, type: 'sensor', position, data: nodeData }])
      }
    } else if (['hydraulic_separator', 'pump', 'mixer'].includes(type)) {
      // Reine Schema-Elemente (kein Store-Eintrag nötig)
      const nodeId = `schema-${uuid()}`
      let nodeData: Record<string, unknown> = {}
      if (type === 'hydraulic_separator') {
        nodeData = { label: nextName('Hydr. Weiche', nodes), portsLeft: 1, portsRight: 3 }
      } else {
        nodeData = { label: nextName(type === 'pump' ? 'Pumpe' : '3W-Mischer', nodes) }
      }
      setNodes((nds) => [...nds, { id: nodeId, type, position, data: nodeData }])
    }
  }, [screenToFlowPosition, pushUndo, setNodes, setEdges, nodes, edges, createEdgeProps, getInternalNode, addGenerator, addStorage, addConsumer, addCircuit, addRoom, addMeter, addSource, addSensor])

  // --- Keyboard shortcuts ---
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undo()
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNode) {
        handleDeleteNode(selectedNode.id)
      }
    }
    // R = 90° im Uhrzeigersinn, Shift+R = 90° gegen Uhrzeigersinn
    if (e.key === 'r' || e.key === 'R') {
      if (selectedNode) {
        e.preventDefault()
        rotateNode(selectedNode.id, e.shiftKey ? 'ccw' : 'cw')
      }
    }
  }, [undo, selectedNode, handleDeleteNode, rotateNode])

  // --- Reset positions + rotations ---
  const resetPositions = useCallback(() => {
    savedPositions.current = {}
    savedRotationsRef.current = {}
    savePositions({})
    saveRotations({})
    const newNodes = buildNodes({ generators, storages, consumers, circuits, rooms, meters }, {}, {})
    setNodes(newNodes)
  }, [generators, storages, consumers, circuits, rooms, meters, setNodes])

  // --- Sync: store data → canvas neu laden ---
  const syncFromStore = useCallback(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const rots: Record<string, number> = {}
    nodes.forEach((n) => {
      pos[n.id] = n.position
      const r = ((n.data as Record<string, unknown>).rotation as number) || 0
      if (r) rots[n.id] = r
    })
    savedPositions.current = { ...savedPositions.current, ...pos }
    savedRotationsRef.current = { ...savedRotationsRef.current, ...rots }
    savePositions(savedPositions.current)
    saveRotations(savedRotationsRef.current)

    const newNodes = buildNodes({ generators, storages, consumers, circuits, rooms, meters }, savedPositions.current, savedRotationsRef.current)
    const newEdges = buildEdges({ generators, storages, consumers, circuits, rooms, meters })
    setNodes(newNodes)
    setEdges(newEdges)
  }, [generators, storages, consumers, circuits, rooms, meters, nodes, setNodes, setEdges])

  // MiniMap-Farben
  const miniMapNodeColor = useCallback((node: Node) => {
    const t = node.type || ''
    if (['boiler', 'heat_pump'].includes(t)) return '#dc2626'
    if (['chp'].includes(t)) return '#ea580c'
    if (['chiller'].includes(t)) return '#06b6d4'
    if (['thermal_heat'].includes(t)) return '#dc2626'
    if (['thermal_cold'].includes(t)) return '#06b6d4'
    if (['circuit'].includes(t)) return '#dc2626'
    if (['room'].includes(t)) return '#8b949e'
    if (['consumer'].includes(t)) return '#16a34a'
    if (['meter'].includes(t)) return '#0891b2'
    if (t === 'solar_thermal') return '#f59e0b'
    if (t === 'ground_source') return '#16a34a'
    if (t === 'air_source') return '#60a5fa'
    if (t === 'well_source') return '#3b82f6'
    if (t === 'sensor') return '#8b5cf6'
    if (t === 'junction') return '#8b949e'
    return '#30363d'
  }, [])

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      {/* Palette links */}
      <ComponentPalette />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onReconnect={onReconnect}
          onEdgesDelete={onEdgesDelete}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode="loose"
          isValidConnection={handleIsValidConnection}
          snapToGrid
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'electrical', deletable: true }}
          colorMode="dark"
        >
          <CrossingArcsOverlay />
          <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} color="#21262d" />
          <Controls
            showZoom={false}
            showFitView={false}
            showInteractive={false}
            position="top-right"
          />
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor="rgba(13, 17, 23, 0.8)"
            style={{ background: '#161b22', border: '1px solid #30363d' }}
            position="bottom-right"
          />

          {/* Toolbar oben */}
          <Panel position="top-left">
            <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1 shadow-lg">
              <button onClick={undo} className="btn-icon p-1.5" title="Rückgängig (Ctrl+Z)">
                <Undo2 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-dark-border" />
              <button
                onClick={() => selectedNode && rotateNode(selectedNode.id, 'ccw')}
                disabled={!selectedNode}
                className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="90° gegen Uhrzeigersinn (Shift+R)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => selectedNode && rotateNode(selectedNode.id, 'cw')}
                disabled={!selectedNode}
                className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="90° im Uhrzeigersinn (R)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-dark-border" />
              <button onClick={resetPositions} className="btn-icon p-1.5" title="Layout zurücksetzen">
                <RotateCcw className="w-4 h-4 text-dark-faded" />
              </button>
              <button onClick={syncFromStore} className="btn-icon p-1.5" title="Aus Store neu laden">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
            {selectedNode && (
              <div className="mt-1 bg-dark-card border border-dark-border rounded px-2 py-1 text-[10px] text-dark-faded">
                {((selectedNode.data as Record<string, unknown>).rotation as number) || 0}° &middot; R drehen &middot; Shift+R zurück
              </div>
            )}
          </Panel>

          {/* Legende */}
          <Panel position="bottom-left">
            <div className="bg-dark-card border border-dark-border rounded-lg p-3 shadow-lg text-[10px] space-y-1">
              <p className="font-semibold text-dark-faded tracking-wider uppercase mb-1.5">Leitungen</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '3px solid #dc2626' }} /> <span className="text-dark-muted">Vorlauf (VL)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '3px dashed #3b82f6' }} /> <span className="text-dark-muted">Rücklauf (RL)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '3px solid #06b6d4' }} /> <span className="text-dark-muted">Kälte VL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '3px dashed #f97316' }} /> <span className="text-dark-muted">Kälte RL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '2.5px dashed #d97706' }} /> <span className="text-dark-muted">Gas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '2px dotted #16a34a' }} /> <span className="text-dark-muted">Sole / Quelle</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Properties rechts */}
      {selectedNode && (
        <PropertiesPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
          onRotate={rotateNode}
          onUpdateData={updateNodeData}
        />
      )}
    </div>
  )
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    boiler: 'Kessel', heat_pump: 'Wärmepumpe',
    chp: 'BHKW', chiller: 'Kältemaschine',
  }
  return map[type] || type
}

/** Nächsten freien Namen ableiten: "Kessel", "Kessel 2", "Kessel 3", ... */
function nextName(baseName: string, nodes: Node[]): string {
  const existing = new Set(nodes.map((n) => (n.data as Record<string, unknown>).label as string))
  if (!existing.has(baseName)) return baseName
  let i = 2
  while (existing.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}
