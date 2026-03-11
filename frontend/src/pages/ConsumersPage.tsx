import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Plug, X, Copy, Home, Factory, Lightbulb, Wind, Car, Droplets, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Consumer, ConsumerType, LoadProfile, EnergyPort, PortEnergy } from '../types'
import { createDefaultCommunication } from '../types'
import { PortEditor, mkPort } from '../components/ui/PortEditor'

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

const typeIcons: Record<ConsumerType, typeof Plug> = {
  household: Home,
  commercial: Factory,
  production: Factory,
  lighting: Lightbulb,
  hvac: Wind,
  ventilation: Wind,
  wallbox: Car,
  hot_water: Droplets,
  other: Plug,
}

const typeColors: Record<ConsumerType, string> = {
  household: 'bg-green-500/15 text-green-400',
  commercial: 'bg-purple-500/15 text-purple-400',
  production: 'bg-orange-500/15 text-orange-400',
  lighting: 'bg-yellow-500/15 text-yellow-400',
  hvac: 'bg-blue-500/15 text-blue-400',
  ventilation: 'bg-cyan-500/15 text-cyan-400',
  wallbox: 'bg-emerald-500/100/15 text-emerald-400',
  hot_water: 'bg-red-500/15 text-red-400',
  other: 'bg-dark-hover text-dark-muted',
}

const typeLabels: Record<ConsumerType, string> = {
  household: 'Haushalt',
  commercial: 'Gewerbe',
  production: 'Produktion',
  lighting: 'Beleuchtung',
  hvac: 'HLK',
  ventilation: 'Lüftung',
  wallbox: 'Wallbox',
  hot_water: 'Warmwasser',
  other: 'Sonstige',
}

function createDefaultConsumerPorts(type: ConsumerType): EnergyPort[] {
  switch (type) {
    case 'hvac':       return [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'heat', 'Heizung'), mkPort('input', 'cold', 'Kälte')]
    case 'hot_water':  return [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'heat', 'Wärme')]
    default:           return [mkPort('input', 'electricity', 'Strom')]
  }
}

const consumerNodeColors: Record<ConsumerType, string> = {
  household: '#dcfce7', commercial: '#f3e8ff', production: '#ffedd5',
  lighting: '#fef9c3', hvac: '#dbeafe', ventilation: '#cffafe',
  wallbox: '#d1fae5', hot_water: '#fee2e2', other: '#f3f4f6',
}

function createDefaultConsumer(type: ConsumerType): Consumer {
  return {
    id: uuid(),
    name: '',
    type,
    nominalPowerKw: type === 'wallbox' ? 11 : type === 'household' ? 5 : 2,
    annualConsumptionKwh: type === 'household' ? 4000 : 2000,
    loadProfile: type === 'household' ? 'H0' : type === 'commercial' ? 'G0' : 'custom',
    controllable: type === 'wallbox',
    sheddable: false,
    priority: 5,
    connectedSourceIds: [],
    assignedMeterIds: [],
    communication: createDefaultCommunication(),
    ports: createDefaultConsumerPorts(type),
    notes: '',
    wallboxMaxPowerKw: 22,
    wallboxPhases: 3,
    wallboxMinCurrentA: 6,
    vehicleBatteryKwh: 60,
    vehicleConsumptionPer100km: 18,
    ocppEnabled: false,
  }
}

export default function ConsumersPage() {
  const { consumers, rooms, meters, storages, addConsumer, updateConsumer, removeConsumer, updateRoom } = useEnergyStore()
  const [editing, setEditing] = useState<Consumer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const { navigateToCreate, isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: ConsumerType) => { setEditing(createDefaultConsumer(type)); setSelectedRoomId(''); setShowForm(true) }
  const startEdit = (c: Consumer) => {
    setEditing({ ...c })
    setSelectedRoomId(rooms.find((r) => r.consumerIds.includes(c.id))?.id || '')
    setShowForm(true)
  }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd('household')
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const c = consumers.find((c) => c.id === flowEditId)
      if (c) startEdit(c)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      startAdd('household')
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      if (pendingReturn.assignField === 'selectedRoomId') {
        setSelectedRoomId(pendingReturn.createdEntityId!)
        setEditing({ ...pendingReturn.draft } as Consumer)
      } else {
        const draft = { ...pendingReturn.draft } as Consumer
        if (pendingReturn.assignMode === 'single') {
          (draft as any)[pendingReturn.assignField] = pendingReturn.createdEntityId
        } else {
          (draft as any)[pendingReturn.assignField] = [...((draft as any)[pendingReturn.assignField] || []), pendingReturn.createdEntityId]
        }
        setEditing(draft)
      }
      setShowForm(true)
      if (pendingReturn.extraState?.selectedRoomId !== undefined) {
        setSelectedRoomId(pendingReturn.extraState.selectedRoomId)
      }
      clearPendingCreation()
    }
  }, [pendingReturn])

  const save = () => {
    if (!editing) return
    if (consumers.find((c) => c.id === editing.id)) updateConsumer(editing.id, editing)
    else addConsumer(editing)

    // Raumzuordnung aktualisieren
    const currentRoom = rooms.find((r) => r.consumerIds.includes(editing.id))
    if (currentRoom && currentRoom.id !== selectedRoomId) {
      updateRoom(currentRoom.id, { ...currentRoom, consumerIds: currentRoom.consumerIds.filter((id) => id !== editing.id) })
    }
    if (selectedRoomId && (!currentRoom || currentRoom.id !== selectedRoomId)) {
      const newRoom = rooms.find((r) => r.id === selectedRoomId)
      if (newRoom) {
        updateRoom(newRoom.id, { ...newRoom, consumerIds: [...newRoom.consumerIds, editing.id] })
      }
    }

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
  const update = <K extends keyof Consumer>(key: K, value: Consumer[K]) => {
    if (editing) setEditing({ ...editing, [key]: value })
  }

  const meterOptions = meters.map((m) => ({ value: m.id, label: `${m.name} (${m.meterNumber || '-'})` }))
  const roomOptions = [{ value: '', label: '— Kein Raum —' }, ...rooms.map((r) => ({ value: r.id, label: r.name || 'Unbenannt' }))]

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{consumers.find((c) => c.id === editing.id) ? 'Verbraucher bearbeiten' : 'Neuer Verbraucher'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Verbraucher und kehre automatisch zurück</span>
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
              <SelectField label="Typ" value={editing.type} onChange={(v) => { const c = createDefaultConsumer(v as ConsumerType); setEditing({ ...c, id: editing.id, name: editing.name, connectedSourceIds: editing.connectedSourceIds, assignedMeterIds: editing.assignedMeterIds, ports: createDefaultConsumerPorts(v as ConsumerType) }) }} options={consumerTypeOptions} />
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. Haushalt EG, Wallbox Carport" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Nennleistung" value={editing.nominalPowerKw} onChange={(v) => update('nominalPowerKw', Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Jahresverbrauch" value={editing.annualConsumptionKwh} onChange={(v) => update('annualConsumptionKwh', Number(v))} type="number" unit="kWh" hint="Geschätzter Jahresverbrauch" />
              <SelectField label="Lastprofil" value={editing.loadProfile} onChange={(v) => update('loadProfile', v as LoadProfile)} options={loadProfileOptions} hint="Standardlastprofil BDEW" />
            </div>
            {meterOptions.length > 0 ? (
              <div>
                <SelectField
                  label="Zugeordneter Zähler"
                  value={editing.assignedMeterIds[0] || ''}
                  onChange={(v) => update('assignedMeterIds', v ? [v] : [])}
                  options={meterOptions}
                />
                <button onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'assignedMeterIds', assignMode: 'append', draft: editing, extraState: { selectedRoomId } })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1"><Plus className="w-3 h-3" /> Neuen Zähler anlegen</button>
              </div>
            ) : (
              <div>
                <label className="label">Zugeordneter Zähler</label>
                <button
                  onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'assignedMeterIds', assignMode: 'append', draft: editing, extraState: { selectedRoomId } })}
                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Zähler jetzt anlegen</span>
                </button>
              </div>
            )}
            {rooms.length > 0 ? (
              <div>
                <SelectField
                  label="Zugeordneter Raum"
                  value={selectedRoomId}
                  onChange={(v) => setSelectedRoomId(v)}
                  options={roomOptions}
                  hint="Optional — in welchem Raum befindet sich der Verbraucher?"
                />
                <button onClick={() => navigateToCreate({ targetPath: '/rooms', assignField: 'selectedRoomId', assignMode: 'single', draft: editing, extraState: { selectedRoomId } })} className="flex items-center gap-1 text-xs text-dark-faded hover:text-emerald-400 transition-colors mt-1"><Plus className="w-3 h-3" /> Neuen Raum anlegen</button>
              </div>
            ) : (
              <div>
                <label className="label">Zugeordneter Raum</label>
                <button
                  onClick={() => navigateToCreate({ targetPath: '/rooms', assignField: 'selectedRoomId', assignMode: 'single', draft: editing, extraState: { selectedRoomId } })}
                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Raum jetzt anlegen</span>
                </button>
              </div>
            )}
          </Section>

          <PortEditor
            ports={editing.ports || []}
            onChange={(ports) => update('ports', ports)}
            onReset={() => update('ports', createDefaultConsumerPorts(editing.type))}
            nodeName={editing.name || typeLabels[editing.type]}
            nodeColor={consumerNodeColors[editing.type]}
          />

          <Section title="Energiequellen" defaultOpen={true}>
            <p className="text-sm text-dark-faded mb-3">Von welchen Quellen wird dieser Verbraucher versorgt?</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(editing.connectedSourceIds || []).includes('grid')}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...(editing.connectedSourceIds || []), 'grid']
                      : (editing.connectedSourceIds || []).filter((id) => id !== 'grid')
                    update('connectedSourceIds', ids)
                  }}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                Netz (Hausanschluss)
              </label>
              {storages.filter((s) => s.type === 'battery').map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(editing.connectedSourceIds || []).includes(s.id)}
                    onChange={(e) => {
                      const ids = e.target.checked
                        ? [...(editing.connectedSourceIds || []), s.id]
                        : (editing.connectedSourceIds || []).filter((id) => id !== s.id)
                      update('connectedSourceIds', ids)
                    }}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  {s.name || 'Batteriespeicher'}
                </label>
              ))}
            </div>
          </Section>

          <Section title="Lastmanagement" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Steuerbar" checked={editing.controllable} onChange={(v) => update('controllable', v)} hint="Leistung kann vom System geregelt werden" />
              <CheckboxField label="Abschaltbar (Lastabwurf)" checked={editing.sheddable} onChange={(v) => update('sheddable', v)} hint="Kann bei Engpässen abgeschaltet werden" />
            </div>
            <InputField label="Priorität" value={editing.priority} onChange={(v) => update('priority', Number(v))} type="number" min={1} max={10} hint="1 = höchste Priorität (zuletzt abschalten), 10 = niedrigste" />
          </Section>

          {/* Wallbox-spezifische Felder */}
          {editing.type === 'wallbox' && (
            <Section title="Wallbox / Ladestation" defaultOpen={true} badge="Wallbox">
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Max. Ladeleistung" value={editing.wallboxMaxPowerKw} onChange={(v) => update('wallboxMaxPowerKw', Number(v))} type="number" unit="kW" step="0.1" />
                <SelectField label="Phasen" value={String(editing.wallboxPhases)} onChange={(v) => update('wallboxPhases', Number(v) as 1 | 3)} options={[{ value: '1', label: '1-phasig (3.7 kW)' }, { value: '3', label: '3-phasig (11/22 kW)' }]} />
                <InputField label="Min. Ladestrom" value={editing.wallboxMinCurrentA} onChange={(v) => update('wallboxMinCurrentA', Number(v))} type="number" unit="A" hint="Min. 6A nach Norm" min={6} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Fahrzeug-Batterie" value={editing.vehicleBatteryKwh} onChange={(v) => update('vehicleBatteryKwh', Number(v))} type="number" unit="kWh" hint="Kapazität des E-Fahrzeugs" />
                <InputField label="Fahrzeug-Verbrauch" value={editing.vehicleConsumptionPer100km} onChange={(v) => update('vehicleConsumptionPer100km', Number(v))} type="number" unit="kWh/100km" step="0.1" />
              </div>
              <CheckboxField label="OCPP-fähig" checked={editing.ocppEnabled} onChange={(v) => update('ocppEnabled', v)} hint="Open Charge Point Protocol für intelligentes Laden" />
            </Section>
          )}

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
          <h1 className="page-header">Verbraucher</h1>
          <p className="text-sm text-dark-faded mt-1">Alle Energieverbraucher erfassen und zuordnen</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {consumerTypeOptions.slice(0, 9).map(({ value, label }) => {
          const Icon = typeIcons[value as ConsumerType]
          return (
            <button key={value} onClick={() => startAdd(value as ConsumerType)}
              className="card hover:border-emerald-500/50 hover:shadow-md transition-all flex items-center gap-3 py-3 px-4 cursor-pointer">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[value as ConsumerType]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <Plus className="w-4 h-4 text-dark-faded ml-auto" />
            </button>
          )
        })}
      </div>

      {consumers.length === 0 ? (
        <div className="card text-center py-12">
          <Plug className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Verbraucher konfiguriert</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consumers.map((c) => {
            const Icon = typeIcons[c.type]
            return (
              <div key={c.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[c.type]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-dark-text">{c.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[c.type]}</span>
                    {c.controllable && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Steuerbar</span>}
                    {c.sheddable && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full">Abschaltbar</span>}
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">
                    {c.nominalPowerKw} kW | {c.annualConsumptionKwh.toLocaleString()} kWh/a | Profil: {c.loadProfile} | Priorität: {c.priority}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { addConsumer({ ...c, id: uuid(), name: c.name + ' (Kopie)' }) }} className="btn-icon"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(c)} className="btn-icon"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeConsumer(c.id)} itemName={c.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
