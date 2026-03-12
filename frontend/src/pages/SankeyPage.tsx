import { useMemo, useEffect, useRef } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { BarChart3 } from 'lucide-react'
import type { PvGenerator, ChpGenerator, HeatPumpGenerator, BoilerGenerator, ChillerGenerator, BatteryStorage, ThermalStorage } from '../types'

// Dynamic import for Plotly (loaded at runtime)
let Plotly: typeof import('plotly.js-dist-min') | null = null

export default function SankeyPage() {
  const { generators, consumers, storages, settings } = useEnergyStore()
  const plotRef = useRef<HTMLDivElement>(null)
  const plotlyLoaded = useRef(false)

  const sankeyData = useMemo(() => {
    const labels: string[] = []
    const colors: string[] = []
    const sources: number[] = []
    const targets: number[] = []
    const values: number[] = []
    const linkColors: string[] = []

    // Quellen (Links)
    // 0: Hausanschluss — Netzbezug über Hausanschluss-Zähler
    const gridGen = generators.find((g) => g.type === 'grid')
    labels.push(gridGen?.name || 'Hausanschluss')
    colors.push('#3b82f6')

    // Erzeuger (ohne Grid — der ist schon als Hausanschluss-Node oben)
    const nonGridGens = generators.filter((g) => g.type !== 'grid')
    const genStartIdx = labels.length
    nonGridGens.forEach((g) => {
      switch (g.type) {
        case 'pv':
          labels.push(g.name || 'PV-Anlage')
          colors.push('#f59e0b')
          break
        case 'chp':
          labels.push(g.name || 'BHKW')
          colors.push('#f97316')
          break
        case 'heat_pump':
          labels.push(g.name || 'Wärmepumpe')
          colors.push('#ef4444')
          break
        case 'boiler':
          labels.push(g.name || 'Heizkessel')
          colors.push('#ef4444')
          break
        case 'chiller':
          labels.push(g.name || 'Kältemaschine')
          colors.push('#3b82f6')
          break
      }
    })

    // Zentrale Knoten
    const electricIdx = labels.length
    labels.push('Strom gesamt')
    colors.push('#fbbf24')

    const heatIdx = labels.length
    labels.push('Wärme gesamt')
    colors.push('#ef4444')

    const coldIdx = labels.length
    labels.push('Kälte gesamt')
    colors.push('#60a5fa')

    // Speicher
    const storStartIdx = labels.length
    storages.forEach((s) => {
      labels.push(s.name || (s.type === 'battery' ? 'Batterie' : s.type === 'heat' ? 'Wärmespeicher' : 'Kältespeicher'))
      colors.push(s.type === 'battery' ? '#8b5cf6' : s.type === 'heat' ? '#ef4444' : '#3b82f6')
    })

    // Verbraucher (Senken)
    const conStartIdx = labels.length
    consumers.forEach((c) => {
      labels.push(c.name || c.type)
      colors.push('#22c55e')
    })

    // Einspeisung
    const feedInIdx = labels.length
    labels.push('Netzeinspeisung')
    colors.push('#a78bfa')

    // Verluste
    const lossIdx = labels.length
    labels.push('Verluste')
    colors.push('#9ca3af')

    // --- Flüsse berechnen (Schätzwerte basierend auf Nennleistungen) ---

    // Netz -> Strom
    const totalConsumption = consumers.reduce((s, c) => s + c.annualConsumptionKwh, 0)
    let pvGeneration = 0
    let chpElectrical = 0
    let totalHeatGen = 0
    let totalColdGen = 0

    nonGridGens.forEach((g, i) => {
      const gIdx = genStartIdx + i
      switch (g.type) {
        case 'pv': {
          const pv = g as PvGenerator
          const est = pv.peakPowerKwp * 950 // kWh/kWp typical
          pvGeneration += est
          sources.push(gIdx); targets.push(electricIdx); values.push(est)
          linkColors.push('rgba(245, 158, 11, 0.4)')
          break
        }
        case 'chp': {
          const chp = g as ChpGenerator
          const hours = 4000 // typical running hours
          const elEst = chp.electricalPowerKw * hours
          const thEst = chp.thermalPowerKw * hours
          chpElectrical += elEst
          totalHeatGen += thEst
          sources.push(gIdx); targets.push(electricIdx); values.push(elEst)
          linkColors.push('rgba(249, 115, 22, 0.4)')
          sources.push(gIdx); targets.push(heatIdx); values.push(thEst)
          linkColors.push('rgba(239, 68, 68, 0.3)')
          break
        }
        case 'heat_pump': {
          const hp = g as HeatPumpGenerator
          const heatEst = hp.heatingPowerKw * 2000
          totalHeatGen += heatEst
          // Strom -> WP (als Verbraucher)
          const elConsumption = heatEst / hp.copRated
          sources.push(electricIdx); targets.push(gIdx); values.push(elConsumption)
          linkColors.push('rgba(239, 68, 68, 0.3)')
          sources.push(gIdx); targets.push(heatIdx); values.push(heatEst)
          linkColors.push('rgba(239, 68, 68, 0.3)')
          break
        }
        case 'boiler': {
          const b = g as BoilerGenerator
          const heatEst = b.nominalPowerKw * 1500
          totalHeatGen += heatEst
          sources.push(gIdx); targets.push(heatIdx); values.push(heatEst)
          linkColors.push('rgba(239, 68, 68, 0.3)')
          break
        }
        case 'chiller': {
          const ch = g as ChillerGenerator
          const coldEst = ch.coolingPowerKw * 800
          totalColdGen += coldEst
          const elConsumption = coldEst / ch.eerRated
          sources.push(electricIdx); targets.push(gIdx); values.push(elConsumption)
          linkColors.push('rgba(59, 130, 246, 0.3)')
          sources.push(gIdx); targets.push(coldIdx); values.push(coldEst)
          linkColors.push('rgba(59, 130, 246, 0.3)')
          break
        }
      }
    })

    // Netz -> Strom (Restbedarf)
    const totalGen = pvGeneration + chpElectrical
    const gridImport = Math.max(0, totalConsumption - totalGen * 0.7) // 30% Eigenverbrauch angenommen
    if (gridImport > 0) {
      sources.push(0); targets.push(electricIdx); values.push(gridImport)
      linkColors.push('rgba(99, 102, 241, 0.4)')
    }

    // Strom -> Verbraucher
    consumers.forEach((c, i) => {
      if (c.annualConsumptionKwh > 0) {
        sources.push(electricIdx); targets.push(conStartIdx + i); values.push(c.annualConsumptionKwh)
        linkColors.push('rgba(34, 197, 94, 0.3)')
      }
    })

    // Strom -> Batterie -> Strom (Eigenverbrauchsoptimierung)
    storages.forEach((s, i) => {
      const sIdx = storStartIdx + i
      if (s.type === 'battery') {
        const bat = s as BatteryStorage
        const cyclesPerYear = 250
        const throughput = bat.usableCapacityKwh * cyclesPerYear
        sources.push(electricIdx); targets.push(sIdx); values.push(throughput)
        linkColors.push('rgba(139, 92, 246, 0.3)')
        const discharged = throughput * bat.roundTripEfficiency
        sources.push(sIdx); targets.push(electricIdx); values.push(discharged)
        linkColors.push('rgba(139, 92, 246, 0.3)')
      } else {
        const th = s as ThermalStorage
        const stored = th.volumeLiters * 4.18 * (th.maxTemperatureC - th.minTemperatureC) / 3600 * 300 // ~300 cycles
        if (s.type === 'heat' && stored > 0) {
          sources.push(heatIdx); targets.push(sIdx); values.push(stored)
          linkColors.push('rgba(239, 68, 68, 0.2)')
        }
        if (s.type === 'cold' && stored > 0) {
          sources.push(coldIdx); targets.push(sIdx); values.push(stored)
          linkColors.push('rgba(59, 130, 246, 0.2)')
        }
      }
    })

    // Einspeisung
    const feedIn = Math.max(0, totalGen * 0.3) // ~30% Überschuss
    if (feedIn > 0) {
      sources.push(electricIdx); targets.push(feedInIdx); values.push(feedIn)
      linkColors.push('rgba(167, 139, 250, 0.4)')
    }

    // Verluste
    const totalLosses = totalGen * 0.05 // 5% Verluste
    if (totalLosses > 0) {
      sources.push(electricIdx); targets.push(lossIdx); values.push(totalLosses)
      linkColors.push('rgba(156, 163, 175, 0.3)')
    }

    // Filter: nur Einträge mit value > 0
    const filtered = sources.map((s, i) => ({ s, t: targets[i], v: values[i], c: linkColors[i] })).filter((e) => e.v > 0)

    return {
      labels,
      colors,
      sources: filtered.map((e) => e.s),
      targets: filtered.map((e) => e.t),
      values: filtered.map((e) => Math.round(e.v)),
      linkColors: filtered.map((e) => e.c),
    }
  }, [generators, consumers, storages, settings])

  useEffect(() => {
    if (!plotRef.current || sankeyData.values.length === 0) return

    const renderPlot = async () => {
      if (!Plotly) {
        Plotly = await import('plotly.js-dist-min')
      }
      plotlyLoaded.current = true

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
          Energieflussbilanz — geschätzte Jahreswerte basierend auf den konfigurierten Anlagenparametern
        </p>
      </div>

      {isEmpty ? (
        <div className="card text-center py-16">
          <BarChart3 className="w-16 h-16 text-dark-border mx-auto mb-4" />
          <p className="text-dark-faded text-lg">Noch keine Daten für das Sankey-Diagramm</p>
          <p className="text-sm text-dark-faded mt-2">
            Konfiguriere Erzeuger und Verbraucher, um die Energieflüsse zu visualisieren
          </p>
        </div>
      ) : (
        <div className="card">
          <div ref={plotRef} />
          <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs text-amber-400">
              <strong>Hinweis:</strong> Die dargestellten Werte sind Schätzungen basierend auf Nennleistungen und
              typischen Betriebsstunden. Reale Werte werden nach Inbetriebnahme des Systems durch Messdaten ersetzt.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
