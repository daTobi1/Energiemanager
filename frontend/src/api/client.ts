/**
 * API-Client für die Backend-Anbindung.
 *
 * Alle Konfigurationsentitäten werden als JSON übertragen —
 * die TypeScript-Interfaces sind die kanonische Schema-Definition.
 * Das Backend speichert die Objekte 1:1 als JSONB.
 */

import type {
  Generator, Meter, Consumer, Storage,
  Room, HeatingCoolingCircuit, Source, Sensor, SystemSettings,
  TrendDefinition,
  WeatherCurrent, WeatherForecast, PvForecastResponse, PvAccuracyResponse, LoadForecastResponse, ThermalForecastResponse, OptimizationSchedule,
  ControllerStatus, ControllerHistoryEntry,
  SchedulerStatus, SchedulerHistoryEntry,
  MLStatusResponse, MLModelDetail,
  AlarmDefinition, AlarmEvent,
  SelfLearningStatus, ActivationMode,
  ChargingStatus, ChargingSessionInfo, ChargingMode, Vehicle,
  ChargingAnalyticsResponse,
} from '../types'

// Device-Manager Typen
interface DevicePresetSummary {
  id: string
  manufacturer: string
  model: string
  category: string
  protocol: string
  description: string
  defaults: Record<string, unknown>
  writable_keys: string[]
  setpoint_keys: string[]
}

interface DeviceStatus {
  entity_id: string
  entity_type: string
  name: string
  preset_id: string | null
  protocol: string
  host: string
  port: number
  connected: boolean
  modules: Record<string, number>
  last_poll: string | null
  error_count: number
  last_error: string | null
  value_count: number
}

interface DeviceManagerStatus {
  running: boolean
  device_count: number
  connected_count: number
  devices: {
    entity_id: string
    name: string
    preset_id: string | null
    protocol: string
    connected: boolean
    modules: Record<string, number>
    values: number
    errors: number
  }[]
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// --- Generic CRUD ---

function crudFor<T extends { id: string }>(path: string) {
  return {
    list: () => request<T[]>(path),
    get: (id: string) => request<T>(`${path}/${id}`),
    create: (item: T) => request<T>(path, { method: 'POST', body: JSON.stringify(item) }),
    update: (id: string, item: T) => request<T>(`${path}/${id}`, { method: 'PUT', body: JSON.stringify(item) }),
    remove: (id: string) => request<void>(`${path}/${id}`, { method: 'DELETE' }),
  }
}

// --- API ---

export const api = {
  generators: crudFor<Generator>('/generators'),
  meters: crudFor<Meter>('/meters'),
  consumers: crudFor<Consumer>('/consumers'),
  storages: crudFor<Storage>('/storages'),
  rooms: crudFor<Room>('/rooms'),
  circuits: crudFor<HeatingCoolingCircuit>('/circuits'),
  sources: crudFor<Source>('/sources'),
  sensors: crudFor<Sensor>('/sensors'),

  settings: {
    get: () => request<SystemSettings | null>('/settings'),
    update: (s: SystemSettings) =>
      request<SystemSettings>('/settings', { method: 'PUT', body: JSON.stringify(s) }),
  },

  data: {
    seed: (payload: {
      generators: Generator[]
      meters: Meter[]
      consumers: Consumer[]
      storages: Storage[]
      rooms: Room[]
      circuits: HeatingCoolingCircuit[]
      settings: SystemSettings
    }) => request<{ status: string }>('/data/seed', { method: 'POST', body: JSON.stringify(payload) }),

    clearAll: () => request<void>('/data/all', { method: 'DELETE' }),
  },

  trends: {
    timeRange: () => request<{ min: string | null; max: string | null; count: number }>('/trends/time-range'),
    sources: () => request<{ source: string; metric: string; unit: string }[]>('/trends/sources'),
    data: (params: { sources: string; from: string; to: string; interval: string }) =>
      request<Record<string, { unit: string; timestamps: string[]; values: number[]; min: number[]; max: number[] }>>(
        `/trends/data?sources=${encodeURIComponent(params.sources)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}&interval=${params.interval}`
      ),
    statistics: (params: { sources: string; from: string; to: string }) =>
      request<Record<string, { min: number; max: number; avg: number; sum: number; count: number }>>(
        `/trends/statistics?sources=${encodeURIComponent(params.sources)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`
      ),
  },

  trendDefinitions: crudFor<TrendDefinition>('/trend-definitions'),

  simulator: {
    status: () => request<{
      running: boolean
      interval_seconds: number
      speed_factor: number
      state: {
        battery_soc_pct: number
        heat_storage_temp_c: number
        outdoor_temp_c: number
        total_pv_kwh: number
        total_import_kwh: number
        total_export_kwh: number
      }
    }>('/simulator/status'),
    start: (interval = 5, speed = 1) =>
      request<{ status: string }>(`/simulator/start?interval=${interval}&speed=${speed}`, { method: 'POST' }),
    stop: () => request<{ status: string }>('/simulator/stop', { method: 'POST' }),
    latest: () => request<Record<string, { value: number; unit: string; timestamp: string }>>('/simulator/measurements/latest'),
    clearMeasurements: () => request<void>('/simulator/measurements', { method: 'DELETE' }),
  },

  daq: {
    status: () => request<{
      running: boolean
      targets: number
      details: {
        source: string
        entity_type: string
        protocol: string
        interval_seconds: number
        data_points: string[]
        errors: number
      }[]
    }>('/daq/status'),
    start: () => request<{ status: string }>('/daq/start', { method: 'POST' }),
    stop: () => request<{ status: string }>('/daq/stop', { method: 'POST' }),
    reload: () => request<{ status: string }>('/daq/reload', { method: 'POST' }),
  },

  weather: {
    current: () => request<WeatherCurrent>('/weather/current'),
    forecast: (hours = 72) =>
      request<WeatherForecast>(`/weather/forecast?hours=${hours}`),
    pvForecast: (hours = 72) =>
      request<PvForecastResponse>(`/weather/pv-forecast?hours=${hours}`),
    loadForecast: (hours = 72) =>
      request<LoadForecastResponse>(`/weather/load-forecast?hours=${hours}`),
    thermalForecast: (hours = 72) =>
      request<ThermalForecastResponse>(`/weather/thermal-forecast?hours=${hours}`),
    pvAccuracy: (params: { from: string; to: string }) =>
      request<PvAccuracyResponse>(
        `/weather/pv-accuracy?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`
      ),
    refresh: () => request<{ status: string }>('/weather/refresh', { method: 'POST' }),
  },

  optimizer: {
    schedule: (hours = 24) =>
      request<OptimizationSchedule>(`/optimizer/schedule?hours=${hours}`),
  },

  ml: {
    status: () => request<MLStatusResponse>('/ml/status'),
    statusDetail: (type: string) => request<MLModelDetail>(`/ml/status/${type}`),
    train: (type?: string) =>
      request<Record<string, unknown>>(type ? `/ml/train/${type}` : '/ml/train', { method: 'POST' }),
    deleteModel: (type: string) =>
      request<{ status: string }>(`/ml/models/${type}`, { method: 'DELETE' }),
  },

  alarmDefinitions: crudFor<AlarmDefinition>('/alarm-definitions'),

  alarms: {
    events: (last = 100) => request<AlarmEvent[]>(`/alarms/events?last=${last}`),
    active: () => request<AlarmEvent[]>('/alarms/events/active'),
    acknowledge: (eventId: number) =>
      request<{ success: boolean }>(`/alarms/events/${eventId}/acknowledge`, { method: 'POST' }),
    clear: (eventId: number) =>
      request<{ success: boolean }>(`/alarms/events/${eventId}/clear`, { method: 'POST' }),
    status: () => request<{ running: boolean; eval_interval_s: number; system_alarms: number }>('/alarms/status'),
    start: (interval = 30) => request<unknown>(`/alarms/start?interval=${interval}`, { method: 'POST' }),
    stop: () => request<unknown>('/alarms/stop', { method: 'POST' }),
    evaluate: () => request<{ triggered: number; alarms: unknown[] }>('/alarms/evaluate', { method: 'POST' }),
    systemRules: () => request<AlarmDefinition[]>('/alarms/system-rules'),
  },

  devices: {
    presets: (category?: string) =>
      request<DevicePresetSummary[]>(category ? `/devices/presets?category=${category}` : '/devices/presets'),
    presetDetail: (id: string) => request<Record<string, unknown>>(`/devices/presets/${id}`),
    reloadPresets: () => request<{ reloaded: number }>('/devices/presets/reload', { method: 'POST' }),
    status: () => request<DeviceManagerStatus>('/devices/status'),
    start: () => request<DeviceManagerStatus>('/devices/start', { method: 'POST' }),
    stop: () => request<{ stopped: boolean }>('/devices/stop', { method: 'POST' }),
    reload: () => request<DeviceManagerStatus>('/devices/reload', { method: 'POST' }),
    deviceStatus: (id: string) => request<DeviceStatus>(`/devices/${id}/status`),
    deviceValues: (id: string) => request<{ entity_id: string; values: Record<string, number>; count: number }>(`/devices/${id}/values`),
    writeSetpoint: (id: string, key: string, value: number) =>
      request<{ success: boolean }>(`/devices/${id}/write?key=${encodeURIComponent(key)}&value=${value}`, { method: 'POST' }),
  },

  scheduler: {
    status: () => request<SchedulerStatus>('/scheduler/status'),
    start: (optimizationInterval = 900, autoMode = true) =>
      request<{ status: string }>(`/scheduler/start?optimization_interval=${optimizationInterval}&auto_mode=${autoMode}`, { method: 'POST' }),
    stop: () => request<{ status: string }>('/scheduler/stop', { method: 'POST' }),
    trigger: (hours = 24, solver: 'auto' | 'milp' | 'heuristic' = 'auto') =>
      request<OptimizationSchedule>(`/scheduler/trigger?hours=${hours}&solver=${solver}`, { method: 'POST' }),
    history: (last = 100) =>
      request<{ count: number; entries: SchedulerHistoryEntry[] }>(`/scheduler/history?last=${last}`),
  },

  controller: {
    status: () => request<ControllerStatus>('/controller/status'),
    setMode: (mode: string) =>
      request<{ status: string; mode: string }>('/controller/mode', { method: 'POST', body: JSON.stringify({ mode }) }),
    setOverride: (key: string, value: number) =>
      request<{ status: string }>('/controller/override', { method: 'POST', body: JSON.stringify({ key, value }) }),
    clearOverrides: () =>
      request<{ status: string }>('/controller/overrides', { method: 'DELETE' }),
    history: (last = 48) =>
      request<{ count: number; entries: ControllerHistoryEntry[] }>(`/controller/history?last=${last}`),
  },

  charging: {
    status: () => request<ChargingStatus>('/charging/status'),
    syncWallboxes: () => request<{ synced: number }>('/charging/sync-wallboxes', { method: 'POST' }),
    sessions: (activeOnly = true) =>
      request<ChargingSessionInfo[]>(`/charging/sessions?active_only=${activeOnly}`),
    createSession: (data: {
      wallbox_id: number; mode: ChargingMode; vehicle_id?: number;
      vehicle_battery_capacity_kwh?: number; vehicle_soc_pct?: number;
      vehicle_efficiency_kwh_per_km?: number; vehicle_name?: string;
      soc_limit_pct?: number; target_km?: number; target_time?: string;
    }) =>
      request<ChargingSessionInfo>('/charging/sessions', { method: 'POST', body: JSON.stringify(data) }),
    updateMode: (id: number, data: { mode: ChargingMode; target_km?: number; target_time?: string; soc_limit_pct?: number }) =>
      request<ChargingSessionInfo>(`/charging/sessions/${id}/mode`, { method: 'PUT', body: JSON.stringify(data) }),
    startSession: (id: number) =>
      request<ChargingSessionInfo>(`/charging/sessions/${id}/start`, { method: 'POST' }),
    stopSession: (id: number) =>
      request<ChargingSessionInfo>(`/charging/sessions/${id}/stop`, { method: 'POST' }),
    pauseSession: (id: number) =>
      request<ChargingSessionInfo>(`/charging/sessions/${id}/pause`, { method: 'POST' }),
    resumeSession: (id: number) =>
      request<ChargingSessionInfo>(`/charging/sessions/${id}/resume`, { method: 'POST' }),
    // Fahrzeug-Verwaltung
    vehicles: () => request<Vehicle[]>('/charging/vehicles'),
    createVehicle: (data: Omit<Vehicle, 'id' | 'is_active'>) =>
      request<Vehicle>('/charging/vehicles', { method: 'POST', body: JSON.stringify(data) }),
    updateVehicle: (id: number, data: Partial<Vehicle>) =>
      request<Vehicle>(`/charging/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVehicle: (id: number) =>
      request<{ deleted: boolean }>(`/charging/vehicles/${id}`, { method: 'DELETE' }),
    assignVehicle: (wallboxId: number, vehicleId: number | null) =>
      request<{ wallbox_id: number; assigned_vehicle_id: number | null }>(
        `/charging/wallboxes/${wallboxId}/assign-vehicle${vehicleId != null ? `?vehicle_id=${vehicleId}` : ''}`,
        { method: 'POST' },
      ),
    analytics: (params: { from: string; to: string; grouping: string }) =>
      request<ChargingAnalyticsResponse>(
        `/charging/analytics?from_date=${params.from}&to_date=${params.to}&grouping=${params.grouping}`,
      ),
  },

  selfLearning: {
    status: () => request<SelfLearningStatus>('/self-learning/status'),
    setMode: (forecastType: string, mode: ActivationMode) =>
      request<{ forecast_type: string; activation_mode: ActivationMode }>(
        `/self-learning/models/${forecastType}/mode?mode=${mode}`, { method: 'PUT' },
      ),
    train: (forecastType: string) =>
      request<Record<string, unknown>>(`/self-learning/models/${forecastType}/train`, { method: 'POST' }),
    learnThermal: () =>
      request<Record<string, unknown>>('/self-learning/thermal/learn', { method: 'POST' }),
  },

  /** Prüft ob das Backend erreichbar ist. */
  health: async () => {
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${base.replace('/api/v1', '')}/health`)
      return res.ok
    } catch {
      return false
    }
  },
}
