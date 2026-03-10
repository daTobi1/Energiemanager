import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, Edit2, Battery, X, Copy, Thermometer, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Storage, StorageType, BatteryStorage, ThermalStorage, TemperatureSensor } from '../types'
import { createDefaultCommunication, createDefaultTemperatureSensor } from '../types'

const storageTypeOptions = [
  { value: 'battery', label: 'Batteriespeicher' },
  { value: 'heat', label: 'Wärmespeicher' },
  { value: 'cold', label: 'Kältespeicher' },
]

const batteryTechOptions = [
  { value: 'lithium_ion', label: 'Lithium-Ionen (NMC)' },
  { value: 'lfp', label: 'LiFePO4 (LFP)' },
  { value: 'lead_acid', label: 'Blei-Säure' },
  { value: 'redox_flow', label: 'Redox-Flow' },
  { value: 'sodium_ion', label: 'Natrium-Ionen' },
]

const sensorPositionOptions = [
  { value: 'top', label: 'Oben' },
  { value: 'upper_middle', label: 'Oben-Mitte' },
  { value: 'middle', label: 'Mitte' },
  { value: 'lower_middle', label: 'Unten-Mitte' },
  { value: 'bottom', label: 'Unten' },
  { value: 'flow', label: 'Vorlauf' },
  { value: 'return', label: 'Rücklauf' },
  { value: 'ambient', label: 'Umgebung' },
]

const sensorTypeOptions = [
  { value: 'PT100', label: 'PT100' },
  { value: 'PT1000', label: 'PT1000' },
  { value: 'NTC', label: 'NTC' },
  { value: 'KTY', label: 'KTY' },
  { value: 'digital', label: 'Digital (1-Wire / I²C)' },
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
    assignedMeterIds: [], notes: '',
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
    assignedMeterIds: [],
    stratificationEnabled: isHeat, numberOfLayers: isHeat ? 4 : 1,
    hasElectricalHeatingElement: isHeat,
    heatingElementPowerKw: isHeat ? 3 : 0,
    communication: createDefaultCommunication(),
    notes: '',
  }
}

export default function StoragePage() {
  const { storages, generators, consumers, meters, addStorage, updateStorage, removeStorage } = useEnergyStore()
  const [editing, setEditing] = useState<Storage | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { navigateToCreate, isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

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
  const update = (key: string, value: unknown) => {
    if (editing) setEditing({ ...editing, [key]: value } as Storage)
  }

  const generatorOptions = generators.map((g) => ({ value: g.id, label: g.name || 'Unbenannt' }))
  const consumerOptions = consumers.map((c) => ({ value: c.id, label: c.name || 'Unbenannt' }))
  const meterOptions = meters.map((m) => ({ value: m.id, label: `${m.name} (${m.meterNumber || '-'})` }))

  if (showForm && editing) {
    const isBattery = editing.type === 'battery'
    const isThermal = editing.type === 'heat' || editing.type === 'cold'

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
          <Section title="Grunddaten" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder={isBattery ? 'z.B. Hausbatterie' : 'z.B. Pufferspeicher'} />
              <SelectField label="Typ" value={editing.type} onChange={(v) => {
                const s = v === 'battery' ? createDefaultBattery() : createDefaultThermal(v as 'heat' | 'cold')
                setEditing({ ...s, id: editing.id, name: editing.name })
              }} options={storageTypeOptions} />
            </div>
            {isBattery && (
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Hersteller" value={(editing as BatteryStorage).manufacturer} onChange={(v) => update('manufacturer', v)} />
                <InputField label="Modell" value={(editing as BatteryStorage).model} onChange={(v) => update('model', v)} />
                <SelectField label="Technologie" value={(editing as BatteryStorage).technology} onChange={(v) => update('technology', v)} options={batteryTechOptions} />
              </div>
            )}
          </Section>

          {/* Batterie-spezifisch */}
          {isBattery && (
            <>
              <Section title="Kapazität & Leistung" defaultOpen={true} badge="Batterie">
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Kapazität (gesamt)" value={(editing as BatteryStorage).capacityKwh} onChange={(v) => update('capacityKwh', Number(v))} type="number" unit="kWh" step="0.1" />
                  <InputField label="Nutzbare Kapazität" value={(editing as BatteryStorage).usableCapacityKwh} onChange={(v) => update('usableCapacityKwh', Number(v))} type="number" unit="kWh" step="0.1" />
                  <InputField label="Nennspannung" value={(editing as BatteryStorage).nominalVoltageV} onChange={(v) => update('nominalVoltageV', Number(v))} type="number" unit="V" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Max. Ladeleistung" value={(editing as BatteryStorage).maxChargePowerKw} onChange={(v) => update('maxChargePowerKw', Number(v))} type="number" unit="kW" step="0.1" />
                  <InputField label="Max. Entladeleistung" value={(editing as BatteryStorage).maxDischargePowerKw} onChange={(v) => update('maxDischargePowerKw', Number(v))} type="number" unit="kW" step="0.1" />
                  <InputField label="Max. Strom" value={(editing as BatteryStorage).maxCurrentA} onChange={(v) => update('maxCurrentA', Number(v))} type="number" unit="A" />
                </div>
              </Section>

              <Section title="Wirkungsgrade & SoC" defaultOpen={true}>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Lade-Wirkungsgrad" value={(editing as BatteryStorage).chargeEfficiency} onChange={(v) => update('chargeEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
                  <InputField label="Entlade-Wirkungsgrad" value={(editing as BatteryStorage).dischargeEfficiency} onChange={(v) => update('dischargeEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
                  <InputField label="Roundtrip-Wirkungsgrad" value={(editing as BatteryStorage).roundTripEfficiency} onChange={(v) => update('roundTripEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Min. SoC" value={(editing as BatteryStorage).minSocPercent} onChange={(v) => update('minSocPercent', Number(v))} type="number" unit="%" min={0} max={100} hint="Tiefentladeschutz" />
                  <InputField label="Max. SoC" value={(editing as BatteryStorage).maxSocPercent} onChange={(v) => update('maxSocPercent', Number(v))} type="number" unit="%" min={0} max={100} hint="Obergrenze für Lebensdauer" />
                  <InputField label="Initialer SoC" value={(editing as BatteryStorage).initialSocPercent} onChange={(v) => update('initialSocPercent', Number(v))} type="number" unit="%" min={0} max={100} />
                </div>
              </Section>

              <Section title="Lebensdauer & C-Rate" defaultOpen={false}>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Erwartete Zyklen" value={(editing as BatteryStorage).cycleLifeExpected} onChange={(v) => update('cycleLifeExpected', Number(v))} type="number" hint="Bei 80% DoD" />
                  <InputField label="Aktuelle Zyklen" value={(editing as BatteryStorage).currentCycles} onChange={(v) => update('currentCycles', Number(v))} type="number" />
                  <InputField label="Kalendarische Lebensdauer" value={(editing as BatteryStorage).calendarLifeYears} onChange={(v) => update('calendarLifeYears', Number(v))} type="number" unit="Jahre" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Max. DoD" value={(editing as BatteryStorage).maxDoD} onChange={(v) => update('maxDoD', Number(v))} type="number" step="0.05" min={0} max={1} hint="Depth of Discharge" />
                  <InputField label="C-Rate Laden" value={(editing as BatteryStorage).cRateCharge} onChange={(v) => update('cRateCharge', Number(v))} type="number" step="0.1" hint="z.B. 0.5C = halbe Kapazität/h" />
                  <InputField label="C-Rate Entladen" value={(editing as BatteryStorage).cRateDischarge} onChange={(v) => update('cRateDischarge', Number(v))} type="number" step="0.1" />
                </div>
                <InputField label="Selbstentladung" value={(editing as BatteryStorage).selfDischargePerMonth} onChange={(v) => update('selfDischargePerMonth', Number(v))} type="number" unit="%/Monat" step="0.1" />
              </Section>
            </>
          )}

          {/* Thermische Speicher */}
          {isThermal && (
            <>
              <Section title="Speicher-Geometrie" defaultOpen={true} badge={editing.type === 'heat' ? 'Wärme' : 'Kälte'}>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Volumen" value={(editing as ThermalStorage).volumeLiters} onChange={(v) => update('volumeLiters', Number(v))} type="number" unit="Liter" />
                  <InputField label="Höhe" value={(editing as ThermalStorage).heightMm} onChange={(v) => update('heightMm', Number(v))} type="number" unit="mm" />
                  <InputField label="Durchmesser" value={(editing as ThermalStorage).diameterMm} onChange={(v) => update('diameterMm', Number(v))} type="number" unit="mm" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Isolierdicke" value={(editing as ThermalStorage).insulationThicknessMm} onChange={(v) => update('insulationThicknessMm', Number(v))} type="number" unit="mm" />
                  <InputField label="Isoliermaterial" value={(editing as ThermalStorage).insulationMaterial} onChange={(v) => update('insulationMaterial', v)} placeholder="z.B. PU-Schaum, Mineralwolle" />
                  <InputField label="Umgebungstemperatur" value={(editing as ThermalStorage).ambientTemperatureC} onChange={(v) => update('ambientTemperatureC', Number(v))} type="number" unit="°C" hint="Aufstellort" />
                </div>
              </Section>

              <Section title="Temperaturgrenzen" defaultOpen={true}>
                <div className="grid grid-cols-4 gap-4">
                  <InputField label="Min. Temperatur" value={(editing as ThermalStorage).minTemperatureC} onChange={(v) => update('minTemperatureC', Number(v))} type="number" unit="°C" />
                  <InputField label="Max. Temperatur" value={(editing as ThermalStorage).maxTemperatureC} onChange={(v) => update('maxTemperatureC', Number(v))} type="number" unit="°C" />
                  <InputField label="Solltemperatur" value={(editing as ThermalStorage).targetTemperatureC} onChange={(v) => update('targetTemperatureC', Number(v))} type="number" unit="°C" />
                  <InputField label="Hysterese" value={(editing as ThermalStorage).hysteresisK} onChange={(v) => update('hysteresisK', Number(v))} type="number" unit="K" hint="Schaltdifferenz" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Wärmeverlust-Koeffizient (UA)" value={(editing as ThermalStorage).heatLossCoefficientWPerK} onChange={(v) => update('heatLossCoefficientWPerK', Number(v))} type="number" unit="W/K" step="0.1" hint="Wärmeverlustleistung pro Kelvin Differenz" />
                  <InputField label="Spez. Wärmekapazität" value={(editing as ThermalStorage).specificHeatCapacity} onChange={(v) => update('specificHeatCapacity', Number(v))} type="number" unit="kJ/(kg·K)" step="0.01" hint="Wasser: 4.18" />
                </div>
              </Section>

              <Section title="Schichtung" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxField label="Schichtenspeicher" checked={(editing as ThermalStorage).stratificationEnabled} onChange={(v) => update('stratificationEnabled', v)} hint="Temperaturschichtung berücksichtigen" />
                  {(editing as ThermalStorage).stratificationEnabled && (
                    <InputField label="Anzahl Schichten" value={(editing as ThermalStorage).numberOfLayers} onChange={(v) => update('numberOfLayers', Number(v))} type="number" min={2} max={10} hint="Modell-Schichten" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxField label="Elektro-Heizstab vorhanden" checked={(editing as ThermalStorage).hasElectricalHeatingElement} onChange={(v) => update('hasElectricalHeatingElement', v)} hint="Für PV-Eigenverbrauchsoptimierung" />
                  {(editing as ThermalStorage).hasElectricalHeatingElement && (
                    <InputField label="Heizstab-Leistung" value={(editing as ThermalStorage).heatingElementPowerKw} onChange={(v) => update('heatingElementPowerKw', Number(v))} type="number" unit="kW" step="0.5" />
                  )}
                </div>
              </Section>

              {/* Temperatursensoren */}
              <Section title="Temperatursensoren" defaultOpen={true} badge={`${(editing as ThermalStorage).temperatureSensors.length} Sensoren`}>
                <p className="text-sm text-dark-faded mb-3">Temperatursensoren für die Speicherüberwachung und selbstlernende Regelung</p>
                {(editing as ThermalStorage).temperatureSensors.map((sensor, i) => (
                  <div key={sensor.id} className="p-3 bg-dark-hover rounded-lg mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-dark-muted">Sensor {i + 1}</span>
                      <button onClick={() => {
                        const sensors = (editing as ThermalStorage).temperatureSensors.filter((_, j) => j !== i)
                        update('temperatureSensors', sensors)
                      }} className="btn-danger text-xs">Entfernen</button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <InputField label="Name" value={sensor.name} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], name: v }
                        update('temperatureSensors', sensors)
                      }} />
                      <SelectField label="Position" value={sensor.position} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], position: v as TemperatureSensor['position'] }
                        update('temperatureSensors', sensors)
                      }} options={sensorPositionOptions} />
                      <SelectField label="Sensortyp" value={sensor.sensorType} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], sensorType: v as TemperatureSensor['sensorType'] }
                        update('temperatureSensors', sensors)
                      }} options={sensorTypeOptions} />
                      <InputField label="Offset" value={sensor.offsetCorrection} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], offsetCorrection: Number(v) }
                        update('temperatureSensors', sensors)
                      }} type="number" unit="K" step="0.1" hint="Kalibrierung" />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <SelectField label="Protokoll" value={sensor.communication.protocol} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, protocol: v as TemperatureSensor['communication']['protocol'] } }
                        update('temperatureSensors', sensors)
                      }} options={[
                        { value: 'modbus_tcp', label: 'Modbus TCP' },
                        { value: 'mqtt', label: 'MQTT' },
                        { value: 'http_rest', label: 'HTTP/REST' },
                      ]} />
                      <InputField label="IP-Adresse" value={sensor.communication.ipAddress} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, ipAddress: v } }
                        update('temperatureSensors', sensors)
                      }} placeholder="192.168.1.x" />
                      <InputField label="Port" value={sensor.communication.port} onChange={(v) => {
                        const sensors = [...(editing as ThermalStorage).temperatureSensors]
                        sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, port: Number(v) } }
                        update('temperatureSensors', sensors)
                      }} type="number" />
                    </div>
                  </div>
                ))}
                <button onClick={() => {
                  const sensors = [...(editing as ThermalStorage).temperatureSensors, {
                    ...createDefaultTemperatureSensor(), id: uuid(), name: `Sensor ${(editing as ThermalStorage).temperatureSensors.length + 1}`,
                  }]
                  update('temperatureSensors', sensors)
                }} className="btn-secondary text-sm">+ Sensor hinzufügen</button>
              </Section>

            </>
          )}

          {/* Anschlüsse für alle Speichertypen */}
          <Section title="Anschlüsse / Zuordnungen" defaultOpen={true}>
            <p className="text-sm text-dark-faded mb-3">Welche Quellen und Verbraucher sind mit diesem Speicher verbunden?</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Verbundene Quellen</label>
                <div className="space-y-2">
                  {isBattery && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.connectedGeneratorIds.includes('grid')}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...editing.connectedGeneratorIds, 'grid']
                            : editing.connectedGeneratorIds.filter((id) => id !== 'grid')
                          update('connectedGeneratorIds', ids)
                        }}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      Netz (Hausanschluss)
                    </label>
                  )}
                  {generatorOptions.map((g) => (
                    <label key={g.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.connectedGeneratorIds.includes(g.value)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...editing.connectedGeneratorIds, g.value]
                            : editing.connectedGeneratorIds.filter((id) => id !== g.value)
                          update('connectedGeneratorIds', ids)
                        }}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      {g.label}
                    </label>
                  ))}
                  {generatorOptions.length === 0 && !isBattery && (
                    <button
                      onClick={() => navigateToCreate({ targetPath: '/generators', assignField: 'connectedGeneratorIds', assignMode: 'append', draft: editing })}
                      className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Erzeuger jetzt anlegen</span>
                    </button>
                  )}
                  {generatorOptions.length > 0 && (
                    <button onClick={() => navigateToCreate({ targetPath: '/generators', assignField: 'connectedGeneratorIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1">
                      <Plus className="w-3 h-3" /> Neuen Erzeuger anlegen
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Verbundene Verbraucher</label>
                <div className="space-y-2">
                  {consumerOptions.map((c) => (
                    <label key={c.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.connectedConsumerIds.includes(c.value)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...editing.connectedConsumerIds, c.value]
                            : editing.connectedConsumerIds.filter((id) => id !== c.value)
                          update('connectedConsumerIds', ids)
                        }}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      {c.label}
                    </label>
                  ))}
                  {consumerOptions.length === 0 && (
                    <button
                      onClick={() => navigateToCreate({ targetPath: '/consumers', assignField: 'connectedConsumerIds', assignMode: 'append', draft: editing })}
                      className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Verbraucher jetzt anlegen</span>
                    </button>
                  )}
                  {consumerOptions.length > 0 && (
                    <button onClick={() => navigateToCreate({ targetPath: '/consumers', assignField: 'connectedConsumerIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1">
                      <Plus className="w-3 h-3" /> Neuen Verbraucher anlegen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Zähler-Zuordnung" defaultOpen={true}>
            {meterOptions.length > 0 ? (
              <div>
                <SelectField
                  label="Zugeordneter Zähler"
                  value={editing.assignedMeterIds[0] || ''}
                  onChange={(v) => update('assignedMeterIds', v ? [v] : [])}
                  options={meterOptions}
                />
                <button onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'assignedMeterIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1"><Plus className="w-3 h-3" /> Neuen Zähler anlegen</button>
              </div>
            ) : (
              <div>
                <label className="label">Zugeordneter Zähler</label>
                <button
                  onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'assignedMeterIds', assignMode: 'append', draft: editing })}
                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Zähler jetzt anlegen</span>
                </button>
              </div>
            )}
          </Section>

          <CommunicationForm config={editing.communication} onChange={(c) => update('communication', c)} />

          <Section title="Notizen" defaultOpen={false}>
            <TextareaField label="Bemerkungen" value={editing.notes} onChange={(v) => update('notes', v)} />
          </Section>

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
