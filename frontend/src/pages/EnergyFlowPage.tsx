import { useMemo } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { Sun, Flame, Thermometer, Snowflake, Battery, Plug, Zap, Home } from 'lucide-react'
import type { GeneratorType, StorageType, ConsumerType } from '../types'

interface FlowNode {
  id: string
  label: string
  type: 'generator' | 'storage' | 'consumer' | 'grid'
  subType: string
  x: number
  y: number
  color: string
  iconColor: string
  powerKw?: number
}

interface FlowEdge {
  from: string
  to: string
  color: string
  label?: string
  animated?: boolean
}

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

const conColors: Record<ConsumerType, string> = {
  household: '#16a34a', commercial: '#7c3aed', production: '#ea580c',
  lighting: '#eab308', hvac: '#2563eb', ventilation: '#06b6d4',
  wallbox: '#059669', hot_water: '#dc2626', other: '#6b7280',
}

export default function EnergyFlowPage() {
  const { generators, storages, consumers, settings } = useEnergyStore()

  const { nodes, edges } = useMemo(() => {
    const nodes: FlowNode[] = []
    const edges: FlowEdge[] = []
    const svgWidth = 900
    const colPositions = { generators: 100, storages: 450, consumers: 800 }

    // Netz-Knoten (oben mitte)
    nodes.push({
      id: 'grid', label: 'Stromnetz', type: 'grid', subType: 'grid',
      x: colPositions.storages, y: 40,
      color: '#e0e7ff', iconColor: '#4f46e5',
      powerKw: settings.gridMaxPowerKw,
    })

    // Erzeuger (links)
    const genSpacing = Math.min(100, (500 - 60) / Math.max(generators.length, 1))
    generators.forEach((g, i) => {
      const colors = genColors[g.type]
      nodes.push({
        id: `gen-${g.id}`, label: g.name || g.type, type: 'generator', subType: g.type,
        x: colPositions.generators, y: 120 + i * genSpacing,
        color: colors.bg, iconColor: colors.icon,
      })
      // Erzeuger -> Grid (Strom)
      if (g.type === 'pv' || g.type === 'chp') {
        edges.push({ from: `gen-${g.id}`, to: 'grid', color: colors.icon, animated: true })
      }
      // Erzeuger -> Speicher (thermisch)
      storages.forEach((s) => {
        if (s.type !== 'battery' && (s as { connectedGeneratorIds?: string[] }).connectedGeneratorIds?.includes(g.id)) {
          edges.push({ from: `gen-${g.id}`, to: `stor-${s.id}`, color: colors.icon })
        }
      })
    })

    // Speicher (mitte)
    const storSpacing = Math.min(100, (500 - 60) / Math.max(storages.length, 1))
    storages.forEach((s, i) => {
      const colors = storColors[s.type]
      nodes.push({
        id: `stor-${s.id}`, label: s.name || s.type, type: 'storage', subType: s.type,
        x: colPositions.storages, y: 180 + i * storSpacing,
        color: colors.bg, iconColor: colors.icon,
      })
      // Batterie <-> Netz
      if (s.type === 'battery') {
        edges.push({ from: 'grid', to: `stor-${s.id}`, color: '#7c3aed', animated: true })
      }
    })

    // Verbraucher (rechts)
    const conSpacing = Math.min(80, (500 - 60) / Math.max(consumers.length, 1))
    consumers.forEach((c, i) => {
      const color = conColors[c.type]
      nodes.push({
        id: `con-${c.id}`, label: c.name || c.type, type: 'consumer', subType: c.type,
        x: colPositions.consumers, y: 120 + i * conSpacing,
        color: '#f0fdf4', iconColor: color,
      })
      // Grid -> Consumer
      edges.push({ from: 'grid', to: `con-${c.id}`, color: '#4f46e5' })
      // Thermische Speicher -> Verbraucher
      storages.forEach((s) => {
        if (s.type !== 'battery' && (s as { connectedConsumerIds?: string[] }).connectedConsumerIds?.includes(c.id)) {
          edges.push({ from: `stor-${s.id}`, to: `con-${c.id}`, color: storColors[s.type].icon })
        }
      })
    })

    return { nodes, edges }
  }, [generators, storages, consumers, settings])

  const svgWidth = 920
  const svgHeight = Math.max(400, 120 + Math.max(generators.length, storages.length, consumers.length) * 100 + 60)

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
      case 'household': return Home
      case 'wallbox': return Zap
      default: return Plug
    }
  }

  const isEmpty = generators.length === 0 && consumers.length === 0 && storages.length === 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-header">Energiefluss-Diagramm</h1>
        <p className="text-sm text-gray-500 mt-1">Interaktive Darstellung der Energieflüsse basierend auf der Konfiguration</p>
      </div>

      {isEmpty ? (
        <div className="card text-center py-16">
          <Zap className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Noch keine Komponenten konfiguriert</p>
          <p className="text-sm text-gray-400 mt-2">
            Lege Erzeuger, Verbraucher und Speicher an, um das Energiefluss-Diagramm zu sehen
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {/* Legende */}
          <div className="flex gap-6 mb-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Erzeuger</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> Speicher</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Verbraucher</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500" /> Netz</span>
          </div>

          <svg width={svgWidth} height={svgHeight} className="mx-auto">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Spalten-Header */}
            <text x={100} y={25} textAnchor="middle" className="fill-gray-400 text-xs font-semibold">ERZEUGER</text>
            <text x={450} y={25} textAnchor="middle" className="fill-gray-400 text-xs font-semibold">NETZ & SPEICHER</text>
            <text x={800} y={25} textAnchor="middle" className="fill-gray-400 text-xs font-semibold">VERBRAUCHER</text>

            {/* Kanten */}
            {edges.map((edge, i) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const x1 = fromNode.x + 60
              const y1 = fromNode.y + 22
              const x2 = toNode.x - 60
              const y2 = toNode.y + 22

              const midX = (x1 + x2) / 2
              const path = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={2.5}
                    strokeOpacity={0.3}
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.animated && (
                    <path
                      d={path}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={2.5}
                      strokeOpacity={0.7}
                      className="energy-flow-line"
                    />
                  )}
                </g>
              )
            })}

            {/* Knoten */}
            {nodes.map((node) => {
              const Icon = getIcon(node.subType)
              const width = 120
              const height = 44
              return (
                <g key={node.id} className="cursor-pointer">
                  <rect
                    x={node.x - width / 2}
                    y={node.y}
                    width={width}
                    height={height}
                    rx={10}
                    fill={node.color}
                    stroke={node.iconColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                  <foreignObject x={node.x - width / 2} y={node.y} width={width} height={height}>
                    <div className="flex items-center gap-2 h-full px-3">
                      <Icon style={{ color: node.iconColor, width: 18, height: 18, flexShrink: 0 }} />
                      <span className="text-xs font-medium truncate" style={{ color: node.iconColor }}>
                        {node.label}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
