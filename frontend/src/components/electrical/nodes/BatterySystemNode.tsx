import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEC_COLORS } from '../constants'
import { handlePositions } from '../../shared/handlePositions'

/** Batteriespeicher-System — Batterie + Wechselrichter */
export default memo(function BatterySystemNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const elecRightCount = (d.portsElecRight as number) || 1
  const elecRightPos = handlePositions(elecRightCount, 25, 65)
  return (
    <div className="relative">
      <svg width="120" height="90" viewBox="0 0 120 90">
        {/* Batterie-Symbol links (IEC) */}
        <line x1="12" y1="22" x2="12" y2="48" stroke={ELEC_COLORS.storage} strokeWidth="3.5" />
        <line x1="22" y1="27" x2="22" y2="43" stroke={ELEC_COLORS.storage} strokeWidth="2" />
        <line x1="30" y1="22" x2="30" y2="48" stroke={ELEC_COLORS.storage} strokeWidth="3.5" />
        <line x1="40" y1="27" x2="40" y2="43" stroke={ELEC_COLORS.storage} strokeWidth="2" />
        {/* + / - */}
        <text x="6" y="18" fill={ELEC_COLORS.storage} fontSize="8" fontWeight="bold">+</text>
        <text x="38" y="18" fill={ELEC_COLORS.storage} fontSize="10" fontWeight="bold">−</text>
        {/* Verbindung */}
        <line x1="40" y1="35" x2="52" y2="35" stroke={ELEC_COLORS.storage} strokeWidth="1.5" />
        {/* WR-Box */}
        <rect x="52" y="14" width="50" height="42" rx="4"
          fill="#1c2333" stroke={selected ? '#22c55e' : ELEC_COLORS.storage} strokeWidth={selected ? 2.5 : 1.5} />
        {/* ⇄ bidirektional */}
        <path d="M60,30 L68,30" stroke="#8b949e" strokeWidth="1" />
        <path d="M66,27 L70,30 L66,33" fill="none" stroke="#8b949e" strokeWidth="1" />
        <path d="M82,37 L74,37" stroke="#8b949e" strokeWidth="1" />
        <path d="M76,34 L72,37 L76,40" fill="none" stroke="#8b949e" strokeWidth="1" />
        {/* DC/AC */}
        <line x1="60" y1="42" x2="66" y2="42" stroke={ELEC_COLORS.storage} strokeWidth="1" />
        <line x1="60" y1="44" x2="66" y2="44" stroke={ELEC_COLORS.storage} strokeWidth="1" />
        <path d="M80,41 Q83,38 86,41 Q89,44 92,41" fill="none" stroke={ELEC_COLORS.phase} strokeWidth="1" />
        {/* kWh */}
        {d.capacityKwh && (
          <text x="77" y="26" textAnchor="middle" fill="#8b949e" fontSize="7">
            {String(d.capacityKwh)} kWh
          </text>
        )}
        <text x="60" y="78" textAnchor="middle" fill="#e6edf3" fontSize="9" fontWeight="600">
          {d.label as string}
        </text>
      </svg>
      {/* AC bidirektional rechts */}
      {elecRightPos.map((pct, i) => (
        <Handle key={`elec-R${i+1}`} type="source" position={Position.Right} id={`elec-R${i+1}`}
          style={{ background: ELEC_COLORS.storage, width: 10, height: 10, border: '2px solid #30363d', right: -2, top: `${pct}%` }} />
      ))}
    </div>
  )
})
