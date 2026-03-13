import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Sun, Mountain, Wind, Droplets, X, Copy, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Source, SourceType } from '../types'
import { createDefaultSource } from '../types'

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

const typeIcons: Record<SourceType, typeof Sun> = {
  solar_thermal: Sun,
  ground_source: Mountain,
  air_source: Wind,
  well_source: Droplets,
}

const typeColors: Record<SourceType, string> = {
  solar_thermal: 'bg-amber-500/15 text-amber-400',
  ground_source: 'bg-emerald-500/15 text-emerald-400',
  air_source: 'bg-cyan-500/15 text-cyan-400',
  well_source: 'bg-blue-500/15 text-blue-400',
}

const typeLabels: Record<SourceType, string> = {
  solar_thermal: 'Solarthermie',
  ground_source: 'Erdsonde',
  air_source: 'Außenluft',
  well_source: 'Brunnen',
}

export default function SourcesPage() {
  const { sources, addSource, updateSource, removeSource } = useEnergyStore()
  const [editing, setEditing] = useState<Source | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: SourceType = 'solar_thermal') => {
    const source = createDefaultSource(type)
    source.id = uuid()
    setEditing(source)
    setShowForm(true)
  }

  const startEdit = (s: Source) => {
    setEditing({ ...s })
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
      const s = sources.find((s) => s.id === flowEditId)
      if (s) startEdit(s)
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
      const draft = { ...pendingReturn.draft } as Source
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

  // Handle editId from location.state (e.g. navigated from schema page)
  useEffect(() => {
    const state = window.history.state?.usr
    if (state?.editId && !showForm) {
      const s = sources.find((src) => src.id === state.editId)
      if (s) startEdit(s)
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({ ...window.history.state, usr: {} }, '')
    }
  }, [])

  const save = () => {
    if (!editing) return
    const exists = sources.find((s) => s.id === editing.id)
    if (exists) updateSource(editing.id, editing)
    else addSource(editing)

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
    if (isCreationTarget) {
      cancelAndReturn()
      return
    }
    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }
    setShowForm(false)
    setEditing(null)
  }

  const update = <K extends keyof Source>(key: K, value: Source[K]) => {
    if (editing) setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{sources.find((s) => s.id === editing.id) ? 'Quelle bearbeiten' : 'Neue Quelle'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neue Quelle und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Allgemein */}
          <Section title="Allgemein" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. Solarthermie Dach Süd, Erdsonde Garten" />
              <SelectField label="Typ" value={editing.type} onChange={(v) => {
                const newType = v as SourceType
                const fresh = createDefaultSource(newType)
                setEditing({
                  ...fresh,
                  id: editing.id,
                  name: editing.name,
                  location: editing.location,
                  notes: editing.notes,
                  assignedMeterIds: editing.assignedMeterIds,
                  assignedSensorIds: editing.assignedSensorIds,
                  communication: editing.communication,
                })
              }} options={typeOptions} />
            </div>
            <InputField label="Standort" value={editing.location} onChange={(v) => update('location', v)} placeholder="z.B. Dach Süd, Garten Nord, Keller" />
          </Section>

          {/* Solarthermie */}
          {editing.type === 'solar_thermal' && (
            <Section title="Solarthermie" defaultOpen={true} badge="Solarthermie">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Kollektorfläche" value={editing.collectorAreaM2} onChange={(v) => update('collectorAreaM2', Number(v))} type="number" unit="m²" step="0.1" />
                <InputField label="Anzahl Kollektoren" value={editing.collectorCount} onChange={(v) => update('collectorCount', Number(v))} type="number" min={1} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Azimut" value={editing.azimuthDeg} onChange={(v) => update('azimuthDeg', Number(v))} type="number" unit="°" hint="0°=Nord, 90°=Ost, 180°=Süd, 270°=West" />
                <InputField label="Neigung" value={editing.tiltDeg} onChange={(v) => update('tiltDeg', Number(v))} type="number" unit="°" hint="0°=horizontal, 90°=vertikal" />
                <InputField label="Optischer Wirkungsgrad" value={editing.opticalEfficiency} onChange={(v) => update('opticalEfficiency', Number(v))} type="number" step="0.01" min={0} max={1} hint="Eta-0, z.B. 0.80" />
              </div>
            </Section>
          )}

          {/* Erdsonde / Erdkollektor */}
          {editing.type === 'ground_source' && (
            <Section title="Erdsonde / Erdkollektor" defaultOpen={true} badge="Erdsonde">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Bohrtiefe" value={editing.boreholeDepthM} onChange={(v) => update('boreholeDepthM', Number(v))} type="number" unit="m" />
                <InputField label="Anzahl Sonden" value={editing.boreholeCount} onChange={(v) => update('boreholeCount', Number(v))} type="number" min={1} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Sondentyp" value={editing.probeType} onChange={(v) => update('probeType', v as 'single_u' | 'double_u' | 'coaxial')} options={probeTypeOptions} />
                <InputField label="Wärmeleitfähigkeit Boden" value={editing.soilThermalConductivity} onChange={(v) => update('soilThermalConductivity', Number(v))} type="number" unit="W/(m·K)" step="0.1" hint="Typisch: 1.5–3.0" />
              </div>
            </Section>
          )}

          {/* Außenluft — minimal, nur Standort */}
          {editing.type === 'air_source' && (
            <Section title="Außenluft" defaultOpen={true} badge="Luft">
              <p className="text-sm text-dark-faded">
                Außenluft als Energiequelle benötigt keine weiteren technischen Parameter.
                Der Standort und die zugeordneten Sensoren (z.B. Außentemperatur) sind ausreichend.
              </p>
            </Section>
          )}

          {/* Brunnen / Grundwasser */}
          {editing.type === 'well_source' && (
            <Section title="Brunnen / Grundwasser" defaultOpen={true} badge="Brunnen">
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Förderleistung" value={editing.flowRateM3PerH} onChange={(v) => update('flowRateM3PerH', Number(v))} type="number" unit="m³/h" step="0.1" />
                <InputField label="Wassertemperatur" value={editing.temperatureC} onChange={(v) => update('temperatureC', Number(v))} type="number" unit="°C" step="0.5" hint="Durchschnittliche Brunnenwassertemperatur" />
                <InputField label="Brunnentiefe" value={editing.wellDepthM} onChange={(v) => update('wellDepthM', Number(v))} type="number" unit="m" />
              </div>
            </Section>
          )}

          {/* Kommunikation */}
          <CommunicationForm config={editing.communication} onChange={(c) => update('communication', c)} />

          {/* Notizen */}
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
          <h1 className="page-header">Quellen</h1>
          <p className="text-sm text-dark-faded mt-1">Natürliche Energiequellen für Wärmepumpen und Solarthermie</p>
        </div>
      </div>

      {/* Type buttons for quick add */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {typeOptions.map(({ value, label }) => {
          const Icon = typeIcons[value as SourceType]
          return (
            <button key={value} onClick={() => startAdd(value as SourceType)}
              className="card hover:border-emerald-500/50 hover:shadow-md transition-all flex items-center gap-3 py-3 px-4 cursor-pointer">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[value as SourceType]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <Plus className="w-4 h-4 text-dark-faded ml-auto" />
            </button>
          )
        })}
      </div>

      {sources.length === 0 ? (
        <div className="card text-center py-12">
          <Sun className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Quellen konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Energiequellen definieren die Wärme-/Kältequellen für Wärmepumpen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const Icon = typeIcons[s.type]
            return (
              <div key={s.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[s.type]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-dark-text">{s.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[s.type]}</span>
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">
                    {s.location && `${s.location} | `}
                    {s.type === 'solar_thermal' && `${s.collectorAreaM2} m², ${s.collectorCount} Kollektoren, ${s.azimuthDeg}° Azimut`}
                    {s.type === 'ground_source' && `${s.boreholeDepthM} m, ${s.boreholeCount} Sonden, ${s.probeType === 'single_u' ? 'Einfach-U' : s.probeType === 'double_u' ? 'Doppel-U' : 'Koaxial'}`}
                    {s.type === 'air_source' && 'Außenluft'}
                    {s.type === 'well_source' && `${s.flowRateM3PerH} m³/h, ${s.temperatureC} °C, ${s.wellDepthM} m tief`}
                    {s.assignedSensorIds.length > 0 && ` | ${s.assignedSensorIds.length} Sensor${s.assignedSensorIds.length > 1 ? 'en' : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { addSource({ ...s, id: uuid(), name: s.name + ' (Kopie)' }) }} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(s)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeSource(s.id)} itemName={s.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
