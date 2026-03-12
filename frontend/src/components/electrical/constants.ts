// Farben für das Stromnetz-Schema
export const ELEC_COLORS = {
  phase: '#eab308',       // Gelb — Phasenleiter (L)
  neutral: '#3b82f6',     // Blau — Neutralleiter (N)
  pe: '#16a34a',          // Grün — Schutzleiter (PE)
  generation: '#22c55e',  // Grün — Einspeisung
  consumption: '#ef4444', // Rot — Verbrauch
  storage: '#8b5cf6',     // Violett — Speicher
  grid: '#6366f1',        // Indigo — Netz
  bus: '#eab308',         // Gelb — Sammelschiene
} as const

export const GRID_SIZE = 20

export const LS_POSITIONS_KEY = 'electrical-schema-positions'
export const LS_ROTATIONS_KEY = 'electrical-schema-rotations'
