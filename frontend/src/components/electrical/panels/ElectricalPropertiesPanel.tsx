import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, Trash2, RotateCw, RotateCcw, Plus, Minus, Flame, Droplets } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useEnergyStore } from '../../../store/useEnergyStore'
import { isDualSchemaElectricalNode } from '../../shared/crossSchemaUtils'
import type { HeatPumpGenerator, ChpGenerator, ChillerGenerator } from '../../../types'
import { electricalPortConfigs } from '../../shared/portStepperConfigs'

interface Props {
  node: Node | null
  onClose: () => void
  onDelete: (nodeId: string) => void
  onRotate: (nodeId: string, direction: 'cw' | 'ccw') => void
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void
}

const typeLabels: Record<string, string> = {
  transformer: 'Trafo / Hausanschluss',
  pv_inverter: 'PV + Wechselrichter',
  battery_system: 'Batterie + WR',
  generator: 'BHKW Generator',
  motor_load: 'Motor-Last',
  wallbox: 'Wallbox / Ladestation',
  consumer_load: 'Verbraucher',
  circuit_breaker: 'LS-Schalter',
  elec_meter: 'Stromzähler',
  elec_bus: 'Sammelschiene',
  sub_distribution: 'Unterverteilung',
  sun_source: 'Sonne',
  wind_source: 'Wind',
  wind_turbine: 'Windrad',
  junction: 'Verbindungspunkt',
}

const typeRoutes: Record<string, string> = {
  transformer: '/generators',
  pv_inverter: '/generators',
  generator: '/generators',
  battery_system: '/storage',
  motor_load: '/generators',
  wind_turbine: '/generators',
  wallbox: '/consumers',
  consumer_load: '/consumers',
  elec_meter: '/meters',
}

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

export default memo(function ElectricalPropertiesPanel({ node, onClose, onDelete, onRotate, onUpdateData }: Props) {
  const navigate = useNavigate()
  const generators = useEnergyStore((s) => s.generators)
  const storages = useEnergyStore((s) => s.storages)
  const circuits = useEnergyStore((s) => s.circuits)

  if (!node) return null

  const nodeType = node.type || ''
  const data = node.data as Record<string, unknown>
  const label = (data.label as string) || ''
  const entityId = data.entityId as string | undefined
  const rotation = (data.rotation as number) || 0
  const route = typeRoutes[nodeType]

  const portConfigs = electricalPortConfigs[nodeType]

  const handleEdit = () => {
    if (route && entityId) {
      navigate(route, { state: { editId: entityId, returnTo: '/electrical-schema' } })
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

        {/* Anschlüsse konfigurieren */}
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

        {/* === Querverbindung zum Hydraulikschema === */}
        {isDualSchemaElectricalNode(nodeType, data.motorType as string | undefined) && entityId && (() => {
          const gen = generators.find((g) => g.id === entityId)
          if (!gen) return null
          return (
            <div className="border-t border-dark-border pt-3 mt-1">
              <p className="text-[10px] font-semibold text-red-500 tracking-wider uppercase mb-2">
                Hydraulikschema
              </p>
              <div className="space-y-1.5">
                {gen.type === 'heat_pump' && (() => {
                  const hp = gen as HeatPumpGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Heizleistung</span>
                        <span className="text-dark-text">{hp.heatingPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">VL / RL</span>
                        <span className="text-dark-text">{hp.flowTemperatureC}° / {hp.returnTemperatureC}°C</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">COP = Q/P</span>
                        <span className="text-dark-text font-mono">
                          {hp.heatingPowerKw}/{hp.electricalPowerKw} = {(hp.heatingPowerKw / hp.electricalPowerKw).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">WP-Typ</span>
                        <span className="text-dark-text">{hp.heatPumpType === 'air_water' ? 'Luft/Wasser' : hp.heatPumpType === 'brine_water' ? 'Sole/Wasser' : 'Wasser/Wasser'}</span>
                      </div>
                      {hp.coolingCapable && (
                        <div className="flex justify-between text-xs">
                          <span className="text-dark-muted">Kühlung</span>
                          <span className="text-dark-text">{hp.coolingPowerKw} kW</span>
                        </div>
                      )}
                    </>
                  )
                })()}
                {gen.type === 'chiller' && (() => {
                  const ch = gen as ChillerGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Kälteleistung</span>
                        <span className="text-dark-text">{ch.coolingPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">VL / RL</span>
                        <span className="text-dark-text">{ch.flowTemperatureC}° / {ch.returnTemperatureC}°C</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">EER</span>
                        <span className="text-dark-text">{ch.eerRated}</span>
                      </div>
                    </>
                  )
                })()}
                {gen.type === 'chp' && (() => {
                  const chp = gen as ChpGenerator
                  return (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Therm. Leistung</span>
                        <span className="text-dark-text">{chp.thermalPowerKw} kW</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Therm. Wirkungsgrad</span>
                        <span className="text-dark-text">{Math.round(chp.thermalEfficiency * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Gesamt-Wirkungsgrad</span>
                        <span className="text-dark-text">{Math.round(chp.overallEfficiency * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-muted">Brennstoff</span>
                        <span className="text-dark-text">{chp.fuelType === 'natural_gas' ? 'Erdgas' : chp.fuelType}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
              {/* Konsistenz-Hinweis: thermisch nicht verbunden? */}
              {(() => {
                const hasThermalConn = storages.some((s) => s.type !== 'battery' && s.connectedGeneratorIds.includes(entityId!))
                  || circuits.some((c) => c.generatorIds.includes(entityId!))
                if (!hasThermalConn) {
                  return (
                    <p className="text-[9px] text-red-600 mt-1.5">
                      Nicht mit Speicher/Heizkreis verbunden — im Hydraulikschema verbinden.
                    </p>
                  )
                }
                return null
              })()}
              <button
                onClick={() => navigate('/hydraulic-schema', { state: { focusEntityId: entityId } })}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Flame className="w-3 h-3" />
                Im Hydraulikschema anzeigen
              </button>
            </div>
          )
        })()}

        {/* === Verbraucher/Wallbox: Hydraulikschema-Link === */}
        {(nodeType === 'consumer_load' || nodeType === 'wallbox') && entityId && (
          <div className="border-t border-dark-border pt-3 mt-1">
            <button
              onClick={() => navigate('/hydraulic-schema', { state: { focusEntityId: entityId } })}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Droplets className="w-3 h-3" />
              Im Hydraulikschema anzeigen
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-dark-border space-y-2">
        {route && entityId && (
          <button onClick={handleEdit}
            className="w-full flex items-center justify-center gap-2 btn-primary text-sm py-2">
            <ExternalLink className="w-4 h-4" />
            Bearbeiten
          </button>
        )}
        <button onClick={() => onDelete(node.id)}
          className="w-full flex items-center justify-center gap-2 btn-danger text-sm py-2">
          <Trash2 className="w-4 h-4" />
          Entfernen
        </button>
      </div>
    </div>
  )
})
