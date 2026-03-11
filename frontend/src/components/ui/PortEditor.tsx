import { v4 as uuid } from 'uuid'
import { Plus, X } from 'lucide-react'
import { Section } from './FormField'
import type { EnergyPort, PortEnergy } from '../../types'

const portEnergyLabels: Record<PortEnergy, string> = {
  electricity: '⚡ Strom',
  heat: '🔥 Heizung',
  hot_water: '🚿 Warmwasser',
  cold: '❄ Kälte',
  gas: '🔶 Gas/Brennstoff',
  source: '♨ Quellenenergie',
}

export const portEnergyColors: Record<PortEnergy, string> = {
  electricity: '#3b82f6',
  heat: '#dc2626',
  hot_water: '#ea580c',
  cold: '#2563eb',
  gas: '#d97706',
  source: '#0891b2',
}

const portEnergyOptions: Array<{ value: PortEnergy; label: string }> = [
  { value: 'electricity', label: '⚡ Strom' },
  { value: 'heat', label: '🔥 Heizung' },
  { value: 'hot_water', label: '🚿 Warmwasser' },
  { value: 'cold', label: '❄ Kälte' },
  { value: 'gas', label: '🔶 Gas/Brennstoff' },
  { value: 'source', label: '♨ Quellenenergie' },
]

interface PortEditorProps {
  ports: EnergyPort[]
  onChange: (ports: EnergyPort[]) => void
  onReset?: () => void
  nodeName: string
  nodeColor: string
}

export function PortEditor({ ports, onChange, onReset, nodeName, nodeColor }: PortEditorProps) {
  const inputs = ports.filter(p => p.side === 'input')
  const outputs = ports.filter(p => p.side === 'output')

  return (
    <Section title="Energie-Anschlüsse" defaultOpen={true}>
      <div className="space-y-3">
        {/* Visuelle Vorschau */}
        <div className="flex items-center justify-center py-3">
          <svg width={260} height={Math.max(60, Math.max(inputs.length, outputs.length) * 28 + 20)} className="border border-dark-border rounded-lg bg-dark-bg">
            {(() => {
              const maxPorts = Math.max(inputs.length, outputs.length, 1)
              const h = maxPorts * 28 + 20
              const nodeW = 100, nodeH = Math.min(h - 12, maxPorts * 26 + 10)
              const nodeX = 130, nodeY = (h - nodeH) / 2
              return (
                <g>
                  <rect x={nodeX - nodeW / 2} y={nodeY} width={nodeW} height={nodeH} rx={8}
                    fill={nodeColor} stroke="#555" strokeWidth={1} />
                  <text x={nodeX} y={nodeY + nodeH / 2 + 4} textAnchor="middle" className="fill-dark-text" style={{ fontSize: 10, fontWeight: 600 }}>
                    {nodeName}
                  </text>
                  {inputs.map((p, i) => {
                    const cy = nodeY + nodeH * ((i + 0.5) / Math.max(inputs.length, 1))
                    const color = portEnergyColors[p.energy]
                    return (
                      <g key={p.id}>
                        <line x1={20} y1={cy} x2={nodeX - nodeW / 2} y2={cy} stroke={color} strokeWidth={2} strokeOpacity={0.6} />
                        <circle cx={nodeX - nodeW / 2} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />
                        <text x={18} y={cy + 3} textAnchor="end" fill={color} style={{ fontSize: 8 }}>{p.label || portEnergyLabels[p.energy]}</text>
                      </g>
                    )
                  })}
                  {outputs.map((p, i) => {
                    const cy = nodeY + nodeH * ((i + 0.5) / Math.max(outputs.length, 1))
                    const color = portEnergyColors[p.energy]
                    return (
                      <g key={p.id}>
                        <line x1={nodeX + nodeW / 2} y1={cy} x2={240} y2={cy} stroke={color} strokeWidth={2} strokeOpacity={0.6} />
                        <circle cx={nodeX + nodeW / 2} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />
                        <text x={242} y={cy + 3} textAnchor="start" fill={color} style={{ fontSize: 8 }}>{p.label || portEnergyLabels[p.energy]}</text>
                      </g>
                    )
                  })}
                </g>
              )
            })()}
          </svg>
        </div>

        {/* Port-Liste: Eingänge */}
        <div className="space-y-2">
          <div className="text-xs text-dark-faded font-semibold uppercase tracking-wider">Eingänge</div>
          {inputs.map((port) => (
            <div key={port.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: portEnergyColors[port.energy] }} />
              <select className="input text-sm flex-1" value={port.energy}
                onChange={(e) => onChange(ports.map(p => p.id === port.id ? { ...p, energy: e.target.value as PortEnergy } : p))}>
                {portEnergyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input className="input text-sm w-28" placeholder="Bezeichnung" value={port.label}
                onChange={(e) => onChange(ports.map(p => p.id === port.id ? { ...p, label: e.target.value } : p))} />
              <button className="text-red-400 hover:text-red-300 p-1" onClick={() => onChange(ports.filter(p => p.id !== port.id))}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            onClick={() => onChange([...ports, { id: uuid(), side: 'input', energy: 'electricity', label: '' }])}>
            <Plus className="w-3 h-3" /> Eingang hinzufügen
          </button>
        </div>

        {/* Port-Liste: Ausgänge */}
        <div className="space-y-2">
          <div className="text-xs text-dark-faded font-semibold uppercase tracking-wider">Ausgänge</div>
          {outputs.map((port) => (
            <div key={port.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: portEnergyColors[port.energy] }} />
              <select className="input text-sm flex-1" value={port.energy}
                onChange={(e) => onChange(ports.map(p => p.id === port.id ? { ...p, energy: e.target.value as PortEnergy } : p))}>
                {portEnergyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input className="input text-sm w-28" placeholder="Bezeichnung" value={port.label}
                onChange={(e) => onChange(ports.map(p => p.id === port.id ? { ...p, label: e.target.value } : p))} />
              <button className="text-red-400 hover:text-red-300 p-1" onClick={() => onChange(ports.filter(p => p.id !== port.id))}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            onClick={() => onChange([...ports, { id: uuid(), side: 'output', energy: 'heat', label: '' }])}>
            <Plus className="w-3 h-3" /> Ausgang hinzufügen
          </button>
        </div>

        {onReset && (
          <button className="text-xs text-dark-faded hover:text-dark-text" onClick={onReset}>
            Auf Standard zurücksetzen
          </button>
        )}
      </div>
    </Section>
  )
}

/** Helper: erstellt einen einzelnen Port */
export function mkPort(side: 'input' | 'output', energy: PortEnergy, label: string): EnergyPort {
  return { id: uuid(), side, energy, label }
}
