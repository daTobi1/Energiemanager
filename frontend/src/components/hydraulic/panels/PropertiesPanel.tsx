import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Edit2, Trash2, RotateCw, RotateCcw, Plus, Minus, Zap, Link, Unlink } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useEnergyStore } from '../../../store/useEnergyStore'
import { isDualSchemaHydraulicNode } from '../../shared/crossSchemaUtils'
import type { HeatPumpGenerator, ChpGenerator, ChillerGenerator, Consumer } from '../../../types'
import { createDefaultCommunication } from '../../../types'
import { v4 as uuid } from 'uuid'
import { hydraulicPortConfigs } from '../../shared/portStepperConfigs'
import { EntityEditDrawer } from '../../ui/EntityEditDrawer'

interface Props {
  node: Node | null
  onClose: () => void
  onDelete: (nodeId: string) => void
  onRotate: (nodeId: string, direction: 'cw' | 'ccw') => void
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void
}

const typeLabels: Record<string, string> = {
  heat_pump: 'Wärmepumpe',
  boiler: 'Kessel',
  chp: 'BHKW',
  chiller: 'Kältemaschine',
  thermal_heat: 'Pufferspeicher',
  thermal_cold: 'Kältespeicher',
  hydraulic_separator: 'Hydraulische Weiche',
  pump: 'Umwälzpumpe',
  mixer: '3-Wege-Mischer',
  circuit: 'Heizkreis',
  room: 'Raum',
  consumer: 'Verbraucher',
  meter: 'Zähler',
  solar_thermal: 'Solarthermie',
  ground_source: 'Erdsonde / Erdkollektor',
  air_source: 'Luft (Umgebung)',
  well_source: 'Brunnen / Grundwasser',
  sensor: 'Sensor / Fühler',
  junction: 'Verbindungspunkt',
}

const typeRoutes: Record<string, string> = {
  heat_pump: '/generators',
  boiler: '/generators',
  chp: '/generators',
  chiller: '/generators',
  thermal_heat: '/storage',
  thermal_cold: '/storage',
  circuit: '/circuits',
  room: '/rooms',
  consumer: '/consumers',
  meter: '/meters',
  sensor: '/sensors',
  solar_thermal: '/sources',
  ground_source: '/sources',
  air_source: '/sources',
  well_source: '/sources',
}

/** +/- Stepper für Anschlussanzahl */
function PortStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-dark-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="btn-icon p-1 border border-dark-border rounded disabled:opacity-30"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-sm text-dark-text font-mono min-w-[2ch] text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="btn-icon p-1 border border-dark-border rounded disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default memo(function PropertiesPanel({ node, onClose, onDelete, onRotate, onUpdateData }: Props) {
  const navigate = useNavigate()
  const generators = useEnergyStore((s) => s.generators)
  const consumers = useEnergyStore((s) => s.consumers)
  const addConsumer = useEnergyStore((s) => s.addConsumer)
  const updateConsumer = useEnergyStore((s) => s.updateConsumer)
  const removeConsumer = useEnergyStore((s) => s.removeConsumer)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!node) return null

  const nodeType = node.type || ''
  const data = node.data as Record<string, unknown>
  const label = (data.label as string) || ''
  const entityId = data.entityId as string | undefined
  const rotation = (data.rotation as number) || 0
  const route = typeRoutes[nodeType]

  const portConfigs = hydraulicPortConfigs[nodeType]

  const handleEdit = () => {
    if (route && entityId) {
      setDrawerOpen(true)
    }
  }

  return (
    <div className="w-64 bg-dark-card border-l border-dark-border flex flex-col" style={{ height: '100%' }}>
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-dark-faded tracking-wider uppercase">Eigenschaften</h3>
        <button onClick={onClose} className="btn-icon p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Typ */}
        <div>
          <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Typ</p>
          <p className="text-sm text-dark-text">{typeLabels[nodeType] || nodeType}</p>
        </div>

        {/* Name */}
        <div>
          <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Name</p>
          <p className="text-sm text-dark-text">{label}</p>
        </div>

        {/* Rotation */}
        <div>
          <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Drehung</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRotate(node.id, 'ccw')}
              className="btn-icon p-1.5 border border-dark-border rounded"
              title="90° gegen Uhrzeigersinn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm text-dark-text font-mono min-w-[3ch] text-center">{rotation}°</span>
            <button
              onClick={() => onRotate(node.id, 'cw')}
              className="btn-icon p-1.5 border border-dark-border rounded"
              title="90° im Uhrzeigersinn"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* === Anschlüsse konfigurieren === */}
        {portConfigs && portConfigs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-2">Anschlüsse</p>
            <div className="space-y-2">
              {portConfigs.map((cfg) => (
                <PortStepper
                  key={cfg.key}
                  label={cfg.label}
                  value={(data[cfg.key] as number) || cfg.default}
                  min={cfg.min} max={cfg.max}
                  onChange={(v) => onUpdateData(node.id, { [cfg.key]: v })}
                />
              ))}
            </div>
          </div>
        )}

        {/* === Pumpe/Mischer: Verbraucher verknüpfen für Stromschema === */}
        {(nodeType === 'pump' || nodeType === 'mixer') && (() => {
          const linkedId = data.linkedConsumerId as string | undefined
          const linkedConsumer = linkedId ? consumers.find((c) => c.id === linkedId) : null

          const handleLink = () => {
            const id = uuid()
            const c: Consumer = {
              id, name: `${label} (Strom)`, type: 'hvac' as any, nominalPowerKw: 0.1,
              annualConsumptionKwh: 500, loadProfile: 'G1',
              controllable: false, sheddable: false, priority: 5,
              connectedSourceIds: [], assignedMeterIds: [],
              communication: createDefaultCommunication(), ports: [], notes: `Verknüpft mit ${nodeType === 'pump' ? 'Pumpe' : 'Mischer'} im Hydraulikschema`,
              wallboxMaxPowerKw: 0, wallboxPhases: 1, wallboxMinCurrentA: 0,
              vehicleBatteryKwh: 0, vehicleConsumptionPer100km: 0, ocppEnabled: false,
            }
            addConsumer(c)
            onUpdateData(node.id, { linkedConsumerId: id })
          }

          const handleUnlink = () => {
            if (linkedId) removeConsumer(linkedId)
            onUpdateData(node.id, { linkedConsumerId: undefined })
          }

          return (
            <div className="border-t border-dark-border pt-3 mt-1">
              <p className="text-[10px] font-semibold text-amber-500 tracking-wider uppercase mb-2">
                Stromversorgung
              </p>
              {linkedConsumer ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-muted">Verbraucher</span>
                    <span className="text-dark-text">{linkedConsumer.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">Leistung</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.01"
                        step="0.1"
                        value={linkedConsumer.nominalPowerKw}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (!isNaN(val) && val > 0) {
                            updateConsumer(linkedConsumer.id, { ...linkedConsumer, nominalPowerKw: val })
                          }
                        }}
                        className="w-16 text-right bg-dark-hover border border-dark-border rounded px-1 py-0.5 text-xs text-dark-text font-mono"
                      />
                      <span className="text-dark-muted">kW</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/electrical-schema', { state: { focusEntityId: linkedId } })}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    Im Stromschema anzeigen
                  </button>
                  <button
                    onClick={handleUnlink}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-dark-border text-dark-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                    Verknüpfung lösen
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[9px] text-dark-faded mb-2">
                    Verbraucher erstellen, der im Stromschema als Last erscheint.
                  </p>
                  <button
                    onClick={handleLink}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Link className="w-3 h-3" />
                    Verbraucher erstellen
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* === Verbraucher: Stromschema-Link === */}
        {nodeType === 'consumer' && entityId && (
          <div className="border-t border-dark-border pt-3 mt-1">
            <button
              onClick={() => navigate('/electrical-schema', { state: { focusEntityId: entityId } })}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Im Stromschema anzeigen
            </button>
          </div>
        )}

        {/* Position */}
        <div>
          <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Position</p>
          <p className="text-xs text-dark-muted">
            X: {Math.round(node.position.x)} &nbsp; Y: {Math.round(node.position.y)}
          </p>
        </div>

        {/* Typ-spezifische Info */}
        {data.nominalPowerKw && (
          <div>
            <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Nennleistung</p>
            <p className="text-sm text-dark-text">{String(data.nominalPowerKw)} kW</p>
          </div>
        )}
        {data.capacityKwh && (
          <div>
            <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Kapazität</p>
            <p className="text-sm text-dark-text">{String(data.capacityKwh)} kWh</p>
          </div>
        )}
        {data.peakPowerKwp && (
          <div>
            <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">Peak-Leistung</p>
            <p className="text-sm text-dark-text">{String(data.peakPowerKwp)} kWp</p>
          </div>
        )}
        {data.flowTempC && (
          <div>
            <p className="text-[10px] font-semibold text-dark-faded tracking-wider uppercase mb-1">VL / RL</p>
            <p className="text-sm text-dark-text">{String(data.flowTempC)} / {String(data.returnTempC)} °C</p>
          </div>
        )}

        {/* === Querverbindung zum Stromschema === */}
        {isDualSchemaHydraulicNode(nodeType) && entityId && (() => {
          const gen = generators.find((g) => g.id === entityId)
          if (!gen) return null
          return (
            <div className="border-t border-dark-border pt-3 mt-1">
              <p className="text-[10px] font-semibold text-amber-500 tracking-wider uppercase mb-2">
                Stromschema
              </p>
              <div className="space-y-1.5">
                {gen.type === 'heat_pump' && (() => {
                  const hp = gen as HeatPumpGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Elektr. Leistung</span>
                        <span className="text-dark-text">{hp.electricalPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">COP (Nenn)</span>
                        <span className="text-dark-text">{hp.copRated}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">COP = Q/P</span>
                        <span className="text-dark-text font-mono">
                          {hp.heatingPowerKw}/{hp.electricalPowerKw} = {(hp.heatingPowerKw / hp.electricalPowerKw).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Schematyp</span>
                        <span className="text-dark-text">Motor-Last (M)</span>
                      </div>
                    </>
                  )
                })()}
                {gen.type === 'chiller' && (() => {
                  const ch = gen as ChillerGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Elektr. Leistung</span>
                        <span className="text-dark-text">{ch.electricalPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">EER (Nenn)</span>
                        <span className="text-dark-text">{ch.eerRated}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Schematyp</span>
                        <span className="text-dark-text">Motor-Last (M)</span>
                      </div>
                    </>
                  )
                })()}
                {gen.type === 'chp' && (() => {
                  const chp = gen as ChpGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Elektr. Leistung</span>
                        <span className="text-dark-text">{chp.electricalPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Elektr. Wirkungsgrad</span>
                        <span className="text-dark-text">{Math.round(chp.electricalEfficiency * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Stromkennzahl</span>
                        <span className="text-dark-text">{chp.powerToHeatRatio}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Schematyp</span>
                        <span className="text-dark-text">Generator (G)</span>
                      </div>
                    </>
                  )
                })()}
              </div>
              {/* Konsistenz-Hinweis */}
              {gen.connectedGeneratorIds.length === 0 && (
                <p className="text-[9px] text-amber-600 mt-1.5">
                  Keine Stromquelle zugeordnet — im Stromschema verbinden.
                </p>
              )}
              <button
                onClick={() => navigate('/electrical-schema', { state: { focusEntityId: entityId } })}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <Zap className="w-3 h-3" />
                Im Stromschema anzeigen
              </button>
            </div>
          )
        })()}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-dark-border space-y-2">
        {route && entityId && (
          <button onClick={handleEdit}
            className="w-full flex items-center justify-center gap-2 btn-primary text-sm py-2">
            <Edit2 className="w-4 h-4" />
            Bearbeiten
          </button>
        )}
        <button onClick={() => onDelete(node.id)}
          className="w-full flex items-center justify-center gap-2 btn-danger text-sm py-2">
          <Trash2 className="w-4 h-4" />
          Entfernen
        </button>
      </div>

      {entityId && (
        <EntityEditDrawer
          open={drawerOpen}
          nodeType={nodeType}
          entityId={entityId}
          onClose={() => setDrawerOpen(false)}
          onSaved={(id, name) => onUpdateData(node.id, { label: name })}
        />
      )}
    </div>
  )
})
