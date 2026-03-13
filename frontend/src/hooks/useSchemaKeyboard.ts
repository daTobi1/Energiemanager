import { useCallback } from 'react'
import type { Node } from '@xyflow/react'

interface KeyboardParams {
  undo: () => void
  redo: () => void
  selectedNodes: Node[]
  handleDeleteNode: (nodeId: string) => void
  rotateNode: (nodeId: string, dir: 'cw' | 'ccw') => void
  copy: () => void
  paste: () => void
}

export function useSchemaKeyboard({
  undo, redo, selectedNodes, handleDeleteNode, rotateNode, copy, paste,
}: KeyboardParams) {
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ignore keyboard shortcuts when editing text
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
      e.preventDefault()
      redo()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undo()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault()
      copy()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault()
      paste()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      selectedNodes.forEach((n) => handleDeleteNode(n.id))
    }
    if (e.key === 'r' || e.key === 'R') {
      if (selectedNodes.length === 1) {
        e.preventDefault()
        rotateNode(selectedNodes[0].id, e.shiftKey ? 'ccw' : 'cw')
      }
    }
  }, [undo, redo, selectedNodes, handleDeleteNode, rotateNode, copy, paste])

  return onKeyDown
}
