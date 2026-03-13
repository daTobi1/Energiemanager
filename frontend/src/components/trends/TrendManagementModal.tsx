import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { TrendDefinition, TrendSeries, TrendInterval, TrendPresetRange } from '../../types'

interface TrendManagementModalProps {
  open: boolean
  onClose: () => void
  definitions: TrendDefinition[]
  availableSources: { source: string; metric: string; unit: string }[]
  onSave: (def: TrendDefinition) => void
  onDelete: (id: string) => void
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899']

function generateId() {
  return 'trend-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export default function TrendManagementModal({
  open, onClose, definitions, availableSources, onSave, onDelete,
}: TrendManagementModalProps) {
  const [editing, setEditing] = useState<TrendDefinition | null>(null)
  const [name, setName] = useState('')
  const [series, setSeries] = useState<TrendSeries[]>([])
  const [defaultInterval, setDefaultInterval] = useState<TrendInterval>('5min')
  const [defaultRange, setDefaultRange] = useState<TrendPresetRange>('24h')

  if (!open) return null

  const startNew = () => {
    setEditing(null)
    setName('')
    setSeries([])
    setDefaultInterval('5min')
    setDefaultRange('24h')
  }

  const startEdit = (def: TrendDefinition) => {
    setEditing(def)
    setName(def.name)
    setSeries([...def.series])
    setDefaultInterval(def.defaultInterval)
    setDefaultRange(def.defaultRange)
  }

  const addSeries = () => {
    if (availableSources.length === 0) return
    const src = availableSources[0]
    setSeries((prev) => [...prev, {
      source: src.source,
      metric: src.metric,
      color: COLORS[prev.length % COLORS.length],
      yAxisId: 'left',
    }])
  }

  const updateSeries = (idx: number, partial: Partial<TrendSeries>) => {
    setSeries((prev) => prev.map((s, i) => i === idx ? { ...s, ...partial } : s))
  }

  const removeSeries = (idx: number) => {
    setSeries((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!name.trim() || series.length === 0) return
    const def: TrendDefinition = {
      id: editing?.id || generateId(),
      name: name.trim(),
      series,
      defaultInterval,
      defaultRange,
      isDefault: false,
    }
    onSave(def)
    startNew()
  }

  const isEditing = editing !== null || name !== '' || series.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">Trend-Ansichten verwalten</h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-hover rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Existing definitions */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-dark-faded">Gespeicherte Ansichten</h3>
            {definitions.map((def) => (
              <div key={def.id} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                <div>
                  <span className="text-sm font-medium">{def.name}</span>
                  <span className="text-xs text-dark-faded ml-2">({def.series.length} Serien)</span>
                  {def.isDefault && <span className="text-xs text-emerald-400 ml-2">Standard</span>}
                </div>
                <div className="flex gap-1">
                  {!def.isDefault && (
                    <>
                      <button onClick={() => startEdit(def)} className="px-2 py-1 text-xs bg-dark-hover rounded hover:bg-dark-border">Bearbeiten</button>
                      <button onClick={() => onDelete(def.id)} className="px-2 py-1 text-xs text-red-400 bg-dark-hover rounded hover:bg-red-400/20"><Trash2 className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="border-t border-dark-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">{editing ? 'Ansicht bearbeiten' : 'Neue Ansicht erstellen'}</h3>
              {!isEditing && (
                <button onClick={startNew} className="btn-primary text-xs px-3 py-1">
                  <Plus className="w-3 h-3 inline mr-1" />Neu
                </button>
              )}
            </div>

            {isEditing && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name der Ansicht"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                />

                <div className="flex gap-3">
                  <div>
                    <label className="text-xs text-dark-faded">Standard-Intervall</label>
                    <select value={defaultInterval} onChange={(e) => setDefaultInterval(e.target.value as TrendInterval)} className="select text-sm w-full mt-1">
                      <option value="raw">Roh</option>
                      <option value="1min">1 min</option>
                      <option value="5min">5 min</option>
                      <option value="15min">15 min</option>
                      <option value="1h">1 h</option>
                      <option value="1d">1 Tag</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-dark-faded">Standard-Zeitraum</label>
                    <select value={defaultRange} onChange={(e) => setDefaultRange(e.target.value as TrendPresetRange)} className="select text-sm w-full mt-1">
                      <option value="1h">1 Stunde</option>
                      <option value="6h">6 Stunden</option>
                      <option value="24h">24 Stunden</option>
                      <option value="7d">7 Tage</option>
                      <option value="30d">30 Tage</option>
                    </select>
                  </div>
                </div>

                {/* Series list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-dark-faded">Datenreihen</label>
                    <button onClick={addSeries} className="text-xs text-emerald-400 hover:text-emerald-300">
                      <Plus className="w-3 h-3 inline mr-1" />Reihe hinzufügen
                    </button>
                  </div>
                  {series.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-dark-bg rounded-lg">
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateSeries(idx, { color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <select
                        value={`${s.source}.${s.metric}`}
                        onChange={(e) => {
                          const [source, metric] = e.target.value.split('.', 2)
                          updateSeries(idx, { source, metric })
                        }}
                        className="select text-sm flex-1"
                      >
                        {availableSources.map((src) => (
                          <option key={`${src.source}.${src.metric}`} value={`${src.source}.${src.metric}`}>
                            {src.source}.{src.metric} ({src.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Label"
                        value={s.label || ''}
                        onChange={(e) => updateSeries(idx, { label: e.target.value })}
                        className="input text-sm w-24"
                      />
                      <select
                        value={s.yAxisId || 'left'}
                        onChange={(e) => updateSeries(idx, { yAxisId: e.target.value as 'left' | 'right' })}
                        className="select text-sm w-20"
                      >
                        <option value="left">Links</option>
                        <option value="right">Rechts</option>
                      </select>
                      <button onClick={() => removeSeries(idx)} className="p-1 text-red-400 hover:bg-red-400/20 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} disabled={!name.trim() || series.length === 0} className="btn-primary text-sm px-4 py-2">
                    Speichern
                  </button>
                  <button onClick={startNew} className="px-4 py-2 text-sm text-dark-faded hover:text-dark-text">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
