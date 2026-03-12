import { memo, type ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'

/**
 * HOC: Wickelt eine Node-Komponente in einen drehbaren Container.
 * - SVG-Symbol dreht sich (0°, 90°, 180°, 270°)
 * - Text-Labels werden per CSS gegen-gedreht → bleiben lesbar
 * - Handles drehen mit → Verbindungen kommen aus der richtigen Richtung
 */
export function withRotation(NodeComponent: ComponentType<NodeProps>) {
  return memo(function RotatedNode(props: NodeProps) {
    const rotation = (props.data?.rotation as number) || 0

    if (rotation === 0) {
      return <NodeComponent {...props} />
    }

    const rotClass = `hydraulic-rotate-${rotation}`

    return (
      <div
        className={`hydraulic-rotated ${rotClass}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.2s ease',
        }}
      >
        <NodeComponent {...props} />
      </div>
    )
  })
}
