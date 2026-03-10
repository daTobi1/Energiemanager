import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Generator, Meter, Consumer, Storage, SystemSettings, Room, HeatingCoolingCircuit } from '../types'
import { createDefaultSettings } from '../types'

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
  settings: SystemSettings

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

  updateSettings: (s: Partial<SystemSettings>) => void

  loadSeedData: (data: {
    generators: Generator[]
    meters: Meter[]
    consumers: Consumer[]
    storages: Storage[]
    rooms: Room[]
    circuits: HeatingCoolingCircuit[]
    settings: SystemSettings
  }) => void
  clearAll: () => void
}

export const useEnergyStore = create<EnergyStore>()(
  persist(
    (set) => ({
      generators: [],
      meters: [],
      consumers: [],
      storages: [],
      rooms: [],
      circuits: [],
      settings: createDefaultSettings(),

      pendingCreation: null,
      setPendingCreation: (p) => set(() => ({ pendingCreation: p })),
      completePendingCreation: (createdId) =>
        set((s) => ({
          pendingCreation: s.pendingCreation
            ? { ...s.pendingCreation, createdEntityId: createdId }
            : null,
        })),
      clearPendingCreation: () => set(() => ({ pendingCreation: null })),

      addGenerator: (g) =>
        set((s) => ({ generators: [...s.generators, g] })),
      updateGenerator: (id, g) =>
        set((s) => ({ generators: s.generators.map((gen) => (gen.id === id ? g : gen)) })),
      removeGenerator: (id) =>
        set((s) => ({ generators: s.generators.filter((g) => g.id !== id) })),

      addMeter: (m) =>
        set((s) => ({ meters: [...s.meters, m] })),
      updateMeter: (id, m) =>
        set((s) => ({ meters: s.meters.map((meter) => (meter.id === id ? m : meter)) })),
      removeMeter: (id) =>
        set((s) => ({ meters: s.meters.filter((m) => m.id !== id) })),

      addConsumer: (c) =>
        set((s) => ({ consumers: [...s.consumers, c] })),
      updateConsumer: (id, c) =>
        set((s) => ({ consumers: s.consumers.map((con) => (con.id === id ? c : con)) })),
      removeConsumer: (id) =>
        set((s) => ({ consumers: s.consumers.filter((c) => c.id !== id) })),

      addStorage: (s_) =>
        set((s) => ({ storages: [...s.storages, s_] })),
      updateStorage: (id, s_) =>
        set((s) => ({ storages: s.storages.map((st) => (st.id === id ? s_ : st)) })),
      removeStorage: (id) =>
        set((s) => ({ storages: s.storages.filter((st) => st.id !== id) })),

      addRoom: (r) =>
        set((s) => ({ rooms: [...s.rooms, r] })),
      updateRoom: (id, r) =>
        set((s) => ({ rooms: s.rooms.map((room) => (room.id === id ? r : room)) })),
      removeRoom: (id) =>
        set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),

      addCircuit: (c) =>
        set((s) => ({ circuits: [...s.circuits, c] })),
      updateCircuit: (id, c) =>
        set((s) => ({ circuits: s.circuits.map((ci) => (ci.id === id ? c : ci)) })),
      removeCircuit: (id) =>
        set((s) => ({ circuits: s.circuits.filter((c) => c.id !== id) })),

      updateSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),

      loadSeedData: (data) =>
        set(() => ({
          generators: data.generators,
          meters: data.meters,
          consumers: data.consumers,
          storages: data.storages,
          rooms: data.rooms,
          circuits: data.circuits,
          settings: data.settings,
        })),
      clearAll: () =>
        set(() => ({
          generators: [],
          meters: [],
          consumers: [],
          storages: [],
          rooms: [],
          circuits: [],
          settings: createDefaultSettings(),
        })),
    }),
    { name: 'energy-manager-store' },
  ),
)
