import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Elektrische Leitung: Gelb/Gold, gestrichelt */
export default memo(function ElectricalEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props

  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      {/* Hintergrund für Klickbereich */}
      <BaseEdge
        path={path}
        style={{
          stroke: 'transparent',
          strokeWidth: 12,
        }}
      />
      {/* Leitung */}
      <BaseEdge
        path={path}
        style={{
          stroke: ENERGY_COLORS.electricity,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '8 4',
          filter: selected ? 'drop-shadow(0 0 4px rgba(234,179,8,0.5))' : undefined,
        }}
      />
    </>
  )
})
