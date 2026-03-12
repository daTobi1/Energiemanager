import { withRotation } from './withRotation'

import BoilerNode from './nodes/BoilerNode'
import HeatPumpNode from './nodes/HeatPumpNode'
import CHPNode from './nodes/CHPNode'
import ChillerNode from './nodes/ChillerNode'
import ThermalStorageNode from './nodes/ThermalStorageNode'
import PumpNode from './nodes/PumpNode'
import MixerValveNode from './nodes/MixerValveNode'
import HydraulicSeparatorNode from './nodes/HydraulicSeparatorNode'
import CircuitNode from './nodes/CircuitNode'
import ConsumerNode from './nodes/ConsumerNode'
import MeterNode from './nodes/MeterNode'
import RoomNode from './nodes/RoomNode'

export const nodeTypes = {
  boiler: withRotation(BoilerNode),
  heat_pump: withRotation(HeatPumpNode),
  chp: withRotation(CHPNode),
  chiller: withRotation(ChillerNode),
  thermal_heat: withRotation(ThermalStorageNode),
  thermal_cold: withRotation(ThermalStorageNode),
  pump: withRotation(PumpNode),
  mixer: withRotation(MixerValveNode),
  hydraulic_separator: withRotation(HydraulicSeparatorNode),
  circuit: withRotation(CircuitNode),
  consumer: withRotation(ConsumerNode),
  meter: withRotation(MeterNode),
  room: withRotation(RoomNode),
} as const
