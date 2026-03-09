import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, Edit2, Plug, X, Copy, Home, Factory, Lightbulb, Wind, Car, Droplets } from 'lucide-react'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import type { Consumer, ConsumerType, LoadProfile } from '../types'
import { createDefaultCommunication } from '../types'

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
  household: 'bg-green-100 text-green-700',
  commercial: 'bg-purple-100 text-purple-700',
  production: 'bg-orange-100 text-orange-700',
  lighting: 'bg-yellow-100 text-yellow-700',
  hvac: 'bg-blue-100 text-blue-700',
  ventilation: 'bg-cyan-100 text-cyan-700',
  wallbox: 'bg-emerald-100 text-emerald-700',
  hot_water: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
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
    assignedMeterIds: [],
    communication: createDefaultCommunication(),
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
  const { consumers, meters, addConsumer, updateConsumer, removeConsumer } = useEnergyStore()
  const [editing, setEditing] = useState<Consumer | null>(null)
  const [showForm, setShowForm] = useState(false)

  const startAdd = (type: ConsumerType) => { setEditing(createDefaultConsumer(type)); setShowForm(true) }
  const startEdit = (c: Consumer) => { setEditing({ ...c }); setShowForm(true) }
  const save = () => {
    if (!editing) return
    if (consumers.find((c) => c.id === editing.id)) updateConsumer(editing.id, editing)
    else addConsumer(editing)
    setShowForm(false); setEditing(null)
  }
  const cancel = () => { setShowForm(false); setEditing(null) }
  const update = <K extends keyof Consumer>(key: K, value: Consumer[K]) => {
    if (editing) setEditing({ ...editing, [key]: value })
  }

  const meterOptions = meters.map((m) => ({ value: m.id, label: `${m.name} (${m.meterNumber || '-'})` }))

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{consumers.find((c) => c.id === editing.id) ? 'Verbraucher bearbeiten' : 'Neuer Verbraucher'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <Section title="Grunddaten" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Typ" value={editing.type} onChange={(v) => { const c = createDefaultConsumer(v as ConsumerType); setEditing({ ...c, id: editing.id, name: editing.name }) }} options={consumerTypeOptions} />
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. Haushalt EG, Wallbox Carport" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Nennleistung" value={editing.nominalPowerKw} onChange={(v) => update('nominalPowerKw', Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Jahresverbrauch" value={editing.annualConsumptionKwh} onChange={(v) => update('annualConsumptionKwh', Number(v))} type="number" unit="kWh" hint="Geschätzter Jahresverbrauch" />
              <SelectField label="Lastprofil" value={editing.loadProfile} onChange={(v) => update('loadProfile', v as LoadProfile)} options={loadProfileOptions} hint="Standardlastprofil BDEW" />
            </div>
            <SelectField
              label="Zugeordneter Zähler"
              value={editing.assignedMeterIds[0] || ''}
              onChange={(v) => update('assignedMeterIds', v ? [v] : [])}
              options={meterOptions}
            />
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
          <p className="text-sm text-gray-500 mt-1">Alle Energieverbraucher erfassen und zuordnen</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {consumerTypeOptions.slice(0, 9).map(({ value, label }) => {
          const Icon = typeIcons[value as ConsumerType]
          return (
            <button key={value} onClick={() => startAdd(value as ConsumerType)}
              className="card hover:border-emerald-300 hover:shadow-md transition-all flex items-center gap-3 py-3 px-4 cursor-pointer">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[value as ConsumerType]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <Plus className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
          )
        })}
      </div>

      {consumers.length === 0 ? (
        <div className="card text-center py-12">
          <Plug className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Verbraucher konfiguriert</p>
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
                    <h3 className="font-semibold text-gray-900">{c.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{typeLabels[c.type]}</span>
                    {c.controllable && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded-full">Steuerbar</span>}
                    {c.sheddable && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full">Abschaltbar</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {c.nominalPowerKw} kW | {c.annualConsumptionKwh.toLocaleString()} kWh/a | Profil: {c.loadProfile} | Priorität: {c.priority}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { addConsumer({ ...c, id: uuid(), name: c.name + ' (Kopie)' }) }} className="btn-icon"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(c)} className="btn-icon"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => removeConsumer(c.id)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
