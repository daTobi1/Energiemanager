/**
 * Bidirektionale Handle-ID Utilities für React Flow Schema-Seiten.
 *
 * Handle-ID-Konvention: `{energy}-{position}{index}`
 *   energy:   elec, heat, heat-ret, cold, cold-ret, gas, source, flow, meter, circuit
 *   position: L=links, R=rechts, T=oben, B=unten
 *   index:    1,2,3...
 */

/** Energietyp-Kürzel (Prefix vor dem Positionsbuchstaben) */
const ENERGY_PREFIXES = [
  'heat-ret',
  'cold-ret',
  'elec',
  'heat',
  'cold',
  'gas',
  'source',
  'flow',
  'meter',
  'circuit',
  'junction',
] as const

export type HandleEnergy = (typeof ENERGY_PREFIXES)[number]

/** Extrahiert den Energietyp-Prefix aus einer Handle-ID wie "heat-ret-R1" → "heat-ret" */
export function energyFromHandle(id: string): HandleEnergy | null {
  // Sortiert nach Länge absteigend, damit "heat-ret" vor "heat" matcht
  for (const prefix of ENERGY_PREFIXES) {
    if (id.startsWith(prefix + '-')) return prefix
  }
  return null
}

/** Bestimmt den Edge-Typ basierend auf den Handle-IDs beider Seiten */
export function resolveEdgeType(srcHandle: string, tgtHandle: string): string {
  const srcE = energyFromHandle(srcHandle)
  const tgtE = energyFromHandle(tgtHandle)
  // Junction: Typ von der anderen Seite ableiten
  if (srcE === 'junction' && tgtE && tgtE !== 'junction') return resolveEdgeType(tgtHandle, tgtHandle)
  if (tgtE === 'junction' && srcE && srcE !== 'junction') return resolveEdgeType(srcHandle, srcHandle)

  const both = [srcE, tgtE]

  if (both.includes('gas')) return 'gas'
  if (both.includes('source')) return 'source'
  if (
    both.includes('heat') || both.includes('heat-ret') ||
    both.includes('cold') || both.includes('cold-ret') ||
    both.includes('flow') || both.includes('circuit')
  ) return 'thermal'
  return 'electrical'
}

/** Erkennt Rücklauf-Handles: heat-ret-*, cold-ret-* */
export function isReturnHandle(id: string): boolean {
  return id.startsWith('heat-ret-') || id.startsWith('cold-ret-')
}

/** Erkennt Kälte-Handles: cold-*, cold-ret-* */
export function isColdHandle(id: string): boolean {
  return id.startsWith('cold-') || id.startsWith('cold-ret-')
}

/** Prüft ob zwei Handles kompatible Energietypen haben */
export function isValidConnection(srcHandle: string, tgtHandle: string): boolean {
  const srcE = energyFromHandle(srcHandle)
  const tgtE = energyFromHandle(tgtHandle)
  if (!srcE || !tgtE) return true // Unbekannte Handles erlauben

  // Gleicher Energietyp → immer OK
  if (srcE === tgtE) return true

  // VL/RL-Paare sind kompatibel
  if ((srcE === 'heat' && tgtE === 'heat-ret') || (srcE === 'heat-ret' && tgtE === 'heat')) return true
  if ((srcE === 'cold' && tgtE === 'cold-ret') || (srcE === 'cold-ret' && tgtE === 'cold')) return true

  // flow ↔ heat/heat-ret (Pumpe in Heizkreis)
  if (srcE === 'flow' || tgtE === 'flow') {
    const other = srcE === 'flow' ? tgtE : srcE
    if (other === 'heat' || other === 'heat-ret' || other === 'cold' || other === 'cold-ret' || other === 'circuit') return true
  }

  // circuit ↔ heat/cold (Heizkreis-Anbindung)
  if (srcE === 'circuit' || tgtE === 'circuit') {
    const other = srcE === 'circuit' ? tgtE : srcE
    if (other === 'heat' || other === 'heat-ret' || other === 'cold' || other === 'cold-ret') return true
  }

  // meter ist universell verbindbar
  if (srcE === 'meter' || tgtE === 'meter') return true

  // junction ist universell verbindbar (T-Stück, Kreuzung)
  if (srcE === 'junction' || tgtE === 'junction') return true

  return false
}
