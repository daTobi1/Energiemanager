import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, Edit2, Gauge, X, Copy } from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import type { Meter, MeterType, MeterDirection, MeterCategory, MeterAssignmentType } from '../types'
import { createDefaultCommunication } from '../types'

const meterTypeOptions = [
  { value: 'electricity', label: 'Stromzähler' },
  { value: 'heat', label: 'Wärmemengenzähler' },
  { value: 'gas', label: 'Gaszähler' },
  { value: 'water', label: 'Wasserzähler' },
  { value: 'cold', label: 'Kältemengenzähler' },
]

const directionOptions = [
  { value: 'consumption', label: 'Verbrauch' },
  { value: 'generation', label: 'Erzeugung' },
  { value: 'bidirectional', label: 'Bidirektional (Zweirichtung)' },
  { value: 'grid_feed_in', label: 'Netzeinspeisung' },
  { value: 'grid_consumption', label: 'Netzbezug' },
]

const categoryOptions = [
  { value: 'main', label: 'Hauptzähler' },
  { value: 'sub', label: 'Unterzähler' },
]

const assignmentTypeOptions = [
  { value: 'none', label: '— Keine Zuordnung —' },
  { value: 'generator', label: 'Erzeuger' },
  { value: 'consumer', label: 'Verbraucher' },
  { value: 'storage', label: 'Speicher' },
  { value: 'grid', label: 'Netzanschluss' },
]

const typeColors: Record<MeterType, string> = {
  electricity: 'bg-yellow-100 text-yellow-700',
  heat: 'bg-red-100 text-red-700',
  gas: 'bg-blue-100 text-blue-700',
  water: 'bg-cyan-100 text-cyan-700',
  cold: 'bg-indigo-100 text-indigo-700',
}

const typeLabels: Record<MeterType, string> = {
  electricity: 'Strom',
  heat: 'Wärme',
  gas: 'Gas',
  water: 'Wasser',
  cold: 'Kälte',
}

const directionLabels: Record<MeterDirection, string> = {
  consumption: 'Verbrauch',
  generation: 'Erzeugung',
  bidirectional: 'Bidirektional',
  grid_feed_in: 'Einspeisung',
  grid_consumption: 'Netzbezug',
}

function createDefaultMeter(): Meter {
  return {
    id: uuid(),
    name: '',
    type: 'electricity',
    meterNumber: '',
    direction: 'consumption',
    category: 'sub',
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
    notes: '',
  }
}

export default function MetersPage() {
  const { meters, generators, consumers, storages, addMeter, updateMeter, removeMeter } = useEnergyStore()
  const [editing, setEditing] = useState<Meter | null>(null)
  const [showForm, setShowForm] = useState(false)

  const startAdd = () => {
    setEditing(createDefaultMeter())
    setShowForm(true)
  }

  const startEdit = (m: Meter) => {
    setEditing({ ...m })
    setShowForm(true)
  }

  const save = () => {
    if (!editing) return
    const exists = meters.find((m) => m.id === editing.id)
    if (exists) updateMeter(editing.id, editing)
    else addMeter(editing)
    setShowForm(false)
    setEditing(null)
  }

  const cancel = () => { setShowForm(false); setEditing(null) }

  const update = <K extends keyof Meter>(key: K, value: Meter[K]) => {
    if (!editing) return
    setEditing({ ...editing, [key]: value })
  }

  // Zuordnungs-Optionen basierend auf Typ
  const getAssignmentOptions = () => {
    if (!editing) return []
    switch (editing.assignedToType) {
      case 'generator': return generators.map((g) => ({ value: g.id, label: g.name || 'Unbenannt' }))
      case 'consumer': return consumers.map((c) => ({ value: c.id, label: c.name || 'Unbenannt' }))
      case 'storage': return storages.map((s) => ({ value: s.id, label: s.name || 'Unbenannt' }))
      case 'grid': return [{ value: 'grid', label: 'Netzanschluss' }]
      default: return []
    }
  }

  const parentMeterOptions = meters
    .filter((m) => m.id !== editing?.id && m.category === 'main')
    .map((m) => ({ value: m.id, label: m.name || m.meterNumber }))

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{meters.find((m) => m.id === editing.id) ? 'Zähler bearbeiten' : 'Neuer Zähler'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <Section title="Grunddaten" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. Hauptzähler Strom, PV-Erzeugungszähler" />
              <InputField label="Zählernummer" value={editing.meterNumber} onChange={(v) => update('meterNumber', v)} placeholder="z.B. 1EMH0012345678" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Medium" value={editing.type} onChange={(v) => update('type', v as MeterType)} options={meterTypeOptions} />
              <SelectField label="Messrichtung" value={editing.direction} onChange={(v) => update('direction', v as MeterDirection)} options={directionOptions} />
              <SelectField label="Zählerart" value={editing.category} onChange={(v) => update('category', v as MeterCategory)} options={categoryOptions} />
            </div>
            {editing.category === 'sub' && (
              <SelectField label="Übergeordneter Hauptzähler" value={editing.parentMeterId} onChange={(v) => update('parentMeterId', v)} options={parentMeterOptions} hint="Diesem Hauptzähler untergeordnet" />
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

          <Section title="Zuordnung" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Zuordnung zu"
                value={editing.assignedToType}
                onChange={(v) => { update('assignedToType', v as MeterAssignmentType); update('assignedToId', '') }}
                options={assignmentTypeOptions}
              />
              {editing.assignedToType !== 'none' && (
                <SelectField
                  label="Zugeordnetes Gerät"
                  value={editing.assignedToId}
                  onChange={(v) => update('assignedToId', v)}
                  options={getAssignmentOptions()}
                  hint="Gerät zuerst in der entsprechenden Sektion anlegen"
                />
              )}
            </div>
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
          <h1 className="page-header">Zähler</h1>
          <p className="text-sm text-gray-500 mt-1">Alle Energiezähler erfassen und zuordnen</p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Zähler hinzufügen
        </button>
      </div>

      {meters.length === 0 ? (
        <div className="card text-center py-12">
          <Gauge className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Zähler konfiguriert</p>
          <p className="text-sm text-gray-400 mt-1">Zähler sind die Grundlage für alle Messdaten</p>
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
                  <h3 className="font-semibold text-gray-900">{m.name || 'Unbenannt'}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{typeLabels[m.type]}</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{directionLabels[m.direction]}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${m.category === 'main' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-500'}`}>
                    {m.category === 'main' ? 'Hauptzähler' : 'Unterzähler'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {m.meterNumber && `Nr. ${m.meterNumber}`}
                  {m.type === 'electricity' && ` | ${m.phases}-phasig, ${m.nominalCurrentA}A`}
                  {m.communication.ipAddress && ` | ${m.communication.protocol} @ ${m.communication.ipAddress}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { const copy = { ...m, id: uuid(), name: m.name + ' (Kopie)' }; addMeter(copy) }} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                <button onClick={() => startEdit(m)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => removeMeter(m.id)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Löschen"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
