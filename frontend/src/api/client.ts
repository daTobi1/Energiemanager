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
  MLStatusResponse, MLModelDetail,
  LambdaHPStatus, LambdaHPModules,
} from '../types'

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

  lambdaHp: {
    status: () => request<LambdaHPStatus>('/lambda-hp/status'),
    connect: (host: string, port = 502, slaveId = 1) =>
      request<{ success: boolean; modules?: LambdaHPModules; error?: string }>(
        `/lambda-hp/connect?host=${encodeURIComponent(host)}&port=${port}&slave_id=${slaveId}`,
        { method: 'POST' },
      ),
    disconnect: () => request<{ status: string }>('/lambda-hp/disconnect', { method: 'POST' }),
    values: () => request<{ values: Record<string, number>; timestamp: string }>('/lambda-hp/values'),
    write: (key: string, value: number) =>
      request<{ success: boolean }>(`/lambda-hp/write?key=${encodeURIComponent(key)}&value=${value}`, { method: 'POST' }),
    pvSurplus: (watts: number) =>
      request<{ success: boolean }>(`/lambda-hp/pv-surplus?watts=${watts}`, { method: 'POST' }),
    modules: () => request<LambdaHPModules>('/lambda-hp/modules'),
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
