import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../ui/FormField'
import { CommunicationForm } from '../ui/CommunicationForm'
import type {
  Generator, GeneratorType, PvGenerator, ChpGenerator,
  HeatPumpGenerator, BoilerGenerator, ChillerGenerator, GridGenerator,
  EnergyPort,
} from '../../types'
import { createDefaultCommunication } from '../../types'
import { mkPort } from '../ui/PortEditor'

const typeOptions = [
  { value: 'grid', label: 'Hausanschluss (Netzanschluss)' },
  { value: 'pv', label: 'PV-Anlage (Photovoltaik)' },
  { value: 'chp', label: 'BHKW (Kraft-Wärme-Kopplung)' },
  { value: 'heat_pump', label: 'Wärmepumpe' },
  { value: 'boiler', label: 'Heizkessel' },
  { value: 'chiller', label: 'Kältemaschine' },
]

const fuelOptions = [
  { value: 'natural_gas', label: 'Erdgas' },
  { value: 'biogas', label: 'Biogas' },
  { value: 'lpg', label: 'Flüssiggas (LPG)' },
  { value: 'oil', label: 'Heizöl' },
  { value: 'pellet', label: 'Pellet' },
  { value: 'wood_chips', label: 'Hackschnitzel' },
]

const heatPumpTypeOptions = [
  { value: 'air_water', label: 'Luft/Wasser' },
  { value: 'brine_water', label: 'Sole/Wasser' },
  { value: 'water_water', label: 'Wasser/Wasser' },
]

function createDefaultPorts(type: GeneratorType, coolingCapable = false): EnergyPort[] {
  switch (type) {
    case 'grid':      return [mkPort('input', 'electricity', 'Netzbezug'), mkPort('output', 'electricity', 'Einspeisung')]
    case 'pv':        return [mkPort('output', 'electricity', 'Strom')]
    case 'chp':       return [mkPort('input', 'gas', 'Erdgas'), mkPort('output', 'electricity', 'Strom'), mkPort('output', 'heat', 'Heizwärme')]
    case 'heat_pump': {
      const ports = [mkPort('input', 'electricity', 'Strom'), mkPort('input', 'source', 'Quellenenergie'), mkPort('output', 'heat', 'Heizwärme')]
      if (coolingCapable) ports.push(mkPort('output', 'cold', 'Kälte'))
      return ports
    }
    case 'boiler':    return [mkPort('input', 'gas', 'Erdgas'), mkPort('output', 'heat', 'Heizwärme')]
    case 'chiller':   return [mkPort('input', 'electricity', 'Strom'), mkPort('output', 'cold', 'Kälte')]
  }
}

function createDefaultGenerator(type: GeneratorType): Generator {
  const base = {
    id: '', name: '', manufacturer: '', model: '', serialNumber: '',
    commissioningDate: '', location: '', notes: '',
    communication: createDefaultCommunication(),
    assignedMeterIds: [], ports: createDefaultPorts(type), connectedGeneratorIds: [],
  }
  switch (type) {
    case 'grid':
      return { ...base, type: 'grid', energyForm: 'electricity', gridMaxPowerKw: 30, gridPhases: 3, gridVoltageV: 400, feedInLimitPercent: 100, feedInLimitKw: 0, gridOperator: '', meterPointId: '' }
    case 'pv':
      return { ...base, type: 'pv', energyForm: 'electricity', peakPowerKwp: 10, numberOfModules: 25, moduleType: '', modulePowerWp: 400, inverterType: '', inverterPowerKw: 10, numberOfInverters: 1, mppTrackers: 2, azimuthDeg: 0, tiltDeg: 30, efficiency: 0.85, degradationPerYear: 0.5, temperatureCoefficient: -0.35, albedo: 0.2 }
    case 'chp':
      return { ...base, type: 'chp', energyForm: 'electricity_heat', electricalPowerKw: 5.5, thermalPowerKw: 12.5, fuelType: 'natural_gas', electricalEfficiency: 0.33, thermalEfficiency: 0.55, overallEfficiency: 0.88, modulationMinPercent: 50, modulationMaxPercent: 100, minimumRunTimeMin: 30, minimumOffTimeMin: 15, startCostEur: 0.50, maintenanceIntervalHours: 4000, currentOperatingHours: 0, fuelCostCtPerKwh: 8, powerToHeatRatio: 0.44 }
    case 'heat_pump':
      return { ...base, type: 'heat_pump', energyForm: 'heat', heatPumpType: 'air_water', heatingPowerKw: 10, coolingCapable: false, coolingPowerKw: 0, electricalPowerKw: 2.5, copRated: 4.0, copCurve: [{ outdoorTempC: -15, cop: 2.2 }, { outdoorTempC: -7, cop: 2.8 }, { outdoorTempC: 2, cop: 3.5 }, { outdoorTempC: 7, cop: 4.0 }, { outdoorTempC: 15, cop: 4.8 }, { outdoorTempC: 20, cop: 5.2 }], minOutdoorTempC: -25, maxOutdoorTempC: 40, flowTemperatureC: 35, returnTemperatureC: 28, modulationMinPercent: 30, modulationMaxPercent: 100, defrostPowerKw: 1.0, sgReadyEnabled: false, bivalencePointC: -5, refrigerant: 'R290' }
    case 'boiler':
      return { ...base, type: 'boiler', energyForm: 'heat', fuelType: 'natural_gas', nominalPowerKw: 20, efficiency: 0.95, modulationMinPercent: 30, modulationMaxPercent: 100, condensing: true, flowTemperatureMaxC: 80, returnTemperatureMinC: 30, minimumRunTimeMin: 5, fuelCostCtPerKwh: 8, flueGasLosses: 0.05 }
    case 'chiller':
      return { ...base, type: 'chiller', energyForm: 'cold', coolingPowerKw: 20, electricalPowerKw: 6, eerRated: 3.5, seerRated: 5.0, coolantType: 'Wasser/Glykol', refrigerant: 'R410A', flowTemperatureC: 6, returnTemperatureC: 12, modulationMinPercent: 25, modulationMaxPercent: 100, minOutdoorTempC: -10, maxOutdoorTempC: 45 }
  }
}

interface Props {
  entity: Generator
  onChange: (entity: Generator) => void
  hasGrid?: boolean
}

export function GeneratorForm({ entity, onChange, hasGrid }: Props) {
  const updateField = <K extends keyof Generator>(key: K, value: Generator[K]) => {
    onChange({ ...entity, [key]: value } as Generator)
  }

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Typ" value={entity.type}
            onChange={(v) => {
              const newGen = createDefaultGenerator(v as GeneratorType)
              onChange({ ...newGen, id: entity.id, name: entity.name, notes: entity.notes })
            }}
            options={typeOptions.filter(({ value }) => !(value === 'grid' && hasGrid && entity.type !== 'grid'))}
          />
          <InputField label="Name / Bezeichnung" value={entity.name} onChange={(v) => updateField('name', v)} placeholder="z.B. PV Süddach" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Hersteller" value={entity.manufacturer} onChange={(v) => updateField('manufacturer', v)} placeholder="z.B. SMA, Viessmann" />
          <InputField label="Modell" value={entity.model} onChange={(v) => updateField('model', v)} />
          <InputField label="Seriennummer" value={entity.serialNumber} onChange={(v) => updateField('serialNumber', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Inbetriebnahme" value={entity.commissioningDate} onChange={(v) => updateField('commissioningDate', v)} type="date" />
          <InputField label="Standort / Position" value={entity.location} onChange={(v) => updateField('location', v)} placeholder="z.B. Dach Gebäude A" />
        </div>
      </Section>

      {entity.type === 'grid' && (
        <Section title="Hausanschluss-Daten" defaultOpen={true} badge="Netzanschluss">
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Max. Anschlussleistung" value={(entity as GridGenerator).gridMaxPowerKw} onChange={(v) => updateField('gridMaxPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" info="Maximale Leistung des Hausanschlusses laut Anschlussvertrag." />
            <InputField label="Nennspannung" value={(entity as GridGenerator).gridVoltageV} onChange={(v) => updateField('gridVoltageV' as keyof Generator, Number(v))} type="number" unit="V" />
            <InputField label="Einspeisebegrenzung" value={(entity as GridGenerator).feedInLimitPercent} onChange={(v) => updateField('feedInLimitPercent' as keyof Generator, Number(v))} type="number" unit="%" hint="z.B. 70%-Regel" min={0} max={100} info="Maximale Einspeiseleistung in Prozent der installierten PV-Leistung." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Netzbetreiber" value={(entity as GridGenerator).gridOperator} onChange={(v) => updateField('gridOperator' as keyof Generator, v)} placeholder="z.B. E.ON, Stadtwerke..." />
            <InputField label="Zählpunkt-ID (MeLo)" value={(entity as GridGenerator).meterPointId} onChange={(v) => updateField('meterPointId' as keyof Generator, v)} placeholder="DE000..." hint="Marktlokations-ID" info="Die Marktlokations-ID (MaLo) identifiziert den Hausanschlusspunkt eindeutig im deutschen Stromnetz." />
          </div>
        </Section>
      )}

      {entity.type === 'pv' && (
        <>
          <Section title="PV-Module" defaultOpen={true} badge="Photovoltaik">
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Peak-Leistung" value={(entity as PvGenerator).peakPowerKwp} onChange={(v) => updateField('peakPowerKwp' as keyof Generator, Number(v))} type="number" unit="kWp" step="0.1" />
              <InputField label="Anzahl Module" value={(entity as PvGenerator).numberOfModules} onChange={(v) => updateField('numberOfModules' as keyof Generator, Number(v))} type="number" />
              <InputField label="Modulleistung" value={(entity as PvGenerator).modulePowerWp} onChange={(v) => updateField('modulePowerWp' as keyof Generator, Number(v))} type="number" unit="Wp" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Modultyp / Hersteller" value={(entity as PvGenerator).moduleType} onChange={(v) => updateField('moduleType' as keyof Generator, v)} placeholder="z.B. JA Solar JAM72S30-540" />
              <InputField label="MPP-Tracker" value={(entity as PvGenerator).mppTrackers} onChange={(v) => updateField('mppTrackers' as keyof Generator, Number(v))} type="number" min={1} />
            </div>
          </Section>

          <Section title="Wechselrichter" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Wechselrichter-Typ" value={(entity as PvGenerator).inverterType} onChange={(v) => updateField('inverterType' as keyof Generator, v)} placeholder="z.B. SMA Sunny Tripower 10.0" />
              <InputField label="WR-Leistung" value={(entity as PvGenerator).inverterPowerKw} onChange={(v) => updateField('inverterPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Anzahl WR" value={(entity as PvGenerator).numberOfInverters} onChange={(v) => updateField('numberOfInverters' as keyof Generator, Number(v))} type="number" min={1} />
            </div>
          </Section>

          <Section title="Ausrichtung & Leistungsparameter" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Azimut" value={(entity as PvGenerator).azimuthDeg} onChange={(v) => updateField('azimuthDeg' as keyof Generator, Number(v))} type="number" unit="°" hint="0°=Süd, -90°=Ost, 90°=West" min={-180} max={180} />
              <InputField label="Neigung" value={(entity as PvGenerator).tiltDeg} onChange={(v) => updateField('tiltDeg' as keyof Generator, Number(v))} type="number" unit="°" hint="0°=horizontal, 90°=vertikal" min={0} max={90} />
              <InputField label="Albedo" value={(entity as PvGenerator).albedo} onChange={(v) => updateField('albedo' as keyof Generator, Number(v))} type="number" step="0.05" hint="Bodenreflexion (0.2 = Gras)" min={0} max={1} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="System-Wirkungsgrad" value={(entity as PvGenerator).efficiency} onChange={(v) => updateField('efficiency' as keyof Generator, Number(v))} type="number" step="0.01" hint="Gesamtwirkungsgrad inkl. Verluste" min={0} max={1} />
              <InputField label="Degradation" value={(entity as PvGenerator).degradationPerYear} onChange={(v) => updateField('degradationPerYear' as keyof Generator, Number(v))} type="number" unit="%/Jahr" step="0.1" hint="Jährl. Leistungsabnahme" />
              <InputField label="Temp.-Koeffizient" value={(entity as PvGenerator).temperatureCoefficient} onChange={(v) => updateField('temperatureCoefficient' as keyof Generator, Number(v))} type="number" unit="%/°C" step="0.01" hint="Leistungsänderung pro °C" />
            </div>
          </Section>
        </>
      )}

      {entity.type === 'chp' && (
        <>
          <Section title="Leistungsdaten" defaultOpen={true} badge="BHKW">
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Elektrische Leistung" value={(entity as ChpGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Thermische Leistung" value={(entity as ChpGenerator).thermalPowerKw} onChange={(v) => updateField('thermalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
              <InputField label="Stromkennzahl" value={(entity as ChpGenerator).powerToHeatRatio} onChange={(v) => updateField('powerToHeatRatio' as keyof Generator, Number(v))} type="number" step="0.01" hint="P_el / P_th" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Elektr. Wirkungsgrad" value={(entity as ChpGenerator).electricalEfficiency} onChange={(v) => updateField('electricalEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
              <InputField label="Therm. Wirkungsgrad" value={(entity as ChpGenerator).thermalEfficiency} onChange={(v) => updateField('thermalEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
              <InputField label="Gesamtwirkungsgrad" value={(entity as ChpGenerator).overallEfficiency} onChange={(v) => updateField('overallEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" hint="η_el + η_th" min={0} max={1} />
            </div>
          </Section>

          <Section title="Brennstoff" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Brennstoffart" value={(entity as ChpGenerator).fuelType} onChange={(v) => updateField('fuelType' as keyof Generator, v)} options={fuelOptions} />
              <InputField label="Brennstoffkosten" value={(entity as ChpGenerator).fuelCostCtPerKwh} onChange={(v) => updateField('fuelCostCtPerKwh' as keyof Generator, Number(v))} type="number" unit="ct/kWh" step="0.1" />
            </div>
          </Section>

          <Section title="Betriebsparameter" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Modulation Min" value={(entity as ChpGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" min={0} max={100} />
              <InputField label="Modulation Max" value={(entity as ChpGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" min={0} max={100} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Mindestlaufzeit" value={(entity as ChpGenerator).minimumRunTimeMin} onChange={(v) => updateField('minimumRunTimeMin' as keyof Generator, Number(v))} type="number" unit="min" hint="Min. Laufzeit nach Start" />
              <InputField label="Mindeststillstandzeit" value={(entity as ChpGenerator).minimumOffTimeMin} onChange={(v) => updateField('minimumOffTimeMin' as keyof Generator, Number(v))} type="number" unit="min" hint="Min. Pause zwischen Starts" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Startkosten" value={(entity as ChpGenerator).startCostEur} onChange={(v) => updateField('startCostEur' as keyof Generator, Number(v))} type="number" unit="EUR" step="0.01" hint="Verschleiß pro Start" />
              <InputField label="Wartungsintervall" value={(entity as ChpGenerator).maintenanceIntervalHours} onChange={(v) => updateField('maintenanceIntervalHours' as keyof Generator, Number(v))} type="number" unit="Bh" />
              <InputField label="Aktuelle Betriebsstd." value={(entity as ChpGenerator).currentOperatingHours} onChange={(v) => updateField('currentOperatingHours' as keyof Generator, Number(v))} type="number" unit="h" />
            </div>
          </Section>
        </>
      )}

      {entity.type === 'heat_pump' && (
        <>
          <Section title="Wärmepumpen-Typ & Leistung" defaultOpen={true} badge="Wärmepumpe">
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Bauart" value={(entity as HeatPumpGenerator).heatPumpType} onChange={(v) => updateField('heatPumpType' as keyof Generator, v)} options={heatPumpTypeOptions} />
              <InputField label="Heizleistung" value={(entity as HeatPumpGenerator).heatingPowerKw} onChange={(v) => updateField('heatingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" hint="bei Nennbedingungen" />
              <InputField label="Elektr. Aufnahme" value={(entity as HeatPumpGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="COP (Nenn)" value={(entity as HeatPumpGenerator).copRated} onChange={(v) => updateField('copRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Coefficient of Performance" />
              <InputField label="Kältemittel" value={(entity as HeatPumpGenerator).refrigerant} onChange={(v) => updateField('refrigerant' as keyof Generator, v)} placeholder="z.B. R290, R410A" />
              <InputField label="Bivalenzpunkt" value={(entity as HeatPumpGenerator).bivalencePointC} onChange={(v) => updateField('bivalencePointC' as keyof Generator, Number(v))} type="number" unit="°C" hint="Ab hier Zuheizen nötig" />
            </div>
          </Section>

          <Section title="Temperaturen & Modulation" defaultOpen={true}>
            <div className="grid grid-cols-4 gap-4">
              <InputField label="Vorlauftemp." value={(entity as HeatPumpGenerator).flowTemperatureC} onChange={(v) => updateField('flowTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
              <InputField label="Rücklauftemp." value={(entity as HeatPumpGenerator).returnTemperatureC} onChange={(v) => updateField('returnTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
              <InputField label="Min. Außentemp." value={(entity as HeatPumpGenerator).minOutdoorTempC} onChange={(v) => updateField('minOutdoorTempC' as keyof Generator, Number(v))} type="number" unit="°C" />
              <InputField label="Max. Außentemp." value={(entity as HeatPumpGenerator).maxOutdoorTempC} onChange={(v) => updateField('maxOutdoorTempC' as keyof Generator, Number(v))} type="number" unit="°C" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Modulation Min" value={(entity as HeatPumpGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
              <InputField label="Modulation Max" value={(entity as HeatPumpGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
              <InputField label="Abtauleistung" value={(entity as HeatPumpGenerator).defrostPowerKw} onChange={(v) => updateField('defrostPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" hint="Nur Luft/Wasser" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Kühlung möglich (reversibel)" checked={(entity as HeatPumpGenerator).coolingCapable} onChange={(v) => updateField('coolingCapable' as keyof Generator, v)} />
              <CheckboxField label="SG Ready Schnittstelle" checked={(entity as HeatPumpGenerator).sgReadyEnabled} onChange={(v) => updateField('sgReadyEnabled' as keyof Generator, v)} hint="Smart Grid Ready für PV-Eigenverbrauch" />
            </div>
            {(entity as HeatPumpGenerator).coolingCapable && (
              <InputField label="Kühlleistung" value={(entity as HeatPumpGenerator).coolingPowerKw} onChange={(v) => updateField('coolingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" />
            )}
          </Section>

          <Section title="COP-Kennlinie" defaultOpen={false} badge={`${(entity as HeatPumpGenerator).copCurve.length} Punkte`}>
            <p className="text-sm text-dark-faded mb-3">COP-Werte bei verschiedenen Außentemperaturen (für selbstlernende Regelung)</p>
            {(entity as HeatPumpGenerator).copCurve.map((point, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 items-end">
                <InputField label={i === 0 ? 'Außentemp.' : ''} value={point.outdoorTempC} onChange={(v) => {
                  const curve = [...(entity as HeatPumpGenerator).copCurve]
                  curve[i] = { ...curve[i], outdoorTempC: Number(v) }
                  updateField('copCurve' as keyof Generator, curve as never)
                }} type="number" unit="°C" />
                <InputField label={i === 0 ? 'COP' : ''} value={point.cop} onChange={(v) => {
                  const curve = [...(entity as HeatPumpGenerator).copCurve]
                  curve[i] = { ...curve[i], cop: Number(v) }
                  updateField('copCurve' as keyof Generator, curve as never)
                }} type="number" step="0.1" />
                <button
                  onClick={() => {
                    const curve = (entity as HeatPumpGenerator).copCurve.filter((_, j) => j !== i)
                    updateField('copCurve' as keyof Generator, curve as never)
                  }}
                  className="btn-danger mb-0.5"
                >Entfernen</button>
              </div>
            ))}
            <button
              onClick={() => {
                const curve = [...(entity as HeatPumpGenerator).copCurve, { outdoorTempC: 0, cop: 3.5 }]
                updateField('copCurve' as keyof Generator, curve as never)
              }}
              className="btn-secondary text-sm mt-2"
            >+ Messpunkt hinzufügen</button>
          </Section>
        </>
      )}

      {entity.type === 'boiler' && (
        <Section title="Kessel-Daten" defaultOpen={true} badge="Heizkessel">
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Brennstoffart" value={(entity as BoilerGenerator).fuelType} onChange={(v) => updateField('fuelType' as keyof Generator, v)} options={fuelOptions} />
            <InputField label="Nennleistung" value={(entity as BoilerGenerator).nominalPowerKw} onChange={(v) => updateField('nominalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
            <InputField label="Wirkungsgrad" value={(entity as BoilerGenerator).efficiency} onChange={(v) => updateField('efficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1.1} hint="Brennwert kann >1 sein" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Modulation Min" value={(entity as BoilerGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
            <InputField label="Modulation Max" value={(entity as BoilerGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Max. Vorlauftemp." value={(entity as BoilerGenerator).flowTemperatureMaxC} onChange={(v) => updateField('flowTemperatureMaxC' as keyof Generator, Number(v))} type="number" unit="°C" />
            <InputField label="Min. Rücklauftemp." value={(entity as BoilerGenerator).returnTemperatureMinC} onChange={(v) => updateField('returnTemperatureMinC' as keyof Generator, Number(v))} type="number" unit="°C" hint="Für Brennwert-Nutzung" />
            <InputField label="Mindestlaufzeit" value={(entity as BoilerGenerator).minimumRunTimeMin} onChange={(v) => updateField('minimumRunTimeMin' as keyof Generator, Number(v))} type="number" unit="min" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Brennstoffkosten" value={(entity as BoilerGenerator).fuelCostCtPerKwh} onChange={(v) => updateField('fuelCostCtPerKwh' as keyof Generator, Number(v))} type="number" unit="ct/kWh" step="0.1" />
            <InputField label="Abgasverluste" value={(entity as BoilerGenerator).flueGasLosses} onChange={(v) => updateField('flueGasLosses' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
            <CheckboxField label="Brennwertgerät" checked={(entity as BoilerGenerator).condensing} onChange={(v) => updateField('condensing' as keyof Generator, v)} />
          </div>
        </Section>
      )}

      {entity.type === 'chiller' && (
        <Section title="Kältemaschinen-Daten" defaultOpen={true} badge="Kältemaschine">
          <div className="grid grid-cols-3 gap-4">
            <InputField label="Kälteleistung" value={(entity as ChillerGenerator).coolingPowerKw} onChange={(v) => updateField('coolingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
            <InputField label="Elektr. Aufnahme" value={(entity as ChillerGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
            <InputField label="EER" value={(entity as ChillerGenerator).eerRated} onChange={(v) => updateField('eerRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Energy Efficiency Ratio" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputField label="SEER" value={(entity as ChillerGenerator).seerRated} onChange={(v) => updateField('seerRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Seasonal EER" />
            <InputField label="Kältemittel" value={(entity as ChillerGenerator).refrigerant} onChange={(v) => updateField('refrigerant' as keyof Generator, v)} placeholder="z.B. R410A" />
            <InputField label="Kühlmedium" value={(entity as ChillerGenerator).coolantType} onChange={(v) => updateField('coolantType' as keyof Generator, v)} placeholder="z.B. Wasser/Glykol" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <InputField label="Vorlauftemp." value={(entity as ChillerGenerator).flowTemperatureC} onChange={(v) => updateField('flowTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
            <InputField label="Rücklauftemp." value={(entity as ChillerGenerator).returnTemperatureC} onChange={(v) => updateField('returnTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
            <InputField label="Modulation Min" value={(entity as ChillerGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
            <InputField label="Modulation Max" value={(entity as ChillerGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
          </div>
        </Section>
      )}

      <CommunicationForm
        config={entity.communication}
        onChange={(c) => updateField('communication' as keyof Generator, c as never)}
      />

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => updateField('notes', v)} placeholder="Freitext für zusätzliche Informationen..." />
      </Section>
    </>
  )
}
