import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Generator, Meter, Consumer, Storage, SystemSettings, Room, HeatingCoolingCircuit, Source, Sensor } from '../types'
import { createDefaultSettings } from '../types'
import { api } from '../api/client'

export interface PendingCreation {
  returnPath: string
  draft: any
  extraState?: Record<string, any>
  assignField: string
  assignMode: 'single' | 'append'
  createdEntityId?: string
}

interface EnergyStore {
  generators: Generator[]
  meters: Meter[]
  consumers: Consumer[]
  storages: Storage[]
  rooms: Room[]
  circuits: HeatingCoolingCircuit[]
  sources: Source[]
  sensors: Sensor[]
  settings: SystemSettings

  /** True wenn das Backend erreichbar ist */
  apiConnected: boolean
  /** True während syncFromApi läuft */
  syncing: boolean

  pendingCreation: PendingCreation | null
  setPendingCreation: (p: PendingCreation) => void
  completePendingCreation: (createdId: string) => void
  clearPendingCreation: () => void

  addGenerator: (g: Generator) => void
  updateGenerator: (id: string, g: Generator) => void
  removeGenerator: (id: string) => void

  addMeter: (m: Meter) => void
  updateMeter: (id: string, m: Meter) => void
  removeMeter: (id: string) => void

  addConsumer: (c: Consumer) => void
  updateConsumer: (id: string, c: Consumer) => void
  removeConsumer: (id: string) => void

  addStorage: (s: Storage) => void
  updateStorage: (id: string, s: Storage) => void
  removeStorage: (id: string) => void

  addRoom: (r: Room) => void
  updateRoom: (id: string, r: Room) => void
  removeRoom: (id: string) => void

  addCircuit: (c: HeatingCoolingCircuit) => void
  updateCircuit: (id: string, c: HeatingCoolingCircuit) => void
  removeCircuit: (id: string) => void

  addSource: (s: Source) => void
  updateSource: (id: string, s: Source) => void
  removeSource: (id: string) => void

  addSensor: (s: Sensor) => void
  updateSensor: (id: string, s: Sensor) => void
  removeSensor: (id: string) => void

  updateSettings: (s: Partial<SystemSettings>) => void

  loadSeedData: (data: {
    generators: Generator[]
    meters: Meter[]
    consumers: Consumer[]
    storages: Storage[]
    rooms: Room[]
    circuits: HeatingCoolingCircuit[]
    sources?: Source[]
    sensors?: Sensor[]
    settings: SystemSettings
  }) => void
  clearAll: () => void

  /** Daten vom Backend laden (API ist Source of Truth wenn verfügbar) */
  syncFromApi: () => Promise<void>
}

/** Fire-and-forget API call — Fehler werden nur geloggt, nie geworfen */
function fire(promise: Promise<unknown>) {
  promise.catch((err) => console.warn('[API sync]', err.message))
}

export const useEnergyStore = create<EnergyStore>()(
  persist(
    (set, get) => ({
      generators: [],
      meters: [],
      consumers: [],
      storages: [],
      rooms: [],
      circuits: [],
      sources: [],
      sensors: [],
      settings: createDefaultSettings(),

      apiConnected: false,
      syncing: false,

      pendingCreation: null,
      setPendingCreation: (p) => set(() => ({ pendingCreation: p })),
      completePendingCreation: (createdId) =>
        set((s) => ({
          pendingCreation: s.pendingCreation
            ? { ...s.pendingCreation, createdEntityId: createdId }
            : null,
        })),
      clearPendingCreation: () => set(() => ({ pendingCreation: null })),

      // --- Generators ---
      addGenerator: (g) => {
        set((s) => ({ generators: [...s.generators, g] }))
        if (get().apiConnected) fire(api.generators.create(g))
      },
      updateGenerator: (id, g) => {
        set((s) => ({ generators: s.generators.map((gen) => (gen.id === id ? g : gen)) }))
        if (get().apiConnected) fire(api.generators.update(id, g))
      },
      removeGenerator: (id) => {
        set((s) => ({ generators: s.generators.filter((g) => g.id !== id) }))
        if (get().apiConnected) fire(api.generators.remove(id))
      },

      // --- Meters ---
      addMeter: (m) => {
        set((s) => ({ meters: [...s.meters, m] }))
        if (get().apiConnected) fire(api.meters.create(m))
      },
      updateMeter: (id, m) => {
        set((s) => ({ meters: s.meters.map((meter) => (meter.id === id ? m : meter)) }))
        if (get().apiConnected) fire(api.meters.update(id, m))
      },
      removeMeter: (id) => {
        set((s) => ({ meters: s.meters.filter((m) => m.id !== id) }))
        if (get().apiConnected) fire(api.meters.remove(id))
      },

      // --- Consumers ---
      addConsumer: (c) => {
        set((s) => ({ consumers: [...s.consumers, c] }))
        if (get().apiConnected) fire(api.consumers.create(c))
      },
      updateConsumer: (id, c) => {
        set((s) => ({ consumers: s.consumers.map((con) => (con.id === id ? c : con)) }))
        if (get().apiConnected) fire(api.consumers.update(id, c))
      },
      removeConsumer: (id) => {
        set((s) => ({ consumers: s.consumers.filter((c) => c.id !== id) }))
        if (get().apiConnected) fire(api.consumers.remove(id))
      },

      // --- Storages ---
      addStorage: (s_) => {
        set((s) => ({ storages: [...s.storages, s_] }))
        if (get().apiConnected) fire(api.storages.create(s_))
      },
      updateStorage: (id, s_) => {
        set((s) => ({ storages: s.storages.map((st) => (st.id === id ? s_ : st)) }))
        if (get().apiConnected) fire(api.storages.update(id, s_))
      },
      removeStorage: (id) => {
        set((s) => ({ storages: s.storages.filter((st) => st.id !== id) }))
        if (get().apiConnected) fire(api.storages.remove(id))
      },

      // --- Rooms ---
      addRoom: (r) => {
        set((s) => ({ rooms: [...s.rooms, r] }))
        if (get().apiConnected) fire(api.rooms.create(r))
      },
      updateRoom: (id, r) => {
        set((s) => ({ rooms: s.rooms.map((room) => (room.id === id ? r : room)) }))
        if (get().apiConnected) fire(api.rooms.update(id, r))
      },
      removeRoom: (id) => {
        set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) }))
        if (get().apiConnected) fire(api.rooms.remove(id))
      },

      // --- Circuits ---
      addCircuit: (c) => {
        set((s) => ({ circuits: [...s.circuits, c] }))
        if (get().apiConnected) fire(api.circuits.create(c))
      },
      updateCircuit: (id, c) => {
        set((s) => ({ circuits: s.circuits.map((ci) => (ci.id === id ? c : ci)) }))
        if (get().apiConnected) fire(api.circuits.update(id, c))
      },
      removeCircuit: (id) => {
        set((s) => ({ circuits: s.circuits.filter((c) => c.id !== id) }))
        if (get().apiConnected) fire(api.circuits.remove(id))
      },

      // --- Sources ---
      addSource: (s_) => {
        set((s) => ({ sources: [...s.sources, s_] }))
        if (get().apiConnected) fire(api.sources.create(s_))
      },
      updateSource: (id, s_) => {
        set((s) => ({ sources: s.sources.map((src) => (src.id === id ? s_ : src)) }))
        if (get().apiConnected) fire(api.sources.update(id, s_))
      },
      removeSource: (id) => {
        set((s) => ({ sources: s.sources.filter((src) => src.id !== id) }))
        if (get().apiConnected) fire(api.sources.remove(id))
      },

      // --- Sensors ---
      addSensor: (s_) => {
        set((s) => ({ sensors: [...s.sensors, s_] }))
        if (get().apiConnected) fire(api.sensors.create(s_))
      },
      updateSensor: (id, s_) => {
        set((s) => ({ sensors: s.sensors.map((sen) => (sen.id === id ? s_ : sen)) }))
        if (get().apiConnected) fire(api.sensors.update(id, s_))
      },
      removeSensor: (id) => {
        set((s) => ({ sensors: s.sensors.filter((sen) => sen.id !== id) }))
        if (get().apiConnected) fire(api.sensors.remove(id))
      },

      // --- Settings ---
      updateSettings: (partial) => {
        const merged = { ...get().settings, ...partial }
        set(() => ({ settings: merged }))
        if (get().apiConnected) fire(api.settings.update(merged))
      },

      // --- Bulk Operations ---
      loadSeedData: (data) => {
        set(() => ({
          generators: data.generators,
          meters: data.meters,
          consumers: data.consumers,
          storages: data.storages,
          rooms: data.rooms,
          circuits: data.circuits,
          sources: data.sources || [],
          sensors: data.sensors || [],
          settings: data.settings,
        }))
        if (get().apiConnected) fire(api.data.seed(data))
      },

      clearAll: () => {
        set(() => ({
          generators: [],
          meters: [],
          consumers: [],
          storages: [],
          rooms: [],
          circuits: [],
          sources: [],
          sensors: [],
          settings: createDefaultSettings(),
        }))
        if (get().apiConnected) fire(api.data.clearAll())
      },

      // --- API Sync ---
      syncFromApi: async () => {
        set({ syncing: true })
        try {
          const [generators, meters, consumers, storages, rooms, circuits, settings] =
            await Promise.all([
              api.generators.list(),
              api.meters.list(),
              api.consumers.list(),
              api.storages.list(),
              api.rooms.list(),
              api.circuits.list(),
              api.settings.get(),
            ])

          set({
            generators: generators || [],
            meters: meters || [],
            consumers: consumers || [],
            storages: storages || [],
            rooms: rooms || [],
            circuits: circuits || [],
            settings: settings || get().settings,
            apiConnected: true,
            syncing: false,
          })
          console.info('[API] Sync erfolgreich — Backend ist Source of Truth')
        } catch {
          set({ apiConnected: false, syncing: false })
          console.info('[API] Backend nicht erreichbar — localStorage-Modus')
        }
      },
    }),
    {
      name: 'energy-manager-store',
      // pendingCreation, apiConnected und syncing nicht persistieren
      partialize: (state) => ({
        generators: state.generators,
        meters: state.meters,
        consumers: state.consumers,
        storages: state.storages,
        rooms: state.rooms,
        circuits: state.circuits,
        sources: state.sources,
        sensors: state.sensors,
        settings: state.settings,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        // Sicherstellen, dass neue Felder mit Defaults belegt sind,
        // falls ältere localStorage-Daten geladen werden
        sources: (persisted as any)?.sources ?? (current as any).sources ?? [],
        sensors: (persisted as any)?.sensors ?? (current as any).sensors ?? [],
      }),
    },
  ),
)
