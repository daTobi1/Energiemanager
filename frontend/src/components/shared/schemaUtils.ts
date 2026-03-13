import type { Node } from '@xyflow/react'

/** Derive next available name: "Kessel", "Kessel 2", "Kessel 3", ... */
export function nextName(baseName: string, nodes: Node[]): string {
  const existing = new Set(nodes.map((n) => (n.data as Record<string, unknown>).label as string))
  if (!existing.has(baseName)) return baseName
  let i = 2
  while (existing.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}
