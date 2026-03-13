import { memo } from 'react'
import { type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import DraggableStepEdge from '../../shared/DraggableStepEdge'

/** Quellen-Leitung (Sole/Erdwärme): Grün, gepunktet */
export default memo(function SourceEdge(props: EdgeProps) {
  return (
    <DraggableStepEdge
      edge={props}
      color={ENERGY_COLORS.source}
      strokeWidth={2}
      selectedStrokeWidth={3}
      dashArray="2 4"
      filter="drop-shadow(0 0 4px rgba(22,163,74,0.5))"
    />
  )
})
