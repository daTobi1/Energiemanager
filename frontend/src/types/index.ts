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
  // Trend-Aufzeichnung
  trendEnabled: boolean
  trendMode: 'interval' | 'on_change' | 'both'
  trendIntervalSeconds: number
  trendDeadbandPercent: number   // Schwellwert fuer on_change: Aenderung in % vom Messbereich
  modbus?: ModbusConfig
  mqtt?: MqttConfig
  http?: HttpConfig
}

// ============================================================
// Erzeuger (Generators)
// ============================================================

export type GeneratorType = 'pv' | 'chp' | 'heat_pump' | 'boiler' | 'chiller' | 'grid' | 'wind_turbine'
export type FuelType = 'natural_gas' | 'biogas' | 'lpg' | 'oil' | 'pellet' | 'wood_chips'
export type HeatPumpType = 'air_water' | 'brine_water' | 'water_water'
export type EnergyForm = 'electricity' | 'heat' | 'cold' | 'electricity_heat'
export type PortEnergy = 'electricity' | 'heat' | 'hot_water' | 'cold' | 'gas' | 'source'

export interface EnergyPort {
  id: string
  side: 'left' | 'right' | 'top' | 'bottom'
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

export interface WindTurbineGenerator extends GeneratorBase {
  type: 'wind_turbine'
  energyForm: 'electricity'
  nominalPowerKw: number
  rotorDiameterM: number
  hubHeightM: number
  cutInWindSpeedMs: number
  ratedWindSpeedMs: number
  cutOutWindSpeedMs: number
  numberOfBlades: number
  generatorType: 'synchronous' | 'asynchronous' | 'pmsg'
}

export type Generator = PvGenerator | ChpGenerator | HeatPumpGenerator | BoilerGenerator | ChillerGenerator | GridGenerator | WindTurbineGenerator

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
// Quellen (Natural Energy Sources)
// ============================================================

export type SourceType = 'solar_thermal' | 'ground_source' | 'air_source' | 'well_source'

export interface Source {
  id: string
  name: string
  type: SourceType
  location: string
  notes: string
  assignedMeterIds: string[]
  assignedSensorIds: string[]
  communication: CommunicationConfig
  // Solarthermie
  collectorAreaM2: number
  collectorCount: number
  azimuthDeg: number
  tiltDeg: number
  opticalEfficiency: number
  // Erdsonde / Erdkollektor
  boreholeDepthM: number
  boreholeCount: number
  probeType: 'single_u' | 'double_u' | 'coaxial'
  soilThermalConductivity: number // W/(m·K)
  // Brunnen
  flowRateM3PerH: number
  temperatureC: number
  wellDepthM: number
}

// ============================================================
// Sensoren (Sensors)
// ============================================================

export type SensorType =
  | 'temperature' | 'pressure' | 'flow' | 'level'
  | 'power' | 'energy' | 'humidity' | 'radiation'
  | 'wind_speed' | 'wind_direction' | 'outdoor_temp'

export type SensorSignalType =
  | 'analog_0_10v' | 'analog_4_20ma' | 'pt100' | 'pt1000'
  | 'ntc' | 'kty' | 'digital' | '1_wire' | 'bus'

export type SensorMeasurement =
  | 'vorlauf_temp' | 'ruecklauf_temp' | 'aussen_temp' | 'raum_temp'
  | 'speicher_temp' | 'kollektor_temp' | 'sole_temp' | 'brunnenwasser_temp'
  | 'druck' | 'differenzdruck' | 'volumenstrom' | 'fuellstand'
  | 'leistung' | 'energie' | 'luftfeuchtigkeit'
  | 'globalstrahlung' | 'windgeschwindigkeit' | 'windrichtung'
  | 'sonstige'

export interface Sensor {
  id: string
  name: string
  sensorType: SensorType
  measurement: SensorMeasurement
  unit: string
  signalType: SensorSignalType
  rangeMin: number
  rangeMax: number
  accuracy: number
  location: string
  assignedSourceId: string
  notes: string
  communication: CommunicationConfig
}

// ============================================================
// Systemeinstellungen
// ============================================================

export type InsulationStandard = 'poor' | 'average' | 'good' | 'passive_house'
export type BuildingType = 'residential' | 'commercial' | 'industrial' | 'mixed'
export type WeatherProvider = 'openmeteo' | 'openweathermap' | 'brightsky' | 'visual_crossing'
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
// Trends
// ============================================================

export interface TrendSeries {
  source: string
  metric: string
  color: string
  label?: string
  yAxisId?: 'left' | 'right'
}

export type TrendInterval = 'raw' | '1min' | '5min' | '15min' | '1h' | '1d'
export type TrendPresetRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom'

export interface TrendDefinition {
  id: string
  name: string
  series: TrendSeries[]
  defaultInterval: TrendInterval
  defaultRange: TrendPresetRange
  isDefault: boolean
}

// ============================================================
// Wetter & PV-Prognose
// ============================================================

export interface WeatherHourly {
  time: string
  temperature_c: number
  humidity_pct: number
  wind_speed_ms: number
  wind_direction_deg: number
  cloud_cover_pct: number
  precipitation_mm: number
  weather_code: number
  ghi_wm2: number
  dni_wm2: number
  dhi_wm2: number
}

export interface WeatherCurrent {
  temperature_c: number
  humidity_pct: number
  wind_speed_ms: number
  cloud_cover_pct: number
  precipitation_mm: number
  weather_code: number
  ghi_wm2: number
  updated_at: string
}

export interface WeatherForecast {
  location: { lat: number; lon: number; altitude: number }
  generated_at: string
  hourly: WeatherHourly[]
}

export interface PvForecastHourly {
  time: string
  power_kw: number
  ghi_wm2: number
  temperature_c: number
}

export interface PvForecastResponse {
  generated_at: string
  total_peak_kwp: number
  panels: { id: string; name: string; peak_kwp: number; tilt: number; azimuth: number }[]
  hourly: PvForecastHourly[]
  daily_summary: Record<string, number>
  error?: string
}

export interface LoadForecastHourly {
  time: string
  power_kw: number
  temperature_c: number
  profile_factor: number
}

export interface LoadForecastResponse {
  generated_at: string
  annual_consumption_kwh: number
  hourly: LoadForecastHourly[]
  daily_summary: Record<string, number>
}

export interface ThermalForecastHourly {
  time: string
  outdoor_temp_c: number
  heating_demand_kw: number
  hot_water_kw: number
  total_thermal_demand_kw: number
  hp_thermal_kw: number
  hp_electric_kw: number
  hp_cop: number
  boiler_kw: number
  storage_temp_c: number
  flow_temp_c: number
}

export interface ThermalForecastResponse {
  generated_at: string
  building: {
    heated_area_m2: number
    insulation_standard: string
    u_value_w_m2k: number
    heating_threshold_c: number
    indoor_target_c: number
  }
  heat_pump: { total_thermal_kw: number; cop_rated: number; count: number }
  boiler: { total_kw: number; count: number }
  storage: { volume_liters: number; target_temp_c: number; capacity_kwh_per_k: number }
  hourly: ThermalForecastHourly[]
  daily_summary: Record<string, {
    heating_kwh: number
    hp_electric_kwh: number
    boiler_kwh: number
    hot_water_kwh: number
  }>
}

export interface PvAccuracyResponse {
  mae: number
  rmse: number
  mbe: number
  correlation: number
  hourly: { time: string; forecast_kw: number; actual_kw: number }[]
}

// ============================================================
// Optimizer Schedule
// ============================================================

export interface ScheduleHourly {
  time: string
  pv_forecast_kw: number
  load_forecast_kw: number
  battery_setpoint_kw: number
  battery_soc_pct: number
  hp_thermal_kw: number
  hp_electric_kw: number
  hp_cop: number
  boiler_kw: number
  storage_temp_c: number
  heating_demand_kw: number
  grid_kw: number
  cost_ct: number
  co2_kg: number
  self_consumption_pct: number
  tariff_ct: number
  strategy: string
}

export interface ScheduleSummary {
  total_cost_ct: number
  total_revenue_ct: number
  net_cost_ct: number
  total_co2_kg: number
  avg_self_consumption_pct: number
  peak_grid_import_kw: number
  peak_grid_export_kw: number
  total_pv_kwh: number
  total_grid_import_kwh: number
  total_grid_export_kwh: number
  total_battery_charged_kwh: number
  total_battery_discharged_kwh: number
}

export interface OptimizationSchedule {
  generated_at: string
  hours: number
  weights: OptimizerWeights
  strategy: string
  strategy_description: string
  summary: ScheduleSummary
  hourly: ScheduleHourly[]
}

// ============================================================
// ML (Prognose-Korrektur)
// ============================================================

export interface MLModelInfo {
  forecast_type: string
  model_type: string
  is_trained: boolean
  trained_at: string | null
  training_samples: number
  feature_count: number
  mae: number
  rmse: number
  r2_score: number
  is_active: boolean
}

export interface MLStatusResponse {
  models: MLModelInfo[]
  loaded_models: string[]
  model_dir: string
}

export interface MLModelDetail extends MLModelInfo {
  version: string
  model_path: string
  is_loaded: boolean
  metadata: { feature_importance?: Record<string, number> }
}

// ============================================================
// Controller (Regelung)
// ============================================================

export type ControllerMode = 'auto' | 'manual' | 'off'

export interface ControllerSetpoints {
  battery_kw: number
  hp_modulation_pct: number
  hp_thermal_kw: number
  boiler_kw: number
  flow_temp_c: number
  wallbox_kw: number
  source: string
  strategy: string
}

export interface ControllerStatus {
  mode: ControllerMode
  safety_active: string | null
  schedule_loaded: boolean
  schedule_hours: number
  schedule_strategy: string
  manual_overrides: Record<string, number>
  active_setpoints: ControllerSetpoints
  history_count: number
  avg_deviation_pct: number
}

export interface ControllerHistoryEntry {
  timestamp: string
  setpoint_battery_kw: number
  actual_battery_kw: number
  setpoint_grid_kw: number
  actual_grid_kw: number
  setpoint_hp_kw: number
  actual_hp_kw: number
  deviation_pct: number
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
    trendEnabled: true,
    trendMode: 'interval',
    trendIntervalSeconds: 30,
    trendDeadbandPercent: 1,
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
    weatherProvider: 'openmeteo',
    weatherApiKey: '',
    optimizerWeights: createDefaultOptimizerWeights(),
  }
}

export function createDefaultSource(type: SourceType = 'solar_thermal'): Source {
  return {
    id: '',
    name: '',
    type,
    location: '',
    notes: '',
    assignedMeterIds: [],
    assignedSensorIds: [],
    communication: createDefaultCommunication(),
    collectorAreaM2: 10,
    collectorCount: 4,
    azimuthDeg: 180,
    tiltDeg: 45,
    opticalEfficiency: 0.8,
    boreholeDepthM: 100,
    boreholeCount: 2,
    probeType: 'double_u',
    soilThermalConductivity: 2.0,
    flowRateM3PerH: 3,
    temperatureC: 10,
    wellDepthM: 15,
  }
}

export function createDefaultSensor(): Sensor {
  return {
    id: '',
    name: '',
    sensorType: 'temperature',
    measurement: 'vorlauf_temp',
    unit: '°C',
    signalType: 'pt1000',
    rangeMin: -20,
    rangeMax: 120,
    accuracy: 0.5,
    location: '',
    assignedSourceId: '',
    notes: '',
    communication: createDefaultCommunication(),
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
