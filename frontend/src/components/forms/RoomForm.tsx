import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../ui/FormField'
import type { Room, FloorLevel, RoomType, SchedulePeriod, EnergyPort } from '../../types'
import { mkPort } from '../ui/PortEditor'

const floorOptions = [
  { value: 'UG', label: 'Untergeschoss' },
  { value: 'EG', label: 'Erdgeschoss' },
  { value: 'OG1', label: '1. Obergeschoss' },
  { value: 'OG2', label: '2. Obergeschoss' },
  { value: 'OG3', label: '3. Obergeschoss' },
  { value: 'DG', label: 'Dachgeschoss' },
]

const roomTypeOptions = [
  { value: 'wohnen', label: 'Wohnen' },
  { value: 'schlafen', label: 'Schlafen' },
  { value: 'kueche', label: 'Küche' },
  { value: 'bad', label: 'Bad' },
  { value: 'buero', label: 'Büro' },
  { value: 'flur', label: 'Flur / Treppenhaus' },
  { value: 'lager', label: 'Lager / Garage' },
  { value: 'technik', label: 'Technikraum' },
  { value: 'sonstige', label: 'Sonstige' },
]

const dayOptions = [
  { value: 'mo', label: 'Mo' }, { value: 'di', label: 'Di' },
  { value: 'mi', label: 'Mi' }, { value: 'do', label: 'Do' },
  { value: 'fr', label: 'Fr' }, { value: 'sa', label: 'Sa' },
  { value: 'so', label: 'So' },
]

export function createDefaultRoomPorts(coolingEnabled: boolean): EnergyPort[] {
  const ports = [mkPort('input', 'heat', 'Heizung')]
  if (coolingEnabled) ports.push(mkPort('input', 'cold', 'Kühlung'))
  return ports
}

interface Props {
  entity: Room
  onChange: (entity: Room) => void
}

export function RoomForm({ entity, onChange }: Props) {
  const update = <K extends keyof Room>(key: K, value: Room[K]) => {
    onChange({ ...entity, [key]: value })
  }

  const addSchedule = () => {
    const newPeriod: SchedulePeriod = {
      id: uuid(), name: '', days: ['mo', 'di', 'mi', 'do', 'fr'],
      startTime: '06:00', endTime: '22:00', targetTemperatureC: 21,
    }
    update('schedule', [...entity.schedule, newPeriod])
  }

  const updateSchedule = (idx: number, field: keyof SchedulePeriod, value: SchedulePeriod[keyof SchedulePeriod]) => {
    const updated = entity.schedule.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    update('schedule', updated)
  }

  const removeSchedule = (idx: number) => {
    update('schedule', entity.schedule.filter((_, i) => i !== idx))
  }

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. WE 1 – Wohnzimmer, Technikraum" />
          <SelectField label="Raumtyp" value={entity.roomType} onChange={(v) => update('roomType', v as RoomType)} options={roomTypeOptions} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectField label="Geschoss" value={entity.floor} onChange={(v) => update('floor', v as FloorLevel)} options={floorOptions} />
          <InputField label="Fläche" value={entity.areaM2} onChange={(v) => update('areaM2', Number(v))} type="number" unit="m²" step="0.1" />
          <InputField label="Raumhöhe" value={entity.heightM} onChange={(v) => update('heightM', Number(v))} type="number" unit="m" step="0.1" />
        </div>
      </Section>

      <Section title="Klima-Sollwerte" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Raumsolltemperatur" value={entity.targetTemperatureC} onChange={(v) => update('targetTemperatureC', Number(v))} type="number" unit="°C" step="0.5" info="Gewünschte Raumtemperatur im Normalbetrieb" />
          <InputField label="Nachtabsenkung" value={entity.nightSetbackK} onChange={(v) => update('nightSetbackK', Number(v))} type="number" unit="K" step="0.5" info="Absenkung der Solltemperatur während der Nacht" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Mindesttemperatur" value={entity.minTemperatureC} onChange={(v) => update('minTemperatureC', Number(v))} type="number" unit="°C" info="Frostschutz-Grenzwert. Heizung schaltet ein wenn unterschritten." />
          <InputField label="Maximaltemperatur" value={entity.maxTemperatureC} onChange={(v) => update('maxTemperatureC', Number(v))} type="number" unit="°C" info="Obergrenze. Bei Überschreitung wird Kühlung aktiviert (falls verfügbar)." />
        </div>
        <CheckboxField label="Kühlung aktiviert" checked={entity.coolingEnabled} onChange={(v) => { update('coolingEnabled', v); update('ports', createDefaultRoomPorts(v)) }} hint="Raum kann aktiv gekühlt werden" />
        {entity.coolingEnabled && (
          <InputField label="Kühlsolltemperatur" value={entity.coolingTargetTemperatureC} onChange={(v) => update('coolingTargetTemperatureC', Number(v))} type="number" unit="°C" step="0.5" info="Solltemperatur bei aktiver Kühlung" />
        )}
      </Section>

      <Section title="Zeitprogramm" defaultOpen={entity.schedule.length > 0}>
        {entity.schedule.length === 0 ? (
          <p className="text-sm text-dark-faded">Kein Zeitprogramm — es gilt der globale Raumsollwert.</p>
        ) : (
          <div className="space-y-3">
            {entity.schedule.map((sp, idx) => (
              <div key={sp.id} className="p-3 bg-dark-bg rounded-lg border border-dark-border">
                <div className="flex items-center justify-between mb-2">
                  <input
                    value={sp.name}
                    onChange={(e) => updateSchedule(idx, 'name', e.target.value)}
                    placeholder="Programmname"
                    className="input text-sm w-40"
                  />
                  <button onClick={() => removeSchedule(idx)} className="btn-icon text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex gap-1 mb-2">
                  {dayOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        const days = sp.days.includes(value as SchedulePeriod['days'][number])
                          ? sp.days.filter((d) => d !== value)
                          : [...sp.days, value as SchedulePeriod['days'][number]]
                        updateSchedule(idx, 'days', days)
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        sp.days.includes(value as SchedulePeriod['days'][number])
                          ? 'bg-emerald-600 text-white'
                          : 'bg-dark-hover text-dark-faded'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Von</label>
                    <input type="time" value={sp.startTime} onChange={(e) => updateSchedule(idx, 'startTime', e.target.value)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label">Bis</label>
                    <input type="time" value={sp.endTime} onChange={(e) => updateSchedule(idx, 'endTime', e.target.value)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="label">Solltemperatur</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={sp.targetTemperatureC} onChange={(e) => updateSchedule(idx, 'targetTemperatureC', Number(e.target.value))} step="0.5" className="input text-sm" />
                      <span className="text-xs text-dark-faded">°C</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={addSchedule} className="btn-secondary text-sm flex items-center gap-1 mt-2">
          <Plus className="w-3.5 h-3.5" /> Zeitprogramm hinzufügen
        </button>
      </Section>

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
