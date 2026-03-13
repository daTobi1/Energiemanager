import { ReactFlowProvider } from '@xyflow/react'
import ElectricalSchemaPage from './ElectricalSchemaPage'

/** Wrapper um ReactFlowProvider - nötig weil useReactFlow() nur innerhalb des Providers funktioniert */
export default function ElectricalSchemaPageWrapper() {
  return (
    <ReactFlowProvider>
      <ElectricalSchemaPage />
    </ReactFlowProvider>
  )
}
