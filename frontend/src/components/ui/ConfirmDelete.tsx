import { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface ConfirmDeleteProps {
  onConfirm: () => void
  itemName?: string
}

export function ConfirmDelete({ onConfirm, itemName }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={() => { onConfirm(); setConfirming(false) }}
          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Löschen
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 text-xs rounded bg-dark-hover text-dark-faded hover:text-dark-muted transition-colors"
        >
          Nein
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-500/10"
      title={itemName ? `${itemName} löschen` : 'Löschen'}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
