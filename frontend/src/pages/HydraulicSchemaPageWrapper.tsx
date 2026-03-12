import { ReactFlowProvider } from '@xyflow/react'
import HydraulicSchemaPage from './HydraulicSchemaPage'

/** Wrapper um ReactFlowProvider - nötig weil useReactFlow() nur innerhalb des Providers funktioniert */
export default function HydraulicSchemaPageWrapper() {
  return (
    <ReactFlowProvider>
      <HydraulicSchemaPage />
    </ReactFlowProvider>
  )
}
