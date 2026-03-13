import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type { Consumer, ConsumerType, LoadProfile, EnergyPort } from '../../types'
import { createDefaultCommunication } from '../../types'
import { mkPort } from '../ui/PortEditor'

const consumerTypeOptions = [
  { value: 'household', label: 'Haushalt' },
  { value: 'commercial', label: 'Gewerbe' },
  { value: 'production', label: 'Produktion' },
  { value: 'lighting', label: 'Beleuchtung' },
  { value: 'hvac', label: 'Klimaanlage / HLK' },
  { value: 'ventilation', label: 'Lüftungsanlage' },
  { value: 'wallbox', label: 'Wallbox / Ladestation' },
  { value: 'hot_water', label: 'Warmwasser (elektr.)' },
  { value: 'other', label: 'Sonstige' },
]

const loadProfileOptions: { value: LoadProfile; label: string }[] = [
  { value: 'H0', label: 'H0 — Haushalt' },
  { value: 'G0', label: 'G0 — Gewerbe allgemein' },
  { value: 'G1', label: 'G1 — Gewerbe Wochentag 8-18' },
  { value: 'G2', label: 'G2 — Gewerbe mit Abendverbrauch' },
  { value: 'G3', label: 'G3 — Gewerbe durchgehend' },
  { value: 'G4', label: 'G4 — Laden / Friseur' },
  { value: 'G5', label: 'G5 — Bäckerei' },
  { value: 'G6', label: 'G6 — Wochenendbetrieb' },
  { value: 'L0', label: 'L0 — Landwirtschaft allgemein' },
  { value: 'L1', label: 'L1 — Landwirtschaft Milchwirtschaft' },
  { value: 'L2', label: 'L2 — Landwirtschaft sonstige' },
  { value: 'custom', label: 'Benutzerdefiniert' },
]

function createDefaultConsumerPorts(type: ConsumerType): EnergyPort[] {
  switch (type) {
    case 'hvac':       return [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'heat', 'Heizung'), mkPort('input', 'cold', 'Kälte')]
    case 'hot_water':  return [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'heat', 'Wärme')]
    default:           return [mkPort('input', 'electricity', 'Strom')]
  }
}

function createDefaultConsumer(type: ConsumerType): Consumer {
  return {
    id: '', name: '', type,
    nominalPowerKw: type === 'wallbox' ? 11 : type === 'household' ? 5 : 2,
    annualConsumptionKwh: type === 'household' ? 4000 : 2000,
    loadProfile: type === 'household' ? 'H0' : type === 'commercial' ? 'G0' : 'custom',
    controllable: type === 'wallbox', sheddable: false, priority: 5,
    connectedSourceIds: [], assignedMeterIds: [],
    communication: createDefaultCommunication(),
    ports: createDefaultConsumerPorts(type), notes: '',
    wallboxMaxPowerKw: 22, wallboxPhases: 3, wallboxMinCurrentA: 6,
    vehicleBatteryKwh: 60, vehicleConsumptionPer100km: 18, ocppEnabled: false,
  }
}

interface Props {
  entity: Consumer
  onChange: (entity: Consumer) => void
}

export function ConsumerForm({ entity, onChange }: Props) {
  const update = <K extends keyof Consumer>(key: K, value: Consumer[K]) => {
    onChange({ ...entity, [key]: value })
  }

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Typ" value={entity.type} onChange={(v) => {
            const c = createDefaultConsumer(v as ConsumerType)
            onChange({ ...c, id: entity.id, name: entity.name, connectedSourceIds: entity.connectedSourceIds, assignedMeterIds: entity.assignedMeterIds, ports: createDefaultConsumerPorts(v as ConsumerType) })
          }} options={consumerTypeOptions} />
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. Haushalt EG, Wallbox Carport" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Nennleistung" value={entity.nominalPowerKw} onChange={(v) => update('nominalPowerKw', Number(v))} type="number" unit="kW" step="0.1" />
          <InputField label="Jahresverbrauch" value={entity.annualConsumptionKwh} onChange={(v) => update('annualConsumptionKwh', Number(v))} type="number" unit="kWh" hint="Geschätzter Jahresverbrauch" />
          <SelectField label="Lastprofil" value={entity.loadProfile} onChange={(v) => update('loadProfile', v as LoadProfile)} options={loadProfileOptions} hint="Standardlastprofil BDEW" />
        </div>
      </Section>

      <Section title="Lastmanagement" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <CheckboxField label="Steuerbar" checked={entity.controllable} onChange={(v) => update('controllable', v)} hint="Leistung kann vom System geregelt werden" />
          <CheckboxField label="Abschaltbar (Lastabwurf)" checked={entity.sheddable} onChange={(v) => update('sheddable', v)} hint="Kann bei Engpässen abgeschaltet werden" />
        </div>
        <InputField label="Priorität" value={entity.priority} onChange={(v) => update('priority', Number(v))} type="number" min={1} max={10} hint="1 = höchste Priorität (zuletzt abschalten), 10 = niedrigste" />
      </Section>

      {entity.type === 'wallbox' && (
        <Section title="Wallbox / Ladestation" defaultOpen={true} badge="Wallbox">
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Max. Ladeleistung" value={entity.wallboxMaxPowerKw} onChange={(v) => update('wallboxMaxPowerKw', Number(v))} type="number" unit="kW" step="0.1" />
            <SelectField label="Phasen" value={String(entity.wallboxPhases)} onChange={(v) => update('wallboxPhases', Number(v) as 1 | 3)} options={[{ value: '1', label: '1-phasig (3.7 kW)' }, { value: '3', label: '3-phasig (11/22 kW)' }]} />
            <InputField label="Min. Ladestrom" value={entity.wallboxMinCurrentA} onChange={(v) => update('wallboxMinCurrentA', Number(v))} type="number" unit="A" hint="Min. 6A nach Norm" min={6} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Fahrzeug-Batterie" value={entity.vehicleBatteryKwh} onChange={(v) => update('vehicleBatteryKwh', Number(v))} type="number" unit="kWh" hint="Kapazität des E-Fahrzeugs" />
            <InputField label="Fahrzeug-Verbrauch" value={entity.vehicleConsumptionPer100km} onChange={(v) => update('vehicleConsumptionPer100km', Number(v))} type="number" unit="kWh/100km" step="0.1" />
          </div>
          <CheckboxField label="OCPP-fähig" checked={entity.ocppEnabled} onChange={(v) => update('ocppEnabled', v)} hint="Open Charge Point Protocol für intelligentes Laden" />
        </Section>
      )}

      <CommunicationForm config={entity.communication} onChange={(c) => update('communication', c)} />

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
