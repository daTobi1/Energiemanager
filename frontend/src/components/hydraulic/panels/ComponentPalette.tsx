import { memo, type DragEvent } from 'react'
import { Flame, Thermometer, Snowflake, Zap, Plug, Home, Waypoints, Gauge, ArrowLeftRight, Sun, Mountain, Wind, Droplets } from 'lucide-react'

interface PaletteItem {
  type: string
  label: string
  icon: typeof Sun
  color: string
  group: string
}

const items: PaletteItem[] = [
  // Natürliche Quellen
  { type: 'solar_thermal', label: 'Solarthermie', icon: Sun, color: '#f59e0b', group: 'Quellen' },
  { type: 'ground_source', label: 'Erdsonde', icon: Mountain, color: '#16a34a', group: 'Quellen' },
  { type: 'air_source', label: 'Luft (Umgebung)', icon: Wind, color: '#60a5fa', group: 'Quellen' },
  { type: 'well_source', label: 'Brunnen/Grundw.', icon: Droplets, color: '#3b82f6', group: 'Quellen' },
  // Erzeuger
  { type: 'heat_pump', label: 'Wärmepumpe', icon: Thermometer, color: '#dc2626', group: 'Erzeuger' },
  { type: 'boiler', label: 'Kessel', icon: Flame, color: '#dc2626', group: 'Erzeuger' },
  { type: 'chp', label: 'BHKW', icon: Zap, color: '#ea580c', group: 'Erzeuger' },
  { type: 'chiller', label: 'Kältemaschine', icon: Snowflake, color: '#06b6d4', group: 'Erzeuger' },
  // Speicher
  { type: 'thermal_heat', label: 'Pufferspeicher', icon: Thermometer, color: '#dc2626', group: 'Speicher' },
  { type: 'thermal_cold', label: 'Kältespeicher', icon: Snowflake, color: '#06b6d4', group: 'Speicher' },
  // Hydraulik
  { type: 'hydraulic_separator', label: 'Hydr. Weiche', icon: ArrowLeftRight, color: '#8b949e', group: 'Hydraulik' },
  { type: 'pump', label: 'Pumpe', icon: Waypoints, color: '#8b949e', group: 'Hydraulik' },
  { type: 'mixer', label: '3W-Mischer', icon: ArrowLeftRight, color: '#dc2626', group: 'Hydraulik' },
  // Verteilung
  { type: 'circuit', label: 'Heizkreis', icon: Waypoints, color: '#dc2626', group: 'Verteilung' },
  { type: 'room', label: 'Raum', icon: Home, color: '#8b949e', group: 'Verteilung' },
  { type: 'consumer', label: 'Verbraucher', icon: Plug, color: '#16a34a', group: 'Verteilung' },
  // Messtechnik
  { type: 'meter', label: 'Zähler', icon: Gauge, color: '#0891b2', group: 'Messtechnik' },
]

function onDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer.setData('application/hydraulic-node', JSON.stringify({ type: item.type }))
  event.dataTransfer.effectAllowed = 'move'
}

export default memo(function ComponentPalette() {
  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <div className="w-48 bg-dark-card border-r border-dark-border overflow-y-auto flex flex-col"
      style={{ height: '100%' }}>
      <div className="p-3 border-b border-dark-border">
        <h3 className="text-xs font-semibold text-dark-faded tracking-wider uppercase">Komponenten</h3>
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
