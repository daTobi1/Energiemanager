import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, Edit2, Home, X, Copy, Thermometer, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Room, FloorLevel, RoomType, SchedulePeriod, EnergyPort } from '../types'
import { createDefaultRoom } from '../types'
import { PortEditor, mkPort } from '../components/ui/PortEditor'

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

const roomTypeLabels: Record<RoomType, string> = {
  wohnen: 'Wohnen', schlafen: 'Schlafen', kueche: 'Küche', bad: 'Bad',
  buero: 'Büro', flur: 'Flur', lager: 'Lager', technik: 'Technik', sonstige: 'Sonstige',
}

const roomTypeColors: Record<RoomType, string> = {
  wohnen: 'bg-emerald-500/15 text-emerald-400',
  schlafen: 'bg-blue-500/15 text-blue-400',
  kueche: 'bg-orange-500/15 text-orange-400',
  bad: 'bg-cyan-500/15 text-cyan-400',
  buero: 'bg-purple-500/15 text-purple-400',
  flur: 'bg-dark-hover text-dark-muted',
  lager: 'bg-dark-hover text-dark-muted',
  technik: 'bg-yellow-500/15 text-yellow-400',
  sonstige: 'bg-dark-hover text-dark-muted',
}

function createDefaultRoomPorts(coolingEnabled: boolean): EnergyPort[] {
  const ports = [mkPort('input', 'heat', 'Heizung')]
  if (coolingEnabled) ports.push(mkPort('input', 'cold', 'Kühlung'))
  return ports
}

const roomNodeColors: Record<RoomType, string> = {
  wohnen: '#ecfdf5', schlafen: '#eff6ff', kueche: '#fff7ed', bad: '#ecfeff',
  buero: '#f3e8ff', flur: '#f3f4f6', lager: '#f3f4f6', technik: '#fef9c3', sonstige: '#f3f4f6',
}

const dayOptions = [
  { value: 'mo', label: 'Mo' }, { value: 'di', label: 'Di' },
  { value: 'mi', label: 'Mi' }, { value: 'do', label: 'Do' },
  { value: 'fr', label: 'Fr' }, { value: 'sa', label: 'Sa' },
  { value: 'so', label: 'So' },
]

export default function RoomsPage() {
  const { rooms, circuits, consumers, meters, addRoom, updateRoom, removeRoom } = useEnergyStore()
  const [editing, setEditing] = useState<Room | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { navigateToCreate, isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = () => {
    setEditing({ ...createDefaultRoom(), id: uuid(), ports: createDefaultRoomPorts(false) })
    setShowForm(true)
  }
  const startEdit = (r: Room) => { setEditing({ ...r }); setShowForm(true) }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd()
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const r = rooms.find((r) => r.id === flowEditId)
      if (r) startEdit(r)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      startAdd()
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft } as Room
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
    if (rooms.find((r) => r.id === editing.id)) updateRoom(editing.id, editing)
    else addRoom(editing)

    // If we are a creation target, save and navigate back
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
  const update = <K extends keyof Room>(key: K, value: Room[K]) => {
    if (editing) setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const circuitOptions = circuits.map((c) => ({ value: c.id, label: c.name || 'Unbenannt' }))
  const heatingCircuitOptions = [{ value: '', label: '— Kein Heizkreis —' }, ...circuitOptions.filter((_, i) => circuits[i].type !== 'cooling')]
  const coolingCircuitOptions = [{ value: '', label: '— Kein Kältekreis —' }, ...circuitOptions.filter((_, i) => circuits[i].type !== 'heating')]
  const consumerOptions = consumers.map((c) => ({ value: c.id, label: c.name || 'Unbenannt' }))
  const meterOptions = meters.map((m) => ({ value: m.id, label: `${m.name} (${m.meterNumber || '-'})` }))

  // Schedule helpers
  const addSchedule = () => {
    if (!editing) return
    const newPeriod: SchedulePeriod = {
      id: uuid(), name: '', days: ['mo', 'di', 'mi', 'do', 'fr'],
      startTime: '06:00', endTime: '22:00', targetTemperatureC: 21,
    }
    update('schedule', [...editing.schedule, newPeriod])
  }
  const updateSchedule = (idx: number, field: keyof SchedulePeriod, value: SchedulePeriod[keyof SchedulePeriod]) => {
    if (!editing) return
    const updated = editing.schedule.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    update('schedule', updated)
  }
  const removeSchedule = (idx: number) => {
    if (!editing) return
    update('schedule', editing.schedule.filter((_, i) => i !== idx))
  }

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{rooms.find((r) => r.id === editing.id) ? 'Raum bearbeiten' : 'Neuer Raum'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Raum und kehre automatisch zurück</span>
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
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. WE 1 – Wohnzimmer, Technikraum" />
              <SelectField label="Raumtyp" value={editing.roomType} onChange={(v) => update('roomType', v as RoomType)} options={roomTypeOptions} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Geschoss" value={editing.floor} onChange={(v) => update('floor', v as FloorLevel)} options={floorOptions} />
              <InputField label="Fläche" value={editing.areaM2} onChange={(v) => update('areaM2', Number(v))} type="number" unit="m²" step="0.1" />
              <InputField label="Raumhöhe" value={editing.heightM} onChange={(v) => update('heightM', Number(v))} type="number" unit="m" step="0.1" />
            </div>
          </Section>

          <Section title="Klima-Sollwerte" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Raumsolltemperatur" value={editing.targetTemperatureC} onChange={(v) => update('targetTemperatureC', Number(v))} type="number" unit="°C" step="0.5" info="Gewünschte Raumtemperatur im Normalbetrieb" />
              <InputField label="Nachtabsenkung" value={editing.nightSetbackK} onChange={(v) => update('nightSetbackK', Number(v))} type="number" unit="K" step="0.5" info="Absenkung der Solltemperatur während der Nacht" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Mindesttemperatur" value={editing.minTemperatureC} onChange={(v) => update('minTemperatureC', Number(v))} type="number" unit="°C" info="Frostschutz-Grenzwert. Heizung schaltet ein wenn unterschritten." />
              <InputField label="Maximaltemperatur" value={editing.maxTemperatureC} onChange={(v) => update('maxTemperatureC', Number(v))} type="number" unit="°C" info="Obergrenze. Bei Überschreitung wird Kühlung aktiviert (falls verfügbar)." />
            </div>
            <CheckboxField label="Kühlung aktiviert" checked={editing.coolingEnabled} onChange={(v) => { update('coolingEnabled', v); update('ports', createDefaultRoomPorts(v)) }} hint="Raum kann aktiv gekühlt werden" />
            {editing.coolingEnabled && (
              <InputField label="Kühlsolltemperatur" value={editing.coolingTargetTemperatureC} onChange={(v) => update('coolingTargetTemperatureC', Number(v))} type="number" unit="°C" step="0.5" info="Solltemperatur bei aktiver Kühlung" />
            )}
          </Section>

          <Section title="Zeitprogramm" defaultOpen={editing.schedule.length > 0}>
            {editing.schedule.length === 0 ? (
              <p className="text-sm text-dark-faded">Kein Zeitprogramm — es gilt der globale Raumsollwert.</p>
            ) : (
              <div className="space-y-3">
                {editing.schedule.map((sp, idx) => (
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

          <Section title="Zuordnungen" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              {heatingCircuitOptions.length > 1 ? (
                <div>
                  <SelectField label="Heizkreis" value={editing.heatingCircuitId} onChange={(v) => update('heatingCircuitId', v)} options={heatingCircuitOptions} info="Welcher Heizkreis versorgt diesen Raum?" />
                  <button onClick={() => navigateToCreate({ targetPath: '/circuits', assignField: 'heatingCircuitId', assignMode: 'single', draft: editing })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1"><Plus className="w-3 h-3" /> Neuen Heizkreis anlegen</button>
                </div>
              ) : (
                <div>
                  <label className="label">Heizkreis</label>
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/circuits', assignField: 'heatingCircuitId', assignMode: 'single', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Heizkreis jetzt anlegen</span>
                  </button>
                </div>
              )}
              {coolingCircuitOptions.length > 1 ? (
                <div>
                  <SelectField label="Kältekreis" value={editing.coolingCircuitId} onChange={(v) => update('coolingCircuitId', v)} options={coolingCircuitOptions} info="Welcher Kältekreis versorgt diesen Raum?" />
                  <button onClick={() => navigateToCreate({ targetPath: '/circuits', assignField: 'coolingCircuitId', assignMode: 'single', draft: editing })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1"><Plus className="w-3 h-3" /> Neuen Kältekreis anlegen</button>
                </div>
              ) : (
                <div>
                  <label className="label">Kältekreis</label>
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/circuits', assignField: 'coolingCircuitId', assignMode: 'single', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Kältekreis jetzt anlegen</span>
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3">
              <label className="label">Zugeordnete Verbraucher</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {consumerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const ids = editing.consumerIds.includes(opt.value)
                        ? editing.consumerIds.filter((id) => id !== opt.value)
                        : [...editing.consumerIds, opt.value]
                      update('consumerIds', ids)
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editing.consumerIds.includes(opt.value)
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-dark-hover border-dark-border text-dark-faded hover:text-dark-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => navigateToCreate({ targetPath: '/consumers', assignField: 'consumerIds', assignMode: 'append', draft: editing })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-dark-faded hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Neuen Verbraucher anlegen
                </button>
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Zugeordnete Zähler</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {meterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const ids = editing.meterIds.includes(opt.value)
                        ? editing.meterIds.filter((id) => id !== opt.value)
                        : [...editing.meterIds, opt.value]
                      update('meterIds', ids)
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editing.meterIds.includes(opt.value)
                        ? 'bg-yellow-600/20 border-yellow-500/40 text-yellow-400'
                        : 'bg-dark-hover border-dark-border text-dark-faded hover:text-dark-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'meterIds', assignMode: 'append', draft: editing })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-yellow-500/50 hover:bg-yellow-500/5 text-dark-faded hover:text-yellow-400 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Neuen Zähler anlegen
                </button>
              </div>
            </div>
          </Section>

          <PortEditor
            ports={editing.ports || []}
            onChange={(ports) => update('ports', ports)}
            onReset={() => update('ports', createDefaultRoomPorts(editing.coolingEnabled))}
            nodeName={editing.name || roomTypeLabels[editing.roomType]}
            nodeColor={roomNodeColors[editing.roomType]}
          />

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

  // Group rooms by floor
  const floorOrder: FloorLevel[] = ['DG', 'OG3', 'OG2', 'OG1', 'EG', 'UG']
  const roomsByFloor = floorOrder
    .map((floor) => ({ floor, rooms: rooms.filter((r) => r.floor === floor) }))
    .filter((g) => g.rooms.length > 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header">Räume</h1>
          <p className="text-sm text-dark-faded mt-1">Räume definieren und Klimasollwerte festlegen</p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Raum hinzufügen
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="card text-center py-12">
          <Home className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Räume konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Räume ermöglichen raumweise Klimaregelung und Verbrauchszuordnung</p>
        </div>
      ) : (
        <div className="space-y-6">
          {roomsByFloor.map(({ floor, rooms: floorRooms }) => (
            <div key={floor}>
              <h2 className="text-sm font-semibold text-dark-faded mb-2 uppercase tracking-wider">
                {floorOptions.find((f) => f.value === floor)?.label || floor}
              </h2>
              <div className="space-y-2">
                {floorRooms.map((r) => {
                  const circuit = circuits.find((c) => c.id === r.heatingCircuitId)
                  return (
                    <div key={r.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${roomTypeColors[r.roomType]}`}>
                        <Home className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-dark-text">{r.name || 'Unbenannt'}</h3>
                          <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{roomTypeLabels[r.roomType]}</span>
                          <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{r.areaM2} m²</span>
                        </div>
                        <p className="text-sm text-dark-faded mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-red-400" /> {r.targetTemperatureC}°C</span>
                          {r.coolingEnabled && <span className="flex items-center gap-1"><Snowflake className="w-3.5 h-3.5 text-blue-400" /> {r.coolingTargetTemperatureC}°C</span>}
                          {circuit && <span>Heizkreis: {circuit.name}</span>}
                          {r.consumerIds.length > 0 && <span>{r.consumerIds.length} Verbraucher</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { addRoom({ ...r, id: uuid(), name: r.name + ' (Kopie)' }) }} className="btn-icon"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => startEdit(r)} className="btn-icon"><Edit2 className="w-4 h-4" /></button>
                        <ConfirmDelete onConfirm={() => removeRoom(r.id)} itemName={r.name} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
