import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/**
 * Thermische Leitung — einzeln geführt.
 *
 * data.isReturn = false → Vorlauf (durchgezogen, rot/cyan)
 * data.isReturn = true  → Rücklauf (gestrichelt, blau/orange)
 * data.pipeType = 'cold' → Kälte-Farbschema
 */
export default memo(function ThermalEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props
  const pipeType = (data?.pipeType as string) || 'heat'
  const isReturn = !!(data?.isReturn)

  let color: string
  let dashArray: string | undefined

  if (pipeType === 'cold') {
    color = isReturn ? ENERGY_COLORS.cold_return : ENERGY_COLORS.cold
  } else {
    color = isReturn ? ENERGY_COLORS.heat_return : ENERGY_COLORS.heat
  }
  dashArray = isReturn ? '8 4' : undefined

  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      {/* Transparenter Hit-Bereich */}
      <BaseEdge
        path={path}
        style={{ stroke: 'transparent', strokeWidth: 14 }}
      />
      {/* Leitung */}
      <BaseEdge
        path={path}
        style={{
          stroke: color,
          strokeWidth: selected ? 3.5 : 2.5,
          strokeDasharray: dashArray,
          filter: selected ? `drop-shadow(0 0 4px ${color}80)` : undefined,
        }}
      />
    </>
  )
})
