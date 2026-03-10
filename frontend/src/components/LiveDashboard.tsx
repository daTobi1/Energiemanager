import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api/client'
import {
  Play, Square, Sun, Zap, Battery, Thermometer,
  ArrowDownToLine, ArrowUpFromLine, Gauge, Flame, Wind,
} from 'lucide-react'

interface LiveData {
  pv_power_kw: number
  grid_power_kw: number
  load_power_kw: number
  battery_power_kw: number
  battery_soc_pct: number
  heat_pump_power_kw: number
  heat_pump_heat_kw: number
  boiler_heat_kw: number
  outdoor_temp_c: number
  heat_storage_temp_c: number
  self_sufficiency_pct: number
  import_kwh: number
  export_kwh: number
}

function MetricCard({ icon: Icon, label, value, unit, color, subValue }: {
  icon: typeof Sun
  label: string
  value: string
  unit: string
  color: string
  subValue?: string
}) {
  return (
    <div className="bg-dark-hover rounded-lg p-3 border border-dark-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-dark-faded">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        <span className="text-xs text-dark-faded">{unit}</span>
      </div>
      {subValue && <p className="text-xs text-dark-faded mt-0.5">{subValue}</p>}
    </div>
  )
}

export default function LiveDashboard() {
  const [simRunning, setSimRunning] = useState(false)
  const [data, setData] = useState<LiveData | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const status = await api.simulator.status()
      setSimRunning(status.running)
      if (status.running && status.state) {
        // Setze initiale Werte aus dem Status
        setData((prev) => prev ?? {
          pv_power_kw: 0, grid_power_kw: 0, load_power_kw: 0,
          battery_power_kw: 0, battery_soc_pct: status.state.battery_soc_pct,
          heat_pump_power_kw: 0, heat_pump_heat_kw: 0, boiler_heat_kw: 0,
          outdoor_temp_c: status.state.outdoor_temp_c,
          heat_storage_temp_c: status.state.heat_storage_temp_c,
          self_sufficiency_pct: 0,
          import_kwh: status.state.total_import_kwh,
          export_kwh: status.state.total_export_kwh,
        })
      }
    } catch {
      // Backend nicht erreichbar
    }
  }, [])

  // WebSocket-Verbindung
  useEffect(() => {
    const wsBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
      .replace('http://', 'ws://')
      .replace('https://', 'wss://')

    function connect() {
      const ws = new WebSocket(`${wsBase}/ws/live`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        checkStatus()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'measurements' && msg.data) {
            setData(msg.data)
            setSimRunning(true)
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect nach 3s
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [checkStatus])

  // Fallback-Polling wenn kein WebSocket
  useEffect(() => {
    if (!connected && simRunning) {
      pollRef.current = setInterval(async () => {
        try {
          const latest = await api.simulator.latest()
          if (Object.keys(latest).length > 0) {
            setData({
              pv_power_kw: latest['pv.power_kw']?.value ?? 0,
              grid_power_kw: latest['grid.power_kw']?.value ?? 0,
              load_power_kw: latest['load.power_kw']?.value ?? 0,
              battery_power_kw: latest['battery.power_kw']?.value ?? 0,
              battery_soc_pct: latest['battery.soc_pct']?.value ?? 0,
              heat_pump_power_kw: latest['heat_pump.power_kw']?.value ?? 0,
              heat_pump_heat_kw: latest['heat_pump.heat_kw']?.value ?? 0,
              boiler_heat_kw: latest['boiler.heat_kw']?.value ?? 0,
              outdoor_temp_c: latest['outdoor.temperature_c']?.value ?? 0,
              heat_storage_temp_c: latest['heat_storage.temperature_c']?.value ?? 0,
              self_sufficiency_pct: latest['system.self_sufficiency_pct']?.value ?? 0,
              import_kwh: latest['grid.import_kwh']?.value ?? 0,
              export_kwh: latest['grid.export_kwh']?.value ?? 0,
            })
          }
        } catch { /* ignore */ }
      }, 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [connected, simRunning])

  // Initial-Check
  useEffect(() => { checkStatus() }, [checkStatus])

  const toggleSimulator = async () => {
    try {
      if (simRunning) {
        await api.simulator.stop()
        setSimRunning(false)
      } else {
        await api.simulator.start(5, 1)
        setSimRunning(true)
      }
    } catch {
      // Backend nicht erreichbar
    }
  }

  const gridImporting = (data?.grid_power_kw ?? 0) > 0
  const batteryCharging = (data?.battery_power_kw ?? 0) > 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Live-Daten</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-dark-faded'}`} />
            <span className="text-xs text-dark-faded">{connected ? 'WebSocket' : 'Offline'}</span>
          </span>
          <button onClick={toggleSimulator} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            simRunning
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          }`}>
            {simRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {simRunning ? 'Stoppen' : 'Simulator starten'}
          </button>
        </div>
      </div>

      {!simRunning && !data ? (
        <div className="text-center py-8 text-dark-faded">
          <Gauge className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Simulator starten um Live-Daten zu sehen</p>
          <p className="text-xs mt-1">Erzeugt realistische Messwerte basierend auf der Anlagenkonfiguration</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Sun} label="PV-Erzeugung" color="text-amber-400"
            value={data?.pv_power_kw.toFixed(1) ?? '—'} unit="kW"
          />
          <MetricCard
            icon={gridImporting ? ArrowDownToLine : ArrowUpFromLine}
            label={gridImporting ? 'Netzbezug' : 'Einspeisung'}
            color={gridImporting ? 'text-red-400' : 'text-emerald-400'}
            value={Math.abs(data?.grid_power_kw ?? 0).toFixed(1)} unit="kW"
          />
          <MetricCard
            icon={Zap} label="Verbrauch" color="text-blue-400"
            value={data?.load_power_kw.toFixed(1) ?? '—'} unit="kW"
          />
          <MetricCard
            icon={Battery}
            label={batteryCharging ? 'Batterie (Laden)' : 'Batterie (Entladen)'}
            color="text-purple-400"
            value={Math.abs(data?.battery_power_kw ?? 0).toFixed(1)} unit="kW"
            subValue={`SoC: ${data?.battery_soc_pct.toFixed(0) ?? '—'}%`}
          />
          <MetricCard
            icon={Zap} label="Wärmepumpe" color="text-cyan-400"
            value={data?.heat_pump_power_kw.toFixed(1) ?? '—'} unit="kW"
            subValue={`${data?.heat_pump_heat_kw.toFixed(1) ?? '—'} kW th.`}
          />
          <MetricCard
            icon={Flame} label="Gaskessel" color="text-orange-400"
            value={data?.boiler_heat_kw.toFixed(1) ?? '—'} unit="kW th."
          />
          <MetricCard
            icon={Wind} label="Außentemperatur" color="text-sky-400"
            value={data?.outdoor_temp_c.toFixed(1) ?? '—'} unit="°C"
            subValue={`Puffer: ${data?.heat_storage_temp_c.toFixed(0) ?? '—'}°C`}
          />
          <MetricCard
            icon={Thermometer} label="Autarkie" color="text-emerald-400"
            value={data?.self_sufficiency_pct.toFixed(0) ?? '—'} unit="%"
            subValue={`↓${data?.import_kwh.toFixed(1) ?? '0'} ↑${data?.export_kwh.toFixed(1) ?? '0'} kWh`}
          />
        </div>
      )}
    </div>
  )
}
