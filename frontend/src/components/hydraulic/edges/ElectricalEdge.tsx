import { memo } from 'react'
import { type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import DraggableStepEdge from '../../shared/DraggableStepEdge'

/** Elektrische Leitung: Gelb/Gold, gestrichelt */
export default memo(function ElectricalEdge(props: EdgeProps) {
  return (
    <DraggableStepEdge
      edge={props}
      color={ENERGY_COLORS.electricity}
      strokeWidth={2}
      selectedStrokeWidth={3}
      dashArray="8 4"
      filter="drop-shadow(0 0 4px rgba(234,179,8,0.5))"
    />
  )
})
