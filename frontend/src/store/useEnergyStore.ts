import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Generator, Meter, Consumer, Storage, SystemSettings } from '../types'
import { createDefaultSettings } from '../types'

interface EnergyStore {
  generators: Generator[]
  meters: Meter[]
  consumers: Consumer[]
  storages: Storage[]
  settings: SystemSettings

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

  updateSettings: (s: Partial<SystemSettings>) => void

  loadSeedData: (data: {
    generators: Generator[]
    meters: Meter[]
    consumers: Consumer[]
    storages: Storage[]
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
      settings: createDefaultSettings(),

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

      updateSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),

      loadSeedData: (data) =>
        set(() => ({
          generators: data.generators,
          meters: data.meters,
          consumers: data.consumers,
          storages: data.storages,
          settings: data.settings,
        })),
      clearAll: () =>
        set(() => ({
          generators: [],
          meters: [],
          consumers: [],
          storages: [],
          settings: createDefaultSettings(),
        })),
    }),
    { name: 'energy-manager-store' },
  ),
)
