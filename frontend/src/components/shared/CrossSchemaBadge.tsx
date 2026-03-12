import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  entityId: string
  currentSchema: 'hydraulic' | 'electrical'
}

/**
 * Kleines anklickbares Badge das auf Nodes erscheint die in beiden
 * Schemata vorkommen. Klick navigiert zum anderen Schema und
 * zentriert auf den entsprechenden Node.
 */
export default memo(function CrossSchemaBadge({ entityId, currentSchema }: Props) {
  const navigate = useNavigate()

  const targetRoute = currentSchema === 'hydraulic'
    ? '/electrical-schema'
    : '/hydraulic-schema'

  const title = currentSchema === 'hydraulic'
    ? 'Im Stromschema anzeigen'
    : 'Im Hydraulikschema anzeigen'

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(targetRoute, { state: { focusEntityId: entityId } })
  }, [navigate, targetRoute, entityId])

  if (currentSchema === 'hydraulic') {
    // Lightning bolt (Strom) — gelb
    return (
      <button
        onClick={handleClick}
        title={title}
        className="absolute z-10 w-5 h-5 rounded-full bg-dark-card/90 border border-amber-500/60 flex items-center justify-center cursor-pointer hover:scale-110 hover:border-amber-400 transition-transform"
        style={{ top: -6, right: -6 }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M6 1L3 5.5H5L4 9L7 4.5H5L6 1Z" fill="#eab308" />
        </svg>
      </button>
    )
  }

  // Flame (Wärme) — rot
  return (
    <button
      onClick={handleClick}
      title={title}
      className="absolute z-10 w-5 h-5 rounded-full bg-dark-card/90 border border-red-500/60 flex items-center justify-center cursor-pointer hover:scale-110 hover:border-red-400 transition-transform"
      style={{ top: -6, right: -6 }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1Q3.5 3.5 3.5 5C3.5 6.5 4 7.5 5 8.5C6 7.5 6.5 6.5 6.5 5Q6.5 3.5 5 1Z" fill="#dc2626" />
      </svg>
    </button>
  )
})
