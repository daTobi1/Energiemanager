import { InputField, SelectField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type { Sensor, SensorType, SensorMeasurement, SensorSignalType } from '../../types'

const typeOptions: { value: SensorType; label: string }[] = [
  { value: 'temperature', label: 'Temperaturfühler' },
  { value: 'pressure', label: 'Drucksensor' },
  { value: 'flow', label: 'Durchflussmesser' },
  { value: 'level', label: 'Füllstandsensor' },
  { value: 'power', label: 'Leistungsmesser' },
  { value: 'energy', label: 'Energiezähler' },
  { value: 'humidity', label: 'Feuchtefühler' },
  { value: 'radiation', label: 'Strahlungssensor' },
  { value: 'wind_speed', label: 'Windmesser' },
  { value: 'wind_direction', label: 'Windrichtung' },
  { value: 'outdoor_temp', label: 'Außentemperatur' },
]

const measurementOptions: { value: SensorMeasurement; label: string }[] = [
  { value: 'vorlauf_temp', label: 'Vorlauftemperatur' },
  { value: 'ruecklauf_temp', label: 'Rücklauftemperatur' },
  { value: 'aussen_temp', label: 'Außentemperatur' },
  { value: 'raum_temp', label: 'Raumtemperatur' },
  { value: 'speicher_temp', label: 'Speichertemperatur' },
  { value: 'kollektor_temp', label: 'Kollektortemperatur' },
  { value: 'sole_temp', label: 'Soletemperatur' },
  { value: 'brunnenwasser_temp', label: 'Brunnenwassertemp.' },
  { value: 'druck', label: 'Druck' },
  { value: 'differenzdruck', label: 'Differenzdruck' },
  { value: 'volumenstrom', label: 'Volumenstrom' },
  { value: 'fuellstand', label: 'Füllstand' },
  { value: 'leistung', label: 'Leistung' },
  { value: 'energie', label: 'Energie' },
  { value: 'luftfeuchtigkeit', label: 'Luftfeuchtigkeit' },
  { value: 'globalstrahlung', label: 'Globalstrahlung' },
  { value: 'windgeschwindigkeit', label: 'Windgeschwindigkeit' },
  { value: 'windrichtung', label: 'Windrichtung' },
  { value: 'sonstige', label: 'Sonstige' },
]

const signalTypeOptions: { value: SensorSignalType; label: string }[] = [
  { value: 'analog_0_10v', label: 'Analog 0-10V' },
  { value: 'analog_4_20ma', label: 'Analog 4-20mA' },
  { value: 'pt100', label: 'PT100' },
  { value: 'pt1000', label: 'PT1000' },
  { value: 'ntc', label: 'NTC' },
  { value: 'kty', label: 'KTY' },
  { value: 'digital', label: 'Digital' },
  { value: '1_wire', label: '1-Wire' },
  { value: 'bus', label: 'Bus (Modbus/BACnet)' },
]

interface Props {
  entity: Sensor
  onChange: (entity: Sensor) => void
}

export function SensorForm({ entity, onChange }: Props) {
  const update = <K extends keyof Sensor>(key: K, value: Sensor[K]) => {
    onChange({ ...entity, [key]: value })
  }

  return (
    <>
      <Section title="Allgemein" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. VL-Fühler Heizkreis 1" />
          <SelectField label="Sensortyp" value={entity.sensorType} onChange={(v) => update('sensorType', v as SensorType)} options={typeOptions} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Messgröße" value={entity.measurement} onChange={(v) => update('measurement', v as SensorMeasurement)} options={measurementOptions} />
          <InputField label="Einheit" value={entity.unit} onChange={(v) => update('unit', v)} placeholder="z.B. °C, bar, l/min" />
        </div>
      </Section>

      <Section title="Signaltyp & Messbereich" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Signaltyp" value={entity.signalType} onChange={(v) => update('signalType', v as SensorSignalType)} options={signalTypeOptions} />
          <InputField label="Genauigkeit" value={entity.accuracy} onChange={(v) => update('accuracy', Number(v))} type="number" step="0.01" unit={entity.unit || '—'} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Messbereich Min" value={entity.rangeMin} onChange={(v) => update('rangeMin', Number(v))} type="number" unit={entity.unit || '—'} />
          <InputField label="Messbereich Max" value={entity.rangeMax} onChange={(v) => update('rangeMax', Number(v))} type="number" unit={entity.unit || '—'} />
        </div>
      </Section>

      <Section title="Einbauort" defaultOpen={true}>
        <InputField label="Einbauort" value={entity.location} onChange={(v) => update('location', v)} placeholder="z.B. Heizraum, Dach, Außenwand Nord" />
      </Section>

      <CommunicationForm config={entity.communication} onChange={(c) => update('communication', c)} />

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
