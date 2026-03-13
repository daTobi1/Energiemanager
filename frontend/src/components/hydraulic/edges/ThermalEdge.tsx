import { memo } from 'react'
import { type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'
import DraggableStepEdge from '../../shared/DraggableStepEdge'

/**
 * Thermische Leitung — einzeln geführt.
 *
 * data.isReturn = false → Vorlauf (durchgezogen, rot/cyan)
 * data.isReturn = true  → Rücklauf (gestrichelt, blau/orange)
 * data.pipeType = 'cold' → Kälte-Farbschema
 */
export default memo(function ThermalEdge(props: EdgeProps) {
  const { data } = props
  const pipeType = (data?.pipeType as string) || 'heat'
  const isReturn = !!(data?.isReturn)

  let color: string
  if (pipeType === 'cold') {
    color = isReturn ? ENERGY_COLORS.cold_return : ENERGY_COLORS.cold
  } else {
    color = isReturn ? ENERGY_COLORS.heat_return : ENERGY_COLORS.heat
  }

  return (
    <DraggableStepEdge
      edge={props}
      color={color}
      strokeWidth={2.5}
      selectedStrokeWidth={3.5}
      dashArray={isReturn ? '8 4' : undefined}
      filter={`drop-shadow(0 0 4px ${color}80)`}
    />
  )
})
