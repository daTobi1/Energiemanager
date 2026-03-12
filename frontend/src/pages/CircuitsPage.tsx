import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, Edit2, X, Copy, Waypoints, Flame, Snowflake, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type { HeatingCoolingCircuit, CircuitType, DistributionType, PumpType, ControllableComponent, CommunicationConfig, EnergyPort, PortEnergy } from '../types'
import { createDefaultCircuit, createDefaultControllableComponent } from '../types'
import { PortEditor, mkPort } from '../components/ui/PortEditor'

const circuitTypeOptions = [
  { value: 'heating', label: 'Heizkreis' },
  { value: 'cooling', label: 'Kältekreis' },
  { value: 'combined', label: 'Kombiniert (Heizen & Kühlen)' },
]

const distributionOptions = [
  { value: 'floor_heating', label: 'Fußbodenheizung' },
  { value: 'radiator', label: 'Heizkörper' },
  { value: 'fan_coil', label: 'Gebläsekonvektor (Fan Coil)' },
  { value: 'ceiling_cooling', label: 'Deckenstrahlplatten' },
  { value: 'mixed', label: 'Gemischt' },
]

const pumpTypeOptions = [
  { value: 'fixed_speed', label: 'Konstantdrehzahl' },
  { value: 'variable_speed', label: 'Drehzahlgeregelt' },
  { value: 'high_efficiency', label: 'Hocheffizienz (HE)' },
]

const typeLabels: Record<CircuitType, string> = {
  heating: 'Heizkreis', cooling: 'Kältekreis', combined: 'Kombiniert',
}

const typeColors: Record<CircuitType, string> = {
  heating: 'bg-red-500/15 text-red-400',
  cooling: 'bg-blue-500/15 text-blue-400',
  combined: 'bg-purple-500/15 text-purple-400',
}

function createDefaultCircuitPorts(type: CircuitType): EnergyPort[] {
  switch (type) {
    case 'heating':  return [mkPort('input', 'heat', 'Wärme'), mkPort('output', 'heat', 'Wärmeabgabe')]
    case 'cooling':  return [mkPort('input', 'cold', 'Kälte'), mkPort('output', 'cold', 'Kälteabgabe')]
    case 'combined': return [mkPort('input', 'heat', 'Wärme'), mkPort('input', 'cold', 'Kälte'), mkPort('output', 'heat', 'Wärmeabgabe'), mkPort('output', 'cold', 'Kälteabgabe')]
  }
}

const circuitNodeColors: Record<CircuitType, string> = {
  heating: '#fee2e2',
  cooling: '#dbeafe',
  combined: '#f3e8ff',
}

const distributionLabels: Record<DistributionType, string> = {
  floor_heating: 'FBH', radiator: 'HK', fan_coil: 'FC', ceiling_cooling: 'DKP', mixed: 'Gemischt',
}

// Inline communication config for a single controllable component (compact)
function CompactCommConfig({ config, onChange }: { config: CommunicationConfig; onChange: (c: CommunicationConfig) => void }) {
  const protocolOptions = [
    { value: 'modbus_tcp', label: 'Modbus TCP' },
    { value: 'sunspec', label: 'SunSpec' },
    { value: 'mqtt', label: 'MQTT' },
    { value: 'http_rest', label: 'HTTP/REST' },
    { value: 'bacnet_ip', label: 'BACnet/IP' },
    { value: 'knx_ip', label: 'KNX/IP' },
    { value: 'opc_ua', label: 'OPC UA' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 mt-2">
      <SelectField label="Protokoll" value={config.protocol} onChange={(v) => onChange({ ...config, protocol: v as CommunicationConfig['protocol'] })} options={protocolOptions} />
      <InputField label="IP-Adresse" value={config.ipAddress} onChange={(v) => onChange({ ...config, ipAddress: v })} placeholder="192.168.1.x" />
      <InputField label="Port" value={config.port} onChange={(v) => onChange({ ...config, port: Number(v) })} type="number" />
    </div>
  )
}

// Component block for a controllable actuator
function ControllableBlock({
  label, hint, component, onChange,
}: {
  label: string
  hint: string
  component: ControllableComponent
  onChange: (c: ControllableComponent) => void
}) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${component.enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-dark-bg border-dark-border'}`}>
      <CheckboxField
        label={label}
        checked={component.enabled}
        onChange={(v) => onChange(v ? { ...component, enabled: true } : { ...createDefaultControllableComponent(), enabled: false })}
        hint={hint}
      />
      {component.enabled && (
        <CompactCommConfig config={component.communication} onChange={(c) => onChange({ ...component, communication: c })} />
      )}
    </div>
  )
}

export default function CircuitsPage() {
  const { circuits, generators, storages, rooms, meters, addCircuit, updateCircuit, removeCircuit } = useEnergyStore()
  const [editing, setEditing] = useState<HeatingCoolingCircuit | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { navigateToCreate, isCreationTarget, saveAndReturn, cancelAndReturn, pendingReturn, clearPendingCreation, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

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
  const update = <K extends keyof HeatingCoolingCircuit>(key: K, value: HeatingCoolingCircuit[K]) => {
    if (editing) setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const thermalStorageOptions = storages.filter((s) => s.type === 'heat' || s.type === 'cold').map((s) => ({ value: s.id, label: s.name || 'Unbenannt' }))
  const generatorOptions = generators.map((g) => ({ value: g.id, label: g.name || 'Unbenannt' }))
  const roomOptions = rooms.map((r) => ({ value: r.id, label: r.name || 'Unbenannt' }))
  const meterOptions = meters.map((m) => ({ value: m.id, label: `${m.name} (${m.meterNumber || '-'})` }))

  // Count active components
  const countActive = (c: HeatingCoolingCircuit) => {
    let n = 0
    if (c.flowTempSetpoint.enabled) n++
    if (c.mixerValve.enabled) n++
    if (c.pumpControl.enabled) n++
    if (c.zoneValves.enabled) n++
    return n
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
          <Section title="Grunddaten" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Bezeichnung" value={editing.name} onChange={(v) => update('name', v)} placeholder="z.B. FBH Erdgeschoss, Heizkörper OG" />
              <SelectField label="Typ" value={editing.type} onChange={(v) => { update('type', v as CircuitType); update('ports', createDefaultCircuitPorts(v as CircuitType)) }} options={circuitTypeOptions} />
            </div>
            <SelectField label="Verteilsystem" value={editing.distributionType} onChange={(v) => {
              const dt = v as DistributionType
              const updates: Partial<HeatingCoolingCircuit> = { distributionType: dt }
              // Auto-adjust defaults based on distribution type
              if (dt === 'floor_heating') {
                updates.flowTemperatureC = 35; updates.returnTemperatureC = 28
                updates.heatingCurve = { steepness: 0.6, parallelShift: editing.heatingCurve.parallelShift }
              } else if (dt === 'radiator') {
                updates.flowTemperatureC = 55; updates.returnTemperatureC = 45
                updates.heatingCurve = { steepness: 1.4, parallelShift: editing.heatingCurve.parallelShift }
              } else if (dt === 'fan_coil' || dt === 'ceiling_cooling') {
                updates.flowTemperatureC = 16; updates.returnTemperatureC = 20
                updates.heatingCurve = { steepness: 0.4, parallelShift: editing.heatingCurve.parallelShift }
              }
              setEditing((prev) => prev ? { ...prev, ...updates } : prev)
            }} options={distributionOptions} info="Art der Wärme-/Kälteabgabe im Raum. Temperaturen und Heizkurve werden automatisch vorbelegt." />
          </Section>

          <PortEditor
            ports={editing.ports || []}
            onChange={(ports) => update('ports', ports)}
            onReset={() => update('ports', createDefaultCircuitPorts(editing.type))}
            nodeName={editing.name || typeLabels[editing.type]}
            nodeColor={circuitNodeColors[editing.type]}
          />

          <Section title="Regelung" defaultOpen={true} badge={editing.controllable ? `${countActive(editing)} Komponenten` : undefined}>
            <CheckboxField
              label="Regelkreis regelbar"
              checked={editing.controllable}
              onChange={(v) => update('controllable', v)}
              hint="Kann vom EMS aktiv geregelt werden"
            />
            {editing.controllable && (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-dark-faded">
                  Welche Komponenten soll das EMS ansteuern? Jede Komponente kann über ein eigenes Busprotokoll angesprochen werden.
                </p>
                <ControllableBlock
                  label="Vorlaufsollwert-Vorgabe"
                  hint="EMS gibt die Vorlauftemperatur vor (Standard-Regelgröße)"
                  component={editing.flowTempSetpoint}
                  onChange={(c) => update('flowTempSetpoint', c)}
                />
                <ControllableBlock
                  label="Mischventil"
                  hint="Motorischer Mischer zur Vorlauftemperatur-Regelung"
                  component={editing.mixerValve}
                  onChange={(c) => update('mixerValve', c)}
                />
                <ControllableBlock
                  label="Umwälzpumpe"
                  hint="Pumpe ein/aus oder Drehzahlregelung"
                  component={editing.pumpControl}
                  onChange={(c) => update('pumpControl', c)}
                />
                <ControllableBlock
                  label="Zonenventile / Stellantriebe"
                  hint="Einzelraumregelung über Stellventile an Verteilern"
                  component={editing.zoneValves}
                  onChange={(c) => update('zoneValves', c)}
                />
              </div>
            )}
          </Section>

          <Section title="Temperaturen" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Vorlauftemperatur" value={editing.flowTemperatureC} onChange={(v) => update('flowTemperatureC', Number(v))} type="number" unit="°C" info="Auslegungsvorlauftemperatur des Kreises" />
              <InputField label="Rücklauftemperatur" value={editing.returnTemperatureC} onChange={(v) => update('returnTemperatureC', Number(v))} type="number" unit="°C" info="Auslegungsrücklauftemperatur" />
              <InputField label="Auslegungsaußentemp." value={editing.designOutdoorTemperatureC} onChange={(v) => update('designOutdoorTemperatureC', Number(v))} type="number" unit="°C" info="Normaußentemperatur für die Heizlastberechnung (z.B. -12°C für München)" />
            </div>
          </Section>

          {(editing.type === 'heating' || editing.type === 'combined') && (
            <Section title="Heizkurve" defaultOpen={true}>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Steilheit" value={editing.heatingCurve.steepness} onChange={(v) => update('heatingCurve', { ...editing.heatingCurve, steepness: Number(v) })} type="number" step="0.1" min={0.2} max={3.0} info="Steilheit der Heizkurve. Niedrig (0.4-0.8) für FBH, hoch (1.0-1.8) für Heizkörper." />
                <InputField label="Parallelverschiebung" value={editing.heatingCurve.parallelShift} onChange={(v) => update('heatingCurve', { ...editing.heatingCurve, parallelShift: Number(v) })} type="number" step="0.5" min={-5} max={5} unit="K" info="Verschiebt die gesamte Heizkurve nach oben (+) oder unten (-)" />
              </div>
              <div className="p-3 bg-dark-bg rounded-lg border border-dark-border mt-2">
                <p className="text-xs text-dark-faded mb-1">Berechnete Vorlauftemperaturen (Heizkurve):</p>
                <div className="flex gap-4 text-xs text-dark-muted">
                  {[-10, -5, 0, 5, 10, 15].map((outdoor) => {
                    const vl = Math.round(20 + editing.heatingCurve.steepness * (20 - outdoor) + editing.heatingCurve.parallelShift)
                    return (
                      <span key={outdoor}>
                        {outdoor}°C → <strong className="text-dark-text">{vl}°C</strong>
                      </span>
                    )
                  })}
                </div>
              </div>
            </Section>
          )}

          <Section title="Umwälzpumpe" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Pumpentyp" value={editing.pumpType} onChange={(v) => update('pumpType', v as PumpType)} options={pumpTypeOptions} info="Hocheffizienzpumpen sparen bis zu 80% Pumpenstrom" />
              <InputField label="Pumpenleistung" value={editing.pumpPowerW} onChange={(v) => update('pumpPowerW', Number(v))} type="number" unit="W" info="Elektrische Leistungsaufnahme der Umwälzpumpe" />
            </div>
          </Section>

          <Section title="Versorgung & Zuordnungen" defaultOpen={true}>
            <div>
              <label className="label">Gespeist aus Speicher</label>
              <p className="text-xs text-dark-faded mb-1">Wird der Kreis aus einem Puffer-/Kältespeicher versorgt?</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {thermalStorageOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const ids = editing.supplyStorageIds.includes(opt.value)
                        ? editing.supplyStorageIds.filter((id) => id !== opt.value)
                        : [...editing.supplyStorageIds, opt.value]
                      update('supplyStorageIds', ids)
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editing.supplyStorageIds.includes(opt.value)
                        ? 'bg-red-600/20 border-red-500/40 text-red-400'
                        : 'bg-dark-hover border-dark-border text-dark-faded hover:text-dark-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                {thermalStorageOptions.length === 0 && (
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/storage', assignField: 'supplyStorageIds', assignMode: 'append', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-red-500/50 hover:text-red-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Thermischen Speicher jetzt anlegen</span>
                  </button>
                )}
                {thermalStorageOptions.length > 0 && (
                  <button onClick={() => navigateToCreate({ targetPath: '/storage', assignField: 'supplyStorageIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-red-500/50 hover:bg-red-500/5 text-dark-faded hover:text-red-400 transition-colors">
                    <Plus className="w-3 h-3" /> Neuen Speicher anlegen
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Direkt angeschlossene Erzeuger</label>
              <p className="text-xs text-dark-faded mb-1">Nur wenn kein Speicher dazwischen — Erzeuger speist direkt in den Kreis</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {generatorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const ids = editing.generatorIds.includes(opt.value)
                        ? editing.generatorIds.filter((id) => id !== opt.value)
                        : [...editing.generatorIds, opt.value]
                      update('generatorIds', ids)
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editing.generatorIds.includes(opt.value)
                        ? 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                        : 'bg-dark-hover border-dark-border text-dark-faded hover:text-dark-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                {generatorOptions.length === 0 && (
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/generators', assignField: 'generatorIds', assignMode: 'append', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Erzeuger jetzt anlegen</span>
                  </button>
                )}
                {generatorOptions.length > 0 && (
                  <button onClick={() => navigateToCreate({ targetPath: '/generators', assignField: 'generatorIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-amber-500/50 hover:bg-amber-500/5 text-dark-faded hover:text-amber-400 transition-colors">
                    <Plus className="w-3 h-3" /> Neuen Erzeuger anlegen
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Zugeordnete Räume</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {roomOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const ids = editing.roomIds.includes(opt.value)
                        ? editing.roomIds.filter((id) => id !== opt.value)
                        : [...editing.roomIds, opt.value]
                      update('roomIds', ids)
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editing.roomIds.includes(opt.value)
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-dark-hover border-dark-border text-dark-faded hover:text-dark-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                {roomOptions.length === 0 && (
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/rooms', assignField: 'roomIds', assignMode: 'append', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Raum jetzt anlegen</span>
                  </button>
                )}
                {roomOptions.length > 0 && (
                  <button onClick={() => navigateToCreate({ targetPath: '/rooms', assignField: 'roomIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-dark-faded hover:text-emerald-400 transition-colors">
                    <Plus className="w-3 h-3" /> Neuen Raum anlegen
                  </button>
                )}
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
                {meterOptions.length === 0 && (
                  <button
                    onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'meterIds', assignMode: 'append', draft: editing })}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-dark-border rounded-lg text-dark-faded hover:border-yellow-500/50 hover:text-yellow-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Zähler jetzt anlegen</span>
                  </button>
                )}
                {meterOptions.length > 0 && (
                  <button onClick={() => navigateToCreate({ targetPath: '/meters', assignField: 'meterIds', assignMode: 'append', draft: editing })} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dashed border-dark-border hover:border-yellow-500/50 hover:bg-yellow-500/5 text-dark-faded hover:text-yellow-400 transition-colors">
                    <Plus className="w-3 h-3" /> Neuen Zähler anlegen
                  </button>
                )}
              </div>
            </div>
          </Section>

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
