import { useEffect, useRef } from 'react'
import { Pencil, Copy, Trash2, RotateCw, RotateCcw, Scissors, ClipboardPaste } from 'lucide-react'

export interface ContextMenuState {
  x: number
  y: number
  type: 'node' | 'edge' | 'pane'
  nodeId?: string
  edgeId?: string
}

interface Props {
  menu: ContextMenuState
  onClose: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onRotateCw?: () => void
  onRotateCcw?: () => void
  onDelete?: () => void
  onDeleteEdge?: () => void
  onPaste?: () => void
  canPaste?: boolean
}

export default function SchemaContextMenu({
  menu, onClose,
  onEdit, onDuplicate, onRotateCw, onRotateCcw, onDelete,
  onDeleteEdge, onPaste, canPaste,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  const Item = ({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick?: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick?.(); onClose() }}
      disabled={!onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left rounded transition-colors
        ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-dark-text hover:bg-dark-hover'}
        disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 1000 }}
      className="bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[160px]"
    >
      {menu.type === 'node' && (
        <>
          <Item icon={Pencil} label="Bearbeiten" onClick={onEdit} />
          <Item icon={Copy} label="Duplizieren" onClick={onDuplicate} />
          <div className="border-t border-dark-border my-1" />
          <Item icon={RotateCw} label="Drehen 90° (R)" onClick={onRotateCw} />
          <Item icon={RotateCcw} label="Drehen -90° (Shift+R)" onClick={onRotateCcw} />
          <div className="border-t border-dark-border my-1" />
          <Item icon={Trash2} label="Entfernen" onClick={onDelete} danger />
        </>
      )}
      {menu.type === 'edge' && (
        <Item icon={Scissors} label="Verbindung löschen" onClick={onDeleteEdge} danger />
      )}
      {menu.type === 'pane' && (
        <Item icon={ClipboardPaste} label="Einfügen" onClick={canPaste ? onPaste : undefined} />
      )}
    </div>
  )
}
