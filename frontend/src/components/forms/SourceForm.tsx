import { InputField, SelectField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type { Source, SourceType } from '../../types'
import { createDefaultSource } from '../../types'

const typeOptions = [
  { value: 'solar_thermal', label: 'Solarthermie' },
  { value: 'ground_source', label: 'Erdsonde / Erdkollektor' },
  { value: 'air_source', label: 'Außenluft' },
  { value: 'well_source', label: 'Brunnen / Grundwasser' },
]

const probeTypeOptions = [
  { value: 'single_u', label: 'Einfach-U' },
  { value: 'double_u', label: 'Doppel-U' },
  { value: 'coaxial', label: 'Koaxial' },
]

interface Props {
  entity: Source
  onChange: (entity: Source) => void
}

export function SourceForm({ entity, onChange }: Props) {
  const update = <K extends keyof Source>(key: K, value: Source[K]) => {
    onChange({ ...entity, [key]: value })
  }

  return (
    <>
      <Section title="Allgemein" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. Solarthermie Dach Süd, Erdsonde Garten" />
          <SelectField label="Typ" value={entity.type} onChange={(v) => {
            const newType = v as SourceType
            const fresh = createDefaultSource(newType)
            onChange({
              ...fresh,
              id: entity.id,
              name: entity.name,
              location: entity.location,
              notes: entity.notes,
              assignedMeterIds: entity.assignedMeterIds,
              assignedSensorIds: entity.assignedSensorIds,
              communication: entity.communication,
            })
          }} options={typeOptions} />
        </div>
        <InputField label="Standort" value={entity.location} onChange={(v) => update('location', v)} placeholder="z.B. Dach Süd, Garten Nord, Keller" />
      </Section>

      {entity.type === 'solar_thermal' && (
        <Section title="Solarthermie" defaultOpen={true} badge="Solarthermie">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Kollektorfläche" value={entity.collectorAreaM2} onChange={(v) => update('collectorAreaM2', Number(v))} type="number" unit="m²" step="0.1" />
            <InputField label="Anzahl Kollektoren" value={entity.collectorCount} onChange={(v) => update('collectorCount', Number(v))} type="number" min={1} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Azimut" value={entity.azimuthDeg} onChange={(v) => update('azimuthDeg', Number(v))} type="number" unit="°" hint="0°=Nord, 90°=Ost, 180°=Süd, 270°=West" />
            <InputField label="Neigung" value={entity.tiltDeg} onChange={(v) => update('tiltDeg', Number(v))} type="number" unit="°" hint="0°=horizontal, 90°=vertikal" />
            <InputField label="Optischer Wirkungsgrad" value={entity.opticalEfficiency} onChange={(v) => update('opticalEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} hint="Eta-0, z.B. 0.80" />
          </div>
        </Section>
      )}

      {entity.type === 'ground_source' && (
        <Section title="Erdsonde / Erdkollektor" defaultOpen={true} badge="Erdsonde">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Bohrtiefe" value={entity.boreholeDepthM} onChange={(v) => update('boreholeDepthM', Number(v))} type="number" unit="m" />
            <InputField label="Anzahl Sonden" value={entity.boreholeCount} onChange={(v) => update('boreholeCount', Number(v))} type="number" min={1} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Sondentyp" value={entity.probeType} onChange={(v) => update('probeType', v as 'single_u' | 'double_u' | 'coaxial')} options={probeTypeOptions} />
            <InputField label="Wärmeleitfähigkeit Boden" value={entity.soilThermalConductivity} onChange={(v) => update('soilThermalConductivity', Number(v))} type="number" unit="W/(m·K)" step="0.1" hint="Typisch: 1.5–3.0" />
          </div>
        </Section>
      )}

      {entity.type === 'air_source' && (
        <Section title="Außenluft" defaultOpen={true} badge="Luft">
          <p className="text-sm text-dark-faded">
            Außenluft als Energiequelle benötigt keine weiteren technischen Parameter.
            Der Standort und die zugeordneten Sensoren (z.B. Außentemperatur) sind ausreichend.
          </p>
        </Section>
      )}

      {entity.type === 'well_source' && (
        <Section title="Brunnen / Grundwasser" defaultOpen={true} badge="Brunnen">
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Förderleistung" value={entity.flowRateM3PerH} onChange={(v) => update('flowRateM3PerH', Number(v))} type="number" unit="m³/h" step="0.1" />
            <InputField label="Wassertemperatur" value={entity.temperatureC} onChange={(v) => update('temperatureC', Number(v))} type="number" unit="°C" step="0.5" hint="Durchschnittliche Brunnenwassertemperatur" />
            <InputField label="Brunnentiefe" value={entity.wellDepthM} onChange={(v) => update('wellDepthM', Number(v))} type="number" unit="m" />
          </div>
        </Section>
      )}

      <CommunicationForm config={entity.communication} onChange={(c) => update('communication', c)} />

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
