import { memo, type DragEvent } from 'react'
import { Zap, Sun, Battery, Gauge, Shield, Plug, LayoutGrid, CircleDot, Cable } from 'lucide-react'

interface PaletteItem {
  type: string
  label: string
  icon: typeof Zap
  color: string
  group: string
}

const items: PaletteItem[] = [
  // Netzeinspeisung
  { type: 'transformer', label: 'Trafo / Hausanschluss', icon: Zap, color: '#6366f1', group: 'Netzeinspeisung' },
  // Erzeugung
  { type: 'pv_inverter', label: 'PV + Wechselrichter', icon: Sun, color: '#f59e0b', group: 'Erzeugung' },
  { type: 'generator', label: 'BHKW Generator', icon: CircleDot, color: '#22c55e', group: 'Erzeugung' },
  // Speicher
  { type: 'battery_system', label: 'Batterie + WR', icon: Battery, color: '#8b5cf6', group: 'Speicher' },
  // Verteilung
  { type: 'elec_bus', label: 'Sammelschiene', icon: Cable, color: '#eab308', group: 'Verteilung' },
  { type: 'sub_distribution', label: 'Unterverteilung', icon: LayoutGrid, color: '#eab308', group: 'Verteilung' },
  { type: 'circuit_breaker', label: 'LS-Schalter', icon: Shield, color: '#eab308', group: 'Verteilung' },
  // Verbraucher
  { type: 'motor_load', label: 'Motor (WP/Klima)', icon: CircleDot, color: '#ef4444', group: 'Verbraucher' },
  { type: 'wallbox', label: 'Wallbox', icon: Plug, color: '#22c55e', group: 'Verbraucher' },
  { type: 'consumer_load', label: 'Verbraucher', icon: Zap, color: '#ef4444', group: 'Verbraucher' },
  // Messtechnik
  { type: 'elec_meter', label: 'Stromzähler', icon: Gauge, color: '#eab308', group: 'Messtechnik' },
]

function onDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer.setData('application/electrical-node', JSON.stringify({ type: item.type }))
  event.dataTransfer.effectAllowed = 'move'
}

export default memo(function ElectricalPalette() {
  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <div className="w-48 bg-dark-card border-r border-dark-border overflow-y-auto flex flex-col"
      style={{ height: '100%' }}>
      <div className="p-3 border-b border-dark-border">
        <h3 className="text-xs font-semibold text-dark-faded tracking-wider uppercase">Stromkomponenten</h3>
      </div>
      <div className="p-2 space-y-3 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-2 mb-1 text-[10px] font-semibold text-dark-faded tracking-widest uppercase">{group}</p>
            <div className="space-y-0.5">
              {items.filter((i) => i.group === group).map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab text-xs text-dark-muted hover:bg-dark-hover hover:text-dark-text transition-colors active:cursor-grabbing"
                >
                  <item.icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-dark-border">
        <p className="text-[10px] text-dark-faded text-center">Drag & Drop auf Canvas</p>
      </div>
    </div>
  )
})
