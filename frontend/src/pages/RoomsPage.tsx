import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Home, X, Copy, Thermometer, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { RoomForm, createDefaultRoomPorts } from '../components/forms/RoomForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Room, FloorLevel, RoomType } from '../types'
import { createDefaultRoom } from '../types'

const floorOptions = [
  { value: 'UG', label: 'Untergeschoss' },
  { value: 'EG', label: 'Erdgeschoss' },
  { value: 'OG1', label: '1. Obergeschoss' },
  { value: 'OG2', label: '2. Obergeschoss' },
  { value: 'OG3', label: '3. Obergeschoss' },
  { value: 'DG', label: 'Dachgeschoss' },
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

export default function RoomsPage() {
  const { rooms, circuits, addRoom, updateRoom, removeRoom } = useEnergyStore()
  const [editing, setEditing] = useState<Room | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, returnFromFlow } = useCreateNavigation()

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
          <RoomForm entity={editing} onChange={setEditing} />
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
