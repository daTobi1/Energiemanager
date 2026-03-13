import { memo } from 'react'
import { type EdgeProps } from '@xyflow/react'
import { ELEC_COLORS } from './constants'
import DraggableStepEdge from '../shared/DraggableStepEdge'

/** Elektrische Leitung: Gelb/Gold, gestrichelt */
const ElecEdge = memo(function ElecEdge(props: EdgeProps) {
  return (
    <DraggableStepEdge
      edge={props}
      color={ELEC_COLORS.phase}
      strokeWidth={2}
      selectedStrokeWidth={3}
      dashArray="8 4"
      filter="drop-shadow(0 0 4px rgba(234,179,8,0.5))"
    />
  )
})

export const elecEdgeTypes = {
  electrical: ElecEdge,
} as const
