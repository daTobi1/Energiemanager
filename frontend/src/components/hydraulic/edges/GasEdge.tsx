import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Gasleitung: Orange, lang-gestrichelt */
export default memo(function GasEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props

  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          stroke: 'transparent',
          strokeWidth: 12,
        }}
      />
      <BaseEdge
        path={path}
        style={{
          stroke: ENERGY_COLORS.gas,
          strokeWidth: selected ? 3 : 2.5,
          strokeDasharray: '12 4',
          filter: selected ? 'drop-shadow(0 0 4px rgba(217,119,6,0.5))' : undefined,
        }}
      />
    </>
  )
})
