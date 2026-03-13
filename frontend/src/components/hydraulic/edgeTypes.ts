import ThermalEdge from './edges/ThermalEdge'
import ElectricalEdge from './edges/ElectricalEdge'
import GasEdge from './edges/GasEdge'
import SourceEdge from './edges/SourceEdge'

export const edgeTypes = {
  thermal: ThermalEdge,
  electrical: ElectricalEdge,
  gas: GasEdge,
  source: SourceEdge,
} as const
