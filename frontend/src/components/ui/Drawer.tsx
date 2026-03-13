import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  onSave?: () => void
  saveDisabled?: boolean
  children: React.ReactNode
}

export function Drawer({ open, onClose, title, onSave, saveDisabled, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[640px] max-w-full bg-dark-card border-l border-dark-border flex flex-col animate-slide-in-right">
        <div className="p-4 border-b border-dark-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-dark-text">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>
        {onSave && (
          <div className="p-4 border-t border-dark-border flex gap-3 shrink-0">
            <button onClick={onSave} className="btn-primary" disabled={saveDisabled}>Speichern</button>
            <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
