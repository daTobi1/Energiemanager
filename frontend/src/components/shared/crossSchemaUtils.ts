/**
 * Utility-Funktionen für die Querverbindung zwischen
 * Hydraulik- und Stromschema.
 *
 * Dual-Schema-Entitäten (gleiche entityId in beiden Schemata):
 *   heat_pump → Hydraulik: heat_pump, Strom: motor_load
 *   chiller   → Hydraulik: chiller,   Strom: motor_load
 *   chp       → Hydraulik: chp,       Strom: generator
 */

/** Generator-Typen die in beiden Schemata vorkommen */
export const DUAL_SCHEMA_GEN_TYPES = ['heat_pump', 'chiller', 'chp'] as const

/** Prüft ob ein Hydraulik-Node-Typ auch im Stromschema existiert */
export function isDualSchemaHydraulicNode(nodeType: string): boolean {
  return (DUAL_SCHEMA_GEN_TYPES as readonly string[]).includes(nodeType)
}

/** Prüft ob ein Stromschema-Node-Typ auch im Hydraulikschema existiert */
export function isDualSchemaElectricalNode(nodeType: string, motorType?: string): boolean {
  if (nodeType === 'generator') return true // CHP
  if (nodeType === 'motor_load') return motorType === 'heat_pump' || motorType === 'chiller'
  return false
}
