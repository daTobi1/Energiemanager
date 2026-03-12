import { withRotation } from '../hydraulic/withRotation'

import TransformerNode from './nodes/TransformerNode'
import PVInverterNode from './nodes/PVInverterNode'
import BatterySystemNode from './nodes/BatterySystemNode'
import GeneratorNode from './nodes/GeneratorNode'
import MotorLoadNode from './nodes/MotorLoadNode'
import WallboxNode from './nodes/WallboxNode'
import ConsumerLoadNode from './nodes/ConsumerLoadNode'
import CircuitBreakerNode from './nodes/CircuitBreakerNode'
import ElecMeterNode from './nodes/ElecMeterNode'
import ElecBusNode from './nodes/ElecBusNode'
import SubDistributionNode from './nodes/SubDistributionNode'

export const elecNodeTypes = {
  transformer: withRotation(TransformerNode),
  pv_inverter: withRotation(PVInverterNode),
  battery_system: withRotation(BatterySystemNode),
  generator: withRotation(GeneratorNode),
  motor_load: withRotation(MotorLoadNode),
  wallbox: withRotation(WallboxNode),
  consumer_load: withRotation(ConsumerLoadNode),
  circuit_breaker: withRotation(CircuitBreakerNode),
  elec_meter: withRotation(ElecMeterNode),
  elec_bus: withRotation(ElecBusNode),
  sub_distribution: withRotation(SubDistributionNode),
} as const
