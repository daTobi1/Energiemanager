import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Edit2, Sun, Flame, Thermometer, Snowflake, Zap, X, Copy, ArrowLeft, Plus } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { GeneratorForm } from '../components/forms/GeneratorForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type {
  Generator, GeneratorType,
  EnergyPort,
} from '../types'
import { createDefaultCommunication } from '../types'
import { mkPort } from '../components/ui/PortEditor'

const typeOptions = [
  { value: 'grid', label: 'Hausanschluss (Netzanschluss)' },
  { value: 'pv', label: 'PV-Anlage (Photovoltaik)' },
  { value: 'chp', label: 'BHKW (Kraft-Wärme-Kopplung)' },
  { value: 'heat_pump', label: 'Wärmepumpe' },
  { value: 'boiler', label: 'Heizkessel' },
  { value: 'chiller', label: 'Kältemaschine' },
]

const heatPumpTypeOptions = [
  { value: 'air_water', label: 'Luft/Wasser' },
  { value: 'brine_water', label: 'Sole/Wasser' },
  { value: 'water_water', label: 'Wasser/Wasser' },
]

const typeIcons: Record<GeneratorType, typeof Sun> = {
  grid: Zap,
  pv: Sun,
  chp: Flame,
  heat_pump: Thermometer,
  boiler: Flame,
  chiller: Snowflake,
}

const typeColors: Record<GeneratorType, string> = {
  grid: 'bg-blue-500/15 text-blue-400',
  pv: 'bg-amber-500/15 text-amber-400',
  chp: 'bg-orange-500/15 text-orange-400',
  heat_pump: 'bg-red-500/15 text-red-400',
  boiler: 'bg-red-500/15 text-red-400',
  chiller: 'bg-blue-500/15 text-blue-400',
}

const typeLabels: Record<GeneratorType, string> = {
  grid: 'Hausanschluss',
  pv: 'PV-Anlage',
  chp: 'BHKW',
  heat_pump: 'Wärmepumpe',
  boiler: 'Heizkessel',
  chiller: 'Kältemaschine',
}

function createDefaultPorts(type: GeneratorType, coolingCapable = false): EnergyPort[] {
  switch (type) {
    case 'grid':      return [mkPort('input', 'electricity', 'Netzbezug'), mkPort('output', 'electricity', 'Einspeisung')]
    case 'pv':        return [mkPort('output', 'electricity', 'Strom')]
    case 'chp':       return [mkPort('input', 'gas', 'Erdgas'), mkPort('output', 'electricity', 'Strom'), mkPort('output', 'heat', 'Heizwärme')]
    case 'heat_pump': {
      const ports = [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'source', 'Quellenenergie'), mkPort('output', 'heat', 'Heizwärme')]
      if (coolingCapable) ports.push(mkPort('output', 'cold', 'Kälte'))
      return ports
    }
    case 'boiler':    return [mkPort('input', 'gas', 'Erdgas'), mkPort('output', 'heat', 'Heizwärme')]
    case 'chiller':   return [mkPort('input', 'electricity', 'Strom'), mkPort('output', 'cold', 'Kälte')]
  }
}

function createDefaultGenerator(type: GeneratorType): Generator {
  const base = {
    id: uuid(),
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    commissioningDate: '',
    location: '',
    notes: '',
    communication: createDefaultCommunication(),
    assignedMeterIds: [],
    ports: createDefaultPorts(type),
    connectedGeneratorIds: [],
  }
  switch (type) {
    case 'grid':
      return {
        ...base, type: 'grid', energyForm: 'electricity',
        gridMaxPowerKw: 30, gridPhases: 3, gridVoltageV: 400,
        feedInLimitPercent: 100, feedInLimitKw: 0,
        gridOperator: '', meterPointId: '',
      }
    case 'pv':
      return {
        ...base, type: 'pv', energyForm: 'electricity',
        peakPowerKwp: 10, numberOfModules: 25, moduleType: '', modulePowerWp: 400,
        inverterType: '', inverterPowerKw: 10, numberOfInverters: 1, mppTrackers: 2,
        azimuthDeg: 0, tiltDeg: 30, efficiency: 0.85,
        degradationPerYear: 0.5, temperatureCoefficient: -0.35, albedo: 0.2,
      }
    case 'chp':
      return {
        ...base, type: 'chp', energyForm: 'electricity_heat',
        electricalPowerKw: 5.5, thermalPowerKw: 12.5, fuelType: 'natural_gas',
        electricalEfficiency: 0.33, thermalEfficiency: 0.55, overallEfficiency: 0.88,
        modulationMinPercent: 50, modulationMaxPercent: 100,
        minimumRunTimeMin: 30, minimumOffTimeMin: 15, startCostEur: 0.50,
        maintenanceIntervalHours: 4000, currentOperatingHours: 0,
        fuelCostCtPerKwh: 8, powerToHeatRatio: 0.44,
      }
    case 'heat_pump':
      return {
        ...base, type: 'heat_pump', energyForm: 'heat',
        heatPumpType: 'air_water', heatingPowerKw: 10, coolingCapable: false,
        coolingPowerKw: 0, electricalPowerKw: 2.5, copRated: 4.0, copCurve: [
          { outdoorTempC: -15, cop: 2.2 }, { outdoorTempC: -7, cop: 2.8 },
          { outdoorTempC: 2, cop: 3.5 }, { outdoorTempC: 7, cop: 4.0 },
          { outdoorTempC: 15, cop: 4.8 }, { outdoorTempC: 20, cop: 5.2 },
        ],
        minOutdoorTempC: -25, maxOutdoorTempC: 40,
        flowTemperatureC: 35, returnTemperatureC: 28,
        modulationMinPercent: 30, modulationMaxPercent: 100,
        defrostPowerKw: 1.0, sgReadyEnabled: false,
        bivalencePointC: -5, refrigerant: 'R290',
      }
    case 'boiler':
      return {
        ...base, type: 'boiler', energyForm: 'heat',
        fuelType: 'natural_gas', nominalPowerKw: 20, efficiency: 0.95,
        modulationMinPercent: 30, modulationMaxPercent: 100,
        condensing: true, flowTemperatureMaxC: 80, returnTemperatureMinC: 30,
        minimumRunTimeMin: 5, fuelCostCtPerKwh: 8, flueGasLosses: 0.05,
      }
    case 'chiller':
      return {
        ...base, type: 'chiller', energyForm: 'cold',
        coolingPowerKw: 20, electricalPowerKw: 6, eerRated: 3.5, seerRated: 5.0,
        coolantType: 'Wasser/Glykol', refrigerant: 'R410A',
        flowTemperatureC: 6, returnTemperatureC: 12,
        modulationMinPercent: 25, modulationMaxPercent: 100,
        minOutdoorTempC: -10, maxOutdoorTempC: 45,
      }
  }
}

function getGeneratorSummary(g: Generator): string {
  switch (g.type) {
    case 'grid': return `${g.gridMaxPowerKw} kW, ${g.gridVoltageV}V${g.gridOperator ? `, ${g.gridOperator}` : ''}`
    case 'pv': return `${g.peakPowerKwp} kWp, ${g.numberOfModules} Module, ${g.azimuthDeg}° / ${g.tiltDeg}°`
    case 'chp': return `${g.electricalPowerKw} kW(el) / ${g.thermalPowerKw} kW(th)`
    case 'heat_pump': return `${g.heatingPowerKw} kW, COP ${g.copRated}, ${heatPumpTypeOptions.find(o => o.value === g.heatPumpType)?.label}`
    case 'boiler': return `${g.nominalPowerKw} kW, ${g.condensing ? 'Brennwert' : 'Heizwert'}`
    case 'chiller': return `${g.coolingPowerKw} kW, EER ${g.eerRated}`
  }
}

export default function GeneratorsPage() {
  const { generators, addGenerator, updateGenerator, removeGenerator } = useEnergyStore()
  const [editing, setEditing] = useState<Generator | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: GeneratorType) => {
    setEditing(createDefaultGenerator(type))
    setShowForm(true)
  }

  const startEdit = (g: Generator) => {
    setEditing({ ...g })
    setShowForm(true)
  }

  const hasGrid = generators.some((g) => g.type === 'grid')

  const duplicate = (g: Generator) => {
    if (g.type === 'grid') return // Nur ein Hausanschluss erlaubt
    const copy = { ...g, id: uuid(), name: g.name + ' (Kopie)' }
    addGenerator(copy as Generator)
  }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd('pv') // default type for auto-open
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const g = generators.find((g) => g.id === flowEditId)
      if (g) startEdit(g)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      startAdd('pv')
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft }
      if (pendingReturn.assignMode === 'single') {
        (draft as any)[pendingReturn.assignField] = pendingReturn.createdEntityId
      } else {
        (draft as any)[pendingReturn.assignField] = [...((draft as any)[pendingReturn.assignField] || []), pendingReturn.createdEntityId]
      }
      setEditing(draft)
      setShowForm(true)
      clearPendingCreation()
    }
  }, [pendingReturn])

  const save = () => {
    if (!editing) return
    const exists = generators.find((g) => g.id === editing.id)
    if (exists) {
      updateGenerator(editing.id, editing)
    } else {
      addGenerator(editing)
    }

    // If we are a creation target, save and navigate back
    if (isCreationTarget) {
      saveAndReturn(editing.id)
      return
    }

    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }

    setShowForm(false)
    setEditing(null)
  }

  const cancel = () => {
    if (isCreationTarget) {
      cancelAndReturn()
      return
    }
    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }
    setShowForm(false)
    setEditing(null)
  }

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">
            {generators.find((g) => g.id === editing.id) ? 'Erzeuger bearbeiten' : 'Neuer Erzeuger'}
          </h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Erzeuger und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          <GeneratorForm entity={editing} onChange={setEditing} hasGrid={hasGrid} />
          <div className="flex gap-3 pt-4 border-t">
            <button onClick={save} className="btn-primary" disabled={!editing.name}>Speichern</button>
            <button onClick={cancel} className="btn-secondary">Abbrechen</button>
          </div>
        </div>
      </div>
    )
  }

  // Listenansicht
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header">Erzeuger</h1>
          <p className="text-sm text-dark-faded mt-1">Alle Energieerzeuger der Anlage konfigurieren</p>
        </div>
      </div>

      {/* Typ-Auswahl zum Hinzufügen */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {typeOptions.filter(({ value }) => !(value === 'grid' && hasGrid)).map(({ value, label }) => {
          const Icon = typeIcons[value as GeneratorType]
          return (
            <button
              key={value}
              onClick={() => startAdd(value as GeneratorType)}
              className="card hover:border-emerald-500/50 hover:shadow-md transition-all flex items-center gap-3 py-3 px-4 cursor-pointer"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[value as GeneratorType]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <Plus className="w-4 h-4 text-dark-faded ml-auto" />
            </button>
          )
        })}
      </div>

      {/* Liste */}
      {generators.length === 0 ? (
        <div className="card text-center py-12">
          <Sun className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Erzeuger konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Wähle oben einen Typ aus, um einen Erzeuger hinzuzufügen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generators.map((g) => {
            const Icon = typeIcons[g.type]
            return (
              <div key={g.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[g.type]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-text">{g.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[g.type]}</span>
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">{getGeneratorSummary(g)}</p>
                  {g.manufacturer && <p className="text-xs text-dark-faded mt-0.5">{g.manufacturer} {g.model}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => duplicate(g)} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(g)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeGenerator(g.id)} itemName={g.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
