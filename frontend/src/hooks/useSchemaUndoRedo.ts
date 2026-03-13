import { useCallback, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface Snapshot {
  nodes: Node[]
  edges: Edge[]
}

export function useSchemaUndoRedo(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
) {
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])

  const pushUndo = useCallback(() => {
    undoStack.current.push({ nodes: [...nodes], edges: [...edges] })
    if (undoStack.current.length > 30) undoStack.current.shift()
    // New action invalidates redo
    redoStack.current = []
  }, [nodes, edges])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    // Save current state to redo stack
    redoStack.current.push({ nodes: [...nodes], edges: [...edges] })
    setNodes(prev.nodes)
    setEdges(prev.edges)
  }, [nodes, edges, setNodes, setEdges])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    // Save current state to undo stack (without clearing redo)
    undoStack.current.push({ nodes: [...nodes], edges: [...edges] })
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [nodes, edges, setNodes, setEdges])

  return {
    pushUndo,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  }
}
