import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Activity, Thermometer, Gauge, Droplets, Zap, Wind, X, Copy, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { Sensor, SensorType, SensorMeasurement, SensorSignalType } from '../types'
import { createDefaultSensor } from '../types'

const typeOptions: { value: SensorType; label: string }[] = [
  { value: 'temperature', label: 'Temperaturfühler' },
  { value: 'pressure', label: 'Drucksensor' },
  { value: 'flow', label: 'Durchflussmesser' },
  { value: 'level', label: 'Füllstandsensor' },
  { value: 'power', label: 'Leistungsmesser' },
  { value: 'energy', label: 'Energiezähler' },
  { value: 'humidity', label: 'Feuchtefühler' },
  { value: 'radiation', label: 'Strahlungssensor' },
  { value: 'wind_speed', label: 'Windmesser' },
  { value: 'wind_direction', label: 'Windrichtung' },
  { value: 'outdoor_temp', label: 'Außentemperatur' },
]

const measurementOptions: { value: SensorMeasurement; label: string }[] = [
  { value: 'vorlauf_temp', label: 'Vorlauftemperatur' },
  { value: 'ruecklauf_temp', label: 'Rücklauftemperatur' },
  { value: 'aussen_temp', label: 'Außentemperatur' },
  { value: 'raum_temp', label: 'Raumtemperatur' },
  { value: 'speicher_temp', label: 'Speichertemperatur' },
  { value: 'kollektor_temp', label: 'Kollektortemperatur' },
  { value: 'sole_temp', label: 'Soletemperatur' },
  { value: 'brunnenwasser_temp', label: 'Brunnenwassertemp.' },
  { value: 'druck', label: 'Druck' },
  { value: 'differenzdruck', label: 'Differenzdruck' },
  { value: 'volumenstrom', label: 'Volumenstrom' },
  { value: 'fuellstand', label: 'Füllstand' },
  { value: 'leistung', label: 'Leistung' },
  { value: 'energie', label: 'Energie' },
  { value: 'luftfeuchtigkeit', label: 'Luftfeuchtigkeit' },
  { value: 'globalstrahlung', label: 'Globalstrahlung' },
  { value: 'windgeschwindigkeit', label: 'Windgeschwindigkeit' },
  { value: 'windrichtung', label: 'Windrichtung' },
  { value: 'sonstige', label: 'Sonstige' },
]

const signalTypeOptions: { value: SensorSignalType; label: string }[] = [
  { value: 'analog_0_10v', label: 'Analog 0-10V' },
  { value: 'analog_4_20ma', label: 'Analog 4-20mA' },
  { value: 'pt100', label: 'PT100' },
  { value: 'pt1000', label: 'PT1000' },
  { value: 'ntc', label: 'NTC' },
  { value: 'kty', label: 'KTY' },
  { value: 'digital', label: 'Digital' },
  { value: '1_wire', label: '1-Wire' },
  { value: 'bus', label: 'Bus (Modbus/BACnet)' },
]

const typeIcons: Record<SensorType, typeof Activity> = {
  temperature: Thermometer,
  pressure: Gauge,
  flow: Droplets,
  level: Droplets,
  power: Zap,
  energy: Zap,
  humidity: Droplets,
  radiation: Activity,
  wind_speed: Wind,
  wind_direction: Wind,
  outdoor_temp: Thermometer,
}

const typeColors: Record<SensorType, string> = {
  temperature: 'bg-red-500/15 text-red-400',
  pressure: 'bg-blue-500/15 text-blue-400',
  flow: 'bg-cyan-500/15 text-cyan-400',
  level: 'bg-teal-500/15 text-teal-400',
  power: 'bg-yellow-500/15 text-yellow-400',
  energy: 'bg-amber-500/15 text-amber-400',
  humidity: 'bg-indigo-500/15 text-indigo-400',
  radiation: 'bg-orange-500/15 text-orange-400',
  wind_speed: 'bg-emerald-500/15 text-emerald-400',
  wind_direction: 'bg-green-500/15 text-green-400',
  outdoor_temp: 'bg-purple-500/15 text-purple-400',
}

const typeLabels: Record<SensorType, string> = {
  temperature: 'Temperaturfühler',
  pressure: 'Drucksensor',
  flow: 'Durchflussmesser',
  level: 'Füllstandsensor',
  power: 'Leistungsmesser',
  energy: 'Energiezähler',
  humidity: 'Feuchtefühler',
  radiation: 'Strahlungssensor',
  wind_speed: 'Windmesser',
  wind_direction: 'Windrichtung',
  outdoor_temp: 'Außentemperatur',
}

const measurementLabels: Record<SensorMeasurement, string> = {
  vorlauf_temp: 'Vorlauftemperatur',
  ruecklauf_temp: 'Rücklauftemperatur',
  aussen_temp: 'Außentemperatur',
  raum_temp: 'Raumtemperatur',
  speicher_temp: 'Speichertemperatur',
  kollektor_temp: 'Kollektortemperatur',
  sole_temp: 'Soletemperatur',
  brunnenwasser_temp: 'Brunnenwassertemp.',
  druck: 'Druck',
  differenzdruck: 'Differenzdruck',
  volumenstrom: 'Volumenstrom',
  fuellstand: 'Füllstand',
  leistung: 'Leistung',
  energie: 'Energie',
  luftfeuchtigkeit: 'Luftfeuchtigkeit',
  globalstrahlung: 'Globalstrahlung',
  windgeschwindigkeit: 'Windgeschwindigkeit',
  windrichtung: 'Windrichtung',
  sonstige: 'Sonstige',
}

export default function SensorsPage() {
  const { sensors, addSensor, updateSensor, removeSensor } = useEnergyStore()
  const [editing, setEditing] = useState<Sensor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = () => {
    const s = createDefaultSensor()
    s.id = uuid()
    setEditing(s)
    setShowForm(true)
  }

  const startEdit = (s: Sensor) => {
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
      const s = sensors.find((s) => s.id === flowEditId)
      if (s) startEdit(s)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      const s = createDefaultSensor()
      s.id = uuid()
      if (flowInitialValues?.sensorType) {
        s.sensorType = flowInitialValues.sensorType as SensorType
      }
      setEditing(s)
      setShowForm(true)
    }
  }, [flowCreateNew])

  // Handle return from other pages with a created entity
  useEffect(() => {
    if (pendingReturn) {
      const draft = { ...pendingReturn.draft } as Sensor
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
    const exists = sensors.find((s) => s.id === editing.id)
    if (exists) updateSensor(editing.id, editing)
    else addSensor(editing)

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

  const update = <K extends keyof Sensor>(key: K, value: Sensor[K]) => {
    if (!editing) return
    setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">{sensors.find((s) => s.id === editing.id) ? 'Sensor bearbeiten' : 'Neuer Sensor'}</h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Sensor und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          <Section title="Allgemein" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. VL-Fühler Heizkreis 1" />
              <SelectField label="Sensortyp" value={editing.sensorType} onChange={(v) => update('sensorType', v as SensorType)} options={typeOptions} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Messgröße" value={editing.measurement} onChange={(v) => update('measurement', v as SensorMeasurement)} options={measurementOptions} />
              <InputField label="Einheit" value={editing.unit} onChange={(v) => update('unit', v)} placeholder="z.B. °C, bar, l/min" />
            </div>
          </Section>

          <Section title="Signaltyp & Messbereich" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Signaltyp" value={editing.signalType} onChange={(v) => update('signalType', v as SensorSignalType)} options={signalTypeOptions} />
              <InputField label="Genauigkeit" value={editing.accuracy} onChange={(v) => update('accuracy', Number(v))} type="number" step="0.01" unit={editing.unit || '—'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Messbereich Min" value={editing.rangeMin} onChange={(v) => update('rangeMin', Number(v))} type="number" unit={editing.unit || '—'} />
              <InputField label="Messbereich Max" value={editing.rangeMax} onChange={(v) => update('rangeMax', Number(v))} type="number" unit={editing.unit || '—'} />
            </div>
          </Section>

          <Section title="Einbauort" defaultOpen={true}>
            <InputField label="Einbauort" value={editing.location} onChange={(v) => update('location', v)} placeholder="z.B. Heizraum, Dach, Außenwand Nord" />
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
          <h1 className="page-header">Sensoren</h1>
          <p className="text-sm text-dark-faded mt-1">Alle Sensoren erfassen und zuordnen</p>
        </div>
        <button onClick={startAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Sensor hinzufügen
        </button>
      </div>

      {sensors.length === 0 ? (
        <div className="card text-center py-12">
          <Activity className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Sensoren konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Sensoren erfassen Messwerte für die Regelung und Überwachung</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sensors.map((s) => {
            const Icon = typeIcons[s.sensorType]
            return (
              <div key={s.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[s.sensorType]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-dark-text">{s.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[s.sensorType]}</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">{measurementLabels[s.measurement]}</span>
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">
                    {s.unit && `${s.rangeMin}…${s.rangeMax} ${s.unit}`}
                    {s.signalType && ` | ${signalTypeOptions.find((o) => o.value === s.signalType)?.label || s.signalType}`}
                    {s.location && ` | ${s.location}`}
                    {s.communication.ipAddress && ` | ${s.communication.protocol} @ ${s.communication.ipAddress}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { const copy: Sensor = { ...s, id: uuid(), name: s.name + ' (Kopie)' }; addSensor(copy) }} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(s)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeSensor(s.id)} itemName={s.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
