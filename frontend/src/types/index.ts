// ============================================================
// Communication — Netzwerkbasierte Protokolle
// ============================================================

export type CommunicationProtocol =
  | 'modbus_tcp'
  | 'sunspec'
  | 'mqtt'
  | 'http_rest'
  | 'bacnet_ip'
  | 'knx_ip'
  | 'opc_ua'
  | 'sml_tcp'
  | 'mbus_tcp'
  | 'ocpp'

export interface ModbusConfig {
  unitId: number
  registerAddress: number
  registerCount: number
  registerType: 'holding' | 'input' | 'coil' | 'discrete'
  dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64'
  scaleFactor: number
  byteOrder: 'big_endian' | 'little_endian'
}

export interface MqttConfig {
  topic: string
  qos: 0 | 1 | 2
  payloadFormat: 'json' | 'plain' | 'xml'
  valueJsonPath: string
}

export interface HttpConfig {
  baseUrl: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT'
  authType: 'none' | 'basic' | 'bearer' | 'api_key'
  username: string
  password: string
  apiKey: string
  responseJsonPath: string
}

export interface CommunicationConfig {
  protocol: CommunicationProtocol
  ipAddress: string
  port: number
  pollingIntervalSeconds: number
  enabled: boolean
  modbus?: ModbusConfig
  mqtt?: MqttConfig
  http?: HttpConfig
}

// ============================================================
// Erzeuger (Generators)
// ============================================================

export type GeneratorType = 'pv' | 'chp' | 'heat_pump' | 'boiler' | 'chiller' | 'grid'
export type FuelType = 'natural_gas' | 'biogas' | 'lpg' | 'oil' | 'pellet' | 'wood_chips'
export type HeatPumpType = 'air_water' | 'brine_water' | 'water_water'
export type EnergyForm = 'electricity' | 'heat' | 'cold' | 'electricity_heat'
export type PortEnergy = 'electricity' | 'heat' | 'hot_water' | 'cold' | 'gas' | 'source'

export interface EnergyPort {
  id: string
  side: 'input' | 'output'
  energy: PortEnergy
  label: string
}

interface GeneratorBase {
  id: string
  name: string
  type: GeneratorType
  energyForm: EnergyForm
  manufacturer: string
  model: string
  serialNumber: string
  commissioningDate: string
  location: string
  notes: string
  communication: CommunicationConfig
  assignedMeterIds: string[]
  ports: EnergyPort[]
  connectedGeneratorIds: string[]
}

export interface PvGenerator extends GeneratorBase {
  type: 'pv'
  energyForm: 'electricity'
  peakPowerKwp: number
  numberOfModules: number
  moduleType: string
  modulePowerWp: number
  inverterType: string
  inverterPowerKw: number
  numberOfInverters: number
  mppTrackers: number
  azimuthDeg: number
  tiltDeg: number
  efficiency: number
  degradationPerYear: number
  temperatureCoefficient: number
  albedo: number
}

export interface ChpGenerator extends GeneratorBase {
  type: 'chp'
  energyForm: 'electricity_heat'
  electricalPowerKw: number
  thermalPowerKw: number
  fuelType: FuelType
  electricalEfficiency: number
  thermalEfficiency: number
  overallEfficiency: number
  modulationMinPercent: number
  modulationMaxPercent: number
  minimumRunTimeMin: number
  minimumOffTimeMin: number
  startCostEur: number
  maintenanceIntervalHours: number
  currentOperatingHours: number
  fuelCostCtPerKwh: number
  powerToHeatRatio: number
}

export interface HeatPumpGenerator extends GeneratorBase {
  type: 'heat_pump'
  energyForm: 'heat'
  heatPumpType: HeatPumpType
  heatingPowerKw: number
  coolingCapable: boolean
  coolingPowerKw: number
  electricalPowerKw: number
  copRated: number
  copCurve: Array<{ outdoorTempC: number; cop: number }>
  minOutdoorTempC: number
  maxOutdoorTempC: number
  flowTemperatureC: number
  returnTemperatureC: number
  modulationMinPercent: number
  modulationMaxPercent: number
  defrostPowerKw: number
  sgReadyEnabled: boolean
  bivalencePointC: number
  refrigerant: string
}

export interface BoilerGenerator extends GeneratorBase {
  type: 'boiler'
  energyForm: 'heat'
  fuelType: FuelType
  nominalPowerKw: number
  efficiency: number
  modulationMinPercent: number
  modulationMaxPercent: number
  condensing: boolean
  flowTemperatureMaxC: number
  returnTemperatureMinC: number
  minimumRunTimeMin: number
  fuelCostCtPerKwh: number
  flueGasLosses: number
}

export interface ChillerGenerator extends GeneratorBase {
  type: 'chiller'
  energyForm: 'cold'
  coolingPowerKw: number
  electricalPowerKw: number
  eerRated: number
  seerRated: number
  coolantType: string
  refrigerant: string
  flowTemperatureC: number
  returnTemperatureC: number
  modulationMinPercent: number
  modulationMaxPercent: number
  minOutdoorTempC: number
  maxOutdoorTempC: number
}

export interface GridGenerator extends GeneratorBase {
  type: 'grid'
  energyForm: 'electricity'
  gridMaxPowerKw: number
  gridPhases: 1 | 3
  gridVoltageV: number
  feedInLimitPercent: number
  feedInLimitKw: number
  gridOperator: string
  meterPointId: string
}

export type Generator = PvGenerator | ChpGenerator | HeatPumpGenerator | BoilerGenerator | ChillerGenerator | GridGenerator

// ============================================================
// Zähler (Meters)
// ============================================================

export type MeterType = 'electricity' | 'heat' | 'gas' | 'water' | 'cold' | 'source'
export type MeterDirection = 'consumption' | 'generation' | 'bidirectional' | 'grid_feed_in' | 'grid_consumption'
export type MeterCategory = 'source' | 'generation' | 'consumption' | 'circuit' | 'group' | 'end' | 'unassigned'
export type MeterAssignmentType = 'generator' | 'consumer' | 'storage' | 'grid' | 'none'

export interface MeterRegisterMapping {
  name: string
  description: string
  registerAddress: number
  dataType: string
  unit: string
  scaleFactor: number
}

export interface Meter {
  id: string
  name: string
  type: MeterType
  meterNumber: string
  direction: MeterDirection
  category: MeterCategory
  parentMeterId: string
  phases: 1 | 3
  nominalCurrentA: number
  nominalVoltageV: number
  ctRatio: number
  vtRatio: number
  pulsesPerUnit: number
  assignedToType: MeterAssignmentType
  assignedToId: string
  communication: CommunicationConfig
  registerMappings: MeterRegisterMapping[]
  ports: EnergyPort[]
  notes: string
}

// ============================================================
// Verbraucher (Consumers)
// ============================================================

export type ConsumerType =
  | 'household'
  | 'commercial'
  | 'production'
  | 'lighting'
  | 'hvac'
  | 'ventilation'
  | 'wallbox'
  | 'hot_water'
  | 'other'

export type LoadProfile =
  | 'H0' | 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6'
  | 'L0' | 'L1' | 'L2' | 'custom'

export interface Consumer {
  id: string
  name: string
  type: ConsumerType
  nominalPowerKw: number
  annualConsumptionKwh: number
  loadProfile: LoadProfile
  controllable: boolean
  sheddable: boolean
  priority: number
  connectedSourceIds: string[]
  assignedMeterIds: string[]
  communication: CommunicationConfig
  ports: EnergyPort[]
  notes: string
  // Wallbox-spezifisch
  wallboxMaxPowerKw: number
  wallboxPhases: 1 | 3
  wallboxMinCurrentA: number
  vehicleBatteryKwh: number
  vehicleConsumptionPer100km: number
  ocppEnabled: boolean
}

// ============================================================
// Speicher (Storage)
// ============================================================

export type StorageType = 'battery' | 'heat' | 'cold'
export type SensorPosition = 'top' | 'upper_middle' | 'middle' | 'lower_middle' | 'bottom' | 'flow' | 'return' | 'ambient'

export interface TemperatureSensor {
  id: string
  name: string
  sensorType: 'PT100' | 'PT1000' | 'NTC' | 'KTY' | 'digital'
  position: SensorPosition
  offsetCorrection: number
  communication: CommunicationConfig
}

export interface BatteryStorage {
  id: string
  name: string
  type: 'battery'
  manufacturer: string
  model: string
  technology: 'lithium_ion' | 'lfp' | 'lead_acid' | 'redox_flow' | 'sodium_ion'
  capacityKwh: number
  usableCapacityKwh: number
  maxChargePowerKw: number
  maxDischargePowerKw: number
  chargeEfficiency: number
  dischargeEfficiency: number
  roundTripEfficiency: number
  minSocPercent: number
  maxSocPercent: number
  initialSocPercent: number
  nominalVoltageV: number
  maxCurrentA: number
  cycleLifeExpected: number
  currentCycles: number
  calendarLifeYears: number
  maxDoD: number
  cRateCharge: number
  cRateDischarge: number
  selfDischargePerMonth: number
  temperatureSensors: TemperatureSensor[]
  connectedGeneratorIds: string[]
  connectedConsumerIds: string[]
  communication: CommunicationConfig
  assignedMeterIds: string[]
  ports: EnergyPort[]
  notes: string
}

export interface ThermalStorage {
  id: string
  name: string
  type: 'heat' | 'cold'
  volumeLiters: number
  heightMm: number
  diameterMm: number
  maxTemperatureC: number
  minTemperatureC: number
  targetTemperatureC: number
  hysteresisK: number
  heatLossCoefficientWPerK: number
  insulationThicknessMm: number
  insulationMaterial: string
  ambientTemperatureC: number
  specificHeatCapacity: number
  temperatureSensors: TemperatureSensor[]
  connectedGeneratorIds: string[]
  connectedConsumerIds: string[]
  assignedMeterIds: string[]
  ports: EnergyPort[]
  stratificationEnabled: boolean
  numberOfLayers: number
  hasElectricalHeatingElement: boolean
  heatingElementPowerKw: number
  communication: CommunicationConfig
  notes: string
}

export type Storage = BatteryStorage | ThermalStorage

// ============================================================
// Räume (Rooms)
// ============================================================

export type FloorLevel = 'UG' | 'EG' | 'OG1' | 'OG2' | 'OG3' | 'DG'
export type RoomType =
  | 'wohnen' | 'schlafen' | 'kueche' | 'bad' | 'buero'
  | 'flur' | 'lager' | 'technik' | 'sonstige'

export interface SchedulePeriod {
  id: string
  name: string
  days: ('mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so')[]
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  targetTemperatureC: number
}

export interface Room {
  id: string
  name: string
  floor: FloorLevel
  areaM2: number
  heightM: number
  roomType: RoomType
  // Klima-Sollwerte
  targetTemperatureC: number
  nightSetbackK: number
  minTemperatureC: number
  maxTemperatureC: number
  coolingEnabled: boolean
  coolingTargetTemperatureC: number
  // Zeitprogramm
  schedule: SchedulePeriod[]
  // Zuordnungen
  heatingCircuitId: string
  coolingCircuitId: string
  consumerIds: string[]
  meterIds: string[]
  ports: EnergyPort[]
  notes: string
}

// ============================================================
// Heiz-/Kältekreise (Heating/Cooling Circuits)
// ============================================================

export type CircuitType = 'heating' | 'cooling' | 'combined'
export type PumpType = 'fixed_speed' | 'variable_speed' | 'high_efficiency'
export type DistributionType = 'floor_heating' | 'radiator' | 'fan_coil' | 'ceiling_cooling' | 'mixed'

export interface HeatingCurve {
  steepness: number       // Heizkurven-Steilheit (0.2 - 3.0)
  parallelShift: number   // Parallelverschiebung (-5 bis +5 K)
}

export interface ControllableComponent {
  enabled: boolean
  communication: CommunicationConfig
}

export interface HeatingCoolingCircuit {
  id: string
  name: string
  type: CircuitType
  controllable: boolean
  // Regelbare Komponenten (jeweils eigenes Busprotokoll)
  flowTempSetpoint: ControllableComponent   // Vorlaufsollwert-Vorgabe
  mixerValve: ControllableComponent         // Mischventil
  pumpControl: ControllableComponent        // Umwälzpumpe
  zoneValves: ControllableComponent         // Zonenventile / Stellantriebe
  distributionType: DistributionType
  flowTemperatureC: number
  returnTemperatureC: number
  designOutdoorTemperatureC: number
  heatingCurve: HeatingCurve
  pumpType: PumpType
  pumpPowerW: number
  // Versorgungsquelle
  supplyStorageIds: string[]   // Aus welchem Puffer-/Kältespeicher gespeist
  generatorIds: string[]       // Direkt angeschlossene Erzeuger (wenn kein Speicher dazwischen)
  roomIds: string[]
  meterIds: string[]
  ports: EnergyPort[]
  notes: string
}

// ============================================================
// Systemeinstellungen
// ============================================================

export type InsulationStandard = 'poor' | 'average' | 'good' | 'passive_house'
export type BuildingType = 'residential' | 'commercial' | 'industrial' | 'mixed'
export type WeatherProvider = 'openweathermap' | 'brightsky' | 'visual_crossing'
export type TariffType = 'fixed' | 'time_of_use' | 'dynamic'

export interface TimeOfUsePeriod {
  name: string
  startHour: number
  endHour: number
  priceCtPerKwh: number
  days: string[]
}

export interface SystemSettings {
  buildingName: string
  buildingArea: number
  buildingYear: number
  insulationStandard: InsulationStandard
  buildingType: BuildingType
  occupants: number
  heatedArea: number
  annualHeatingDemandKwh: number
  annualCoolingDemandKwh: number

  address: string
  latitude: number
  longitude: number
  altitudeM: number
  timezone: string

  // Komfort-Vorgaben (Gebäude-Defaults)
  hasIndividualRoomControl: boolean
  targetRoomTemperatureC: number
  nightSetbackK: number
  hotWaterTemperatureC: number
  coolingThresholdC: number
  heatingThresholdOutdoorC: number

  tariffType: TariffType
  gridConsumptionCtPerKwh: number
  gridFeedInCtPerKwh: number
  timeOfUsePeriods: TimeOfUsePeriod[]
  demandChargeEurPerKwPerYear: number
  gasPriceCtPerKwh: number
  oilPriceCtPerLiter: number
  pelletPriceEurPerTon: number

  weatherProvider: WeatherProvider
  weatherApiKey: string

  // Optimierer-Gewichtung (0–100 pro Achse)
  optimizerWeights: OptimizerWeights
}

export interface OptimizerWeights {
  /** CO₂-Einsparung maximieren */
  co2Reduction: number
  /** Wirtschaftlichkeit (Kosten minimieren) */
  economy: number
  /** Komfort (Temperatur, Warmwasser) */
  comfort: number
  /** Eigenverbrauch maximieren */
  selfConsumption: number
  /** Netzdienliches Verhalten (Spitzenlastglättung) */
  gridFriendly: number
}

// ============================================================
// Defaults
// ============================================================

export function createDefaultCommunication(): CommunicationConfig {
  return {
    protocol: 'modbus_tcp',
    ipAddress: '',
    port: 502,
    pollingIntervalSeconds: 5,
    enabled: false,
  }
}

export function createDefaultModbus(): ModbusConfig {
  return {
    unitId: 1,
    registerAddress: 0,
    registerCount: 2,
    registerType: 'holding',
    dataType: 'float32',
    scaleFactor: 1,
    byteOrder: 'big_endian',
  }
}

export function createDefaultMqtt(): MqttConfig {
  return {
    topic: '',
    qos: 0,
    payloadFormat: 'json',
    valueJsonPath: '$.value',
  }
}

export function createDefaultHttp(): HttpConfig {
  return {
    baseUrl: '',
    endpoint: '',
    method: 'GET',
    authType: 'none',
    username: '',
    password: '',
    apiKey: '',
    responseJsonPath: '$.value',
  }
}

export function createDefaultTemperatureSensor(): TemperatureSensor {
  return {
    id: '',
    name: '',
    sensorType: 'PT1000',
    position: 'middle',
    offsetCorrection: 0,
    communication: createDefaultCommunication(),
  }
}

export function createDefaultRoom(): Room {
  return {
    id: '',
    name: '',
    floor: 'EG',
    areaM2: 20,
    heightM: 2.5,
    roomType: 'wohnen',
    targetTemperatureC: 21,
    nightSetbackK: 3,
    minTemperatureC: 16,
    maxTemperatureC: 26,
    coolingEnabled: false,
    coolingTargetTemperatureC: 24,
    schedule: [],
    heatingCircuitId: '',
    coolingCircuitId: '',
    consumerIds: [],
    meterIds: [],
    ports: [],
    notes: '',
  }
}

export function createDefaultControllableComponent(): ControllableComponent {
  return {
    enabled: false,
    communication: createDefaultCommunication(),
  }
}

export function createDefaultCircuit(): HeatingCoolingCircuit {
  return {
    id: '',
    name: '',
    type: 'heating',
    controllable: true,
    flowTempSetpoint: { enabled: true, communication: createDefaultCommunication() },
    mixerValve: createDefaultControllableComponent(),
    pumpControl: createDefaultControllableComponent(),
    zoneValves: createDefaultControllableComponent(),
    distributionType: 'radiator',
    flowTemperatureC: 55,
    returnTemperatureC: 45,
    designOutdoorTemperatureC: -12,
    heatingCurve: { steepness: 1.2, parallelShift: 0 },
    pumpType: 'high_efficiency',
    pumpPowerW: 50,
    supplyStorageIds: [],
    generatorIds: [],
    roomIds: [],
    meterIds: [],
    ports: [],
    notes: '',
  }
}

export function createDefaultSettings(): SystemSettings {
  return {
    buildingName: '',
    buildingArea: 150,
    buildingYear: 2000,
    insulationStandard: 'average',
    buildingType: 'residential',
    occupants: 4,
    heatedArea: 130,
    annualHeatingDemandKwh: 15000,
    annualCoolingDemandKwh: 0,
    address: '',
    latitude: 51.1657,
    longitude: 10.4515,
    altitudeM: 200,
    timezone: 'Europe/Berlin',
    hasIndividualRoomControl: false,
    targetRoomTemperatureC: 21,
    nightSetbackK: 3,
    hotWaterTemperatureC: 55,
    coolingThresholdC: 26,
    heatingThresholdOutdoorC: 15,
    tariffType: 'fixed',
    gridConsumptionCtPerKwh: 30,
    gridFeedInCtPerKwh: 8.2,
    timeOfUsePeriods: [],
    demandChargeEurPerKwPerYear: 0,
    gasPriceCtPerKwh: 8,
    oilPriceCtPerLiter: 95,
    pelletPriceEurPerTon: 350,
    weatherProvider: 'openweathermap',
    weatherApiKey: '',
    optimizerWeights: createDefaultOptimizerWeights(),
  }
}

export function createDefaultOptimizerWeights(): OptimizerWeights {
  return {
    co2Reduction: 50,
    economy: 80,
    comfort: 70,
    selfConsumption: 60,
    gridFriendly: 30,
  }
}
