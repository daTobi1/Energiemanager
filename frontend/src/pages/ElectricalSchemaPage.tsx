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
import { Undo2, RotateCcw, Maximize, RotateCw } from 'lucide-react'

import type {
  Generator, PvGenerator, ChpGenerator, GridGenerator,
  Storage, BatteryStorage,
  Consumer, Meter,
} from '../types'
import { createDefaultCommunication } from '../types'
import { isValidConnection as checkHandleCompat } from '../components/shared/portUtils'

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
    buildEdges({ generators, storages, consumers, meters }),
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
    window.history.replaceState({}, '')
    const timer = setTimeout(() => {
      const targetNode = nodes.find((n) => {
        const data = n.data as Record<string, unknown>
        return data.entityId === targetEntityId
      })
      if (!targetNode) return
      setCenter(targetNode.position.x + 40, targetNode.position.y + 35, { zoom: 1.5, duration: 600 })
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
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev
      const current = ((prev.data as Record<string, unknown>).rotation as number) || 0
      const next = direction === 'cw'
        ? (current + 90) % 360
        : (current - 90 + 360) % 360
      return { ...prev, data: { ...prev.data, rotation: next } }
    })
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

  // --- Connect ---
  const onConnect = useCallback((params: Connection) => {
    pushUndo()
    setEdges((eds) =>
      addEdge({
        ...params,
        type: 'electrical',
        deletable: true,
      }, eds)
    )
  }, [setEdges, pushUndo])

  // --- Verbindungs-Validierung ---
  const handleIsValidConnection = useCallback((connection: Connection) => {
    const src = connection.sourceHandle || ''
    const tgt = connection.targetHandle || ''
    if (connection.source === connection.target) return false
    return checkHandleCompat(src, tgt)
  }, [])

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    pushUndo()
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
  }, [setEdges, pushUndo])

  const onEdgesDelete = useCallback(() => {
    pushUndo()
  }, [pushUndo])

  // --- Delete node ---
  const handleDeleteNode = useCallback((nodeId: string) => {
    pushUndo()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const entityId = (node.data as any).entityId as string | undefined

    if (entityId) {
      const type = node.type || ''
      if (['transformer', 'pv_inverter', 'generator', 'motor_load'].includes(type)) {
        removeGenerator(entityId)
      } else if (type === 'battery_system') {
        removeStorage(entityId)
      } else if (['consumer_load', 'wallbox'].includes(type)) {
        removeConsumer(entityId)
      } else if (type === 'elec_meter') {
        removeMeter(entityId)
      }
    }

    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }, [nodes, setNodes, setEdges, pushUndo, removeGenerator, removeStorage, removeConsumer, removeMeter])

  // --- Drop from palette ---
  const { screenToFlowPosition, setCenter } = useReactFlow()

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/electrical-node')
    if (!raw) return

    const { type } = JSON.parse(raw) as { type: string }
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    position.x = Math.round(position.x / GRID_SIZE) * GRID_SIZE
    position.y = Math.round(position.y / GRID_SIZE) * GRID_SIZE

    pushUndo()
    const id = uuid()

    if (type === 'transformer') {
      const gen: GridGenerator = {
        id, name: 'Hausanschluss', type: 'grid', energyForm: 'electricity',
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
        id, name: 'PV-Anlage', type: 'pv', energyForm: 'electricity',
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
        id, name: 'BHKW', type: 'chp', energyForm: 'electricity_heat',
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
    } else if (type === 'battery_system') {
      const s: BatteryStorage = {
        id, name: 'Batterie', type: 'battery', manufacturer: '', model: '',
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
        id, name: 'Wärmepumpe', type: 'heat_pump' as const, energyForm: 'heat' as const,
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
        id, name: 'Wallbox', type: 'ev_charger' as any, nominalPowerKw: 11,
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
        id, name: 'Verbraucher', type: 'household', nominalPowerKw: 1,
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
        id, name: 'Stromzähler', type: 'electricity', meterNumber: '',
        direction: 'consumption', category: 'unassigned', parentMeterId: '',
        phases: 3, nominalCurrentA: 63, nominalVoltageV: 400,
        ctRatio: 1, vtRatio: 1, pulsesPerUnit: 0,
        assignedToType: 'none', assignedToId: '',
        communication: createDefaultCommunication(), registerMappings: [],
        ports: [], notes: '',
      }
      addMeter(m)
      setNodes((nds) => [...nds, {
        id: `emeter-${id}`, type: 'elec_meter', position,
        data: { label: m.name, entityId: id, direction: m.direction },
      }])
    } else if (['elec_bus', 'sub_distribution', 'circuit_breaker'].includes(type)) {
      // Schema-only elements
      const nodeId = `eschema-${uuid()}`
      let nodeData: Record<string, unknown> = {}
      if (type === 'elec_bus') {
        nodeData = { label: 'Sammelschiene', portsTop: 3, portsBottom: 4 }
      } else if (type === 'sub_distribution') {
        nodeData = { label: 'Unterverteilung', outputs: 4 }
      } else {
        nodeData = { label: 'LS-Schalter' }
      }
      setNodes((nds) => [...nds, { id: nodeId, type, position, data: nodeData }])
    }
  }, [screenToFlowPosition, pushUndo, setNodes, addGenerator, addStorage, addConsumer, addMeter])

  // --- Keyboard ---
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undo()
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNode) handleDeleteNode(selectedNode.id)
    }
    if (e.key === 'r' || e.key === 'R') {
      if (selectedNode) {
        e.preventDefault()
        rotateNode(selectedNode.id, e.shiftKey ? 'ccw' : 'cw')
      }
    }
  }, [undo, selectedNode, handleDeleteNode, rotateNode])

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
          onReconnect={onReconnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={elecNodeTypes}
          edgeTypes={elecEdgeTypes}
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
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
          onRotate={rotateNode}
          onUpdateData={updateNodeData}
        />
      )}
    </div>
  )
}
