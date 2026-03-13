import { useEffect, useRef, useState } from 'react'

interface Props {
  nodeId: string
  initialLabel: string
  position: { x: number; y: number; width: number; height: number }
  onSave: (nodeId: string, newLabel: string) => void
  onCancel: () => void
}

export default function InlineLabelEditor({ nodeId, initialLabel, position, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== initialLabel) {
      onSave(nodeId, trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
        zIndex: 1000,
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        className="w-full h-full bg-dark-hover border border-emerald-500 rounded px-1.5 text-[11px] text-dark-text outline-none"
        style={{ minWidth: 60 }}
      />
    </div>
  )
}
