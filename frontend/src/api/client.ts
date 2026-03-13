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
