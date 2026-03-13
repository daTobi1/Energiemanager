import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** PV-Wechselrichter — IEC: Rechteck mit =/~ + Solarzellen-Symbol */
export default memo(function PVInverterNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const elecRightCount = (d.portsElecRight as number) || 1
  const elecRightPos = handlePositions(elecRightCount, 25, 65)
  return (
    <div className="relative">
      <svg width="120" height="90" viewBox="0 0 120 90">
        {/* PV-Modul links */}
        <rect x="5" y="15" width="35" height="40" rx="2"
          fill="#1c2333" stroke="#f59e0b" strokeWidth="1.2" />
        <line x1="18" y1="15" x2="14" y2="55" stroke="#f59e0b" strokeWidth="0.6" opacity="0.5" />
        <line x1="30" y1="15" x2="26" y2="55" stroke="#f59e0b" strokeWidth="0.6" opacity="0.5" />
        <line x1="5" y1="35" x2="40" y2="35" stroke="#f59e0b" strokeWidth="0.6" opacity="0.5" />
        {/* Verbindung PV → WR */}
        <line x1="40" y1="35" x2="50" y2="35" stroke="#f59e0b" strokeWidth="1.5" />
        {/* Wechselrichter-Box */}
        <rect x="50" y="12" width="55" height="46" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.generation} strokeWidth={selected ? 2.5 : 1.5} />
        {/* DC-Seite (=) */}
        <line x1="58" y1="30" x2="66" y2="30" stroke="#f59e0b" strokeWidth="1.5" />
        <line x1="58" y1="33" x2="66" y2="33" stroke="#f59e0b" strokeWidth="1.5" />
        {/* Pfeil */}
        <path d="M70,31 L78,31" stroke="#8b949e" strokeWidth="1" />
        <path d="M76,28 L80,31 L76,34" fill="none" stroke="#8b949e" strokeWidth="1" />
        {/* AC-Seite (~) */}
        <path d="M84,28 Q87,24 90,28 Q93,32 96,28" fill="none" stroke={ELEC_COLORS.phase} strokeWidth="1.5" />
        {/* kWp */}
        {d.peakPowerKwp && (
          <text x="77" y="50" textAnchor="middle" fill="#8b949e" fontSize="7">
            {String(d.peakPowerKwp)} kWp
          </text>
        )}
        <text x="60" y="78" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* AC rechts */}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i+1}`} type="source" position={Position.Right} id={`elec-R${i+1}`}
          style={{ background: ELEC_COLORS.generation, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
