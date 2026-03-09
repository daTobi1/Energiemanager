import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, Section } from '../components/ui/FormField'
import { Building2, MapPin, Thermometer, Banknote, Zap, Cloud } from 'lucide-react'
import type { SystemSettings, TariffType } from '../types'

export default function SettingsPage() {
  const { settings, updateSettings } = useEnergyStore()
  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    updateSettings({ [key]: value })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="page-header">Einstellungen</h1>
        <p className="text-sm text-gray-500 mt-1">Gebäude, Standort, Tarife und Systemkonfiguration</p>
      </div>

      <div className="space-y-4">
        <Section title="Gebäude" icon={<Building2 className="w-4 h-4 text-amber-500" />} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Gebäudebezeichnung" value={settings.buildingName} onChange={(v) => update('buildingName', v)} placeholder="z.B. Einfamilienhaus, Bürogebäude" />
            <SelectField label="Gebäudetyp" value={settings.buildingType} onChange={(v) => update('buildingType', v as SystemSettings['buildingType'])} options={[
              { value: 'residential', label: 'Wohngebäude' },
              { value: 'commercial', label: 'Gewerbe' },
              { value: 'industrial', label: 'Industrie' },
              { value: 'mixed', label: 'Mischnutzung' },
            ]} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <InputField label="Grundfläche" value={settings.buildingArea} onChange={(v) => update('buildingArea', Number(v))} type="number" unit="m²" />
            <InputField label="Beheizte Fläche" value={settings.heatedArea} onChange={(v) => update('heatedArea', Number(v))} type="number" unit="m²" />
            <InputField label="Baujahr" value={settings.buildingYear} onChange={(v) => update('buildingYear', Number(v))} type="number" />
            <InputField label="Bewohner / Nutzer" value={settings.occupants} onChange={(v) => update('occupants', Number(v))} type="number" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Dämmstandard" value={settings.insulationStandard} onChange={(v) => update('insulationStandard', v as SystemSettings['insulationStandard'])} options={[
              { value: 'poor', label: 'Schlecht (Altbau, unsaniert)' },
              { value: 'average', label: 'Mittel (teilsaniert)' },
              { value: 'good', label: 'Gut (EnEV / GEG)' },
              { value: 'passive_house', label: 'Passivhaus / KfW 40' },
            ]} />
            <InputField label="Jahres-Heizwärmebedarf" value={settings.annualHeatingDemandKwh} onChange={(v) => update('annualHeatingDemandKwh', Number(v))} type="number" unit="kWh" hint="Für Prognosemodell" />
            <InputField label="Jahres-Kühlbedarf" value={settings.annualCoolingDemandKwh} onChange={(v) => update('annualCoolingDemandKwh', Number(v))} type="number" unit="kWh" />
          </div>
        </Section>

        <Section title="Standort" icon={<MapPin className="w-4 h-4 text-blue-500" />} defaultOpen={true}>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Breitengrad" value={settings.latitude} onChange={(v) => update('latitude', Number(v))} type="number" step="0.0001" hint="z.B. 51.1657 (Deutschland)" />
            <InputField label="Längengrad" value={settings.longitude} onChange={(v) => update('longitude', Number(v))} type="number" step="0.0001" hint="z.B. 10.4515" />
            <InputField label="Höhe ü. NN" value={settings.altitudeM} onChange={(v) => update('altitudeM', Number(v))} type="number" unit="m" />
          </div>
          <SelectField label="Zeitzone" value={settings.timezone} onChange={(v) => update('timezone', v)} options={[
            { value: 'Europe/Berlin', label: 'Europe/Berlin (MEZ/MESZ)' },
            { value: 'Europe/Vienna', label: 'Europe/Vienna' },
            { value: 'Europe/Zurich', label: 'Europe/Zurich' },
          ]} />
        </Section>

        <Section title="Komfort-Parameter" icon={<Thermometer className="w-4 h-4 text-red-500" />} defaultOpen={true}>
          <p className="text-sm text-gray-500 mb-3">Vorgaben für die selbstlernende Regelung</p>
          <div className="grid grid-cols-4 gap-4">
            <InputField label="Raum-Solltemperatur" value={settings.targetRoomTemperatureC} onChange={(v) => update('targetRoomTemperatureC', Number(v))} type="number" unit="°C" step="0.5" />
            <InputField label="Nachtabsenkung" value={settings.nightSetbackC} onChange={(v) => update('nightSetbackC', Number(v))} type="number" unit="K" step="0.5" hint="Reduktion nachts" />
            <InputField label="Warmwasser-Temp." value={settings.hotWaterTemperatureC} onChange={(v) => update('hotWaterTemperatureC', Number(v))} type="number" unit="°C" />
            <InputField label="Kühlschwelle" value={settings.coolingThresholdC} onChange={(v) => update('coolingThresholdC', Number(v))} type="number" unit="°C" hint="Ab dieser Außentemp. kühlen" />
          </div>
          <InputField label="Heizschwelle (Außen)" value={settings.heatingThresholdOutdoorC} onChange={(v) => update('heatingThresholdOutdoorC', Number(v))} type="number" unit="°C" hint="Heizgrenztemperatur — darunter wird geheizt" />
        </Section>

        <Section title="Tarife & Kosten" icon={<Banknote className="w-4 h-4 text-green-600" />} defaultOpen={true}>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Tarifmodell" value={settings.tariffType} onChange={(v) => update('tariffType', v as TariffType)} options={[
              { value: 'fixed', label: 'Festpreis' },
              { value: 'time_of_use', label: 'HT/NT (Doppeltarif)' },
              { value: 'dynamic', label: 'Dynamisch (Börsenpreis)' },
            ]} />
            <InputField label="Strombezugspreis" value={settings.gridConsumptionCtPerKwh} onChange={(v) => update('gridConsumptionCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" />
            <InputField label="Einspeisevergütung" value={settings.gridFeedInCtPerKwh} onChange={(v) => update('gridFeedInCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Leistungspreis" value={settings.demandChargeEurPerKwPerYear} onChange={(v) => update('demandChargeEurPerKwPerYear', Number(v))} type="number" unit="EUR/kW/a" step="0.1" hint="Jahresleistungspreis" />
            <InputField label="Gaspreis" value={settings.gasPriceCtPerKwh} onChange={(v) => update('gasPriceCtPerKwh', Number(v))} type="number" unit="ct/kWh" step="0.1" />
            <InputField label="Pelletpreis" value={settings.pelletPriceEurPerTon} onChange={(v) => update('pelletPriceEurPerTon', Number(v))} type="number" unit="EUR/t" />
          </div>
          {settings.tariffType === 'time_of_use' && (
            <div className="p-4 bg-amber-50 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold text-amber-700">HT/NT-Zeiten</h4>
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

        <Section title="Netzanschluss" icon={<Zap className="w-4 h-4 text-indigo-500" />} defaultOpen={true}>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Max. Anschlussleistung" value={settings.gridMaxPowerKw} onChange={(v) => update('gridMaxPowerKw', Number(v))} type="number" unit="kW" />
            <InputField label="Nennspannung" value={settings.gridVoltageV} onChange={(v) => update('gridVoltageV', Number(v))} type="number" unit="V" />
            <InputField label="Einspeisebegrenzung" value={settings.feedInLimitPercent} onChange={(v) => update('feedInLimitPercent', Number(v))} type="number" unit="%" hint="z.B. 70%-Regel" min={0} max={100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Netzbetreiber" value={settings.gridOperator} onChange={(v) => update('gridOperator', v)} placeholder="z.B. E.ON, Stadtwerke..." />
            <InputField label="Zählpunkt-ID (MeLo)" value={settings.meterPointId} onChange={(v) => update('meterPointId', v)} placeholder="DE000..." hint="Marktlokations-ID" />
          </div>
        </Section>

        <Section title="Wetter-API" icon={<Cloud className="w-4 h-4 text-sky-500" />} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Anbieter" value={settings.weatherProvider} onChange={(v) => update('weatherProvider', v as SystemSettings['weatherProvider'])} options={[
              { value: 'openweathermap', label: 'OpenWeatherMap' },
              { value: 'brightsky', label: 'Bright Sky (DWD, kostenlos)' },
              { value: 'visual_crossing', label: 'Visual Crossing' },
            ]} />
            <InputField label="API-Key" value={settings.weatherApiKey} onChange={(v) => update('weatherApiKey', v)} type="password" hint={settings.weatherProvider === 'brightsky' ? 'Bright Sky benötigt keinen API-Key' : 'API-Key des Anbieters'} />
          </div>
        </Section>

        <div className="card bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-700">Einstellungen werden automatisch im Browser gespeichert (localStorage).</p>
        </div>
      </div>
    </div>
  )
}
