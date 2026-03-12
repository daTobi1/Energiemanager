import { useState, useCallback } from 'react'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, Section } from '../components/ui/FormField'
import {
  Building2, MapPin, Thermometer, Banknote, Cloud,
  CheckCircle2, Search, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { SystemSettings, TariffType } from '../types'

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

export default function SettingsPage() {
  const { settings, updateSettings } = useEnergyStore()
  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    updateSettings({ [key]: value })
  }

  // Geocoding state
  const [addressQuery, setAddressQuery] = useState(settings.address || '')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [showManualCoords, setShowManualCoords] = useState(false)

  const searchAddress = useCallback(async () => {
    if (!addressQuery.trim()) return
    setGeoLoading(true)
    setGeoError('')
    setGeoResults([])
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'de' } },
      )
      const data: GeoResult[] = await res.json()
      if (data.length === 0) setGeoError('Keine Ergebnisse gefunden. Versuche eine andere Schreibweise.')
      else setGeoResults(data)
    } catch {
      setGeoError('Geocoding-Anfrage fehlgeschlagen. Prüfe die Internetverbindung.')
    } finally {
      setGeoLoading(false)
    }
  }, [addressQuery])

  const selectGeoResult = (result: GeoResult) => {
    updateSettings({
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    })
    setAddressQuery(result.display_name)
    setGeoResults([])
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="page-header">Anlage & Standort</h1>
        <p className="text-sm text-dark-faded mt-1">Gebäude, Standort, Tarife und Wetterdaten</p>
      </div>

      <div className="space-y-4">
        <Section title="Gebäude" icon={<Building2 className="w-4 h-4 text-amber-400" />} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Gebäudebezeichnung" value={settings.buildingName} onChange={(v) => update('buildingName', v)} placeholder="z.B. Einfamilienhaus, Bürogebäude" info="Name oder Bezeichnung des Gebäudes / der Liegenschaft, die vom EnergyManager gesteuert wird." />
            <SelectField label="Gebäudetyp" value={settings.buildingType} onChange={(v) => update('buildingType', v as SystemSettings['buildingType'])} options={[
              { value: 'residential', label: 'Wohngebäude' },
              { value: 'commercial', label: 'Gewerbe' },
              { value: 'industrial', label: 'Industrie' },
              { value: 'mixed', label: 'Mischnutzung' },
            ]} info="Der Gebäudetyp beeinflusst die verwendeten Standardlastprofile und Prognosemodelle." />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <InputField label="Grundfläche" value={settings.buildingArea} onChange={(v) => update('buildingArea', Number(v))} type="number" unit="m²" info="Brutto-Grundfläche (BGF) des Gebäudes." />
            <InputField label="Beheizte Fläche" value={settings.heatedArea} onChange={(v) => update('heatedArea', Number(v))} type="number" unit="m²" info="Beheizte Nettofläche gemäß EnEV/GEG für Heizlastberechnung." />
            <InputField label="Baujahr" value={settings.buildingYear} onChange={(v) => update('buildingYear', Number(v))} type="number" />
            <InputField label="Bewohner / Nutzer" value={settings.occupants} onChange={(v) => update('occupants', Number(v))} type="number" info="Anzahl der Personen für Warmwasser- und Stromverbrauchsschätzung." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Dämmstandard" value={settings.insulationStandard} onChange={(v) => update('insulationStandard', v as SystemSettings['insulationStandard'])} options={[
              { value: 'poor', label: 'Schlecht (Altbau, unsaniert)' },
              { value: 'average', label: 'Mittel (teilsaniert)' },
              { value: 'good', label: 'Gut (EnEV / GEG)' },
              { value: 'passive_house', label: 'Passivhaus / KfW 40' },
            ]} info="Beeinflusst die Berechnung des Heizwärmebedarfs und die Prognosemodelle." />
            <InputField label="Jahres-Heizwärmebedarf" value={settings.annualHeatingDemandKwh} onChange={(v) => update('annualHeatingDemandKwh', Number(v))} type="number" unit="kWh" hint="Für Prognosemodell" info="Gemessener oder geschätzter Jahresheizwärmebedarf. Wird vom System nach einiger Zeit selbst gelernt." />
            <InputField label="Jahres-Kühlbedarf" value={settings.annualCoolingDemandKwh} onChange={(v) => update('annualCoolingDemandKwh', Number(v))} type="number" unit="kWh" />
          </div>
        </Section>

        <Section title="Komfort & Regelung" icon={<Thermometer className="w-4 h-4 text-red-400" />} defaultOpen={true}>
          <p className="text-sm text-dark-faded mb-3">Gebäude-weite Vorgaben für Heizung, Kühlung und Warmwasser</p>
          <div className="flex items-center gap-3 p-3 bg-dark-hover rounded-lg">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hasIndividualRoomControl}
                onChange={(e) => update('hasIndividualRoomControl', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-dark-border rounded-full peer peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <div>
              <span className="text-sm font-medium text-dark-text">Einzelraumregelung vorhanden</span>
              <p className="text-xs text-dark-faded">
                {settings.hasIndividualRoomControl
                  ? 'Räume können individuelle Sollwerte haben — diese Werte dienen als Vorgabe'
                  : 'Keine Einzelraumregelung — diese Werte gelten für alle Räume'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Raum-Solltemperatur" value={settings.targetRoomTemperatureC} onChange={(v) => update('targetRoomTemperatureC', Number(v))} type="number" unit="°C" step="0.5" info={settings.hasIndividualRoomControl ? 'Standardwert für neue Räume. Kann pro Raum überschrieben werden.' : 'Gewünschte Raumtemperatur tagsüber für alle Räume.'} />
            <InputField label="Nachtabsenkung" value={settings.nightSetbackK} onChange={(v) => update('nightSetbackK', Number(v))} type="number" unit="K" step="0.5" hint="Reduktion nachts" info={settings.hasIndividualRoomControl ? 'Standardwert für neue Räume. Kann pro Raum überschrieben werden.' : 'Um wie viel Kelvin die Solltemperatur nachts abgesenkt wird.'} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Warmwasser-Solltemperatur" value={settings.hotWaterTemperatureC} onChange={(v) => update('hotWaterTemperatureC', Number(v))} type="number" unit="°C" info="Zieltemperatur für die Warmwasserbereitung. Mindestens 60°C empfohlen (Legionellenschutz)." />
            <InputField label="Heizgrenztemperatur" value={settings.heatingThresholdOutdoorC} onChange={(v) => update('heatingThresholdOutdoorC', Number(v))} type="number" unit="°C" hint="Außentemp. — darunter wird geheizt" info="Außentemperatur, ab der die Heizung aktiviert wird. Typisch: 15°C für gut gedämmte, 18°C für schlecht gedämmte Gebäude." />
            <InputField label="Kühlschwelle" value={settings.coolingThresholdC} onChange={(v) => update('coolingThresholdC', Number(v))} type="number" unit="°C" hint="Außentemp. — darüber wird gekühlt" />
          </div>
        </Section>

        <Section title="Standort" icon={<MapPin className="w-4 h-4 text-blue-400" />} defaultOpen={true}>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Adresse</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchAddress() }}
                placeholder="z.B. Musterstraße 42, 80331 München"
                className="flex-1 px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-faded focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={searchAddress}
                disabled={geoLoading || !addressQuery.trim()}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Suchen
              </button>
            </div>
            <p className="text-xs text-dark-faded mt-1">Adresse eingeben — Koordinaten werden automatisch ermittelt (OpenStreetMap)</p>
          </div>
          {geoResults.length > 0 && (
            <div className="border border-dark-border rounded-lg overflow-hidden">
              {geoResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectGeoResult(r)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-emerald-500/10 transition-colors border-b border-dark-border last:border-b-0 flex items-center justify-between gap-3"
                >
                  <span className="text-dark-text">{r.display_name}</span>
                  <span className="text-xs text-dark-faded shrink-0">{parseFloat(r.lat).toFixed(4)}°, {parseFloat(r.lon).toFixed(4)}°</span>
                </button>
              ))}
            </div>
          )}
          {geoError && (
            <p className="text-sm text-amber-400">{geoError}</p>
          )}
          {settings.latitude !== 51.1657 && (
            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-400">
                  Standort: {settings.latitude.toFixed(4)}° N, {settings.longitude.toFixed(4)}° E
                  {settings.address && ` — ${settings.address}`}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowManualCoords(!showManualCoords)}
            className="flex items-center gap-2 text-sm text-dark-faded hover:text-dark-muted transition-colors"
          >
            {showManualCoords ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Koordinaten manuell eingeben
          </button>
          {showManualCoords && (
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Breitengrad" value={settings.latitude} onChange={(v) => update('latitude', Number(v))} type="number" step="0.0001" hint="z.B. 51.1657 (Deutschland)" info="Breitengrad des Gebäudestandorts. Wird für PV-Ertragsberechnung und Wetterprognosen benötigt." />
              <InputField label="Längengrad" value={settings.longitude} onChange={(v) => update('longitude', Number(v))} type="number" step="0.0001" hint="z.B. 10.4515" />
              <InputField label="Höhe ü. NN" value={settings.altitudeM} onChange={(v) => update('altitudeM', Number(v))} type="number" unit="m" info="Höhe über Normalnull. Beeinflusst Luftdruck und damit PV-Ertragsberechnung." />
            </div>
          )}
          <SelectField label="Zeitzone" value={settings.timezone} onChange={(v) => update('timezone', v)} options={[
            { value: 'Europe/Berlin', label: 'Europe/Berlin (MEZ/MESZ)' },
            { value: 'Europe/Vienna', label: 'Europe/Vienna' },
            { value: 'Europe/Zurich', label: 'Europe/Zurich' },
          ]} />
        </Section>

        <Section title="Tarife & Kosten" icon={<Banknote className="w-4 h-4 text-green-400" />} defaultOpen={true}>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Tarifmodell" value={settings.tariffType} onChange={(v) => update('tariffType', v as TariffType)} options={[
              { value: 'fixed', label: 'Festpreis' },
              { value: 'time_of_use', label: 'HT/NT (Doppeltarif)' },
              { value: 'dynamic', label: 'Dynamisch (Börsenpreis)' },
            ]} info="Festpreis = ein Preis rund um die Uhr. HT/NT = verschiedene Preise zu verschiedenen Zeiten. Dynamisch = stündlich wechselnder Börsenpreis." />
            <InputField label="Strombezugspreis" value={settings.gridConsumptionCtPerKwh} onChange={(v) => update('gridConsumptionCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" info="Arbeitspreis für Strombezug aus dem Netz (brutto, inkl. aller Abgaben)." />
            <InputField label="Einspeisevergütung" value={settings.gridFeedInCtPerKwh} onChange={(v) => update('gridFeedInCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" info="Vergütung für ins Netz eingespeisten Strom nach EEG." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Leistungspreis" value={settings.demandChargeEurPerKwPerYear} onChange={(v) => update('demandChargeEurPerKwPerYear', Number(v))} type="number" unit="EUR/kW/a" step="0.1" hint="Jahresleistungspreis" info="Leistungspreis für die maximale bezogene Leistung (relevant ab >100 kW Anschlussleistung)." />
            <InputField label="Gaspreis" value={settings.gasPriceCtPerKwh} onChange={(v) => update('gasPriceCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" />
            <InputField label="Pelletpreis" value={settings.pelletPriceEurPerTon} onChange={(v) => update('pelletPriceEurPerTon', Number(v))} type="number" unit="EUR/t" />
          </div>
          {settings.tariffType === 'time_of_use' && (
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20 space-y-3">
              <h4 className="text-sm font-semibold text-amber-400">HT/NT-Zeiten</h4>
              {settings.timeOfUsePeriods.map((period, i) => (
                <div key={i} className="grid grid-cols-4 gap-3 items-end">
                  <InputField label="Bezeichnung" value={period.name} onChange={(v) => {
                    const periods = [...settings.timeOfUsePeriods]
                    periods[i] = { ...periods[i], name: v }
                    update('timeOfUsePeriods', periods)
                  }} placeholder="z.B. HT, NT" />
                  <InputField label="Von" value={period.startHour} onChange={(v) => {
                    const periods = [...settings.timeOfUsePeriods]
                    periods[i] = { ...periods[i], startHour: Number(v) }
                    update('timeOfUsePeriods', periods)
                  }} type="number" unit="Uhr" min={0} max={23} />
                  <InputField label="Bis" value={period.endHour} onChange={(v) => {
                    const periods = [...settings.timeOfUsePeriods]
                    periods[i] = { ...periods[i], endHour: Number(v) }
                    update('timeOfUsePeriods', periods)
                  }} type="number" unit="Uhr" min={0} max={23} />
                  <InputField label="Preis" value={period.priceCtPerKwh} onChange={(v) => {
                    const periods = [...settings.timeOfUsePeriods]
                    periods[i] = { ...periods[i], priceCtPerKwh: Number(v) }
                    update('timeOfUsePeriods', periods)
                  }} type="number" unit="ct/kWh" step="0.1" />
                </div>
              ))}
              <button onClick={() => update('timeOfUsePeriods', [...settings.timeOfUsePeriods, { name: '', startHour: 6, endHour: 22, priceCtPerKwh: 30, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }])} className="btn-secondary text-sm">+ Zeitfenster</button>
            </div>
          )}
        </Section>

        <Section title="Wetter-API" icon={<Cloud className="w-4 h-4 text-sky-400" />} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Anbieter" value={settings.weatherProvider} onChange={(v) => update('weatherProvider', v as SystemSettings['weatherProvider'])} options={[
              { value: 'openweathermap', label: 'OpenWeatherMap' },
              { value: 'brightsky', label: 'Bright Sky (DWD, kostenlos)' },
              { value: 'visual_crossing', label: 'Visual Crossing' },
            ]} info="Wetterdaten werden für PV-Ertragsprognose und Heiz-/Kühlbedarf-Vorhersage benötigt." />
            <InputField label="API-Key" value={settings.weatherApiKey} onChange={(v) => update('weatherApiKey', v)} type="password" hint={settings.weatherProvider === 'brightsky' ? 'Bright Sky benötigt keinen API-Key' : 'API-Key des Anbieters'} />
          </div>
        </Section>

        <div className="card bg-emerald-500/10 border-emerald-500/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-400">Einstellungen werden automatisch im Browser gespeichert (localStorage).</p>
          </div>
        </div>
      </div>
    </div>
  )
}
