/**
 * Calculate evenly distributed handle positions within a zone.
 * Used by all node components to support configurable port counts.
 *
 * @param count Number of handles
 * @param zoneStart Start of zone (percentage, 0-100)
 * @param zoneEnd End of zone (percentage, 0-100)
 * @returns Array of percentage positions
 */
export function handlePositions(count: number, zoneStart = 20, zoneEnd = 80): number[] {
  if (count <= 0) return []
  if (count === 1) return [(zoneStart + zoneEnd) / 2]
  return Array.from({ length: count }, (_, i) =>
    zoneStart + (i / (count - 1)) * (zoneEnd - zoneStart),
  )
}
