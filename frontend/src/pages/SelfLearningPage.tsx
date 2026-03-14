import { useState, useEffect, useCallback } from 'react'
import { Brain, RefreshCw, Zap, Flame, Thermometer, Info, ChevronDown } from 'lucide-react'
import { api } from '../api/client'
import { useEnergyStore } from '../store/useEnergyStore'
import type { SelfLearningStatus, SelfLearningModel, ThermalRoomLearning, ActivationMode } from '../types'

const modeConfig: Record<ActivationMode, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Aktiv', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  passive: { label: 'Passiv', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  off: { label: 'Aus', color: 'text-dark-faded', bg: 'bg-dark-hover', border: 'border-dark-border' },
}

const levelConfig = {
  excellent: { label: 'Exzellent', color: 'text-emerald-400', barColor: 'bg-emerald-500' },
  ready: { label: 'Bereit', color: 'text-blue-400', barColor: 'bg-blue-500' },
  learning: { label: 'Lernend', color: 'text-amber-400', barColor: 'bg-amber-500' },
  not_ready: { label: 'Nicht bereit', color: 'text-red-400', barColor: 'bg-red-500' },
}

const typeIcons: Record<string, typeof Zap> = {
  pv_correction: Zap,
  load_correction: Flame,
  thermal_correction: Thermometer,
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-dark-hover rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  )
}

function OverallReadinessBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 60 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = pct >= 60 ? 'text-emerald-400' : pct >= 30 ? 'text-amber-400' : 'text-red-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-dark-faded">Gesamtbereitschaft</span>
        <span className={`text-lg font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-3 bg-dark-hover rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ModelCard({
  model,
  onModeChange,
  onTrain,
  training,
}: {
  model: SelfLearningModel
  onModeChange: (type: string, mode: ActivationMode) => void
  onTrain: (type: string) => void
  training: boolean
}) {
  const Icon = typeIcons[model.forecast_type] || Brain
  const mode = modeConfig[model.activation_mode]
  const level = levelConfig[model.readiness.level]
  const { criteria } = model.readiness

  const criteriaLabels = [
    { key: 'data', label: 'Daten', value: criteria.data },
    { key: 'accuracy', label: 'Genauigkeit', value: criteria.accuracy },
    { key: 'error', label: 'Fehler', value: criteria.error },
    { key: 'freshness', label: 'Aktualitaet', value: criteria.freshness },
  ]

  return (
    <div className={`bg-dark-card rounded-xl border ${mode.border} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode.bg}`}>
            <Icon className={`w-5 h-5 ${mode.color}`} />
          </div>
          <div>
            <h3 className="font-semibold text-dark-text">{model.display_name}</h3>
            <span className={`text-xs ${level.color}`}>{level.label} ({Math.round(model.readiness.score * 100)}%)</span>
          </div>
        </div>

        {/* Mode Dropdown */}
        <div className="relative">
          <select
            value={model.activation_mode}
            onChange={(e) => onModeChange(model.forecast_type, e.target.value as ActivationMode)}
            className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium border ${mode.border} ${mode.bg} ${mode.color} bg-dark-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500`}
          >
            <option value="active">Aktiv</option>
            <option value="passive">Passiv</option>
            <option value="off">Aus</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-dark-faded" />
        </div>
      </div>

      {/* Readiness Criteria */}
      <div className="space-y-2 mb-4">
        {criteriaLabels.map(({ key, label, value }) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-dark-faded">{label}</span>
              <span className="text-dark-text">{Math.round(value * 100)}%</span>
            </div>
            <ProgressBar value={value} color={value >= 0.7 ? 'bg-emerald-500' : value >= 0.4 ? 'bg-amber-500' : 'bg-red-500'} />
          </div>
        ))}
      </div>

      {/* Passive correction hint */}
      {model.activation_mode === 'passive' && model.passive_correction_kw !== 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-amber-400">
            Was ML korrigieren wuerde: <span className="font-mono font-bold">
              {model.passive_correction_kw > 0 ? '+' : ''}{model.passive_correction_kw.toFixed(2)} kW
            </span>
          </p>
        </div>
      )}

      {/* Recommendation */}
      <p className="text-xs text-dark-faded mb-3">{model.readiness.recommendation}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-border">
        <div className="text-xs text-dark-faded">
          {model.trained_at
            ? `Trainiert: ${new Date(model.trained_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : 'Noch nicht trainiert'}
          {model.training_samples > 0 && ` · ${model.training_samples} Samples`}
        </div>
        <button
          onClick={() => onTrain(model.forecast_type)}
          disabled={training}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-hover hover:bg-dark-border rounded-lg text-xs text-dark-text transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${training ? 'animate-spin' : ''}`} />
          Trainieren
        </button>
      </div>
    </div>
  )
}

function ThermalRoomTable({ rooms, onLearn, learning }: { rooms: ThermalRoomLearning[]; onLearn: () => void; learning: boolean }) {
  const statusConfig = {
    learned: { icon: '\u25CF', color: 'text-emerald-400', label: 'Gelernt' },
    learning: { icon: '\u25D0', color: 'text-amber-400', label: 'Lernend' },
    waiting: { icon: '\u25CB', color: 'text-dark-faded', label: 'Wartend' },
  }

  if (rooms.length === 0) {
    return (
      <div className="bg-dark-card rounded-xl border border-dark-border p-6 text-center">
        <Thermometer className="w-8 h-8 text-dark-faded mx-auto mb-2" />
        <p className="text-sm text-dark-faded">Keine Raeume mit Heizkreis konfiguriert.</p>
      </div>
    )
  }

  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-dark-border">
        <h3 className="font-semibold text-dark-text">Thermische Raumparameter</h3>
        <button
          onClick={onLearn}
          disabled={learning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-hover hover:bg-dark-border rounded-lg text-xs text-dark-text transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${learning ? 'animate-spin' : ''}`} />
          Lernen starten
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-dark-faded text-xs border-b border-dark-border">
              <th className="text-left px-5 py-2 font-medium">Raum</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">&tau; Heiz. (h)</th>
              <th className="text-right px-3 py-2 font-medium">&tau; Verlust (h)</th>
              <th className="text-right px-3 py-2 font-medium">Kurve</th>
              <th className="text-right px-5 py-2 font-medium">Datenpunkte</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const st = statusConfig[room.status]
              return (
                <tr key={room.room_id} className="border-b border-dark-border/50 hover:bg-dark-hover/50">
                  <td className="px-5 py-2.5 text-dark-text font-medium">{room.room_name}</td>
                  <td className="px-3 py-2.5">
                    <span className={`${st.color} flex items-center gap-1.5`}>
                      <span className="text-base">{st.icon}</span>
                      <span className="text-xs">{st.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-dark-text">
                    {room.tau_response_h != null ? room.tau_response_h.toFixed(2) : '\u2014'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-dark-text">
                    {room.tau_loss_h != null ? room.tau_loss_h.toFixed(1) : '\u2014'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-dark-text">
                    {room.heating_curve_steepness != null
                      ? `${room.heating_curve_steepness.toFixed(2)} / ${room.heating_curve_parallel_shift?.toFixed(1) ?? '0'}K`
                      : '\u2014'}
                  </td>
                  <td className="px-5 py-2.5 text-right text-dark-faded">{room.data_points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SelfLearningPage() {
  const apiConnected = useEnergyStore((s) => s.apiConnected)
  const [status, setStatus] = useState<SelfLearningStatus | null>(null)
  const [trainingType, setTrainingType] = useState<string | null>(null)
  const [thermalLearning, setThermalLearning] = useState(false)

  const fetchData = useCallback(async () => {
    if (!apiConnected) return
    try {
      setStatus(await api.selfLearning.status())
    } catch { /* ignore */ }
  }, [apiConnected])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh alle 15s
  useEffect(() => {
    if (!apiConnected) return
    const iv = setInterval(fetchData, 15_000)
    return () => clearInterval(iv)
  }, [apiConnected, fetchData])

  const handleModeChange = async (forecastType: string, mode: ActivationMode) => {
    try {
      await api.selfLearning.setMode(forecastType, mode)
      await fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Moduswechsel')
    }
  }

  const handleTrain = async (forecastType: string) => {
    setTrainingType(forecastType)
    try {
      await api.selfLearning.train(forecastType)
      await fetchData()
    } catch { /* ignore */ }
    setTrainingType(null)
  }

  const handleThermalLearn = async () => {
    setThermalLearning(true)
    try {
      await api.selfLearning.learnThermal()
      await fetchData()
    } catch { /* ignore */ }
    setThermalLearning(false)
  }

  const trainedCount = status?.ml_models.filter((m) => m.trained_at).length ?? 0
  const totalCount = status?.ml_models.length ?? 3

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
            <Brain className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Selbstlernung</h1>
            <p className="text-sm text-dark-faded">
              ML-Korrekturmodelle steuern und ueberwachen
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text hover:bg-dark-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </button>
      </div>

      {/* Overall Readiness + Summary */}
      {status && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
          <OverallReadinessBar value={status.overall_readiness} />
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-dark-faded">
            <span>{trainedCount} von {totalCount} trainiert</span>
            {status.last_retrain_at && (
              <span>
                Letztes Training: {new Date(status.last_retrain_at).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
            {status.next_retrain_in_h != null && (
              <span>Naechstes in ~{status.next_retrain_in_h.toFixed(0)}h</span>
            )}
          </div>
        </div>
      )}

      {/* ML Model Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {status.ml_models.map((model) => (
            <ModelCard
              key={model.forecast_type}
              model={model}
              onModeChange={handleModeChange}
              onTrain={handleTrain}
              training={trainingType === model.forecast_type}
            />
          ))}
        </div>
      )}

      {/* Thermal Room Table */}
      {status && (
        <ThermalRoomTable
          rooms={status.thermal_rooms}
          onLearn={handleThermalLearn}
          learning={thermalLearning}
        />
      )}

      {/* Info Box */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-dark-faded space-y-2">
            <p className="text-dark-text font-medium">Wie funktioniert die Selbstlernung?</p>
            <p>
              Das System trainiert ML-Korrekturmodelle (PV, Last, Waerme) automatisch alle 24 Stunden
              auf Basis der gesammelten Messdaten. Zusaetzlich werden thermische Raumparameter
              (Zeitkonstanten, Heizkurven) aus Temperaturverlaeufen gelernt.
            </p>
            <p>
              <strong>Aus:</strong> ML wird ignoriert, reine Physik-Prognosen. &mdash;{' '}
              <strong>Passiv:</strong> ML trainiert mit und zeigt was es korrigieren wuerde, ohne Prognosen
              zu beeinflussen. &mdash;{' '}
              <strong>Aktiv:</strong> ML-Korrekturen werden auf die Physik-Prognosen angewendet
              (nur wenn Bereitschaft gegeben).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
