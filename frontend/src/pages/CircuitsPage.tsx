import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, X, Copy, Waypoints, Flame, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import { CircuitForm, createDefaultCircuitPorts } from '../components/forms/CircuitForm'
import type { HeatingCoolingCircuit, CircuitType, DistributionType } from '../types'
import { createDefaultCircuit } from '../types'

const typeLabels: Record<CircuitType, string> = {
  heating: 'Heizkreis', cooling: 'Kältekreis', combined: 'Kombiniert',
}

const typeColors: Record<CircuitType, string> = {
  heating: 'bg-red-500/15 text-red-400',
  cooling: 'bg-blue-500/15 text-blue-400',
  combined: 'bg-purple-500/15 text-purple-400',
}

const distributionLabels: Record<DistributionType, string> = {
  floor_heating: 'FBH', radiator: 'HK', fan_coil: 'FC', ceiling_cooling: 'DKP', mixed: 'Gemischt',
}

export default function CircuitsPage() {
  const { circuits, rooms, addCircuit, updateCircuit, removeCircuit } = useEnergyStore()
  const [editing, setEditing] = useState<HeatingCoolingCircuit | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: CircuitType = 'heating') => {
    setEditing({ ...createDefaultCircuit(), id: uuid(), type, ports: createDefaultCircuitPorts(type) })
    setShowForm(true)
  }
  const startEdit = (c: HeatingCoolingCircuit) => { setEditing({ ...c }); setShowForm(true) }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd()
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const c = circuits.find((c) => c.id === flowEditId)
      if (c) startEdit(c)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      const type = (flowInitialValues?.type as CircuitType) || 'heating'
      const circuit = { ...createDefaultCircuit(), id: uuid(), type, ports: createDefaultCircuitPorts(type) }
      setEditing(circuit)
      setShowForm(true)
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft } as HeatingCoolingCircuit
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
    if (circuits.find((c) => c.id === editing.id)) updateCircuit(editing.id, editing)
    else addCircuit(editing)

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
  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{circuits.find((c) => c.id === editing.id)
            ? `${editing.type === 'cooling' ? 'Kältekreis' : editing.type === 'combined' ? 'Kombikreis' : 'Heizkreis'} bearbeiten`
            : `Neuer ${editing.type === 'cooling' ? 'Kältekreis' : editing.type === 'combined' ? 'Kombikreis' : 'Heizkreis'}`}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Heiz-/Kältekreis und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          <CircuitForm entity={editing} onChange={setEditing} />
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
          <h1 className="page-header">Heiz- & Kältekreise</h1>
          <p className="text-sm text-dark-faded mt-1">Heizkreise und Kältekreise definieren und Räumen zuordnen</p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Kreis hinzufügen
        </button>
      </div>

      {circuits.length === 0 ? (
        <div className="card text-center py-12">
          <Waypoints className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Heiz-/Kältekreise konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Heizkreise verbinden Erzeuger mit Räumen über Heizkurven</p>
        </div>
      ) : (
        <div className="space-y-3">
          {circuits.map((c) => {
            const assignedRooms = rooms.filter((r) => c.roomIds.includes(r.id))
            const assignedStorages = storages.filter((s) => c.supplyStorageIds?.includes(s.id))
            const assignedGens = generators.filter((g) => c.generatorIds.includes(g.id))
            const activeComponents: string[] = []
            if (c.flowTempSetpoint?.enabled) activeComponents.push('VL-Sollwert')
            if (c.mixerValve?.enabled) activeComponents.push('Mischer')
            if (c.pumpControl?.enabled) activeComponents.push('Pumpe')
            if (c.zoneValves?.enabled) activeComponents.push('Zonen')
            return (
              <div key={c.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[c.type]}`}>
                  {c.type === 'cooling' ? <Snowflake className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-dark-text">{c.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[c.type]}</span>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{distributionLabels[c.distributionType]}</span>
                    {c.controllable ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Regelbar</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full">Nicht regelbar</span>
                    )}
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">
                    VL {c.flowTemperatureC}°C / RL {c.returnTemperatureC}°C | Steilheit {c.heatingCurve.steepness} | {c.pumpPowerW}W
                    {assignedStorages.length > 0 && ` | ← ${assignedStorages.map((s) => s.name).join(', ')}`}
                    {assignedGens.length > 0 && ` | ← ${assignedGens.map((g) => g.name).join(', ')} (direkt)`}
                    {assignedRooms.length > 0 && ` | → ${assignedRooms.length} Räume`}
                  </p>
                  {c.controllable && activeComponents.length > 0 && (
                    <p className="text-xs text-emerald-400/70 mt-0.5">
                      Regelbar: {activeComponents.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { addCircuit({ ...c, id: uuid(), name: c.name + ' (Kopie)' }) }} className="btn-icon"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(c)} className="btn-icon"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeCircuit(c.id)} itemName={c.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
