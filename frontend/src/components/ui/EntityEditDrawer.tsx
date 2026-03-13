import { useState, useEffect } from 'react'
import { Drawer } from './Drawer'
import { useEnergyStore } from '../../store/useEnergyStore'
import { GeneratorForm } from '../forms/GeneratorForm'
import { StorageForm } from '../forms/StorageForm'
import { CircuitForm } from '../forms/CircuitForm'
import { RoomForm } from '../forms/RoomForm'
import { ConsumerForm } from '../forms/ConsumerForm'
import { MeterForm } from '../forms/MeterForm'
import { SourceForm } from '../forms/SourceForm'
import { SensorForm } from '../forms/SensorForm'

type EntityCategory = 'generator' | 'storage' | 'circuit' | 'room' | 'consumer' | 'meter' | 'source' | 'sensor'

const categoryMap: Record<string, EntityCategory> = {
  // Hydraulic schema nodes
  heat_pump: 'generator', boiler: 'generator', chp: 'generator', chiller: 'generator',
  thermal_heat: 'storage', thermal_cold: 'storage',
  circuit: 'circuit', room: 'room', consumer: 'consumer',
  meter: 'meter', sensor: 'sensor',
  solar_thermal: 'source', ground_source: 'source', air_source: 'source', well_source: 'source',
  // Electrical schema nodes
  transformer: 'generator', pv_inverter: 'generator', generator: 'generator',
  motor_load: 'generator', wind_turbine: 'generator',
  battery_system: 'storage',
  wallbox: 'consumer', consumer_load: 'consumer',
  elec_meter: 'meter',
}

const categoryTitles: Record<EntityCategory, string> = {
  generator: 'Erzeuger bearbeiten',
  storage: 'Speicher bearbeiten',
  circuit: 'Heizkreis bearbeiten',
  room: 'Raum bearbeiten',
  consumer: 'Verbraucher bearbeiten',
  meter: 'Zähler bearbeiten',
  source: 'Quelle bearbeiten',
  sensor: 'Sensor bearbeiten',
}

interface Props {
  open: boolean
  nodeType: string
  entityId: string
  onClose: () => void
  onSaved?: (entityId: string, label: string) => void
}

export function EntityEditDrawer({ open, nodeType, entityId, onClose, onSaved }: Props) {
  const store = useEnergyStore()
  const [draft, setDraft] = useState<any>(null)
  const category = categoryMap[nodeType]

  // Clone entity to local draft when drawer opens
  useEffect(() => {
    if (!open || !entityId || !category) { setDraft(null); return }
    let entity: any = null
    switch (category) {
      case 'generator': entity = store.generators.find((e) => e.id === entityId); break
      case 'storage':   entity = store.storages.find((e) => e.id === entityId); break
      case 'circuit':   entity = store.circuits.find((e) => e.id === entityId); break
      case 'room':      entity = store.rooms.find((e) => e.id === entityId); break
      case 'consumer':  entity = store.consumers.find((e) => e.id === entityId); break
      case 'meter':     entity = store.meters.find((e) => e.id === entityId); break
      case 'source':    entity = store.sources.find((e) => e.id === entityId); break
      case 'sensor':    entity = store.sensors.find((e) => e.id === entityId); break
    }
    if (entity) setDraft(JSON.parse(JSON.stringify(entity)))
  }, [open, entityId])

  if (!category || !draft) return null

  const save = () => {
    switch (category) {
      case 'generator': store.updateGenerator(draft.id, draft); break
      case 'storage':   store.updateStorage(draft.id, draft); break
      case 'circuit':   store.updateCircuit(draft.id, draft); break
      case 'room':      store.updateRoom(draft.id, draft); break
      case 'consumer':  store.updateConsumer(draft.id, draft); break
      case 'meter':     store.updateMeter(draft.id, draft); break
      case 'source':    store.updateSource(draft.id, draft); break
      case 'sensor':    store.updateSensor(draft.id, draft); break
    }
    onSaved?.(draft.id, draft.name || '')
    onClose()
  }

  const hasGrid = category === 'generator' ? store.generators.some((g) => g.type === 'grid') : false

  const parentMeterOptions = category === 'meter'
    ? store.meters.filter((m) => m.id !== entityId).map((m) => ({ value: m.id, label: m.name || m.meterNumber }))
    : undefined

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={categoryTitles[category]}
      onSave={save}
      saveDisabled={!draft.name}
    >
      {category === 'generator' && <GeneratorForm entity={draft} onChange={setDraft} hasGrid={hasGrid} />}
      {category === 'storage' && <StorageForm entity={draft} onChange={setDraft} />}
      {category === 'circuit' && <CircuitForm entity={draft} onChange={setDraft} />}
      {category === 'room' && <RoomForm entity={draft} onChange={setDraft} />}
      {category === 'consumer' && <ConsumerForm entity={draft} onChange={setDraft} />}
      {category === 'meter' && <MeterForm entity={draft} onChange={setDraft} parentMeterOptions={parentMeterOptions} />}
      {category === 'source' && <SourceForm entity={draft} onChange={setDraft} />}
      {category === 'sensor' && <SensorForm entity={draft} onChange={setDraft} />}
    </Drawer>
  )
}
