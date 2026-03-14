import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, AlertTriangle, Info, XCircle, Check, RefreshCw, Shield, Play, Square } from 'lucide-react'
import { api } from '../api/client'
import { useEnergyStore } from '../store/useEnergyStore'
import type { AlarmEvent, AlarmDefinition } from '../types'

const severityConfig = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle, label: 'Kritisch' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, label: 'Warnung' },
  info: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: Info, label: 'Info' },
}

export default function AlarmsPage() {
  const apiConnected = useEnergyStore((s) => s.apiConnected)
  const [activeAlarms, setActiveAlarms] = useState<AlarmEvent[]>([])
  const [history, setHistory] = useState<AlarmEvent[]>([])
  const [systemRules, setSystemRules] = useState<AlarmDefinition[]>([])
  const [alarmStatus, setAlarmStatus] = useState<{ running: boolean; eval_interval_s: number; system_alarms: number } | null>(null)
  const [tab, setTab] = useState<'active' | 'history' | 'rules'>('active')

  const fetchData = useCallback(async () => {
    if (!apiConnected) return
    try {
      const [active, hist, rules, status] = await Promise.all([
        api.alarms.active(),
        api.alarms.events(200),
        api.alarms.systemRules(),
        api.alarms.status(),
      ])
      setActiveAlarms(active)
      setHistory(hist)
      setSystemRules(rules)
      setAlarmStatus(status)
    } catch { /* ignore */ }
  }, [apiConnected])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh alle 10s
  useEffect(() => {
    if (!apiConnected) return
    const iv = setInterval(fetchData, 10_000)
    return () => clearInterval(iv)
  }, [apiConnected, fetchData])

  const handleAcknowledge = async (id: number) => {
    await api.alarms.acknowledge(id)
    fetchData()
  }

  const handleClear = async (id: number) => {
    await api.alarms.clear(id)
    fetchData()
  }

  const handleStartStop = async () => {
    if (alarmStatus?.running) {
      await api.alarms.stop()
    } else {
      await api.alarms.start()
    }
    fetchData()
  }

  const handleEvaluate = async () => {
    await api.alarms.evaluate()
    fetchData()
  }

  const criticalCount = activeAlarms.filter(a => a.severity === 'critical').length
  const warningCount = activeAlarms.filter(a => a.severity === 'warning').length
  const infoCount = activeAlarms.filter(a => a.severity === 'info').length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
            <Bell className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Alarme & Benachrichtigungen</h1>
            <p className="text-sm text-dark-faded">
              {alarmStatus?.running ? 'Alarm-Ueberwachung aktiv' : 'Alarm-Ueberwachung gestoppt'}
              {alarmStatus?.running && ` (alle ${alarmStatus.eval_interval_s}s)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleEvaluate} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-sm text-dark-faded hover:text-dark-text">
            <RefreshCw className="w-4 h-4" /> Jetzt pruefen
          </button>
          <button onClick={handleStartStop} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            alarmStatus?.running ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
          }`}>
            {alarmStatus?.running ? <><Square className="w-4 h-4" /> Stoppen</> : <><Play className="w-4 h-4" /> Starten</>}
          </button>
        </div>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-dark-faded" />
            <span className="text-sm text-dark-faded">Aktive Alarme</span>
          </div>
          <p className="text-2xl font-bold text-dark-text">{activeAlarms.length}</p>
        </div>
        <div className={`rounded-lg border p-4 ${criticalCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-dark-card border-dark-border'}`}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-dark-faded">Kritisch</span>
          </div>
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-400' : 'text-dark-text'}`}>{criticalCount}</p>
        </div>
        <div className={`rounded-lg border p-4 ${warningCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-dark-card border-dark-border'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-dark-faded">Warnungen</span>
          </div>
          <p className={`text-2xl font-bold ${warningCount > 0 ? 'text-amber-400' : 'text-dark-text'}`}>{warningCount}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-dark-faded">Info</span>
          </div>
          <p className="text-2xl font-bold text-dark-text">{infoCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-card rounded-lg p-1 border border-dark-border">
        {([
          { key: 'active', label: 'Aktive Alarme', count: activeAlarms.length },
          { key: 'history', label: 'Historie', count: history.length },
          { key: 'rules', label: 'Alarm-Regeln', count: systemRules.length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-emerald-600 text-white' : 'text-dark-faded hover:text-dark-text'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeAlarms.length === 0 ? (
            <div className="bg-dark-card rounded-lg border border-dark-border p-8 text-center">
              <BellOff className="w-12 h-12 text-dark-faded mx-auto mb-3" />
              <p className="text-dark-faded">Keine aktiven Alarme</p>
            </div>
          ) : (
            activeAlarms.map(event => {
              const cfg = severityConfig[event.severity] || severityConfig.info
              const Icon = cfg.icon
              return (
                <div key={event.id} className={`${cfg.bg} rounded-lg border ${cfg.border} p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${cfg.color}`} />
                      <div>
                        <p className={`font-medium ${cfg.color}`}>{event.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-dark-faded">
                          <span>{new Date(event.timestamp).toLocaleString('de-DE')}</span>
                          <span>Quelle: {event.source}</span>
                          <span>Ist: {event.actual?.toFixed(1)} | Grenze: {event.threshold?.toFixed(1)}</span>
                          {event.acknowledged_at && <span className="text-emerald-400">Quittiert</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!event.acknowledged_at && (
                        <button onClick={() => handleAcknowledge(event.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-dark-card border border-dark-border text-xs text-dark-faded hover:text-dark-text"
                        >
                          <Check className="w-3 h-3" /> Quittieren
                        </button>
                      )}
                      <button onClick={() => handleClear(event.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-dark-card border border-dark-border text-xs text-dark-faded hover:text-red-400"
                      >
                        <XCircle className="w-3 h-3" /> Loeschen
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-hover">
              <tr>
                <th className="text-left px-4 py-3 text-dark-faded font-medium">Zeitpunkt</th>
                <th className="text-left px-4 py-3 text-dark-faded font-medium">Schwere</th>
                <th className="text-left px-4 py-3 text-dark-faded font-medium">Meldung</th>
                <th className="text-left px-4 py-3 text-dark-faded font-medium">Quelle</th>
                <th className="text-left px-4 py-3 text-dark-faded font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {history.map(event => {
                const cfg = severityConfig[event.severity] || severityConfig.info
                return (
                  <tr key={event.id} className="hover:bg-dark-hover/50">
                    <td className="px-4 py-2 text-dark-faded whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleString('de-DE')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-dark-text">{event.message}</td>
                    <td className="px-4 py-2 text-dark-faded">{event.source}</td>
                    <td className="px-4 py-2">
                      {event.is_active ? (
                        <span className="text-red-400 text-xs">Aktiv</span>
                      ) : event.cleared_at ? (
                        <span className="text-emerald-400 text-xs">Geloest</span>
                      ) : (
                        <span className="text-dark-faded text-xs">Beendet</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="p-8 text-center text-dark-faded">Keine Alarm-Historie vorhanden</div>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-3">
          {systemRules.map(rule => {
            const cfg = severityConfig[rule.severity] || severityConfig.info
            const Icon = cfg.icon
            return (
              <div key={rule.id} className="bg-dark-card rounded-lg border border-dark-border p-4">
                <div className="flex items-start gap-3">
                  <Shield className={`w-5 h-5 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-text">{rule.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {rule.system && <span className="px-2 py-0.5 rounded text-xs bg-dark-hover text-dark-faded">System</span>}
                    </div>
                    <p className="text-sm text-dark-faded mt-1">{rule.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-dark-faded">
                      <span>Quelle: <code className="text-dark-text">{rule.source}</code></span>
                      <span>Bedingung: <code className="text-dark-text">{rule.metric} {rule.condition} {rule.threshold}</code></span>
                      <span>Cooldown: {rule.cooldownMinutes} min</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
