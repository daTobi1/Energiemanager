import { InputField, SelectField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type { Meter, MeterType, MeterDirection, MeterCategory, EnergyPort } from '../../types'
import { mkPort } from '../ui/PortEditor'

const meterTypeOptions = [
  { value: 'electricity', label: 'Stromzähler' },
  { value: 'heat', label: 'Wärmemengenzähler' },
  { value: 'gas', label: 'Gaszähler' },
  { value: 'water', label: 'Wasserzähler' },
  { value: 'cold', label: 'Kältemengenzähler' },
  { value: 'source', label: 'Quellenzähler' },
]

const directionOptions = [
  { value: 'consumption', label: 'Verbrauch' },
  { value: 'generation', label: 'Erzeugung' },
  { value: 'bidirectional', label: 'Bidirektional (Zweirichtung)' },
  { value: 'grid_feed_in', label: 'Netzeinspeisung' },
  { value: 'grid_consumption', label: 'Netzbezug' },
]

const categoryOptions = [
  { value: 'source', label: 'Quellenzähler' },
  { value: 'generation', label: 'Erzeugerzähler' },
  { value: 'consumption', label: 'Heiz-/Kühlkreiszähler' },
  { value: 'circuit', label: 'Raumzähler' },
  { value: 'group', label: 'Verbrauchergruppenzähler' },
  { value: 'end', label: 'Endzähler' },
  { value: 'unassigned', label: 'Nicht zugeordnet' },
]

const typeLabels: Record<MeterType, string> = {
  electricity: 'Strom', heat: 'Wärme', gas: 'Gas',
  water: 'Wasser', cold: 'Kälte', source: 'Quelle',
}

function createDefaultMeterPorts(type: MeterType, direction: MeterDirection): EnergyPort[] {
  const energy = type === 'electricity' ? 'electricity' : type === 'heat' ? 'heat' : type === 'gas' ? 'gas' : type === 'cold' ? 'cold' : type === 'source' ? 'source' : 'electricity'
  const label = typeLabels[type] || 'Energie'
  return [mkPort('input', energy as any, label + ' rein'), mkPort('output', energy as any, label + ' raus')]
}

interface Props {
  entity: Meter
  onChange: (entity: Meter) => void
  parentMeterOptions?: { value: string; label: string }[]
}

export function MeterForm({ entity, onChange, parentMeterOptions }: Props) {
  const update = <K extends keyof Meter>(key: K, value: Meter[K]) => {
    onChange({ ...entity, [key]: value })
  }

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. Hausanschluss-Zähler, PV-Erzeugungszähler" />
          <InputField label="Zählernummer" value={entity.meterNumber} onChange={(v) => update('meterNumber', v)} placeholder="z.B. 1EMH0012345678" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectField label="Medium" value={entity.type} onChange={(v) => { update('type', v as MeterType); update('ports', createDefaultMeterPorts(v as MeterType, entity.direction)) }} options={meterTypeOptions} />
          <SelectField label="Messrichtung" value={entity.direction} onChange={(v) => { update('direction', v as MeterDirection); update('ports', createDefaultMeterPorts(entity.type, v as MeterDirection)) }} options={directionOptions} />
          <SelectField label="Zählerart" value={entity.category} onChange={(v) => update('category', v as MeterCategory)} options={categoryOptions} />
        </div>
        {parentMeterOptions && parentMeterOptions.length > 0 && (
          <SelectField label="Übergeordneter Zähler (optional)" value={entity.parentMeterId} onChange={(v) => update('parentMeterId', v)} options={[{ value: '', label: '— Kein übergeordneter Zähler —' }, ...parentMeterOptions]} hint="Zählerhierarchie für Abrechnungszwecke" />
        )}
      </Section>

      {entity.type === 'electricity' && (
        <Section title="Elektrische Eigenschaften" defaultOpen={true}>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Phasen" value={String(entity.phases)} onChange={(v) => update('phases', Number(v) as 1 | 3)} options={[{ value: '1', label: '1-phasig' }, { value: '3', label: '3-phasig' }]} />
            <InputField label="Nennstrom" value={entity.nominalCurrentA} onChange={(v) => update('nominalCurrentA', Number(v))} type="number" unit="A" />
            <InputField label="Nennspannung" value={entity.nominalVoltageV} onChange={(v) => update('nominalVoltageV', Number(v))} type="number" unit="V" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Stromwandler-Faktor" value={entity.ctRatio} onChange={(v) => update('ctRatio', Number(v))} type="number" hint="CT Ratio, 1 = Direktmessung" step="0.1" />
            <InputField label="Spannungswandler-Faktor" value={entity.vtRatio} onChange={(v) => update('vtRatio', Number(v))} type="number" hint="VT Ratio, 1 = Direktmessung" step="0.1" />
            <InputField label="Impulse pro kWh" value={entity.pulsesPerUnit} onChange={(v) => update('pulsesPerUnit', Number(v))} type="number" hint="S0-Schnittstelle" />
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
