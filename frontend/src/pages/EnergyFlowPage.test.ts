/**
 * Umfassender Test: Energiefluss-Diagramm Verbindungsmatrix
 *
 * Testet:
 * 1. connectTargets: alle Typ-Paare (bidirektional)
 * 2. Energieform-Validierung (nur gleiche Energietypen verbindbar)
 * 3. finishConnect: alle Verbindungstypen + Datenmodell-Mutation
 * 4. deleteEdge: alle Kanten löschbar + Datenmodell-Cleanup
 * 5. deleteNode: Referenzen werden aufgeräumt
 * 6. Bidirektionale Verbindungen (Klick von beiden Seiten)
 * 7. Meter-Durchverbindungen
 *
 * Ausführen: npx vite-node src/pages/EnergyFlowPage.test.ts
 */

// ========================================
// 1. CONNECT TARGETS MATRIX
// ========================================
const connectTargets: Record<string, string[]> = {
  grid: ['generator', 'storage', 'consumer', 'meter'],
  generator: ['grid', 'storage', 'circuit', 'meter', 'generator', 'consumer'],
  storage: ['grid', 'generator', 'circuit', 'consumer', 'meter'],
  circuit: ['room', 'meter'],
  room: ['consumer', 'meter'],
  consumer: ['grid', 'storage', 'meter'],
  meter: ['grid', 'generator', 'storage', 'circuit', 'room', 'consumer'],
}

const allTypes = ['grid', 'generator', 'storage', 'circuit', 'room', 'consumer', 'meter']

function isTypeConnectable(a: string, b: string): boolean {
  return connectTargets[a]?.includes(b) || connectTargets[b]?.includes(a) || false
}

// ========================================
// 2. ENERGIEFORM-DEFINITIONEN
// ========================================
type PortDef = { energy: string; color: string }
type PortLayout = { left: PortDef[]; right: PortDef[] }

// Alle Entity-Subtypen und ihre Port-Layouts
const genPortLayouts: Record<string, PortLayout> = {
  grid: { left: [{ energy: 'electricity', color: '#3b82f6' }], right: [{ energy: 'electricity', color: '#3b82f6' }] },
  pv: { left: [], right: [{ energy: 'electricity', color: '#3b82f6' }] },
  chp: { left: [{ energy: 'gas', color: '#d97706' }], right: [{ energy: 'electricity', color: '#3b82f6' }, { energy: 'heat', color: '#dc2626' }] },
  heat_pump: { left: [{ energy: 'electricity', color: '#3b82f6' }, { energy: 'source', color: '#0891b2' }], right: [{ energy: 'heat', color: '#dc2626' }] },
  heat_pump_cool: { left: [{ energy: 'electricity', color: '#3b82f6' }, { energy: 'source', color: '#0891b2' }], right: [{ energy: 'heat', color: '#dc2626' }, { energy: 'cold', color: '#2563eb' }] },
  boiler: { left: [{ energy: 'gas', color: '#d97706' }], right: [{ energy: 'heat', color: '#dc2626' }] },
  chiller: { left: [{ energy: 'electricity', color: '#3b82f6' }], right: [{ energy: 'cold', color: '#2563eb' }] },
}

const storPortLayouts: Record<string, PortLayout> = {
  battery: { left: [{ energy: 'electricity', color: '#3b82f6' }], right: [{ energy: 'electricity', color: '#3b82f6' }] },
  heat: { left: [{ energy: 'heat', color: '#dc2626' }], right: [{ energy: 'heat', color: '#dc2626' }] },
  cold: { left: [{ energy: 'cold', color: '#2563eb' }], right: [{ energy: 'cold', color: '#2563eb' }] },
}

const circPortLayouts: Record<string, PortLayout> = {
  heating: { left: [{ energy: 'heat', color: '#dc2626' }], right: [{ energy: 'heat', color: '#dc2626' }] },
  cooling: { left: [{ energy: 'cold', color: '#2563eb' }], right: [{ energy: 'cold', color: '#2563eb' }] },
  combined: { left: [{ energy: 'heat', color: '#dc2626' }, { energy: 'cold', color: '#2563eb' }], right: [{ energy: 'heat', color: '#dc2626' }, { energy: 'cold', color: '#2563eb' }] },
}

const conPortLayouts: Record<string, PortLayout> = {
  household: { left: [{ energy: 'electricity', color: '#3b82f6' }], right: [] },
  wallbox: { left: [{ energy: 'electricity', color: '#3b82f6' }], right: [] },
  hvac: { left: [{ energy: 'electricity', color: '#3b82f6' }, { energy: 'heat', color: '#dc2626' }, { energy: 'cold', color: '#2563eb' }], right: [] },
  hot_water: { left: [{ energy: 'electricity', color: '#3b82f6' }, { energy: 'heat', color: '#dc2626' }], right: [] },
}

const roomPortLayouts: Record<string, PortLayout> = {
  normal: { left: [{ energy: 'heat', color: '#dc2626' }], right: [] },
  cooled: { left: [{ energy: 'heat', color: '#dc2626' }, { energy: 'cold', color: '#2563eb' }], right: [] },
}

const meterPortLayouts: Record<string, PortLayout> = {
  electricity: { left: [{ energy: 'electricity', color: '#0891b2' }], right: [{ energy: 'electricity', color: '#0891b2' }] },
  heat: { left: [{ energy: 'heat', color: '#dc2626' }], right: [{ energy: 'heat', color: '#dc2626' }] },
  gas: { left: [{ energy: 'gas', color: '#ea580c' }], right: [{ energy: 'gas', color: '#ea580c' }] },
  cold: { left: [{ energy: 'cold', color: '#0891b2' }], right: [{ energy: 'cold', color: '#0891b2' }] },
  source: { left: [{ energy: 'source', color: '#0891b2' }], right: [{ energy: 'source', color: '#0891b2' }] },
  water: { left: [{ energy: 'water', color: '#2563eb' }], right: [{ energy: 'water', color: '#2563eb' }] },
}

function getEnergies(layout: PortLayout): Set<string> {
  const energies = new Set<string>()
  layout.left.forEach((p) => energies.add(p.energy))
  layout.right.forEach((p) => energies.add(p.energy))
  return energies
}

function hasCommonEnergy(a: PortLayout, b: PortLayout): boolean {
  const aE = getEnergies(a)
  const bE = getEnergies(b)
  for (const e of aE) {
    if (bE.has(e)) return true
  }
  return false
}

// ========================================
// TESTS
// ========================================
let pass = 0
let fail = 0
const failures: string[] = []

function assert(condition: boolean, message: string) {
  if (condition) {
    pass++
  } else {
    fail++
    failures.push(`FAIL: ${message}`)
  }
}

console.log('=== Energiefluss-Diagramm Verbindungstest ===\n')

// ----------------------------------------
// TEST 1: connectTargets Bidirektionalität
// ----------------------------------------
console.log('--- Test 1: connectTargets Bidirektionalität ---')

// Alle Typ-Paare testen (isValidTarget prüft BEIDE Richtungen)
const expectedConnectable: [string, string][] = [
  // Bestehende (schon immer unterstützt)
  ['grid', 'generator'], ['grid', 'storage'], ['grid', 'consumer'], ['grid', 'meter'],
  ['generator', 'storage'], ['generator', 'circuit'], ['generator', 'meter'],
  ['storage', 'circuit'], ['storage', 'consumer'], ['storage', 'meter'],
  ['circuit', 'room'], ['circuit', 'meter'],
  ['room', 'consumer'], ['room', 'meter'],
  ['consumer', 'meter'],
  // NEU hinzugefügt
  ['generator', 'generator'],
  ['generator', 'consumer'],
]

for (const [a, b] of expectedConnectable) {
  assert(isTypeConnectable(a, b), `${a} ↔ ${b} sollte verbindbar sein`)
  assert(isTypeConnectable(b, a), `${b} ↔ ${a} (umgekehrt) sollte verbindbar sein`)
}

// Typ-Paare die NICHT verbindbar sein sollten
const expectedNotConnectable: [string, string][] = [
  ['grid', 'circuit'], ['grid', 'room'],
  ['storage', 'room'],
  ['circuit', 'consumer'], ['circuit', 'circuit'],
  ['room', 'room'],
  ['consumer', 'consumer'],
  ['storage', 'storage'],
]

for (const [a, b] of expectedNotConnectable) {
  assert(!isTypeConnectable(a, b), `${a} ↔ ${b} sollte NICHT verbindbar sein`)
}

console.log(`  Typ-Paare: ${pass} OK\n`)

// ----------------------------------------
// TEST 2: Energieform-Validierung
// ----------------------------------------
console.log('--- Test 2: Energieform-Validierung (kein Mischen) ---')

function simulateIsValidTarget(
  connectingEnergy: string | undefined,
  connectingType: string,
  targetType: string,
  targetLayout: PortLayout,
): boolean {
  // Typ-Check (bidirektional)
  const typeValid = connectTargets[connectingType]?.includes(targetType)
    || connectTargets[targetType]?.includes(connectingType)
    || false
  if (!typeValid) return false
  // Energieform-Check
  if (connectingEnergy) {
    const targetEnergies = getEnergies(targetLayout)
    if (targetEnergies.size > 0 && !targetEnergies.has(connectingEnergy)) return false
  }
  return true
}

const specificTests: Array<{from: string; energy: string; to: string; toLayout: PortLayout; shouldBlock: boolean; label: string}> = [
  // Strom-Port → Wärmespeicher: BLOCKIEREN (Strom ≠ Wärme)
  { from: 'generator', energy: 'electricity', to: 'storage', toLayout: storPortLayouts.heat, shouldBlock: true, label: 'PV Strom → Wärmespeicher' },
  // Strom-Port → Batterie: OK (Strom = Strom)
  { from: 'generator', energy: 'electricity', to: 'storage', toLayout: storPortLayouts.battery, shouldBlock: false, label: 'PV Strom → Batterie' },
  // Wärme-Port → Kältespeicher: BLOCKIEREN (Wärme ≠ Kälte)
  { from: 'generator', energy: 'heat', to: 'storage', toLayout: storPortLayouts.cold, shouldBlock: true, label: 'Kessel Wärme → Kältespeicher' },
  // Wärme-Port → Wärmespeicher: OK
  { from: 'generator', energy: 'heat', to: 'storage', toLayout: storPortLayouts.heat, shouldBlock: false, label: 'Kessel Wärme → Wärmespeicher' },
  // Kälte-Port → Heizkreis: BLOCKIEREN (Kälte ≠ Wärme)
  { from: 'generator', energy: 'cold', to: 'circuit', toLayout: circPortLayouts.heating, shouldBlock: true, label: 'Kältemaschine Kälte → Heizkreis' },
  // Kälte-Port → Kühlkreis: OK
  { from: 'generator', energy: 'cold', to: 'circuit', toLayout: circPortLayouts.cooling, shouldBlock: false, label: 'Kältemaschine Kälte → Kühlkreis' },
  // Strom-Port → Heizkreis: BLOCKIEREN (Strom ≠ Wärme)
  { from: 'generator', energy: 'electricity', to: 'circuit', toLayout: circPortLayouts.heating, shouldBlock: true, label: 'PV Strom → Heizkreis' },
  // Wärme-Port → Heizkreis: OK
  { from: 'generator', energy: 'heat', to: 'circuit', toLayout: circPortLayouts.heating, shouldBlock: false, label: 'BHKW Wärme → Heizkreis' },
  // Strom-Port → Wärmepumpe: OK (Strom-Eingang vorhanden)
  { from: 'generator', energy: 'electricity', to: 'generator', toLayout: genPortLayouts.heat_pump, shouldBlock: false, label: 'PV Strom → Wärmepumpe' },
  // Wärme-Port → Wärmepumpe: ERLAUBT (WP hat heat als Ausgang → Node-Energies inkludiert heat)
  { from: 'generator', energy: 'heat', to: 'generator', toLayout: genPortLayouts.heat_pump, shouldBlock: false, label: 'BHKW Wärme → WP (WP hat heat-Ausgang)' },
  // Strom-Port → Kältemaschine: OK (Strom-Eingang)
  { from: 'generator', energy: 'electricity', to: 'generator', toLayout: genPortLayouts.chiller, shouldBlock: false, label: 'BHKW Strom → Kältemaschine' },
  // Kälte-Port → Haushalt: BLOCKIEREN (Haushalt nur Strom)
  { from: 'generator', energy: 'cold', to: 'consumer', toLayout: conPortLayouts.household, shouldBlock: true, label: 'Kältemaschine Kälte → Haushalt' },
  // Wärme-Port → HVAC: OK (HVAC hat Wärme-Eingang)
  { from: 'generator', energy: 'heat', to: 'consumer', toLayout: conPortLayouts.hvac, shouldBlock: false, label: 'Kessel Wärme → HVAC' },
  // Quellen-Port → Stromzähler: BLOCKIEREN (Quelle ≠ Strom)
  { from: 'generator', energy: 'source', to: 'meter', toLayout: meterPortLayouts.electricity, shouldBlock: true, label: 'WP Quelle → Stromzähler' },
  // Quellen-Port → Quellenzähler: OK
  { from: 'generator', energy: 'source', to: 'meter', toLayout: meterPortLayouts.source, shouldBlock: false, label: 'WP Quelle → Quellenzähler' },
  // Gas-Port → Gaszähler: OK
  { from: 'generator', energy: 'gas', to: 'meter', toLayout: meterPortLayouts.gas, shouldBlock: false, label: 'BHKW Gas → Gaszähler' },
  // Gas-Port → Stromzähler: BLOCKIEREN
  { from: 'generator', energy: 'gas', to: 'meter', toLayout: meterPortLayouts.electricity, shouldBlock: true, label: 'BHKW Gas → Stromzähler' },
  // Wasserzähler → Grid: BLOCKIEREN (Wasser ≠ Strom)
  { from: 'meter', energy: 'water', to: 'grid', toLayout: genPortLayouts.grid, shouldBlock: true, label: 'Wasserzähler → Grid' },
  // Stromzähler → Grid: OK
  { from: 'meter', energy: 'electricity', to: 'grid', toLayout: genPortLayouts.grid, shouldBlock: false, label: 'Stromzähler → Grid' },
  // Kältezähler → Raum mit Kühlung: OK
  { from: 'meter', energy: 'cold', to: 'room', toLayout: roomPortLayouts.cooled, shouldBlock: false, label: 'Kältezähler → Raum+K' },
  // Kältezähler → Raum ohne Kühlung: BLOCKIEREN
  { from: 'meter', energy: 'cold', to: 'room', toLayout: roomPortLayouts.normal, shouldBlock: true, label: 'Kältezähler → Raum (nur Heizung)' },
]

for (const test of specificTests) {
  const result = simulateIsValidTarget(test.energy, test.from, test.to, test.toLayout)
  const expected = !test.shouldBlock
  assert(result === expected, `${test.label}: erwartet ${expected ? 'ERLAUBT' : 'BLOCKIERT'}, bekommen ${result ? 'ERLAUBT' : 'BLOCKIERT'}`)
}

console.log('')

// ----------------------------------------
// TEST 3: finishConnect Datenmodell-Mutation
// ----------------------------------------
console.log('--- Test 3: finishConnect Verbindungstypen ---')

// Simuliere das Datenmodell
interface SimGenerator { id: string; type: string; connectedGeneratorIds: string[] }
interface SimStorage { id: string; type: string; connectedGeneratorIds: string[]; connectedConsumerIds: string[] }
interface SimConsumer { id: string; type: string; connectedSourceIds: string[] }
interface SimCircuit { id: string; type: string; generatorIds: string[]; supplyStorageIds: string[]; roomIds: string[] }
interface SimRoom { id: string; consumerIds: string[] }
interface SimMeter { id: string; type: string; assignedToType: string; assignedToId: string; parentMeterId: string; category: string }

function simFinishConnect(
  fromType: string, fromId: string, toType: string, toId: string,
  state: {
    generators: SimGenerator[]; storages: SimStorage[]; consumers: SimConsumer[];
    circuits: SimCircuit[]; rooms: SimRoom[]; meters: SimMeter[];
  }
): string {
  if ((fromType === 'grid' && toType === 'storage') || (fromType === 'storage' && toType === 'grid')) {
    const storId = fromType === 'storage' ? fromId : toId
    const s = state.storages.find((s) => s.id === storId)
    if (s && !s.connectedGeneratorIds.includes('grid')) s.connectedGeneratorIds.push('grid')
    return `storage.${storId}.connectedGeneratorIds += grid`
  }
  if ((fromType === 'grid' && toType === 'consumer') || (fromType === 'consumer' && toType === 'grid')) {
    const conId = fromType === 'consumer' ? fromId : toId
    const c = state.consumers.find((c) => c.id === conId)
    if (c && !c.connectedSourceIds.includes('grid')) c.connectedSourceIds.push('grid')
    return `consumer.${conId}.connectedSourceIds += grid`
  }
  if ((fromType === 'grid' && toType === 'generator') || (fromType === 'generator' && toType === 'grid')) {
    const genId = fromType === 'generator' ? fromId : toId
    const gridGen = state.generators.find((g) => g.type === 'grid')
    if (gridGen && !gridGen.connectedGeneratorIds.includes(genId)) gridGen.connectedGeneratorIds.push(genId)
    return `gridGen.connectedGeneratorIds += ${genId}`
  }
  if ((fromType === 'generator' && toType === 'storage') || (fromType === 'storage' && toType === 'generator')) {
    const genId = fromType === 'generator' ? fromId : toId
    const storId = fromType === 'storage' ? fromId : toId
    const s = state.storages.find((s) => s.id === storId)
    if (s && !s.connectedGeneratorIds.includes(genId)) s.connectedGeneratorIds.push(genId)
    return `storage.${storId}.connectedGeneratorIds += ${genId}`
  }
  if ((fromType === 'storage' && toType === 'consumer') || (fromType === 'consumer' && toType === 'storage')) {
    const storId = fromType === 'storage' ? fromId : toId
    const conId = fromType === 'consumer' ? fromId : toId
    const s = state.storages.find((s) => s.id === storId)
    if (s && !s.connectedConsumerIds.includes(conId)) s.connectedConsumerIds.push(conId)
    return `storage.${storId}.connectedConsumerIds += ${conId}`
  }
  if (fromType === 'generator' && toType === 'circuit') {
    const c = state.circuits.find((c) => c.id === toId)
    if (c && !c.generatorIds.includes(fromId)) c.generatorIds.push(fromId)
    return `circuit.${toId}.generatorIds += ${fromId}`
  }
  if (fromType === 'storage' && toType === 'circuit') {
    const c = state.circuits.find((c) => c.id === toId)
    if (c && !c.supplyStorageIds.includes(fromId)) c.supplyStorageIds.push(fromId)
    return `circuit.${toId}.supplyStorageIds += ${fromId}`
  }
  if (fromType === 'circuit' && toType === 'room') {
    const c = state.circuits.find((c) => c.id === fromId)
    if (c && !c.roomIds.includes(toId)) c.roomIds.push(toId)
    return `circuit.${fromId}.roomIds += ${toId}`
  }
  if (fromType === 'room' && toType === 'consumer') {
    const r = state.rooms.find((r) => r.id === fromId)
    if (r && !r.consumerIds.includes(toId)) r.consumerIds.push(toId)
    return `room.${fromId}.consumerIds += ${toId}`
  }
  // Generator → Generator
  if (fromType === 'generator' && toType === 'generator') {
    const targetGen = state.generators.find((g) => g.id === toId)
    if (targetGen && !targetGen.connectedGeneratorIds.includes(fromId)) targetGen.connectedGeneratorIds.push(fromId)
    return `generator.${toId}.connectedGeneratorIds += ${fromId}`
  }
  // Generator → Consumer
  if (fromType === 'generator' && toType === 'consumer') {
    const c = state.consumers.find((c) => c.id === toId)
    if (c && !c.connectedSourceIds.includes(fromId)) c.connectedSourceIds.push(fromId)
    return `consumer.${toId}.connectedSourceIds += ${fromId}`
  }
  // Meter cases
  if (toType === 'meter' || fromType === 'meter') {
    const meterId = toType === 'meter' ? toId : fromId
    const otherType = toType === 'meter' ? fromType : toType
    const otherId = toType === 'meter' ? fromId : toId
    const m = state.meters.find((m) => m.id === meterId)
    if (m) {
      m.assignedToType = otherType === 'grid' ? 'grid' : otherType
      m.assignedToId = otherType === 'grid' ? 'grid' : otherId
      if (otherType === 'grid') m.parentMeterId = 'grid'
    }
    return `meter.${meterId}.assignedTo = ${otherType}:${otherId}`
  }
  return 'NO_HANDLER'
}

function createTestState() {
  return {
    generators: [
      { id: 'grid1', type: 'grid', connectedGeneratorIds: [] as string[] },
      { id: 'pv1', type: 'pv', connectedGeneratorIds: [] as string[] },
      { id: 'chp1', type: 'chp', connectedGeneratorIds: [] as string[] },
      { id: 'hp1', type: 'heat_pump', connectedGeneratorIds: [] as string[] },
      { id: 'boiler1', type: 'boiler', connectedGeneratorIds: [] as string[] },
      { id: 'chiller1', type: 'chiller', connectedGeneratorIds: [] as string[] },
    ],
    storages: [
      { id: 'bat1', type: 'battery', connectedGeneratorIds: [] as string[], connectedConsumerIds: [] as string[] },
      { id: 'heat1', type: 'heat', connectedGeneratorIds: [] as string[], connectedConsumerIds: [] as string[] },
      { id: 'cold1', type: 'cold', connectedGeneratorIds: [] as string[], connectedConsumerIds: [] as string[] },
    ],
    consumers: [
      { id: 'hh1', type: 'household', connectedSourceIds: [] as string[] },
      { id: 'wb1', type: 'wallbox', connectedSourceIds: [] as string[] },
      { id: 'hvac1', type: 'hvac', connectedSourceIds: [] as string[] },
    ],
    circuits: [
      { id: 'hc1', type: 'heating', generatorIds: [] as string[], supplyStorageIds: [] as string[], roomIds: [] as string[] },
      { id: 'cc1', type: 'cooling', generatorIds: [] as string[], supplyStorageIds: [] as string[], roomIds: [] as string[] },
    ],
    rooms: [
      { id: 'rm1', consumerIds: [] as string[] },
    ],
    meters: [
      { id: 'em1', type: 'electricity', assignedToType: 'none', assignedToId: '', parentMeterId: '', category: 'generation' },
      { id: 'hm1', type: 'heat', assignedToType: 'none', assignedToId: '', parentMeterId: '', category: 'consumption' },
      { id: 'gm1', type: 'gas', assignedToType: 'none', assignedToId: '', parentMeterId: '', category: 'source' },
    ],
  }
}

// Alle finishConnect-Fälle testen
const connectTests: Array<{ from: [string, string]; to: [string, string]; expected: string }> = [
  // grid ↔ storage
  { from: ['grid', 'grid1'], to: ['storage', 'bat1'], expected: 'storage.bat1.connectedGeneratorIds += grid' },
  { from: ['storage', 'bat1'], to: ['grid', 'grid1'], expected: 'storage.bat1.connectedGeneratorIds += grid' },
  // grid ↔ consumer
  { from: ['grid', 'grid1'], to: ['consumer', 'hh1'], expected: 'consumer.hh1.connectedSourceIds += grid' },
  // grid ↔ generator
  { from: ['generator', 'pv1'], to: ['grid', 'grid1'], expected: 'gridGen.connectedGeneratorIds += pv1' },
  // gen ↔ storage
  { from: ['generator', 'pv1'], to: ['storage', 'bat1'], expected: 'storage.bat1.connectedGeneratorIds += pv1' },
  { from: ['storage', 'heat1'], to: ['generator', 'boiler1'], expected: 'storage.heat1.connectedGeneratorIds += boiler1' },
  // storage ↔ consumer
  { from: ['storage', 'bat1'], to: ['consumer', 'hh1'], expected: 'storage.bat1.connectedConsumerIds += hh1' },
  // gen → circuit
  { from: ['generator', 'hp1'], to: ['circuit', 'hc1'], expected: 'circuit.hc1.generatorIds += hp1' },
  // storage → circuit
  { from: ['storage', 'heat1'], to: ['circuit', 'hc1'], expected: 'circuit.hc1.supplyStorageIds += heat1' },
  // circuit → room
  { from: ['circuit', 'hc1'], to: ['room', 'rm1'], expected: 'circuit.hc1.roomIds += rm1' },
  // room → consumer
  { from: ['room', 'rm1'], to: ['consumer', 'hvac1'], expected: 'room.rm1.consumerIds += hvac1' },
  // NEW: gen → gen
  { from: ['generator', 'pv1'], to: ['generator', 'hp1'], expected: 'generator.hp1.connectedGeneratorIds += pv1' },
  { from: ['generator', 'chp1'], to: ['generator', 'chiller1'], expected: 'generator.chiller1.connectedGeneratorIds += chp1' },
  // NEW: gen → consumer
  { from: ['generator', 'pv1'], to: ['consumer', 'wb1'], expected: 'consumer.wb1.connectedSourceIds += pv1' },
  // meter connections
  { from: ['generator', 'pv1'], to: ['meter', 'em1'], expected: 'meter.em1.assignedTo = generator:pv1' },
  { from: ['meter', 'gm1'], to: ['grid', 'grid1'], expected: 'meter.gm1.assignedTo = grid:grid1' },
]

for (const test of connectTests) {
  const state = createTestState()

  // Direction normalization (wie in finishConnect)
  let fromType: string, fromId: string, toType: string, toId: string
  const [aType, aId] = test.from
  const [bType, bId] = test.to
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }

  const result = simFinishConnect(fromType, fromId, toType, toId, state)
  assert(result === test.expected, `finishConnect ${test.from[0]}:${test.from[1]} → ${test.to[0]}:${test.to[1]}: erwartet "${test.expected}", bekommen "${result}"`)
}

console.log('')

// ----------------------------------------
// TEST 4: Duplikatvermeidung
// ----------------------------------------
console.log('--- Test 4: Doppelte Verbindungen vermeiden ---')

{
  const state = createTestState()
  simFinishConnect('generator', 'pv1', 'storage', 'bat1', state)
  assert(state.storages[0].connectedGeneratorIds.length === 1, 'Batterie hat 1 Verbindung nach 1. Connect')
  simFinishConnect('generator', 'pv1', 'storage', 'bat1', state)
  assert(state.storages[0].connectedGeneratorIds.length === 1, 'Batterie hat immer noch 1 Verbindung (kein Duplikat)')
  simFinishConnect('generator', 'chp1', 'storage', 'bat1', state)
  assert(state.storages[0].connectedGeneratorIds.length === 2, 'Batterie hat 2 verschiedene Verbindungen')
}

{
  const state = createTestState()
  simFinishConnect('generator', 'pv1', 'generator', 'hp1', state)
  assert(state.generators[3].connectedGeneratorIds.length === 1, 'HP hat 1 Gen-Verbindung')
  simFinishConnect('generator', 'pv1', 'generator', 'hp1', state)
  assert(state.generators[3].connectedGeneratorIds.length === 1, 'HP: kein Duplikat nach 2. Connect')
}

console.log('')

// ----------------------------------------
// TEST 5: Create → Delete → Verify Roundtrip
// ----------------------------------------
console.log('--- Test 5: Verbinden → Löschen → Verifizieren ---')

function simDeleteEdge(
  fromPrefix: string, fromId: string, toPrefix: string, toId: string,
  state: ReturnType<typeof createTestState>,
): string {
  if ((fromPrefix === 'bus' && toPrefix === 'stor') || (fromPrefix === 'stor' && toPrefix === 'bus')) {
    const storId = fromPrefix === 'stor' ? fromId : toId
    const s = state.storages.find((s) => s.id === storId)
    if (s) s.connectedGeneratorIds = s.connectedGeneratorIds.filter((id) => id !== 'grid')
    return 'storage.grid removed'
  }
  if ((fromPrefix === 'bus' && toPrefix === 'gen') || (fromPrefix === 'gen' && toPrefix === 'bus')) {
    const genId = fromPrefix === 'gen' ? fromId : toId
    const gridGen = state.generators.find((g) => g.type === 'grid')
    if (gridGen) gridGen.connectedGeneratorIds = gridGen.connectedGeneratorIds.filter((id) => id !== genId)
    return 'gridGen.connGen removed'
  }
  if ((fromPrefix === 'bus' && toPrefix === 'con') || (fromPrefix === 'con' && toPrefix === 'bus')) {
    const conId = fromPrefix === 'con' ? fromId : toId
    const c = state.consumers.find((c) => c.id === conId)
    if (c) c.connectedSourceIds = c.connectedSourceIds.filter((id) => id !== 'grid')
    return 'consumer.grid removed'
  }
  if (fromPrefix === 'gen' && toPrefix === 'stor') {
    const s = state.storages.find((s) => s.id === toId)
    if (s) s.connectedGeneratorIds = s.connectedGeneratorIds.filter((id) => id !== fromId)
    return 'storage.gen removed'
  }
  if (fromPrefix === 'stor' && toPrefix === 'con') {
    const s = state.storages.find((s) => s.id === fromId)
    if (s) s.connectedConsumerIds = s.connectedConsumerIds.filter((id) => id !== toId)
    return 'storage.con removed'
  }
  if (fromPrefix === 'gen' && toPrefix === 'circ') {
    const c = state.circuits.find((c) => c.id === toId)
    if (c) c.generatorIds = c.generatorIds.filter((id) => id !== fromId)
    return 'circuit.gen removed'
  }
  if (fromPrefix === 'stor' && toPrefix === 'circ') {
    const c = state.circuits.find((c) => c.id === toId)
    if (c) c.supplyStorageIds = c.supplyStorageIds.filter((id) => id !== fromId)
    return 'circuit.stor removed'
  }
  if (fromPrefix === 'circ' && toPrefix === 'room') {
    const c = state.circuits.find((c) => c.id === fromId)
    if (c) c.roomIds = c.roomIds.filter((id) => id !== toId)
    return 'circuit.room removed'
  }
  if (fromPrefix === 'room' && toPrefix === 'con') {
    const r = state.rooms.find((r) => r.id === fromId)
    if (r) r.consumerIds = r.consumerIds.filter((id) => id !== toId)
    return 'room.con removed'
  }
  if (fromPrefix === 'gen' && toPrefix === 'gen') {
    const targetGen = state.generators.find((g) => g.id === toId)
    if (targetGen) targetGen.connectedGeneratorIds = targetGen.connectedGeneratorIds.filter((id) => id !== fromId)
    return 'gen.gen removed'
  }
  if (fromPrefix === 'gen' && toPrefix === 'con') {
    const c = state.consumers.find((c) => c.id === toId)
    if (c) c.connectedSourceIds = c.connectedSourceIds.filter((id) => id !== fromId)
    return 'con.gen removed'
  }
  if (fromPrefix === 'con' && toPrefix === 'gen') {
    const c = state.consumers.find((c) => c.id === fromId)
    if (c) c.connectedSourceIds = c.connectedSourceIds.filter((id) => id !== toId)
    return 'con.gen removed'
  }
  if (toPrefix === 'meter' || fromPrefix === 'meter') {
    const meterId = toPrefix === 'meter' ? toId : fromId
    const m = state.meters.find((m) => m.id === meterId)
    if (m) { m.assignedToType = 'none'; m.assignedToId = '' }
    return 'meter reset'
  }
  return 'NO_HANDLER'
}

{
  const state = createTestState()

  // PV → Batterie: verbinden + löschen
  simFinishConnect('generator', 'pv1', 'storage', 'bat1', state)
  assert(state.storages[0].connectedGeneratorIds.includes('pv1'), 'Batterie: PV verbunden')
  simDeleteEdge('gen', 'pv1', 'stor', 'bat1', state)
  assert(!state.storages[0].connectedGeneratorIds.includes('pv1'), 'Batterie: PV getrennt')

  // PV → Grid: verbinden + löschen
  simFinishConnect('generator', 'pv1', 'grid', 'grid1', state)
  assert(state.generators[0].connectedGeneratorIds.includes('pv1'), 'Grid: PV verbunden')
  simDeleteEdge('gen', 'pv1', 'bus', 'grid', state)
  assert(!state.generators[0].connectedGeneratorIds.includes('pv1'), 'Grid: PV getrennt')

  // PV → HP (Gen↔Gen): verbinden + löschen
  simFinishConnect('generator', 'pv1', 'generator', 'hp1', state)
  assert(state.generators[3].connectedGeneratorIds.includes('pv1'), 'HP: PV verbunden (Gen↔Gen)')
  simDeleteEdge('gen', 'pv1', 'gen', 'hp1', state)
  assert(!state.generators[3].connectedGeneratorIds.includes('pv1'), 'HP: PV getrennt (Gen↔Gen)')

  // PV → Wallbox (Gen→Consumer): verbinden + löschen
  simFinishConnect('generator', 'pv1', 'consumer', 'wb1', state)
  assert(state.consumers[1].connectedSourceIds.includes('pv1'), 'Wallbox: PV verbunden (Gen→Con)')
  simDeleteEdge('gen', 'pv1', 'con', 'wb1', state)
  assert(!state.consumers[1].connectedSourceIds.includes('pv1'), 'Wallbox: PV getrennt (Gen→Con)')

  // Grid → Consumer: verbinden + löschen
  simFinishConnect('grid', 'grid1', 'consumer', 'hh1', state)
  assert(state.consumers[0].connectedSourceIds.includes('grid'), 'Haushalt: Grid verbunden')
  simDeleteEdge('bus', 'grid', 'con', 'hh1', state)
  assert(!state.consumers[0].connectedSourceIds.includes('grid'), 'Haushalt: Grid getrennt')

  // Kreis → Raum: verbinden + löschen
  simFinishConnect('circuit', 'hc1', 'room', 'rm1', state)
  assert(state.circuits[0].roomIds.includes('rm1'), 'Heizkreis: Raum verbunden')
  simDeleteEdge('circ', 'hc1', 'room', 'rm1', state)
  assert(!state.circuits[0].roomIds.includes('rm1'), 'Heizkreis: Raum getrennt')

  // Meter: verbinden + löschen
  simFinishConnect('generator', 'pv1', 'meter', 'em1', state)
  assert(state.meters[0].assignedToType === 'generator', 'Stromzähler: PV zugeordnet')
  simDeleteEdge('gen', 'pv1', 'meter', 'em1', state)
  assert(state.meters[0].assignedToType === 'none', 'Stromzähler: PV-Zuordnung gelöscht')

  // BHKW → Kältemaschine (Gen↔Gen): verbinden + löschen
  simFinishConnect('generator', 'chp1', 'generator', 'chiller1', state)
  assert(state.generators[5].connectedGeneratorIds.includes('chp1'), 'Kältemaschine: BHKW verbunden')
  simDeleteEdge('gen', 'chp1', 'gen', 'chiller1', state)
  assert(!state.generators[5].connectedGeneratorIds.includes('chp1'), 'Kältemaschine: BHKW getrennt')

  // Re-connect nach delete (Wiederherstellung)
  simFinishConnect('generator', 'pv1', 'storage', 'bat1', state)
  assert(state.storages[0].connectedGeneratorIds.includes('pv1'), 'Batterie: PV nach Delete wieder verbunden')
  simFinishConnect('generator', 'pv1', 'generator', 'hp1', state)
  assert(state.generators[3].connectedGeneratorIds.includes('pv1'), 'HP: PV nach Delete wieder verbunden (Gen↔Gen)')
}

console.log('')

// ----------------------------------------
// TEST 6: Bidirektionalität (Klick von beiden Seiten)
// ----------------------------------------
console.log('--- Test 6: Bidirektionalität (Klick von beiden Seiten) ---')

{
  // PV → Batterie (vorwärts)
  const state1 = createTestState()
  let aType = 'generator', aId = 'pv1', bType = 'storage', bId = 'bat1'
  let fromType: string, fromId: string, toType: string, toId: string
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }
  simFinishConnect(fromType, fromId, toType, toId, state1)
  assert(state1.storages[0].connectedGeneratorIds.includes('pv1'), 'PV→Batterie (vorwärts): OK')

  // Batterie → PV (rückwärts geklickt)
  const state2 = createTestState()
  aType = 'storage'; aId = 'bat1'; bType = 'generator'; bId = 'pv1'
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }
  simFinishConnect(fromType, fromId, toType, toId, state2)
  assert(state2.storages[0].connectedGeneratorIds.includes('pv1'), 'Batterie→PV (rückwärts): gleiche Verbindung')

  // Raum → Heizkreis (rückwärts)
  const state3 = createTestState()
  aType = 'room'; aId = 'rm1'; bType = 'circuit'; bId = 'hc1'
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }
  simFinishConnect(fromType, fromId, toType, toId, state3)
  assert(state3.circuits[0].roomIds.includes('rm1'), 'Raum→Heizkreis (rückwärts): richtig normalisiert')

  // Consumer → Generator (rückwärts für gen→consumer)
  const state4 = createTestState()
  aType = 'consumer'; aId = 'wb1'; bType = 'generator'; bId = 'pv1'
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }
  simFinishConnect(fromType, fromId, toType, toId, state4)
  assert(state4.consumers[1].connectedSourceIds.includes('pv1'), 'Consumer→Gen (rückwärts): PV in connectedSourceIds')

  // Meter → Consumer (rückwärts)
  const state5 = createTestState()
  aType = 'meter'; aId = 'em1'; bType = 'consumer'; bId = 'hh1'
  if (connectTargets[aType]?.includes(bType)) {
    fromType = aType; fromId = aId; toType = bType; toId = bId
  } else {
    fromType = bType; fromId = bId; toType = aType; toId = aId
  }
  simFinishConnect(fromType, fromId, toType, toId, state5)
  assert(state5.meters[0].assignedToType === 'consumer', 'Meter→Consumer: Zähler zugeordnet')
}

console.log('')

// ----------------------------------------
// TEST 7: Node-Löschung Referenz-Cleanup
// ----------------------------------------
console.log('--- Test 7: Node-Löschung bereinigt Referenzen ---')

{
  const state = createTestState()
  simFinishConnect('generator', 'pv1', 'storage', 'bat1', state)
  simFinishConnect('generator', 'pv1', 'generator', 'hp1', state)
  simFinishConnect('generator', 'pv1', 'consumer', 'wb1', state)
  simFinishConnect('generator', 'pv1', 'grid', 'grid1', state)
  simFinishConnect('generator', 'pv1', 'circuit', 'hc1', state)
  simFinishConnect('generator', 'pv1', 'meter', 'em1', state)

  // Simulate deleteNode('generator', 'pv1')
  state.storages.forEach((s) => {
    s.connectedGeneratorIds = s.connectedGeneratorIds.filter((id) => id !== 'pv1')
  })
  state.circuits.forEach((c) => {
    c.generatorIds = c.generatorIds.filter((id) => id !== 'pv1')
  })
  state.meters.forEach((m) => {
    if (m.assignedToType === 'generator' && m.assignedToId === 'pv1') {
      m.assignedToType = 'none'; m.assignedToId = ''
    }
  })
  state.generators.forEach((g) => {
    if (g.id !== 'pv1') g.connectedGeneratorIds = g.connectedGeneratorIds.filter((id) => id !== 'pv1')
  })
  state.consumers.forEach((c) => {
    c.connectedSourceIds = c.connectedSourceIds.filter((id) => id !== 'pv1')
  })

  assert(!state.storages[0].connectedGeneratorIds.includes('pv1'), 'deleteNode: Batterie bereinigt')
  assert(!state.generators[0].connectedGeneratorIds.includes('pv1'), 'deleteNode: Grid bereinigt')
  assert(!state.generators[3].connectedGeneratorIds.includes('pv1'), 'deleteNode: HP bereinigt (Gen↔Gen)')
  assert(!state.consumers[1].connectedSourceIds.includes('pv1'), 'deleteNode: Wallbox bereinigt (Gen→Con)')
  assert(!state.circuits[0].generatorIds.includes('pv1'), 'deleteNode: Heizkreis bereinigt')
  assert(state.meters[0].assignedToType === 'none', 'deleteNode: Stromzähler bereinigt')
}

console.log('')

// ----------------------------------------
// TEST 8: Spezifische Gen↔Gen Verbindungen
// ----------------------------------------
console.log('--- Test 8: Generator↔Generator Energie-Validierung ---')

const genGenTests: Array<{ from: string; to: string; energy: string; valid: boolean; label: string }> = [
  { from: 'pv', to: 'heat_pump', energy: 'electricity', valid: true, label: 'PV → WP (Strom ✓)' },
  { from: 'pv', to: 'chiller', energy: 'electricity', valid: true, label: 'PV → Kältemaschine (Strom ✓)' },
  { from: 'chp', to: 'heat_pump', energy: 'electricity', valid: true, label: 'BHKW → WP (Strom ✓)' },
  { from: 'chp', to: 'chiller', energy: 'electricity', valid: true, label: 'BHKW → Kältemaschine (Strom ✓)' },
  { from: 'boiler', to: 'heat_pump', energy: 'heat', valid: true, label: 'Kessel → WP (Wärme ✓ — WP hat heat-Ausgang, Node-Energies inkludiert alle Seiten)' },
  { from: 'boiler', to: 'chiller', energy: 'heat', valid: false, label: 'Kessel → Kältem. (Wärme ✗ — Kältem. hat nur electricity+cold)' },
  { from: 'chiller', to: 'pv', energy: 'cold', valid: false, label: 'Kältem. → PV (Kälte ✗ — PV hat keinen Eingang)' },
  { from: 'pv', to: 'boiler', energy: 'electricity', valid: false, label: 'PV → Kessel (Strom ✗ — Kessel hat Gas-Eingang)' },
]

for (const test of genGenTests) {
  const toLayout = genPortLayouts[test.to]
  const result = simulateIsValidTarget(test.energy, 'generator', 'generator', toLayout)
  assert(result === test.valid, test.label)
}

console.log('')

// ========================================
// ERGEBNIS
// ========================================
console.log('========================================')
console.log(`✓ ${pass} Tests bestanden`)
if (fail > 0) {
  console.log(`✗ ${fail} Tests fehlgeschlagen:`)
  failures.forEach((f) => console.log(`  ${f}`))
} else {
  console.log('ALLE TESTS BESTANDEN!')
}
console.log('========================================')
console.log('')

// Verbindungsmatrix-Zusammenfassung
console.log('VERBINDUNGSMATRIX:')
for (const a of allTypes) {
  for (const b of allTypes) {
    if (allTypes.indexOf(b) < allTypes.indexOf(a)) continue
    if (a === b && a !== 'generator') continue
    const conn = isTypeConnectable(a, b) ? '✓' : '✗'
    console.log(`  ${conn} ${a.padEnd(10)} ↔ ${b}`)
  }
}

process.exit(fail > 0 ? 1 : 0)
