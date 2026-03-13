// Farben für Energieleitungen – konsistent im ganzen Schema
export const ENERGY_COLORS = {
  electricity: '#eab308',   // Gelb/Gold – Strom
  heat: '#dc2626',          // Rot – Vorlauf Heizung
  heat_return: '#3b82f6',   // Blau – Rücklauf Heizung
  hot_water: '#ea580c',     // Orange – Warmwasser
  cold: '#06b6d4',          // Cyan – Kälte
  cold_return: '#f97316',   // Orange – Rücklauf Kälte
  gas: '#d97706',           // Orange – Gas
  source: '#16a34a',        // Grün – Wärmequelle (Sole)
  water: '#3b82f6',         // Blau – Wasser
} as const

// Pipe-Styling
export const PIPE_STYLES = {
  electricity: { stroke: ENERGY_COLORS.electricity, strokeWidth: 2.5, strokeDasharray: '8 4' },
  heat: { stroke: ENERGY_COLORS.heat, strokeWidth: 3 },
  heat_return: { stroke: ENERGY_COLORS.heat_return, strokeWidth: 3 },
  cold: { stroke: ENERGY_COLORS.cold, strokeWidth: 3 },
  gas: { stroke: ENERGY_COLORS.gas, strokeWidth: 2.5, strokeDasharray: '6 3' },
  source: { stroke: ENERGY_COLORS.source, strokeWidth: 2.5, strokeDasharray: '2 4' },
} as const

// Grid-Snap
export const GRID_SIZE = 20

// Node-Größen
export const NODE_DEFAULTS = {
  width: 120,
  height: 80,
  meterWidth: 60,
  meterHeight: 60,
  separatorWidth: 40,
  separatorHeight: 200,
  busWidth: 400,
  busHeight: 20,
} as const
