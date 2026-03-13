import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Battery, X, Copy, Thermometer, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { StorageForm } from '../components/forms/StorageForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Storage, StorageType, BatteryStorage, ThermalStorage, EnergyPort } from '../types'
import { createDefaultCommunication, createDefaultTemperatureSensor } from '../types'
import { mkPort } from '../components/ui/PortEditor'

const storageTypeOptions = [
  { value: 'battery', label: 'Batteriespeicher' },
  { value: 'heat', label: 'Wärmespeicher' },
  { value: 'cold', label: 'Kältespeicher' },
]

const typeColors: Record<StorageType, string> = {
  battery: 'bg-purple-500/15 text-purple-400',
  heat: 'bg-red-500/15 text-red-400',
  cold: 'bg-blue-500/15 text-blue-400',
}

const typeIcons: Record<StorageType, typeof Battery> = {
  battery: Battery,
  heat: Thermometer,
  cold: Snowflake,
}

const typeLabels: Record<StorageType, string> = {
  battery: 'Batterie',
  heat: 'Wärmespeicher',
  cold: 'Kältespeicher',
}

function createDefaultStoragePorts(type: StorageType): EnergyPort[] {
  switch (type) {
    case 'battery': return [mkPort('input', 'electricity', 'Laden'), mkPort('output', 'electricity', 'Entladen')]
    case 'heat':    return [mkPort('input', 'heat', 'Wärmeeintrag'), mkPort('output', 'heat', 'Wärmeentnahme')]
    case 'cold':    return [mkPort('input', 'cold', 'Kälteeintrag'), mkPort('output', 'cold', 'Kälteentnahme')]
  }
}

function createDefaultBattery(): BatteryStorage {
  return {
    id: uuid(), name: '', type: 'battery',
    manufacturer: '', model: '', technology: 'lfp',
    capacityKwh: 10, usableCapacityKwh: 9.5,
    maxChargePowerKw: 5, maxDischargePowerKw: 5,
    chargeEfficiency: 0.95, dischargeEfficiency: 0.95, roundTripEfficiency: 0.90,
    minSocPercent: 10, maxSocPercent: 90, initialSocPercent: 50,
    nominalVoltageV: 48, maxCurrentA: 100,
    cycleLifeExpected: 6000, currentCycles: 0, calendarLifeYears: 15,
    maxDoD: 0.9, cRateCharge: 0.5, cRateDischarge: 0.5, selfDischargePerMonth: 2,
    temperatureSensors: [],
    connectedGeneratorIds: [], connectedConsumerIds: [],
    communication: createDefaultCommunication(),
    assignedMeterIds: [], ports: createDefaultStoragePorts('battery'), notes: '',
  }
}

function createDefaultThermal(type: 'heat' | 'cold'): ThermalStorage {
  const isHeat = type === 'heat'
  return {
    id: uuid(), name: '', type,
    volumeLiters: isHeat ? 1000 : 500,
    heightMm: 1800, diameterMm: 800,
    maxTemperatureC: isHeat ? 90 : 20,
    minTemperatureC: isHeat ? 30 : 4,
    targetTemperatureC: isHeat ? 60 : 8,
    hysteresisK: 3,
    heatLossCoefficientWPerK: isHeat ? 2.5 : 1.5,
    insulationThicknessMm: 100, insulationMaterial: isHeat ? 'PU-Schaum' : 'PU-Schaum',
    ambientTemperatureC: 20,
    specificHeatCapacity: 4.18,
    temperatureSensors: [
      { ...createDefaultTemperatureSensor(), id: uuid(), name: 'Oben', position: 'top' },
      { ...createDefaultTemperatureSensor(), id: uuid(), name: 'Mitte', position: 'middle' },
      { ...createDefaultTemperatureSensor(), id: uuid(), name: 'Unten', position: 'bottom' },
    ],
    connectedGeneratorIds: [], connectedConsumerIds: [],
    assignedMeterIds: [], ports: createDefaultStoragePorts(type),
    stratificationEnabled: isHeat, numberOfLayers: isHeat ? 4 : 1,
    hasElectricalHeatingElement: isHeat,
    heatingElementPowerKw: isHeat ? 3 : 0,
    communication: createDefaultCommunication(),
    notes: '',
  }
}

export default function StoragePage() {
  const { storages, addStorage, updateStorage, removeStorage } = useEnergyStore()
  const [editing, setEditing] = useState<Storage | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: StorageType) => {
    const s = type === 'battery' ? createDefaultBattery() : createDefaultThermal(type as 'heat' | 'cold')
    setEditing(s)
    setShowForm(true)
  }
  const startEdit = (s: Storage) => { setEditing(JSON.parse(JSON.stringify(s))); setShowForm(true) }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd('battery')
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const s = storages.find((s) => s.id === flowEditId)
      if (s) startEdit(s)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      startAdd('battery')
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft } as Storage
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
    if (storages.find((s) => s.id === editing.id)) updateStorage(editing.id, editing)
    else addStorage(editing)

    if (isCreationTarget) {
      saveAndReturn(editing.id)
      return
    }

    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }

    setShowForm(false); setEditing(null)
  }
  const cancel = () => {
    if (isCreationTarget) {
      cancelAndReturn()
      return
    }
    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }
    setShowForm(false); setEditing(null)
  }
  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{storages.find((s) => s.id === editing.id) ? 'Speicher bearbeiten' : 'Neuer Speicher'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Speicher und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          <StorageForm entity={editing} onChange={setEditing} />
          <div className="flex gap-3 pt-4 border-t">
            <button onClick={save} className="btn-primary" disabled={!editing.name}>Speichern</button>
            <button onClick={cancel} className="btn-secondary">Abbrechen</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header">Speicher</h1>
          <p className="text-sm text-dark-faded mt-1">Batterie-, Wärme- und Kältespeicher konfigurieren</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {storageTypeOptions.map(({ value, label }) => {
          const Icon = typeIcons[value as StorageType]
          return (
            <button key={value} onClick={() => startAdd(value as StorageType)}
              className="card hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col items-center gap-2 py-6 cursor-pointer">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${typeColors[value as StorageType]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="font-medium">{label}</span>
              <Plus className="w-4 h-4 text-dark-faded" />
            </button>
          )
        })}
      </div>

      {storages.length === 0 ? (
        <div className="card text-center py-12">
          <Battery className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Speicher konfiguriert</p>
        </div>
      ) : (
        <div className="space-y-3">
          {storages.map((s) => {
            const Icon = typeIcons[s.type]
            const summary = s.type === 'battery'
              ? `${(s as BatteryStorage).capacityKwh} kWh, ${(s as BatteryStorage).maxChargePowerKw}/${(s as BatteryStorage).maxDischargePowerKw} kW, ${(s as BatteryStorage).technology.toUpperCase()}`
              : `${(s as ThermalStorage).volumeLiters} L, ${(s as ThermalStorage).minTemperatureC}-${(s as ThermalStorage).maxTemperatureC}°C, ${(s as ThermalStorage).temperatureSensors.length} Sensoren`
            return (
              <div key={s.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[s.type]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-text">{s.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[s.type]}</span>
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">{summary}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { addStorage({ ...s, id: uuid(), name: s.name + ' (Kopie)' } as Storage) }} className="btn-icon"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(s)} className="btn-icon"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeStorage(s.id)} itemName={s.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
