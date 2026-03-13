import { useCallback, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { v4 as uuid } from 'uuid'

interface ClipboardEntry {
  type: string
  data: Record<string, unknown>
  relativePosition: { x: number; y: number }
}

interface Params {
  nodes: Node[]
  setNodes: (updater: (nds: Node[]) => Node[]) => void
  pushUndo: () => void
  /** Called after paste to create the store entity. Returns the new node ID prefix. */
  createEntityForPaste: (type: string, data: Record<string, unknown>, position: { x: number; y: number }) => string | null
}

export function useSchemaClipboard({ nodes, setNodes, pushUndo, createEntityForPaste }: Params) {
  const clipboard = useRef<ClipboardEntry[]>([])

  const copy = useCallback((selectedNodes: Node[]) => {
    if (selectedNodes.length === 0) return
    // Calculate center of selection
    const cx = selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length
    const cy = selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length
    clipboard.current = selectedNodes.map((n) => ({
      type: n.type || '',
      data: { ...(n.data as Record<string, unknown>) },
      relativePosition: { x: n.position.x - cx, y: n.position.y - cy },
    }))
  }, [])

  const paste = useCallback((viewportCenter: { x: number; y: number }) => {
    if (clipboard.current.length === 0) return
    pushUndo()
    const newNodes: Node[] = []
    for (const entry of clipboard.current) {
      const pos = {
        x: viewportCenter.x + entry.relativePosition.x,
        y: viewportCenter.y + entry.relativePosition.y,
      }
      const label = (entry.data.label as string || '') + ' (Kopie)'
      const newData = { ...entry.data, label, entityId: undefined }
      const nodeId = createEntityForPaste(entry.type, newData, pos)
      if (nodeId) {
        newNodes.push({
          id: nodeId,
          type: entry.type,
          position: pos,
          data: { ...newData, entityId: nodeId.includes('-') ? nodeId.split('-').slice(1).join('-') : undefined },
        })
      }
    }
    if (newNodes.length > 0) {
      setNodes((nds) => [...nds, ...newNodes])
    }
  }, [pushUndo, setNodes, createEntityForPaste])

  const canPaste = clipboard.current.length > 0

  return { copy, paste, canPaste }
}
