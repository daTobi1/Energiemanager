import { useState, useEffect } from 'react'
import { InputField, Section } from '../components/ui/FormField'
import {
  Clock, Wifi, Bluetooth, Download, Power, RotateCcw,
  RefreshCw, AlertTriangle, WifiOff, Info, Monitor,
} from 'lucide-react'

export default function SystemPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmShutdown, setConfirmShutdown] = useState(false)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="page-header">System</h1>
        <p className="text-sm text-dark-faded mt-1">Raspberry Pi Systemverwaltung, Netzwerk und Updates</p>
      </div>

      <div className="space-y-4">
        <Section title="Zeit & Datum" icon={<Clock className="w-4 h-4 text-cyan-400" />} defaultOpen={true}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-faded uppercase tracking-wider mb-1">Aktuelle Systemzeit</p>
                <p className="text-2xl font-bold font-mono text-dark-text">
                  {currentTime.toLocaleTimeString('de-DE')}
                </p>
                <p className="text-sm text-dark-muted">
                  {currentTime.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <Clock className="w-10 h-10 text-dark-border" />
            </div>
          </div>
          <InputField label="NTP-Server" value="pool.ntp.org" onChange={() => {}} placeholder="pool.ntp.org" info="Network Time Protocol Server für automatische Zeitsynchronisation. Standard: pool.ntp.org" disabled />
          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300">Die Systemzeit wird automatisch über NTP synchronisiert. Manuelle Zeiteinstellung ist nur bei fehlender Internetverbindung erforderlich und über die Backend-API möglich.</p>
            </div>
          </div>
        </Section>

        <Section title="WLAN" icon={<Wifi className="w-4 h-4 text-blue-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Verbindungsstatus</p>
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span className="text-emerald-400">Verbunden</span>
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Netzwerk (SSID)</span>
                <span className="text-dark-text font-medium">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">IP-Adresse</span>
                <span className="text-dark-text font-mono">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Signalstärke</span>
                <span className="text-dark-text">—</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Netzwerke scannen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border text-center">
            <WifiOff className="w-8 h-8 text-dark-border mx-auto mb-2" />
            <p className="text-sm text-dark-faded">WLAN-Verwaltung verfügbar nach Backend-Anbindung</p>
            <p className="text-xs text-dark-border mt-1">API: GET /api/v1/system/wifi/scan, POST /api/v1/system/wifi/connect</p>
          </div>
        </Section>

        <Section title="Bluetooth" icon={<Bluetooth className="w-4 h-4 text-blue-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Bluetooth-Status</p>
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-dark-faded" />
                <span className="text-dark-faded">Nicht verfügbar</span>
              </span>
            </div>
            <p className="text-sm text-dark-faded">
              Bluetooth wird für die direkte Kommunikation mit kompatiblen Geräten verwendet (z.B. SMA Wechselrichter via Bluetooth, BLE-Sensoren).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Geräte suchen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300">Bluetooth-Gerätesuche und -Kopplung werden nach der Backend-Anbindung über die System-API verfügbar sein.</p>
            </div>
          </div>
        </Section>

        <Section title="Update & Rollback" icon={<Download className="w-4 h-4 text-amber-400" />} defaultOpen={false}>
          <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-faded uppercase tracking-wider">Aktuelle Version</p>
              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded-full font-mono">v0.1.0</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-faded">Branch</span>
                <span className="text-dark-text font-mono">master</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-faded">Letztes Update</span>
                <span className="text-dark-text">—</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary flex items-center gap-2 text-sm" disabled>
              <RefreshCw className="w-4 h-4" /> Auf Updates prüfen
            </button>
            <span className="text-xs text-dark-faded">Erfordert Backend-Verbindung</span>
          </div>

          <div className="border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-dark-hover">
              <h4 className="text-sm font-semibold text-dark-muted flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Rollback
              </h4>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-dark-faded">
                Bei Problemen nach einem Update kann auf eine vorherige Version zurückgesetzt werden. Alle Konfigurationsdaten bleiben erhalten.
              </p>
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300">Rollback setzt die Software auf eine frühere Version zurück. Datenbank-Migrationen werden dabei nicht rückgängig gemacht. Erstelle vor einem Update immer ein Backup.</p>
                </div>
              </div>
              <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
                <RotateCcw className="w-4 h-4" /> Versionshistorie laden
              </button>
            </div>
          </div>
        </Section>

        <Section title="System-Steuerung" icon={<Power className="w-4 h-4 text-red-400" />} defaultOpen={false}>
          <p className="text-sm text-dark-faded mb-4">Raspberry Pi Systemfunktionen. Diese Aktionen erfordern eine aktive Backend-Verbindung.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-text">Pi neustarten</h4>
                  <p className="text-xs text-dark-faded">System wird neu gestartet (~30s)</p>
                </div>
              </div>
              {confirmRestart ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400">Wirklich neustarten? Laufende Prozesse werden beendet.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmRestart(false)}
                      className="btn-secondary text-sm flex-1"
                      disabled
                    >
                      Neustart bestätigen
                    </button>
                    <button onClick={() => setConfirmRestart(false)} className="btn-secondary text-sm">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRestart(true)}
                  className="btn-secondary flex items-center gap-2 text-sm w-full justify-center"
                  disabled
                >
                  <RefreshCw className="w-4 h-4" /> Neustart
                </button>
              )}
            </div>

            <div className="p-4 bg-dark-hover rounded-lg border border-dark-border">
              <div className="flex items-center gap-3 mb-3">
                <Power className="w-5 h-5 text-red-400" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-text">Pi herunterfahren</h4>
                  <p className="text-xs text-dark-faded">System wird sicher heruntergefahren</p>
                </div>
              </div>
              {confirmShutdown ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">Wirklich herunterfahren? Das System ist danach nicht mehr erreichbar!</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmShutdown(false)}
                      className="text-sm flex-1 px-3 py-1.5 rounded-lg font-medium text-red-100 transition-colors"
                      style={{ background: '#7b1a18' }}
                      disabled
                    >
                      Herunterfahren bestätigen
                    </button>
                    <button onClick={() => setConfirmShutdown(false)} className="btn-secondary text-sm">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmShutdown(true)}
                  className="btn-secondary flex items-center gap-2 text-sm w-full justify-center text-red-400 hover:text-red-300"
                  disabled
                >
                  <Power className="w-4 h-4" /> Herunterfahren
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-dark-hover rounded-lg border border-dark-border">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-dark-faded mt-0.5 shrink-0" />
              <p className="text-xs text-dark-faded">Systemsteuerung ist nach der Backend-Anbindung verfügbar. API-Endpoints: POST /api/v1/system/reboot, POST /api/v1/system/shutdown</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
