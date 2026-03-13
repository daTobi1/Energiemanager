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
  SelectionMode,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react'
import { useLocation } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { useEnergyStore } from '../store/useEnergyStore'
import { elecNodeTypes } from '../components/electrical/nodeTypes'
import { elecEdgeTypes } from '../components/electrical/edgeTypes'
import {
  buildNodes, buildEdges,
  loadPositions, savePositions,
  loadRotations, saveRotations,
} from '../components/electrical/storeToFlow'
import ElectricalPalette from '../components/electrical/panels/ElectricalPalette'
import ElectricalPropertiesPanel from '../components/electrical/panels/ElectricalPropertiesPanel'
import { GRID_SIZE } from '../components/electrical/constants'
import { v4 as uuid } from 'uuid'
import { Undo2, Redo2, RotateCcw, Maximize, RotateCw } from 'lucide-react'

import type {
  Generator, PvGenerator, ChpGenerator, GridGenerator, WindTurbineGenerator,
  Storage, BatteryStorage,
  Consumer, Meter,
} from '../types'
import { createDefaultCommunication } from '../types'
import { isValidConnection as checkHandleCompat } from '../components/shared/portUtils'
import CrossingArcsOverlay from '../components/shared/CrossingArcsOverlay'
import { useAutoJunction, findNearestEdgeMath, findNearestOnPath, getVisiblePath } from '../components/shared/useAutoJunction'
import { syncEdgeToStore, saveEdges, loadEdges } from '../components/shared/edgeSync'
import { nextName } from '../components/shared/schemaUtils'
import { useSchemaUndoRedo } from '../hooks/useSchemaUndoRedo'
import { useSchemaKeyboard } from '../hooks/useSchemaKeyboard'
import { useSchemaClipboard } from '../hooks/useSchemaClipboard'
import InlineLabelEditor from '../components/shared/InlineLabelEditor'
import SchemaContextMenu, { type ContextMenuState } from '../components/shared/SchemaContextMenu'

export default function ElectricalSchemaPage() {
  const store = useEnergyStore()
  const {
    generators, storages, consumers, meters,
    addGenerator, addStorage, addConsumer, addMeter,
    removeGenerator, removeStorage, removeConsumer, removeMeter,
  } = store

  const savedPositions = useRef(loadPositions())
  const savedRotationsRef = useRef(loadRotations())
  const initialNodes = useMemo(() =>
    buildNodes({ generators, storages, consumers, meters }, savedPositions.current, savedRotationsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const initialEdges = useMemo(() =>
    loadEdges('electrical-schema-edges') || buildEdges({ generators, storages, consumers, meters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([])
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const [editingLabel, setEditingLabel] = useState<{ nodeId: string; label: string; rect: { x: number; y: number; width: number; height: number } } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // --- Focus-on-navigate (von anderem Schema kommend) ---
  useEffect(() => {
    const state = location.state as { focusEntityId?: string } | null
    if (!state?.focusEntityId) return
    const targetEntityId = state.focusEntityId
    window.history.replaceState({}, '')
    const timer = setTimeout(() => {
      const targetNode = nodes.find((n) => {
        const data = n.data as Record<string, unknown>
        return data.entityId === targetEntityId
      })
      if (!targetNode) return
      setCenter(targetNode.position.x + 40, targetNode.position.y + 35, { zoom: 1.5, duration: 600 })
      setSelectedNodes([targetNode])
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // --- Undo/Redo ---
  const { pushUndo, undo, redo, canUndo, canRedo } = useSchemaUndoRedo(nodes, edges, setNodes, setEdges)

  // --- Persist edges ---
  useEffect(() => {
    saveEdges('electrical-schema-edges', edges)
  }, [edges])

  // --- Persist positions ---
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
        savedRotationsRef.current[nodeId] = next
        saveRotations(savedRotationsRef.current)
        return { ...n, data: { ...n.data, rotation: next } }
      })
    )
    setSelectedNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const current = ((n.data as Record<string, unknown>).rotation as number) || 0
        const next2 = direction === 'cw' ? (current + 90) % 360 : (current - 90 + 360) % 360
        return { ...n, data: { ...n.data, rotation: next2 } }
      })
    )
  }, [pushUndo, setNodes])

  // --- Node Data update (port counts etc.) ---
  const updateNodeData = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    pushUndo()
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n
        return { ...n, data: { ...n.data, ...patch } }
      })
    )
    setSelectedNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)
    )
  }, [pushUndo, setNodes])

  // --- Selection ---
  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedNodes(sel)
  }, [])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNodes([node])
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodes([])
    setContextMenu(null)
  }, [])

  // --- Edge-Typ ableiten ---
  const createEdgeProps = useCallback(
    (_srcHandle: string, _tgtHandle: string, _originalEdge?: Edge) => ({ type: 'electrical' as const }),
    [],
  )

  // --- Auto-Junction ---
  const {
    onConnectStart: handleConnectStart,
    markConnectionMade,
    onConnectEnd: handleConnectEnd,
    deleteJunction,
  } = useAutoJunction({ edges, setNodes, setEdges, pushUndo, gridSize: GRID_SIZE, createEdgeProps })

  // --- Connect ---
  const onConnect = useCallback((params: Connection) => {
    markConnectionMade()
    pushUndo()
    const newEdge: Edge = {
      id: `e-${uuid()}`,
      ...params,
      source: params.source!,
      target: params.target!,
      type: 'electrical',
      deletable: true,
    }
    setEdges((eds) => addEdge(newEdge, eds))
    syncEdgeToStore(newEdge, nodes, 'add')
  }, [setEdges, pushUndo, markConnectionMade, nodes])

  // --- Verbindungs-Validierung ---
  const handleIsValidConnection = useCallback((connection: Connection) => {
    const src = connection.sourceHandle || ''
    const tgt = connection.targetHandle || ''
    if (connection.source === connection.target) return false
    return checkHandleCompat(src, tgt)
  }, [])

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    pushUndo()
    syncEdgeToStore(oldEdge, nodes, 'remove')
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
    const reconnected: Edge = {
      ...oldEdge,
      source: newConnection.source!,
      target: newConnection.target!,
      sourceHandle: newConnection.sourceHandle,
      targetHandle: newConnection.targetHandle,
    }
    syncEdgeToStore(reconnected, nodes, 'add')
  }, [setEdges, pushUndo, nodes])

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    pushUndo()
    for (const edge of deletedEdges) {
      syncEdgeToStore(edge, nodes, 'remove')
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

    const junctionId = `eschema-${uuid()}`
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

  // --- Delete node ---
  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    // Junction / Meter: auto-reconnect gegenüberliegender Leitungen
    const inlineTypes = ['junction', 'elec_meter', 'circuit_breaker']
    if (inlineTypes.includes(node.type || '')) {
      const entityId = (node.data as Record<string, unknown>).entityId as string | undefined
      deleteJunction(nodeId)
      if (entityId && node.type === 'elec_meter') removeMeter(entityId)
      setSelectedNodes([])
      return
    }

    pushUndo()
    const entityId = (node.data as any).entityId as string | undefined

    if (entityId) {
      const type = node.type || ''
      if (['transformer', 'pv_inverter', 'generator', 'motor_load', 'wind_turbine'].includes(type)) {
        removeGenerator(entityId)
      } else if (type === 'battery_system') {
        removeStorage(entityId)
      } else if (['consumer_load', 'wallbox'].includes(type)) {
        removeConsumer(entityId)
      }
    }

    // Sync edge removals to store before deleting
    const affectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId)
    for (const edge of affectedEdges) {
      syncEdgeToStore(edge, nodes, 'remove')
    }

    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodes([])
  }, [nodes, edges, setNodes, setEdges, pushUndo, removeGenerator, removeStorage, removeConsumer, removeMeter, deleteJunction])

  // --- Drop from palette ---
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/electrical-node')
    if (!raw) return

    const { type } = JSON.parse(raw) as { type: string }
    const rawPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const position = {
      x: Math.round(rawPosition.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(rawPosition.y / GRID_SIZE) * GRID_SIZE,
    }

    pushUndo()
    const id = uuid()

    if (type === 'transformer') {
      const gen: GridGenerator = {
        id, name: nextName('Hausanschluss', nodes), type: 'grid', energyForm: 'electricity',
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
        gridMaxPowerKw: 43, gridPhases: 3, gridVoltageV: 400,
        feedInLimitPercent: 70, feedInLimitKw: 30,
        gridOperator: '', meterPointId: '',
      } as any
      addGenerator(gen as Generator)
      setNodes((nds) => [...nds, {
        id: `egen-${id}`, type: 'transformer', position,
        data: { label: gen.name, entityId: id, nominalPowerKw: gen.gridMaxPowerKw },
      }])
    } else if (type === 'pv_inverter') {
      const gen: PvGenerator = {
        id, name: nextName('PV-Anlage', nodes), type: 'pv', energyForm: 'electricity',
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
        peakPowerKwp: 10, numberOfModules: 30, moduleType: '',
        modulePowerWp: 370, inverterType: '', inverterPowerKw: 10,
        numberOfInverters: 1, mppTrackers: 2, azimuthDeg: 180,
        tiltDeg: 30, efficiency: 0.20, degradationPerYear: 0.005,
        temperatureCoefficient: -0.004, albedo: 0.2,
      } as any
      addGenerator(gen as Generator)
      setNodes((nds) => [...nds, {
        id: `egen-${id}`, type: 'pv_inverter', position,
        data: { label: gen.name, entityId: id, peakPowerKwp: gen.peakPowerKwp },
      }])
    } else if (type === 'generator') {
      const gen: ChpGenerator = {
        id, name: nextName('BHKW', nodes), type: 'chp', energyForm: 'electricity_heat',
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
        electricalPowerKw: 5, thermalPowerKw: 12,
        fuelType: 'natural_gas', electricalEfficiency: 0.30,
        thermalEfficiency: 0.60, overallEfficiency: 0.90,
        modulationMinPercent: 50, modulationMaxPercent: 100,
        minimumRunTimeMin: 30, minimumOffTimeMin: 15,
        startCostEur: 0.5, maintenanceIntervalHours: 4000,
        currentOperatingHours: 0, fuelCostCtPerKwh: 8,
        powerToHeatRatio: 0.42,
      } as any
      addGenerator(gen as Generator)
      setNodes((nds) => [...nds, {
        id: `egen-${id}`, type: 'generator', position,
        data: { label: gen.name, entityId: id, nominalPowerKw: gen.electricalPowerKw },
      }])
    } else if (type === 'wind_turbine') {
      const gen: WindTurbineGenerator = {
        id, name: nextName('Windrad', nodes), type: 'wind_turbine', energyForm: 'electricity',
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
        nominalPowerKw: 10, rotorDiameterM: 12, hubHeightM: 30,
        cutInWindSpeedMs: 3, ratedWindSpeedMs: 12, cutOutWindSpeedMs: 25,
        numberOfBlades: 3, generatorType: 'pmsg',
      }
      addGenerator(gen as Generator)
      setNodes((nds) => [...nds, {
        id: `egen-${id}`, type: 'wind_turbine', position,
        data: { label: gen.name, entityId: id, nominalPowerKw: gen.nominalPowerKw },
      }])
    } else if (type === 'battery_system') {
      const s: BatteryStorage = {
        id, name: nextName('Batterie', nodes), type: 'battery', manufacturer: '', model: '',
        technology: 'lfp', capacityKwh: 10, usableCapacityKwh: 9.5,
        maxChargePowerKw: 5, maxDischargePowerKw: 5, chargeEfficiency: 0.97,
        dischargeEfficiency: 0.97, roundTripEfficiency: 0.94,
        minSocPercent: 5, maxSocPercent: 95, initialSocPercent: 50,
        nominalVoltageV: 48, maxCurrentA: 100, cycleLifeExpected: 6000,
        currentCycles: 0, calendarLifeYears: 15, maxDoD: 0.9,
        cRateCharge: 0.5, cRateDischarge: 1, selfDischargePerMonth: 0.02,
        temperatureSensors: [], connectedGeneratorIds: [], connectedConsumerIds: [],
        communication: createDefaultCommunication(), assignedMeterIds: [], ports: [], notes: '',
      }
      addStorage(s)
      setNodes((nds) => [...nds, {
        id: `estor-${id}`, type: 'battery_system', position,
        data: { label: s.name, entityId: id, capacityKwh: s.capacityKwh },
      }])
    } else if (type === 'motor_load') {
      // Create a heat pump as default motor load
      const gen = {
        id, name: nextName('Wärmepumpe', nodes), type: 'heat_pump' as const, energyForm: 'heat' as const,
        manufacturer: '', model: '', serialNumber: '',
        commissioningDate: '', location: '', notes: '',
        communication: createDefaultCommunication(),
        assignedMeterIds: [], ports: [], connectedGeneratorIds: [],
        heatPumpType: 'air_water', heatingPowerKw: 12, coolingCapable: false,
        coolingPowerKw: 0, electricalPowerKw: 3, copRated: 4.0, copCurve: [],
        minOutdoorTempC: -20, maxOutdoorTempC: 40, flowTemperatureC: 35,
        returnTemperatureC: 28, modulationMinPercent: 30, modulationMaxPercent: 100,
        defrostPowerKw: 1, sgReadyEnabled: true, bivalencePointC: -5, refrigerant: 'R290',
      }
      addGenerator(gen as any)
      setNodes((nds) => [...nds, {
        id: `egen-${id}`, type: 'motor_load', position,
        data: { label: gen.name, entityId: id, motorType: 'heat_pump', nominalPowerKw: gen.electricalPowerKw },
      }])
    } else if (type === 'wallbox') {
      const c: Consumer = {
        id, name: nextName('Wallbox', nodes), type: 'ev_charger' as any, nominalPowerKw: 11,
        annualConsumptionKwh: 3000, loadProfile: 'E0',
        controllable: true, sheddable: true, priority: 7,
        connectedSourceIds: [], assignedMeterIds: [],
        communication: createDefaultCommunication(), ports: [], notes: '',
        wallboxMaxPowerKw: 11, wallboxPhases: 3, wallboxMinCurrentA: 6,
        vehicleBatteryKwh: 60, vehicleConsumptionPer100km: 18, ocppEnabled: true,
      }
      addConsumer(c)
      setNodes((nds) => [...nds, {
        id: `econ-${id}`, type: 'wallbox', position,
        data: { label: c.name, entityId: id, nominalPowerKw: c.nominalPowerKw },
      }])
    } else if (type === 'consumer_load') {
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
      setNodes((nds) => [...nds, {
        id: `econ-${id}`, type: 'consumer_load', position,
        data: { label: c.name, entityId: id, consumerType: c.type, nominalPowerKw: c.nominalPowerKw },
      }])
    } else if (type === 'elec_meter') {
      const m: Meter = {
        id, name: nextName('Stromzähler', nodes), type: 'electricity', meterNumber: '',
        direction: 'consumption', category: 'unassigned', parentMeterId: '',
        phases: 3, nominalCurrentA: 63, nominalVoltageV: 400,
        ctRatio: 1, vtRatio: 1, pulsesPerUnit: 0,
        assignedToType: 'none', assignedToId: '',
        communication: createDefaultCommunication(), registerMappings: [],
        ports: [], notes: '',
      }
      addMeter(m)
      const nodeId = `emeter-${id}`
      const nodeData = { label: m.name, entityId: id, direction: m.direction }
      const nearest = findNearestEdgeMath(rawPosition, edges, getInternalNode, 40)
      if (nearest) {
        // Exakte Position auf der Linie: Handles bei top:42% von 70px Höhe ≈ 29px
        const snappedPos = { x: nearest.point.x - 30, y: nearest.point.y - 29 }
        const origEdge = nearest.edge
        const splitProps = createEdgeProps(origEdge.sourceHandle || '', origEdge.targetHandle || '', origEdge)
        setNodes((nds) => [...nds, { id: nodeId, type: 'elec_meter', position: snappedPos, data: nodeData }])
        setEdges((eds) => [
          ...eds.filter((e) => e.id !== origEdge.id),
          { id: `e-${uuid()}`, source: origEdge.source, sourceHandle: origEdge.sourceHandle, target: nodeId, targetHandle: 'elec-L1', type: splitProps.type, data: splitProps.data, deletable: true },
          { id: `e-${uuid()}`, source: nodeId, sourceHandle: 'elec-R1', target: origEdge.target, targetHandle: origEdge.targetHandle, type: splitProps.type, data: splitProps.data, deletable: true },
        ])
      } else {
        setNodes((nds) => [...nds, { id: nodeId, type: 'elec_meter', position, data: nodeData }])
      }
    } else if (type === 'junction') {
      const nodeId = `eschema-${uuid()}`
      setNodes((nds) => [...nds, { id: nodeId, type: 'junction', position, data: { label: 'Verbindung' } }])
    } else if (['elec_bus', 'sub_distribution', 'circuit_breaker', 'sun_source', 'wind_source'].includes(type)) {
      // Schema-only elements
      const nodeId = `eschema-${uuid()}`
      let nodeData: Record<string, unknown> = {}
      if (type === 'elec_bus') {
        nodeData = { label: nextName('Sammelschiene', nodes), portsTop: 3, portsBottom: 4 }
      } else if (type === 'sub_distribution') {
        nodeData = { label: nextName('Unterverteilung', nodes), outputs: 4 }
      } else if (type === 'sun_source') {
        nodeData = { label: nextName('Sonne', nodes) }
      } else if (type === 'wind_source') {
        nodeData = { label: nextName('Wind', nodes) }
      } else {
        nodeData = { label: nextName('LS-Schalter', nodes) }
      }
      setNodes((nds) => [...nds, { id: nodeId, type, position, data: nodeData }])
    }
  }, [screenToFlowPosition, pushUndo, setNodes, setEdges, nodes, edges, createEdgeProps, getInternalNode, addGenerator, addStorage, addConsumer, addMeter])

  // --- Clipboard (Copy/Paste) ---
  const createEntityForPaste = useCallback((type: string, data: Record<string, unknown>, _pos: { x: number; y: number }): string | null => {
    const id = uuid()
    const label = data.label as string || type
    if (['transformer', 'pv_inverter', 'generator', 'wind_turbine', 'motor_load'].includes(type)) {
      addGenerator({ id, name: label, type: 'grid' as any, communication: createDefaultCommunication(), assignedMeterIds: [], ports: [], connectedGeneratorIds: [] } as any)
      return `egen-${id}`
    }
    if (type === 'battery_system') {
      addStorage({ id, name: label, type: 'battery', communication: createDefaultCommunication(), assignedMeterIds: [], ports: [], connectedGeneratorIds: [], connectedConsumerIds: [] } as any)
      return `estor-${id}`
    }
    if (['consumer_load', 'wallbox'].includes(type)) {
      addConsumer({ id, name: label, type: 'household', communication: createDefaultCommunication(), ports: [], connectedSourceIds: [], assignedMeterIds: [] } as any)
      return `econ-${id}`
    }
    if (['junction', 'elec_bus', 'sub_distribution', 'circuit_breaker', 'sun_source', 'wind_source'].includes(type)) {
      return `eschema-${id}`
    }
    return null
  }, [addGenerator, addStorage, addConsumer])

  const { copy, paste, canPaste } = useSchemaClipboard({
    nodes, setNodes, pushUndo,
    createEntityForPaste,
  })

  const handleCopy = useCallback(() => copy(selectedNodes), [copy, selectedNodes])
  const handlePaste = useCallback(() => {
    const vp = reactFlowWrapper.current?.getBoundingClientRect()
    if (!vp) return
    const center = screenToFlowPosition({ x: vp.width / 2, y: vp.height / 2 })
    paste(center)
  }, [paste, screenToFlowPosition])

  // --- Inline Label Editing ---
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const el = document.querySelector(`[data-id="${node.id}"]`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    setEditingLabel({
      nodeId: node.id,
      label: (node.data as Record<string, unknown>).label as string || '',
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    })
  }, [])

  const handleLabelSave = useCallback((nodeId: string, newLabel: string) => {
    pushUndo()
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n))
    const node = nodes.find((n) => n.id === nodeId)
    if (node) {
      const entityId = (node.data as Record<string, unknown>).entityId as string | undefined
      if (entityId) {
        const t = node.type || ''
        if (['transformer', 'pv_inverter', 'generator', 'motor_load', 'wind_turbine'].includes(t)) {
          const g = generators.find((g) => g.id === entityId)
          if (g) store.updateGenerator(entityId, { ...g, name: newLabel })
        } else if (t === 'battery_system') {
          const s = storages.find((s) => s.id === entityId)
          if (s) store.updateStorage(entityId, { ...s, name: newLabel } as any)
        } else if (['consumer_load', 'wallbox'].includes(t)) {
          const c = consumers.find((c) => c.id === entityId)
          if (c) store.updateConsumer(entityId, { ...c, name: newLabel })
        }
      }
    }
    setEditingLabel(null)
  }, [pushUndo, setNodes, nodes, generators, storages, consumers, store])

  // --- Context Menu ---
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId: node.id })
  }, [])

  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', edgeId: edge.id })
  }, [])

  const handlePaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'pane' })
  }, [])

  // --- Keyboard ---
  const onKeyDown = useSchemaKeyboard({
    undo, redo, selectedNodes, handleDeleteNode, rotateNode,
    copy: handleCopy, paste: handlePaste,
  })

  // --- Reset ---
  const resetPositions = useCallback(() => {
    savedPositions.current = {}
    savedRotationsRef.current = {}
    savePositions({})
    saveRotations({})
    const newNodes = buildNodes({ generators, storages, consumers, meters }, {}, {})
    setNodes(newNodes)
  }, [generators, storages, consumers, meters, setNodes])

  // --- Sync from store ---
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

    const newNodes = buildNodes({ generators, storages, consumers, meters }, savedPositions.current, savedRotationsRef.current)
    const newEdges = buildEdges({ generators, storages, consumers, meters })
    setNodes(newNodes)
    setEdges(newEdges)
  }, [generators, storages, consumers, meters, nodes, setNodes, setEdges])

  // MiniMap
  const miniMapNodeColor = useCallback((node: Node) => {
    const t = node.type || ''
    if (t === 'transformer') return '#6366f1'
    if (t === 'pv_inverter') return '#f59e0b'
    if (t === 'generator') return '#22c55e'
    if (t === 'battery_system') return '#8b5cf6'
    if (t === 'motor_load') return '#2563eb'
    if (t === 'wallbox') return '#22c55e'
    if (t === 'consumer_load') return '#ef4444'
    if (t === 'circuit_breaker') return '#eab308'
    if (t === 'elec_meter') return '#eab308'
    if (t === 'elec_bus') return '#eab308'
    if (t === 'sub_distribution') return '#eab308'
    if (t === 'sun_source') return '#f59e0b'
    if (t === 'wind_source') return '#60a5fa'
    if (t === 'wind_turbine') return '#22c55e'
    if (t === 'junction') return '#8b949e'
    return '#30363d'
  }, [])

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      <ElectricalPalette />

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
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={onPaneClick}
          onPaneContextMenu={handlePaneContextMenu}
          onSelectionChange={onSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={elecNodeTypes}
          edgeTypes={elecEdgeTypes}
          connectionMode="loose"
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          isValidConnection={handleIsValidConnection}
          snapToGrid
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'electrical', deletable: true }}
          colorMode="dark"
        >
          <CrossingArcsOverlay />
          <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} color="#21262d" />
          <Controls showZoom={false} showFitView={false} showInteractive={false} position="top-right" />
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor="rgba(13, 17, 23, 0.8)"
            style={{ background: '#161b22', border: '1px solid #30363d' }}
            position="bottom-right"
          />

          {/* Toolbar */}
          <Panel position="top-left">
            <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1 shadow-lg">
              <button onClick={undo} disabled={!canUndo} className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed" title="Rückgängig (Ctrl+Z)">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={redo} disabled={!canRedo} className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed" title="Wiederholen (Ctrl+Shift+Z)">
                <Redo2 className="w-4 h-4" />
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

          {/* Legend */}
          <Panel position="bottom-left">
            <div className="bg-dark-card border border-dark-border rounded-lg p-3 shadow-lg text-[10px] space-y-1">
              <p className="font-semibold text-dark-faded tracking-wider uppercase mb-1.5">Leitungen</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0" style={{ borderTop: '2.5px dashed #eab308' }} /> <span className="text-dark-muted">Stromleitung</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && (
        <ElectricalPropertiesPanel
          node={selectedNode}
          onClose={() => setSelectedNodes([])}
          onDelete={handleDeleteNode}
          onRotate={rotateNode}
          onUpdateData={updateNodeData}
        />
      )}
      {selectedNodes.length > 1 && (
        <div className="w-64 border-l border-dark-border bg-dark-card p-4">
          <p className="text-sm text-dark-muted">{selectedNodes.length} Elemente ausgewählt</p>
          <button onClick={() => selectedNodes.forEach((n) => handleDeleteNode(n.id))}
            className="btn-danger mt-3 w-full text-sm">
            Alle entfernen
          </button>
        </div>
      )}

      {/* Inline Label Editor */}
      {editingLabel && (
        <InlineLabelEditor
          nodeId={editingLabel.nodeId}
          initialLabel={editingLabel.label}
          position={editingLabel.rect}
          onSave={handleLabelSave}
          onCancel={() => setEditingLabel(null)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <SchemaContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (contextMenu.nodeId) {
              const n = nodes.find((n) => n.id === contextMenu.nodeId)
              if (n) setSelectedNodes([n])
            }
          }}
          onDuplicate={() => {
            if (contextMenu.nodeId) {
              const n = nodes.find((n) => n.id === contextMenu.nodeId)
              if (n) { copy([n]); const vp = reactFlowWrapper.current?.getBoundingClientRect(); if (vp) { const c = screenToFlowPosition({ x: vp.width / 2, y: vp.height / 2 }); paste(c) } }
            }
          }}
          onRotateCw={() => { if (contextMenu.nodeId) rotateNode(contextMenu.nodeId, 'cw') }}
          onRotateCcw={() => { if (contextMenu.nodeId) rotateNode(contextMenu.nodeId, 'ccw') }}
          onDelete={() => { if (contextMenu.nodeId) handleDeleteNode(contextMenu.nodeId) }}
          onDeleteEdge={() => {
            if (contextMenu.edgeId) {
              pushUndo()
              const edge = edges.find((e) => e.id === contextMenu.edgeId)
              if (edge) syncEdgeToStore(edge, nodes, 'remove')
              setEdges((eds) => eds.filter((e) => e.id !== contextMenu.edgeId))
            }
          }}
          onPaste={handlePaste}
          canPaste={canPaste}
        />
      )}
    </div>
  )
}
