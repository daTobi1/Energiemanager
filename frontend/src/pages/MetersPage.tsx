import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Gauge, X, Copy, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Meter, MeterType, MeterDirection, MeterCategory, EnergyPort } from '../types'
import { createDefaultCommunication } from '../types'
import { mkPort } from '../components/ui/PortEditor'

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

const typeColors: Record<MeterType, string> = {
  electricity: 'bg-yellow-500/15 text-yellow-400',
  heat: 'bg-red-500/15 text-red-400',
  gas: 'bg-blue-500/15 text-blue-400',
  water: 'bg-cyan-500/15 text-cyan-400',
  cold: 'bg-indigo-500/15 text-indigo-400',
  source: 'bg-teal-500/15 text-teal-400',
}

const typeLabels: Record<MeterType, string> = {
  electricity: 'Strom',
  heat: 'Wärme',
  gas: 'Gas',
  water: 'Wasser',
  cold: 'Kälte',
  source: 'Quelle',
}

const categoryLabels: Record<MeterCategory, string> = {
  source: 'Quellenzähler',
  generation: 'Erzeugerzähler',
  consumption: 'Heiz-/Kühlkreiszähler',
  circuit: 'Raumzähler',
  group: 'Verbrauchergruppenzähler',
  end: 'Endzähler',
  unassigned: 'Nicht zugeordnet',
}

const directionLabels: Record<MeterDirection, string> = {
  consumption: 'Verbrauch',
  generation: 'Erzeugung',
  bidirectional: 'Bidirektional',
  grid_feed_in: 'Einspeisung',
  grid_consumption: 'Netzbezug',
}

function createDefaultMeterPorts(type: MeterType, direction: MeterDirection): EnergyPort[] {
  const energy = type === 'electricity' ? 'electricity' : type === 'heat' ? 'heat' : type === 'gas' ? 'gas' : type === 'cold' ? 'cold' : type === 'source' ? 'source' : 'electricity'
  const label = typeLabels[type] || 'Energie'
  if (direction === 'bidirectional') return [mkPort('input', energy as any, label + ' rein'), mkPort('output', energy as any, label + ' raus')]
  if (direction === 'generation' || direction === 'grid_feed_in') return [mkPort('input', energy as any, label + ' rein'), mkPort('output', energy as any, label + ' raus')]
  return [mkPort('input', energy as any, label + ' rein'), mkPort('output', energy as any, label + ' raus')]
}

function createDefaultMeter(): Meter {
  return {
    id: uuid(),
    name: '',
    type: 'electricity',
    meterNumber: '',
    direction: 'consumption',
    category: 'unassigned',
    parentMeterId: '',
    phases: 3,
    nominalCurrentA: 63,
    nominalVoltageV: 230,
    ctRatio: 1,
    vtRatio: 1,
    pulsesPerUnit: 1000,
    assignedToType: 'none',
    assignedToId: '',
    communication: createDefaultCommunication(),
    registerMappings: [],
    ports: createDefaultMeterPorts('electricity', 'consumption'),
    notes: '',
  }
}

export default function MetersPage() {
  const { meters, addMeter, updateMeter, removeMeter } = useEnergyStore()
  const [editing, setEditing] = useState<Meter | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draftMeter, setDraftMeter] = useState<Meter | null>(null)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = () => {
    setEditing(createDefaultMeter())
    setShowForm(true)
  }

  const startEdit = (m: Meter) => {
    setEditing({ ...m })
    setShowForm(true)
  }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd()
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const m = meters.find((m) => m.id === flowEditId)
      if (m) startEdit(m)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      const meter = createDefaultMeter()
      if (flowInitialValues?.category) {
        meter.category = flowInitialValues.category as MeterCategory
      }
      setEditing(meter)
      setShowForm(true)
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft } as Meter
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
    const exists = meters.find((m) => m.id === editing.id)
    if (exists) updateMeter(editing.id, editing)
    else addMeter(editing)

    // If we were creating a parent meter via draft, restore the draft with the new parent ID
    if (draftMeter) {
      setEditing({ ...draftMeter, parentMeterId: editing.id })
      setDraftMeter(null)
      return
    }

    // If we are a creation target, save and navigate back
    if (isCreationTarget) {
      saveAndReturn(editing.id)
      return
    }

    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }

    setShowForm(false)
    setEditing(null)
  }

  const cancel = () => {
    if (draftMeter) {
      setEditing(draftMeter)
      setDraftMeter(null)
      return
    }
    if (isCreationTarget) {
      cancelAndReturn()
      return
    }
    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }
    setShowForm(false)
    setEditing(null)
  }

  const update = <K extends keyof Meter>(key: K, value: Meter[K]) => {
    if (!editing) return
    setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const parentMeterOptions = meters
    .filter((m) => m.id !== editing?.id)
    .map((m) => ({ value: m.id, label: m.name || m.meterNumber }))

  const startCreateParentMeter = () => {
    if (!editing) return
    setDraftMeter(editing)
    const newMeter = createDefaultMeter()
    newMeter.category = 'generation'
    setEditing(newMeter)
  }

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{meters.find((m) => m.id === editing.id) ? 'Zähler bearbeiten' : 'Neuer Zähler'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Zähler und kehre automatisch zurück</span>
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
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. Hausanschluss-Zähler, PV-Erzeugungszähler" />
              <InputField label="Zählernummer" value={editing.meterNumber} onChange={(v) => update('meterNumber', v)} placeholder="z.B. 1EMH0012345678" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Medium" value={editing.type} onChange={(v) => { update('type', v as MeterType); update('ports', createDefaultMeterPorts(v as MeterType, editing.direction)) }} options={meterTypeOptions} />
              <SelectField label="Messrichtung" value={editing.direction} onChange={(v) => { update('direction', v as MeterDirection); update('ports', createDefaultMeterPorts(editing.type, v as MeterDirection)) }} options={directionOptions} />
              <SelectField label="Zählerart" value={editing.category} onChange={(v) => update('category', v as MeterCategory)} options={categoryOptions} />
            </div>
            {parentMeterOptions.length > 0 && (
              <div>
                <SelectField label="Übergeordneter Zähler (optional)" value={editing.parentMeterId} onChange={(v) => update('parentMeterId', v)} options={[{ value: '', label: '— Kein übergeordneter Zähler —' }, ...parentMeterOptions]} hint="Zählerhierarchie für Abrechnungszwecke" />
              </div>
            )}
          </Section>

          {editing.type === 'electricity' && (
            <Section title="Elektrische Eigenschaften" defaultOpen={true}>
              <div className="grid grid-cols-3 gap-4">
                <SelectField label="Phasen" value={String(editing.phases)} onChange={(v) => update('phases', Number(v) as 1 | 3)} options={[{ value: '1', label: '1-phasig' }, { value: '3', label: '3-phasig' }]} />
                <InputField label="Nennstrom" value={editing.nominalCurrentA} onChange={(v) => update('nominalCurrentA', Number(v))} type="number" unit="A" />
                <InputField label="Nennspannung" value={editing.nominalVoltageV} onChange={(v) => update('nominalVoltageV', Number(v))} type="number" unit="V" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Stromwandler-Faktor" value={editing.ctRatio} onChange={(v) => update('ctRatio', Number(v))} type="number" hint="CT Ratio, 1 = Direktmessung" step="0.1" />
                <InputField label="Spannungswandler-Faktor" value={editing.vtRatio} onChange={(v) => update('vtRatio', Number(v))} type="number" hint="VT Ratio, 1 = Direktmessung" step="0.1" />
                <InputField label="Impulse pro kWh" value={editing.pulsesPerUnit} onChange={(v) => update('pulsesPerUnit', Number(v))} type="number" hint="S0-Schnittstelle" />
              </div>
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
          <h1 className="page-header">Zähler</h1>
          <p className="text-sm text-dark-faded mt-1">Alle Energiezähler erfassen und zuordnen</p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Zähler hinzufügen
        </button>
      </div>

      {meters.length === 0 ? (
        <div className="card text-center py-12">
          <Gauge className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Zähler konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Zähler sind die Grundlage für alle Messdaten</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meters.map((m) => (
            <div key={m.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[m.type]}`}>
                <Gauge className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-dark-text">{m.name || 'Unbenannt'}</h3>
                  <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[m.type]}</span>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">{directionLabels[m.direction]}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400">
                    {categoryLabels[m.category]}
                  </span>
                </div>
                <p className="text-sm text-dark-faded mt-0.5">
                  {m.meterNumber && `Nr. ${m.meterNumber}`}
                  {m.type === 'electricity' && ` | ${m.phases}-phasig, ${m.nominalCurrentA}A`}
                  {m.communication.ipAddress && ` | ${m.communication.protocol} @ ${m.communication.ipAddress}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { const copy = { ...m, id: uuid(), name: m.name + ' (Kopie)' }; addMeter(copy) }} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                <button onClick={() => startEdit(m)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                <ConfirmDelete onConfirm={() => removeMeter(m.id)} itemName={m.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
