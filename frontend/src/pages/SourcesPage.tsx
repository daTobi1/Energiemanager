import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Sun, Mountain, Wind, Droplets, X, Copy, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { SourceForm } from '../components/forms/SourceForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Source, SourceType } from '../types'
import { createDefaultSource } from '../types'

const typeOptions = [
  { value: 'solar_thermal', label: 'Solarthermie' },
  { value: 'ground_source', label: 'Erdsonde / Erdkollektor' },
  { value: 'air_source', label: 'Außenluft' },
  { value: 'well_source', label: 'Brunnen / Grundwasser' },
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
          <SourceForm entity={editing} onChange={setEditing} />
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
