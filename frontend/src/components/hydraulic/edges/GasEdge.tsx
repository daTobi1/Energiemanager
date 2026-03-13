import { memo } from 'react'
import { type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import DraggableStepEdge from '../../shared/DraggableStepEdge'

/** Gasleitung: Orange, lang-gestrichelt */
export default memo(function GasEdge(props: EdgeProps) {
  return (
    <DraggableStepEdge
      edge={props}
      color={ENERGY_COLORS.gas}
      strokeWidth={2.5}
      selectedStrokeWidth={3}
      dashArray="12 4"
      filter="drop-shadow(0 0 4px rgba(217,119,6,0.5))"
    />
  )
})
