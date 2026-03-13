// Gemeinsame Styles für alle Hydraulik-Nodes
import type { CSSProperties } from 'react'

export const baseNodeStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'grab',
}

// Konsistente Handle-Positionen für symmetrische Darstellung
export const HANDLE_STYLE: CSSProperties = {
  width: 10,
  height: 10,
  border: '2px solid #30363d',
  borderRadius: '50%',
}
