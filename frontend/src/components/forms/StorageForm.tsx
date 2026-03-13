import { v4 as uuid } from 'uuid'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type { Storage, StorageType, BatteryStorage, ThermalStorage, TemperatureSensor, EnergyPort } from '../../types'
import { createDefaultCommunication, createDefaultTemperatureSensor } from '../../types'
import { mkPort } from '../ui/PortEditor'

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

function createDefaultStoragePorts(type: StorageType): EnergyPort[] {
  switch (type) {
    case 'battery': return [mkPort('input', 'electricity', 'Laden'), mkPort('output', 'electricity', 'Entladen')]
    case 'heat':    return [mkPort('input', 'heat', 'Wärmeeintrag'), mkPort('output', 'heat', 'Wärmeentnahme')]
    case 'cold':    return [mkPort('input', 'cold', 'Kälteeintrag'), mkPort('output', 'cold', 'Kälteentnahme')]
  }
}

function createDefaultBattery(): BatteryStorage {
  return {
    id: '', name: '', type: 'battery',
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
    id: '', name: '', type,
    volumeLiters: isHeat ? 1000 : 500,
    heightMm: 1800, diameterMm: 800,
    maxTemperatureC: isHeat ? 90 : 20,
    minTemperatureC: isHeat ? 30 : 4,
    targetTemperatureC: isHeat ? 60 : 8,
    hysteresisK: 3,
    heatLossCoefficientWPerK: isHeat ? 2.5 : 1.5,
    insulationThicknessMm: 100, insulationMaterial: 'PU-Schaum',
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
    communication: createDefaultCommunication(), notes: '',
  }
}

interface Props {
  entity: Storage
  onChange: (entity: Storage) => void
}

export function StorageForm({ entity, onChange }: Props) {
  const update = (key: string, value: unknown) => {
    onChange({ ...entity, [key]: value } as Storage)
  }

  const isBattery = entity.type === 'battery'
  const isThermal = entity.type === 'heat' || entity.type === 'cold'

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder={isBattery ? 'z.B. Hausbatterie' : 'z.B. Pufferspeicher'} />
          <SelectField label="Typ" value={entity.type} onChange={(v) => {
            const s = v === 'battery' ? createDefaultBattery() : createDefaultThermal(v as 'heat' | 'cold')
            onChange({ ...s, id: entity.id, name: entity.name, ports: createDefaultStoragePorts(v as StorageType) })
          }} options={storageTypeOptions} />
        </div>
        {isBattery && (
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Hersteller" value={(entity as BatteryStorage).manufacturer} onChange={(v) => update('manufacturer', v)} />
            <InputField label="Modell" value={(entity as BatteryStorage).model} onChange={(v) => update('model', v)} />
            <SelectField label="Technologie" value={(entity as BatteryStorage).technology} onChange={(v) => update('technology', v)} options={batteryTechOptions} />
          </div>
        )}
      </Section>

      {isBattery && (
        <>
          <Section title="Kapazität & Leistung" defaultOpen={true} badge="Batterie">
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Kapazität (gesamt)" value={(entity as BatteryStorage).capacityKwh} onChange={(v) => update('capacityKwh', Number(v))} type="number" unit="kWh" step="0.1" />
              <InputField label="Nutzbare Kapazität" value={(entity as BatteryStorage).usableCapacityKwh} onChange={(v) => update('usableCapacityKwh', Number(v))} type="number" unit="kWh" step="0.1" />
              <InputField label="Nennspannung" value={(entity as BatteryStorage).nominalVoltageV} onChange={(v) => update('nominalVoltageV', Number(v))} type="number" unit="V" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Max. Ladeleistung" value={(entity as BatteryStorage).maxChargePowerKw} onChange={(v) => update('maxChargePowerKw', Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Max. Entladeleistung" value={(entity as BatteryStorage).maxDischargePowerKw} onChange={(v) => update('maxDischargePowerKw', Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Max. Strom" value={(entity as BatteryStorage).maxCurrentA} onChange={(v) => update('maxCurrentA', Number(v))} type="number" unit="A" />
            </div>
          </Section>

          <Section title="Wirkungsgrade & SoC" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Lade-Wirkungsgrad" value={(entity as BatteryStorage).chargeEfficiency} onChange={(v) => update('chargeEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
              <InputField label="Entlade-Wirkungsgrad" value={(entity as BatteryStorage).dischargeEfficiency} onChange={(v) => update('dischargeEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
              <InputField label="Roundtrip-Wirkungsgrad" value={(entity as BatteryStorage).roundTripEfficiency} onChange={(v) => update('roundTripEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Min. SoC" value={(entity as BatteryStorage).minSocPercent} onChange={(v) => update('minSocPercent', Number(v))} type="number" unit="%" min={0} max={100} hint="Tiefentladeschutz" />
              <InputField label="Max. SoC" value={(entity as BatteryStorage).maxSocPercent} onChange={(v) => update('maxSocPercent', Number(v))} type="number" unit="%" min={0} max={100} hint="Obergrenze für Lebensdauer" />
              <InputField label="Initialer SoC" value={(entity as BatteryStorage).initialSocPercent} onChange={(v) => update('initialSocPercent', Number(v))} type="number" unit="%" min={0} max={100} />
            </div>
          </Section>

          <Section title="Lebensdauer & C-Rate" defaultOpen={false}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Erwartete Zyklen" value={(entity as BatteryStorage).cycleLifeExpected} onChange={(v) => update('cycleLifeExpected', Number(v))} type="number" hint="Bei 80% DoD" />
              <InputField label="Aktuelle Zyklen" value={(entity as BatteryStorage).currentCycles} onChange={(v) => update('currentCycles', Number(v))} type="number" />
              <InputField label="Kalendarische Lebensdauer" value={(entity as BatteryStorage).calendarLifeYears} onChange={(v) => update('calendarLifeYears', Number(v))} type="number" unit="Jahre" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Max. DoD" value={(entity as BatteryStorage).maxDoD} onChange={(v) => update('maxDoD', Number(v))} type="number" step="0.05" min={0} max={1} hint="Depth of Discharge" />
              <InputField label="C-Rate Laden" value={(entity as BatteryStorage).cRateCharge} onChange={(v) => update('cRateCharge', Number(v))} type="number" step="0.1" hint="z.B. 0.5C = halbe Kapazität/h" />
              <InputField label="C-Rate Entladen" value={(entity as BatteryStorage).cRateDischarge} onChange={(v) => update('cRateDischarge', Number(v))} type="number" step="0.1" />
            </div>
            <InputField label="Selbstentladung" value={(entity as BatteryStorage).selfDischargePerMonth} onChange={(v) => update('selfDischargePerMonth', Number(v))} type="number" unit="%/Monat" step="0.1" />
          </Section>
        </>
      )}

      {isThermal && (
        <>
          <Section title="Speicher-Geometrie" defaultOpen={true} badge={entity.type === 'heat' ? 'Wärme' : 'Kälte'}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Volumen" value={(entity as ThermalStorage).volumeLiters} onChange={(v) => update('volumeLiters', Number(v))} type="number" unit="Liter" />
              <InputField label="Höhe" value={(entity as ThermalStorage).heightMm} onChange={(v) => update('heightMm', Number(v))} type="number" unit="mm" />
              <InputField label="Durchmesser" value={(entity as ThermalStorage).diameterMm} onChange={(v) => update('diameterMm', Number(v))} type="number" unit="mm" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Isolierdicke" value={(entity as ThermalStorage).insulationThicknessMm} onChange={(v) => update('insulationThicknessMm', Number(v))} type="number" unit="mm" />
              <InputField label="Isoliermaterial" value={(entity as ThermalStorage).insulationMaterial} onChange={(v) => update('insulationMaterial', v)} placeholder="z.B. PU-Schaum, Mineralwolle" />
              <InputField label="Umgebungstemperatur" value={(entity as ThermalStorage).ambientTemperatureC} onChange={(v) => update('ambientTemperatureC', Number(v))} type="number" unit="°C" hint="Aufstellort" />
            </div>
          </Section>

          <Section title="Temperaturgrenzen" defaultOpen={true}>
            <div className="grid grid-cols-4 gap-4">
              <InputField label="Min. Temperatur" value={(entity as ThermalStorage).minTemperatureC} onChange={(v) => update('minTemperatureC', Number(v))} type="number" unit="°C" />
              <InputField label="Max. Temperatur" value={(entity as ThermalStorage).maxTemperatureC} onChange={(v) => update('maxTemperatureC', Number(v))} type="number" unit="°C" />
              <InputField label="Solltemperatur" value={(entity as ThermalStorage).targetTemperatureC} onChange={(v) => update('targetTemperatureC', Number(v))} type="number" unit="°C" />
              <InputField label="Hysterese" value={(entity as ThermalStorage).hysteresisK} onChange={(v) => update('hysteresisK', Number(v))} type="number" unit="K" hint="Schaltdifferenz" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Wärmeverlust-Koeffizient (UA)" value={(entity as ThermalStorage).heatLossCoefficientWPerK} onChange={(v) => update('heatLossCoefficientWPerK', Number(v))} type="number" unit="W/K" step="0.1" hint="Wärmeverlustleistung pro Kelvin Differenz" />
              <InputField label="Spez. Wärmekapazität" value={(entity as ThermalStorage).specificHeatCapacity} onChange={(v) => update('specificHeatCapacity', Number(v))} type="number" unit="kJ/(kg·K)" step="0.01" hint="Wasser: 4.18" />
            </div>
          </Section>

          <Section title="Schichtung" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Schichtenspeicher" checked={(entity as ThermalStorage).stratificationEnabled} onChange={(v) => update('stratificationEnabled', v)} hint="Temperaturschichtung berücksichtigen" />
              {(entity as ThermalStorage).stratificationEnabled && (
                <InputField label="Anzahl Schichten" value={(entity as ThermalStorage).numberOfLayers} onChange={(v) => update('numberOfLayers', Number(v))} type="number" min={2} max={10} hint="Modell-Schichten" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Elektro-Heizstab vorhanden" checked={(entity as ThermalStorage).hasElectricalHeatingElement} onChange={(v) => update('hasElectricalHeatingElement', v)} hint="Für PV-Eigenverbrauchsoptimierung" />
              {(entity as ThermalStorage).hasElectricalHeatingElement && (
                <InputField label="Heizstab-Leistung" value={(entity as ThermalStorage).heatingElementPowerKw} onChange={(v) => update('heatingElementPowerKw', Number(v))} type="number" unit="kW" step="0.5" />
              )}
            </div>
          </Section>

          <Section title="Temperatursensoren" defaultOpen={true} badge={`${(entity as ThermalStorage).temperatureSensors.length} Sensoren`}>
            <p className="text-sm text-dark-faded mb-3">Temperatursensoren für die Speicherüberwachung und selbstlernende Regelung</p>
            {(entity as ThermalStorage).temperatureSensors.map((sensor, i) => (
              <div key={sensor.id} className="p-3 bg-dark-hover rounded-lg mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-dark-muted">Sensor {i + 1}</span>
                  <button onClick={() => {
                    const sensors = (entity as ThermalStorage).temperatureSensors.filter((_, j) => j !== i)
                    update('temperatureSensors', sensors)
                  }} className="btn-danger text-xs">Entfernen</button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <InputField label="Name" value={sensor.name} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], name: v }
                    update('temperatureSensors', sensors)
                  }} />
                  <SelectField label="Position" value={sensor.position} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], position: v as TemperatureSensor['position'] }
                    update('temperatureSensors', sensors)
                  }} options={sensorPositionOptions} />
                  <SelectField label="Sensortyp" value={sensor.sensorType} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], sensorType: v as TemperatureSensor['sensorType'] }
                    update('temperatureSensors', sensors)
                  }} options={sensorTypeOptions} />
                  <InputField label="Offset" value={sensor.offsetCorrection} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], offsetCorrection: Number(v) }
                    update('temperatureSensors', sensors)
                  }} type="number" unit="K" step="0.1" hint="Kalibrierung" />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <SelectField label="Protokoll" value={sensor.communication.protocol} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, protocol: v as TemperatureSensor['communication']['protocol'] } }
                    update('temperatureSensors', sensors)
                  }} options={[
                    { value: 'modbus_tcp', label: 'Modbus TCP' },
                    { value: 'mqtt', label: 'MQTT' },
                    { value: 'http_rest', label: 'HTTP/REST' },
                  ]} />
                  <InputField label="IP-Adresse" value={sensor.communication.ipAddress} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, ipAddress: v } }
                    update('temperatureSensors', sensors)
                  }} placeholder="192.168.1.x" />
                  <InputField label="Port" value={sensor.communication.port} onChange={(v) => {
                    const sensors = [...(entity as ThermalStorage).temperatureSensors]
                    sensors[i] = { ...sensors[i], communication: { ...sensors[i].communication, port: Number(v) } }
                    update('temperatureSensors', sensors)
                  }} type="number" />
                </div>
              </div>
            ))}
            <button onClick={() => {
              const sensors = [...(entity as ThermalStorage).temperatureSensors, {
                ...createDefaultTemperatureSensor(), id: uuid(), name: `Sensor ${(entity as ThermalStorage).temperatureSensors.length + 1}`,
              }]
              update('temperatureSensors', sensors)
            }} className="btn-secondary text-sm">+ Sensor hinzufügen</button>
          </Section>
        </>
      )}

      <CommunicationForm config={entity.communication} onChange={(c) => update('communication', c)} />

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
