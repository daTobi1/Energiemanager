import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { ELEC_COLORS } from './constants'

/** Elektrische Leitung: Gelb/Gold, gestrichelt */
const ElecEdge = memo(function ElecEdge(props: EdgeProps) {
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
        style={{ stroke: 'transparent', strokeWidth: 12 }}
      />
      <BaseEdge
        path={path}
        style={{
          stroke: ELEC_COLORS.phase,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '8 4',
          filter: selected ? 'drop-shadow(0 0 4px rgba(234,179,8,0.5))' : undefined,
        }}
      />
    </>
  )
})

export const elecEdgeTypes = {
  electrical: ElecEdge,
} as const
