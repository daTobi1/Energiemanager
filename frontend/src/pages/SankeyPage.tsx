import { useMemo, useEffect, useRef } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { BarChart3 } from 'lucide-react'
import type {
  PvGenerator, ChpGenerator, HeatPumpGenerator,
  BoilerGenerator, ChillerGenerator, WindTurbineGenerator,
  BatteryStorage, ThermalStorage,
} from '../types'

// Dynamic import for Plotly (loaded at runtime)
let Plotly: typeof import('plotly.js-dist-min') | null = null

/** Estimate annual production per generator (kWh) */
function estimateGeneration(g: any): { electrical: number; thermal: number; cold: number } {
  switch (g.type) {
    case 'pv': return { electrical: (g as PvGenerator).peakPowerKwp * 950, thermal: 0, cold: 0 }
    case 'wind_turbine': return { electrical: (g as WindTurbineGenerator).nominalPowerKw * 2200, thermal: 0, cold: 0 }
    case 'chp': {
      const chp = g as ChpGenerator
      const hours = 4000
      return { electrical: chp.electricalPowerKw * hours, thermal: chp.thermalPowerKw * hours, cold: 0 }
    }
    case 'heat_pump': {
      const hp = g as HeatPumpGenerator
      return { electrical: 0, thermal: hp.heatingPowerKw * 2000, cold: hp.coolingCapable ? (hp.coolingPowerKw || 0) * 500 : 0 }
    }
    case 'boiler': return { electrical: 0, thermal: (g as BoilerGenerator).nominalPowerKw * 1500, cold: 0 }
    case 'chiller': return { electrical: 0, thermal: 0, cold: (g as ChillerGenerator).coolingPowerKw * 800 }
    case 'grid': return { electrical: 0, thermal: 0, cold: 0 } // computed as residual
    default: return { electrical: 0, thermal: 0, cold: 0 }
  }
}

export default function SankeyPage() {
  const { generators, consumers, storages, circuits, rooms } = useEnergyStore()
  const plotRef = useRef<HTMLDivElement>(null)

  const sankeyData = useMemo(() => {
    const labels: string[] = []
    const colors: string[] = []
    const sources: number[] = []
    const targets: number[] = []
    const values: number[] = []
    const linkColors: string[] = []

    // Index maps: entityId → Sankey node index
    const genIdx = new Map<string, number>()
    const storIdx = new Map<string, number>()
    const circIdx = new Map<string, number>()
    const conIdx = new Map<string, number>()

    // --- Build Sankey nodes ---

    // Grid generator (special — source of imported electricity)
    const gridGen = generators.find((g) => g.type === 'grid')
    const gridNodeIdx = 0
    labels.push(gridGen?.name || 'Hausanschluss')
    colors.push('#3b82f6')
    if (gridGen) genIdx.set(gridGen.id, gridNodeIdx)

    // All other generators
    const genColors: Record<string, string> = {
      pv: '#f59e0b', chp: '#f97316', heat_pump: '#ef4444',
      boiler: '#dc2626', chiller: '#06b6d4', wind_turbine: '#22d3ee',
    }
    for (const g of generators) {
      if (g.type === 'grid') continue
      const idx = labels.length
      genIdx.set(g.id, idx)
      labels.push(g.name)
      colors.push(genColors[g.type] || '#8b949e')
    }

    // Storages
    for (const s of storages) {
      const idx = labels.length
      storIdx.set(s.id, idx)
      labels.push(s.name)
      colors.push(s.type === 'battery' ? '#8b5cf6' : s.type === 'heat' ? '#ef4444' : '#06b6d4')
    }

    // Circuits
    for (const c of circuits) {
      const idx = labels.length
      circIdx.set(c.id, idx)
      labels.push(c.name)
      colors.push(c.type === 'cooling' ? '#06b6d4' : '#ef4444')
    }

    // Consumers
    for (const c of consumers) {
      const idx = labels.length
      conIdx.set(c.id, idx)
      labels.push(c.name)
      colors.push('#22c55e')
    }

    // Feed-in & Losses
    const feedInIdx = labels.length
    labels.push('Netzeinspeisung')
    colors.push('#a78bfa')

    const lossIdx = labels.length
    labels.push('Verluste')
    colors.push('#6b7280')

    // --- Estimate generation ---
    const genEstimates = new Map<string, { electrical: number; thermal: number; cold: number }>()
    let totalElecGen = 0
    let totalElecConsumption = 0

    for (const g of generators) {
      if (g.type === 'grid') continue
      const est = estimateGeneration(g)
      genEstimates.set(g.id, est)
      totalElecGen += est.electrical
    }

    // Heat pump / chiller electricity consumption
    let hpChillerElecConsumption = 0
    for (const g of generators) {
      if (g.type === 'heat_pump') {
        const hp = g as HeatPumpGenerator
        hpChillerElecConsumption += (hp.heatingPowerKw * 2000) / hp.copRated
      } else if (g.type === 'chiller') {
        const ch = g as ChillerGenerator
        hpChillerElecConsumption += (ch.coolingPowerKw * 800) / ch.eerRated
      }
    }

    totalElecConsumption = consumers.reduce((s, c) => s + c.annualConsumptionKwh, 0) + hpChillerElecConsumption

    // --- Helper to add a link ---
    const addLink = (s: number, t: number, v: number, color: string) => {
      if (v <= 0 || s === t) return
      sources.push(s); targets.push(t); values.push(Math.round(v)); linkColors.push(color)
    }

    // --- Build links from actual store connections ---

    // 1. Generator → Storage (thermal + electrical)
    for (const s of storages) {
      for (const gId of s.connectedGeneratorIds) {
        const gNode = genIdx.get(gId)
        const sNode = storIdx.get(s.id)
        if (gNode === undefined || sNode === undefined) continue
        const est = genEstimates.get(gId)
        if (!est) continue
        const gen = generators.find((g) => g.id === gId)
        if (!gen) continue

        if (s.type === 'battery') {
          // Electrical → Battery: estimate charging throughput
          const bat = s as BatteryStorage
          const throughput = bat.usableCapacityKwh * 250
          addLink(gNode, sNode, throughput, 'rgba(139, 92, 246, 0.3)')
        } else {
          // Thermal → Puffer/Kältespeicher
          const thermalFlow = s.type === 'cold' ? est.cold : est.thermal
          const connCount = s.connectedGeneratorIds.length || 1
          addLink(gNode, sNode, thermalFlow / connCount, s.type === 'cold' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(239, 68, 68, 0.3)')
        }
      }
    }

    // 2. Generator → Circuit (direct thermal connection)
    for (const c of circuits) {
      for (const gId of c.generatorIds) {
        const gNode = genIdx.get(gId)
        const cNode = circIdx.get(c.id)
        if (gNode === undefined || cNode === undefined) continue
        const est = genEstimates.get(gId)
        if (!est) continue
        const thermalFlow = c.type === 'cooling' ? est.cold : est.thermal
        const connCount = c.generatorIds.length || 1
        addLink(gNode, cNode, thermalFlow / connCount, c.type === 'cooling' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(239, 68, 68, 0.3)')
      }

      // 3. Storage → Circuit
      for (const sId of c.supplyStorageIds) {
        const sNode = storIdx.get(sId)
        const cNode = circIdx.get(c.id)
        if (sNode === undefined || cNode === undefined) continue
        const stor = storages.find((s) => s.id === sId) as ThermalStorage | undefined
        if (!stor) continue
        const stored = stor.volumeLiters * 4.18 * (stor.maxTemperatureC - stor.minTemperatureC) / 3600 * 300
        const connCount = c.supplyStorageIds.length || 1
        addLink(sNode, cNode, stored / connCount, c.type === 'cooling' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(239, 68, 68, 0.2)')
      }

      // 4. Circuit → Rooms (as consumers of thermal energy)
      for (const rId of c.roomIds) {
        const room = rooms.find((r) => r.id === rId)
        if (!room) continue
        const cNode = circIdx.get(c.id)
        if (cNode === undefined) continue
        // Estimate room thermal demand from area
        const roomDemand = (room.areaM2 || 20) * 80 // ~80 kWh/m²a typical
        // Find consumers in this room
        for (const conId of room.consumerIds || []) {
          const conNode = conIdx.get(conId)
          if (conNode === undefined) continue
          const con = consumers.find((cc) => cc.id === conId)
          if (!con) continue
          addLink(cNode, conNode, roomDemand / Math.max(1, (room.consumerIds || []).length), 'rgba(239, 68, 68, 0.2)')
        }
      }
    }

    // 5. Generator/Storage → Consumer (electrical connections)
    for (const c of consumers) {
      const cNode = conIdx.get(c.id)
      if (cNode === undefined) continue

      for (const srcId of c.connectedSourceIds) {
        const gNode = genIdx.get(srcId)
        if (gNode !== undefined) {
          // Generator → Consumer
          const gen = generators.find((g) => g.id === srcId)
          if (gen && (gen.type === 'pv' || gen.type === 'chp' || gen.type === 'grid' || gen.type === 'wind_turbine')) {
            const est = genEstimates.get(srcId)
            const genElec = est?.electrical || 0
            if (gen.type === 'grid') {
              // Grid → Consumer: use consumer's demand
              addLink(gridNodeIdx, cNode, c.annualConsumptionKwh, 'rgba(59, 130, 246, 0.3)')
            } else {
              // Local gen → Consumer: proportional share
              const connCount = c.connectedSourceIds.length || 1
              addLink(gNode, cNode, Math.min(c.annualConsumptionKwh, genElec / connCount), 'rgba(34, 197, 94, 0.3)')
            }
          }
          continue
        }
        const sNode = storIdx.get(srcId)
        if (sNode !== undefined) {
          // Battery → Consumer
          const stor = storages.find((s) => s.id === srcId)
          if (stor && stor.type === 'battery') {
            const bat = stor as BatteryStorage
            const discharged = bat.usableCapacityKwh * 250 * bat.roundTripEfficiency
            addLink(sNode, cNode, discharged / (consumers.filter((cc) => cc.connectedSourceIds.includes(srcId)).length || 1), 'rgba(139, 92, 246, 0.3)')
          }
        }
      }
    }

    // 6. Battery discharge → connected consumers (from storage.connectedConsumerIds)
    for (const s of storages) {
      if (s.type !== 'battery') continue
      const sNode = storIdx.get(s.id)
      if (sNode === undefined) continue
      const bat = s as BatteryStorage
      for (const cId of s.connectedConsumerIds || []) {
        const cNode = conIdx.get(cId)
        if (cNode === undefined) continue
        // Already handled via consumer.connectedSourceIds above, skip duplicates
      }
    }

    // 7. Generators producing electricity for HP/Chiller (motor loads)
    for (const g of generators) {
      if (g.type !== 'heat_pump' && g.type !== 'chiller') continue
      const motorNode = genIdx.get(g.id)
      if (motorNode === undefined) continue

      let elecConsumption = 0
      if (g.type === 'heat_pump') {
        const hp = g as HeatPumpGenerator
        elecConsumption = (hp.heatingPowerKw * 2000) / hp.copRated
      } else {
        const ch = g as ChillerGenerator
        elecConsumption = (ch.coolingPowerKw * 800) / ch.eerRated
      }

      // Find which generators supply this motor
      if (g.connectedGeneratorIds.length > 0) {
        for (const supplierId of g.connectedGeneratorIds) {
          const supplierNode = genIdx.get(supplierId)
          if (supplierNode !== undefined) {
            addLink(supplierNode, motorNode, elecConsumption / g.connectedGeneratorIds.length, 'rgba(245, 158, 11, 0.3)')
          }
        }
      } else {
        // No explicit connection — assume grid supplies
        addLink(gridNodeIdx, motorNode, elecConsumption, 'rgba(59, 130, 246, 0.3)')
      }
    }

    // 8. Consumers without connections → assume grid supply
    for (const c of consumers) {
      const cNode = conIdx.get(c.id)
      if (cNode === undefined) continue
      if (c.connectedSourceIds.length === 0 && c.annualConsumptionKwh > 0) {
        addLink(gridNodeIdx, cNode, c.annualConsumptionKwh, 'rgba(59, 130, 246, 0.3)')
      }
    }

    // 9. Grid feed-in (excess local generation)
    const selfConsumption = Math.min(totalElecGen, totalElecConsumption)
    const feedIn = Math.max(0, totalElecGen - selfConsumption)
    if (feedIn > 0) {
      // Find the biggest electrical generator for feed-in
      let biggestElecGen: string | null = null
      let biggestElecValue = 0
      for (const [id, est] of genEstimates) {
        if (est.electrical > biggestElecValue) {
          biggestElecValue = est.electrical
          biggestElecGen = id
        }
      }
      if (biggestElecGen) {
        const gNode = genIdx.get(biggestElecGen)
        if (gNode !== undefined) {
          addLink(gNode, feedInIdx, feedIn, 'rgba(167, 139, 250, 0.4)')
        }
      }
    }

    // 10. Grid import (deficit)
    const gridImport = Math.max(0, totalElecConsumption - selfConsumption)
    // Grid import is handled by individual consumer links above (step 8)
    // If consumers have explicit grid connection, those links exist already

    // 11. Losses (5% of total energy)
    const totalEnergy = totalElecGen + Array.from(genEstimates.values()).reduce((s, e) => s + e.thermal + e.cold, 0)
    if (totalEnergy > 0) {
      addLink(gridNodeIdx, lossIdx, totalEnergy * 0.02, 'rgba(107, 114, 128, 0.3)')
    }

    return { labels, colors, sources, targets, values, linkColors }
  }, [generators, consumers, storages, circuits, rooms])

  useEffect(() => {
    if (!plotRef.current || sankeyData.values.length === 0) return

    const renderPlot = async () => {
      if (!Plotly) {
        Plotly = await import('plotly.js-dist-min')
      }

      const data = [{
        type: 'sankey' as const,
        orientation: 'h' as const,
        node: {
          pad: 20,
          thickness: 25,
          line: { color: '#0d1117', width: 2 },
          label: sankeyData.labels,
          color: sankeyData.colors,
          hovertemplate: '%{label}<br>%{value:,.0f} kWh<extra></extra>',
        },
        link: {
          source: sankeyData.sources,
          target: sankeyData.targets,
          value: sankeyData.values,
          color: sankeyData.linkColors,
          hovertemplate: '%{source.label} → %{target.label}<br>%{value:,.0f} kWh<extra></extra>',
        },
      }]

      const layout = {
        title: {
          text: 'Energieflussbilanz (geschätzt, jährlich)',
          font: { size: 16, color: '#e6edf3' },
        },
        font: { size: 12, family: 'system-ui, sans-serif', color: '#b1bac4' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { t: 50, l: 20, r: 20, b: 20 },
        height: 600,
      }

      Plotly!.newPlot(plotRef.current!, data as Plotly.Data[], layout as Partial<Plotly.Layout>, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'] as Plotly.ModeBarDefaultButtons[],
      })
    }

    renderPlot()
  }, [sankeyData])

  const isEmpty = generators.length === 0 && consumers.length === 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-header">Sankey-Diagramm</h1>
        <p className="text-sm text-dark-faded mt-1">
          Energieflussbilanz — geschätzte Jahreswerte basierend auf Konfiguration und Schema-Verbindungen
        </p>
      </div>

      {isEmpty ? (
        <div className="card text-center py-16">
          <BarChart3 className="w-16 h-16 text-dark-border mx-auto mb-4" />
          <p className="text-dark-faded text-lg">Noch keine Daten für das Sankey-Diagramm</p>
          <p className="text-sm text-dark-faded mt-2">
            Konfiguriere Erzeuger und Verbraucher im Hydraulik- oder Stromschema
          </p>
        </div>
      ) : (
        <div className="card">
          <div ref={plotRef} />
          <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs text-amber-400">
              <strong>Hinweis:</strong> Die dargestellten Werte sind Schätzungen basierend auf Nennleistungen und
              typischen Betriebsstunden. Die Flusspfade entsprechen den im Schema gezeichneten Verbindungen.
              Reale Werte werden nach Inbetriebnahme durch Messdaten ersetzt.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
