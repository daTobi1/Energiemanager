import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { ENERGY_COLORS } from '../constants'

/** Quellen-Leitung (Sole/Erdwärme): Grün, gepunktet */
export default memo(function SourceEdge(props: EdgeProps) {
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
          stroke: ENERGY_COLORS.source,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '2 4',
          filter: selected ? 'drop-shadow(0 0 4px rgba(22,163,74,0.5))' : undefined,
        }}
      />
    </>
  )
})
