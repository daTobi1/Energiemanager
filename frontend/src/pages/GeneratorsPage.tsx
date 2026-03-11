import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Edit2, Sun, Flame, Thermometer, Snowflake, X, Copy, ArrowLeft } from 'lucide-react'
import { ConfirmDelete } from '../components/ui/ConfirmDelete'
import { useEnergyStore } from '../store/useEnergyStore'
import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../components/ui/FormField'
import { CommunicationForm } from '../components/ui/CommunicationForm'
import { useCreateNavigation } from '../hooks/useCreateNavigation'
import type {
  Generator, GeneratorType, PvGenerator, ChpGenerator,
  HeatPumpGenerator, BoilerGenerator, ChillerGenerator,
  EnergyPort, PortEnergy,
} from '../types'
import { createDefaultCommunication } from '../types'
import { PortEditor, mkPort } from '../components/ui/PortEditor'

const typeOptions = [
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

const typeIcons: Record<GeneratorType, typeof Sun> = {
  pv: Sun,
  chp: Flame,
  heat_pump: Thermometer,
  boiler: Flame,
  chiller: Snowflake,
}

const typeColors: Record<GeneratorType, string> = {
  pv: 'bg-amber-500/15 text-amber-400',
  chp: 'bg-orange-500/15 text-orange-400',
  heat_pump: 'bg-red-500/15 text-red-400',
  boiler: 'bg-red-500/15 text-red-400',
  chiller: 'bg-blue-500/15 text-blue-400',
}

const typeLabels: Record<GeneratorType, string> = {
  pv: 'PV-Anlage',
  chp: 'BHKW',
  heat_pump: 'Wärmepumpe',
  boiler: 'Heizkessel',
  chiller: 'Kältemaschine',
}

const genNodeColors: Record<GeneratorType, string> = {
  pv: '#fef3c7', chp: '#ffedd5', heat_pump: '#fee2e2', boiler: '#fee2e2', chiller: '#dbeafe',
}

function createDefaultPorts(type: GeneratorType, coolingCapable = false): EnergyPort[] {
  switch (type) {
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
    id: uuid(),
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    commissioningDate: '',
    location: '',
    notes: '',
    communication: createDefaultCommunication(),
    assignedMeterIds: [],
    ports: createDefaultPorts(type),
  }
  switch (type) {
    case 'pv':
      return {
        ...base, type: 'pv', energyForm: 'electricity',
        peakPowerKwp: 10, numberOfModules: 25, moduleType: '', modulePowerWp: 400,
        inverterType: '', inverterPowerKw: 10, numberOfInverters: 1, mppTrackers: 2,
        azimuthDeg: 0, tiltDeg: 30, efficiency: 0.85,
        degradationPerYear: 0.5, temperatureCoefficient: -0.35, albedo: 0.2,
      }
    case 'chp':
      return {
        ...base, type: 'chp', energyForm: 'electricity_heat',
        electricalPowerKw: 5.5, thermalPowerKw: 12.5, fuelType: 'natural_gas',
        electricalEfficiency: 0.33, thermalEfficiency: 0.55, overallEfficiency: 0.88,
        modulationMinPercent: 50, modulationMaxPercent: 100,
        minimumRunTimeMin: 30, minimumOffTimeMin: 15, startCostEur: 0.50,
        maintenanceIntervalHours: 4000, currentOperatingHours: 0,
        fuelCostCtPerKwh: 8, powerToHeatRatio: 0.44,
      }
    case 'heat_pump':
      return {
        ...base, type: 'heat_pump', energyForm: 'heat',
        heatPumpType: 'air_water', heatingPowerKw: 10, coolingCapable: false,
        coolingPowerKw: 0, electricalPowerKw: 2.5, copRated: 4.0, copCurve: [
          { outdoorTempC: -15, cop: 2.2 }, { outdoorTempC: -7, cop: 2.8 },
          { outdoorTempC: 2, cop: 3.5 }, { outdoorTempC: 7, cop: 4.0 },
          { outdoorTempC: 15, cop: 4.8 }, { outdoorTempC: 20, cop: 5.2 },
        ],
        minOutdoorTempC: -25, maxOutdoorTempC: 40,
        flowTemperatureC: 35, returnTemperatureC: 28,
        modulationMinPercent: 30, modulationMaxPercent: 100,
        defrostPowerKw: 1.0, sgReadyEnabled: false,
        bivalencePointC: -5, refrigerant: 'R290',
      }
    case 'boiler':
      return {
        ...base, type: 'boiler', energyForm: 'heat',
        fuelType: 'natural_gas', nominalPowerKw: 20, efficiency: 0.95,
        modulationMinPercent: 30, modulationMaxPercent: 100,
        condensing: true, flowTemperatureMaxC: 80, returnTemperatureMinC: 30,
        minimumRunTimeMin: 5, fuelCostCtPerKwh: 8, flueGasLosses: 0.05,
      }
    case 'chiller':
      return {
        ...base, type: 'chiller', energyForm: 'cold',
        coolingPowerKw: 20, electricalPowerKw: 6, eerRated: 3.5, seerRated: 5.0,
        coolantType: 'Wasser/Glykol', refrigerant: 'R410A',
        flowTemperatureC: 6, returnTemperatureC: 12,
        modulationMinPercent: 25, modulationMaxPercent: 100,
        minOutdoorTempC: -10, maxOutdoorTempC: 45,
      }
  }
}

function getGeneratorSummary(g: Generator): string {
  switch (g.type) {
    case 'pv': return `${g.peakPowerKwp} kWp, ${g.numberOfModules} Module, ${g.azimuthDeg}° / ${g.tiltDeg}°`
    case 'chp': return `${g.electricalPowerKw} kW(el) / ${g.thermalPowerKw} kW(th)`
    case 'heat_pump': return `${g.heatingPowerKw} kW, COP ${g.copRated}, ${heatPumpTypeOptions.find(o => o.value === g.heatPumpType)?.label}`
    case 'boiler': return `${g.nominalPowerKw} kW, ${g.condensing ? 'Brennwert' : 'Heizwert'}`
    case 'chiller': return `${g.coolingPowerKw} kW, EER ${g.eerRated}`
  }
}

export default function GeneratorsPage() {
  const { generators, addGenerator, updateGenerator, removeGenerator } = useEnergyStore()
  const [editing, setEditing] = useState<Generator | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { isCreationTarget, saveAndReturn, cancelAndReturn, flowEditId, isFlowEdit, flowCreateNew, flowInitialValues, returnFromFlow } = useCreateNavigation()

  const startAdd = (type: GeneratorType) => {
    setEditing(createDefaultGenerator(type))
    setShowForm(true)
  }

  const startEdit = (g: Generator) => {
    setEditing({ ...g })
    setShowForm(true)
  }

  const duplicate = (g: Generator) => {
    const copy = { ...g, id: uuid(), name: g.name + ' (Kopie)' }
    addGenerator(copy as Generator)
  }

  // Auto-open form when this page is a creation target
  useEffect(() => {
    if (isCreationTarget && !showForm) {
      startAdd('pv') // default type for auto-open
    }
  }, [isCreationTarget])

  // Flow-Edit: Aus Energiefluss-Diagramm zum Bearbeiten navigiert
  useEffect(() => {
    if (flowEditId && !showForm) {
      const g = generators.find((g) => g.id === flowEditId)
      if (g) startEdit(g)
    }
  }, [flowEditId])

  // Flow-Create: Aus Energiefluss-Diagramm zum Erstellen navigiert
  useEffect(() => {
    if (flowCreateNew && !showForm) {
      startAdd('pv')
    }
  }, [flowCreateNew])


  const save = () => {
    if (!editing) return
    const exists = generators.find((g) => g.id === editing.id)
    if (exists) {
      updateGenerator(editing.id, editing)
    } else {
      addGenerator(editing)
    }

    // If we are a creation target, save and navigate back
    if (isCreationTarget) {
      saveAndReturn(editing.id)
      return
    }

    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }

    setShowForm(false)
    setEditing(null)
  }

  const cancel = () => {
    if (isCreationTarget) {
      cancelAndReturn()
      return
    }
    if (isFlowEdit || flowCreateNew) { returnFromFlow(); return }
    setShowForm(false)
    setEditing(null)
  }

  const updateField = <K extends keyof Generator>(key: K, value: Generator[K]) => {
    if (!editing) return
    setEditing({ ...editing, [key]: value } as Generator)
  }


  if (showForm && editing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header">
            {generators.find((g) => g.id === editing.id) ? 'Erzeuger bearbeiten' : 'Neuer Erzeuger'}
          </h1>
          <button onClick={cancel} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        {isCreationTarget && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">Erstelle neuen Erzeuger und kehre automatisch zurück</span>
          </div>
        )}
        {(isFlowEdit || flowCreateNew) && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400">{isFlowEdit ? 'Bearbeitung' : 'Erstellt'} aus Energiefluss — nach Speichern/Abbrechen zurück zum Diagramm</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Grunddaten */}
          <Section title="Grunddaten" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Typ"
                value={editing.type}
                onChange={(v) => {
                  const newGen = createDefaultGenerator(v as GeneratorType)
                  setEditing({ ...newGen, id: editing.id, name: editing.name, notes: editing.notes })
                }}
                options={typeOptions}
              />
              <InputField label="Name / Bezeichnung" value={editing.name} onChange={(v) => updateField('name', v)} placeholder="z.B. PV Süddach" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Hersteller" value={editing.manufacturer} onChange={(v) => updateField('manufacturer', v)} placeholder="z.B. SMA, Viessmann" />
              <InputField label="Modell" value={editing.model} onChange={(v) => updateField('model', v)} />
              <InputField label="Seriennummer" value={editing.serialNumber} onChange={(v) => updateField('serialNumber', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Inbetriebnahme" value={editing.commissioningDate} onChange={(v) => updateField('commissioningDate', v)} type="date" />
              <InputField label="Standort / Position" value={editing.location} onChange={(v) => updateField('location', v)} placeholder="z.B. Dach Gebäude A" />
            </div>
            <p className="text-xs text-dark-faded mt-2">Zähler- und Gerätezuordnungen werden im <a href="/energy-flow" className="text-emerald-400 hover:underline">Energiefluss-Diagramm</a> per Drag & Drop hergestellt.</p>
          </Section>

          {/* PV-spezifische Felder */}
          {editing.type === 'pv' && (
            <>
              <Section title="PV-Module" defaultOpen={true} badge="Photovoltaik">
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Peak-Leistung" value={(editing as PvGenerator).peakPowerKwp} onChange={(v) => updateField('peakPowerKwp' as keyof Generator, Number(v))} type="number" unit="kWp" step="0.1" />
                  <InputField label="Anzahl Module" value={(editing as PvGenerator).numberOfModules} onChange={(v) => updateField('numberOfModules' as keyof Generator, Number(v))} type="number" />
                  <InputField label="Modulleistung" value={(editing as PvGenerator).modulePowerWp} onChange={(v) => updateField('modulePowerWp' as keyof Generator, Number(v))} type="number" unit="Wp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Modultyp / Hersteller" value={(editing as PvGenerator).moduleType} onChange={(v) => updateField('moduleType' as keyof Generator, v)} placeholder="z.B. JA Solar JAM72S30-540" />
                  <InputField label="MPP-Tracker" value={(editing as PvGenerator).mppTrackers} onChange={(v) => updateField('mppTrackers' as keyof Generator, Number(v))} type="number" min={1} />
                </div>
              </Section>

              <Section title="Wechselrichter" defaultOpen={true}>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Wechselrichter-Typ" value={(editing as PvGenerator).inverterType} onChange={(v) => updateField('inverterType' as keyof Generator, v)} placeholder="z.B. SMA Sunny Tripower 10.0" />
                  <InputField label="WR-Leistung" value={(editing as PvGenerator).inverterPowerKw} onChange={(v) => updateField('inverterPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                  <InputField label="Anzahl WR" value={(editing as PvGenerator).numberOfInverters} onChange={(v) => updateField('numberOfInverters' as keyof Generator, Number(v))} type="number" min={1} />
                </div>
              </Section>

              <Section title="Ausrichtung & Leistungsparameter" defaultOpen={true}>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Azimut" value={(editing as PvGenerator).azimuthDeg} onChange={(v) => updateField('azimuthDeg' as keyof Generator, Number(v))} type="number" unit="°" hint="0°=Süd, -90°=Ost, 90°=West" min={-180} max={180} />
                  <InputField label="Neigung" value={(editing as PvGenerator).tiltDeg} onChange={(v) => updateField('tiltDeg' as keyof Generator, Number(v))} type="number" unit="°" hint="0°=horizontal, 90°=vertikal" min={0} max={90} />
                  <InputField label="Albedo" value={(editing as PvGenerator).albedo} onChange={(v) => updateField('albedo' as keyof Generator, Number(v))} type="number" step="0.05" hint="Bodenreflexion (0.2 = Gras)" min={0} max={1} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="System-Wirkungsgrad" value={(editing as PvGenerator).efficiency} onChange={(v) => updateField('efficiency' as keyof Generator, Number(v))} type="number" step="0.01" hint="Gesamtwirkungsgrad inkl. Verluste" min={0} max={1} />
                  <InputField label="Degradation" value={(editing as PvGenerator).degradationPerYear} onChange={(v) => updateField('degradationPerYear' as keyof Generator, Number(v))} type="number" unit="%/Jahr" step="0.1" hint="Jährl. Leistungsabnahme" />
                  <InputField label="Temp.-Koeffizient" value={(editing as PvGenerator).temperatureCoefficient} onChange={(v) => updateField('temperatureCoefficient' as keyof Generator, Number(v))} type="number" unit="%/°C" step="0.01" hint="Leistungsänderung pro °C" />
                </div>
              </Section>
            </>
          )}

          {/* BHKW-spezifische Felder */}
          {editing.type === 'chp' && (
            <>
              <Section title="Leistungsdaten" defaultOpen={true} badge="BHKW">
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Elektrische Leistung" value={(editing as ChpGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                  <InputField label="Thermische Leistung" value={(editing as ChpGenerator).thermalPowerKw} onChange={(v) => updateField('thermalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                  <InputField label="Stromkennzahl" value={(editing as ChpGenerator).powerToHeatRatio} onChange={(v) => updateField('powerToHeatRatio' as keyof Generator, Number(v))} type="number" step="0.01" hint="P_el / P_th" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Elektr. Wirkungsgrad" value={(editing as ChpGenerator).electricalEfficiency} onChange={(v) => updateField('electricalEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
                  <InputField label="Therm. Wirkungsgrad" value={(editing as ChpGenerator).thermalEfficiency} onChange={(v) => updateField('thermalEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
                  <InputField label="Gesamtwirkungsgrad" value={(editing as ChpGenerator).overallEfficiency} onChange={(v) => updateField('overallEfficiency' as keyof Generator, Number(v))} type="number" step="0.01" hint="η_el + η_th" min={0} max={1} />
                </div>
              </Section>

              <Section title="Brennstoff" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <SelectField label="Brennstoffart" value={(editing as ChpGenerator).fuelType} onChange={(v) => updateField('fuelType' as keyof Generator, v)} options={fuelOptions} />
                  <InputField label="Brennstoffkosten" value={(editing as ChpGenerator).fuelCostCtPerKwh} onChange={(v) => updateField('fuelCostCtPerKwh' as keyof Generator, Number(v))} type="number" unit="ct/kWh" step="0.1" />
                </div>
              </Section>

              <Section title="Betriebsparameter" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Modulation Min" value={(editing as ChpGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" min={0} max={100} />
                  <InputField label="Modulation Max" value={(editing as ChpGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" min={0} max={100} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Mindestlaufzeit" value={(editing as ChpGenerator).minimumRunTimeMin} onChange={(v) => updateField('minimumRunTimeMin' as keyof Generator, Number(v))} type="number" unit="min" hint="Min. Laufzeit nach Start" />
                  <InputField label="Mindeststillstandzeit" value={(editing as ChpGenerator).minimumOffTimeMin} onChange={(v) => updateField('minimumOffTimeMin' as keyof Generator, Number(v))} type="number" unit="min" hint="Min. Pause zwischen Starts" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Startkosten" value={(editing as ChpGenerator).startCostEur} onChange={(v) => updateField('startCostEur' as keyof Generator, Number(v))} type="number" unit="EUR" step="0.01" hint="Verschleiß pro Start" />
                  <InputField label="Wartungsintervall" value={(editing as ChpGenerator).maintenanceIntervalHours} onChange={(v) => updateField('maintenanceIntervalHours' as keyof Generator, Number(v))} type="number" unit="Bh" />
                  <InputField label="Aktuelle Betriebsstd." value={(editing as ChpGenerator).currentOperatingHours} onChange={(v) => updateField('currentOperatingHours' as keyof Generator, Number(v))} type="number" unit="h" />
                </div>
              </Section>
            </>
          )}

          {/* Wärmepumpe-spezifische Felder */}
          {editing.type === 'heat_pump' && (
            <>
              <Section title="Wärmepumpen-Typ & Leistung" defaultOpen={true} badge="Wärmepumpe">
                <div className="grid grid-cols-3 gap-4">
                  <SelectField label="Bauart" value={(editing as HeatPumpGenerator).heatPumpType} onChange={(v) => updateField('heatPumpType' as keyof Generator, v)} options={heatPumpTypeOptions} />
                  <InputField label="Heizleistung" value={(editing as HeatPumpGenerator).heatingPowerKw} onChange={(v) => updateField('heatingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" hint="bei Nennbedingungen" />
                  <InputField label="Elektr. Aufnahme" value={(editing as HeatPumpGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="COP (Nenn)" value={(editing as HeatPumpGenerator).copRated} onChange={(v) => updateField('copRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Coefficient of Performance" />
                  <InputField label="Kältemittel" value={(editing as HeatPumpGenerator).refrigerant} onChange={(v) => updateField('refrigerant' as keyof Generator, v)} placeholder="z.B. R290, R410A" />
                  <InputField label="Bivalenzpunkt" value={(editing as HeatPumpGenerator).bivalencePointC} onChange={(v) => updateField('bivalencePointC' as keyof Generator, Number(v))} type="number" unit="°C" hint="Ab hier Zuheizen nötig" />
                </div>
              </Section>

              <Section title="Temperaturen & Modulation" defaultOpen={true}>
                <div className="grid grid-cols-4 gap-4">
                  <InputField label="Vorlauftemp." value={(editing as HeatPumpGenerator).flowTemperatureC} onChange={(v) => updateField('flowTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
                  <InputField label="Rücklauftemp." value={(editing as HeatPumpGenerator).returnTemperatureC} onChange={(v) => updateField('returnTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
                  <InputField label="Min. Außentemp." value={(editing as HeatPumpGenerator).minOutdoorTempC} onChange={(v) => updateField('minOutdoorTempC' as keyof Generator, Number(v))} type="number" unit="°C" />
                  <InputField label="Max. Außentemp." value={(editing as HeatPumpGenerator).maxOutdoorTempC} onChange={(v) => updateField('maxOutdoorTempC' as keyof Generator, Number(v))} type="number" unit="°C" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Modulation Min" value={(editing as HeatPumpGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
                  <InputField label="Modulation Max" value={(editing as HeatPumpGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
                  <InputField label="Abtauleistung" value={(editing as HeatPumpGenerator).defrostPowerKw} onChange={(v) => updateField('defrostPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" hint="Nur Luft/Wasser" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxField label="Kühlung möglich (reversibel)" checked={(editing as HeatPumpGenerator).coolingCapable} onChange={(v) => updateField('coolingCapable' as keyof Generator, v)} />
                  <CheckboxField label="SG Ready Schnittstelle" checked={(editing as HeatPumpGenerator).sgReadyEnabled} onChange={(v) => updateField('sgReadyEnabled' as keyof Generator, v)} hint="Smart Grid Ready für PV-Eigenverbrauch" />
                </div>
                {(editing as HeatPumpGenerator).coolingCapable && (
                  <InputField label="Kühlleistung" value={(editing as HeatPumpGenerator).coolingPowerKw} onChange={(v) => updateField('coolingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" />
                )}
              </Section>

              <Section title="COP-Kennlinie" defaultOpen={false} badge={`${(editing as HeatPumpGenerator).copCurve.length} Punkte`}>
                <p className="text-sm text-dark-faded mb-3">COP-Werte bei verschiedenen Außentemperaturen (für selbstlernende Regelung)</p>
                {(editing as HeatPumpGenerator).copCurve.map((point, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 items-end">
                    <InputField label={i === 0 ? 'Außentemp.' : ''} value={point.outdoorTempC} onChange={(v) => {
                      const curve = [...(editing as HeatPumpGenerator).copCurve]
                      curve[i] = { ...curve[i], outdoorTempC: Number(v) }
                      updateField('copCurve' as keyof Generator, curve as never)
                    }} type="number" unit="°C" />
                    <InputField label={i === 0 ? 'COP' : ''} value={point.cop} onChange={(v) => {
                      const curve = [...(editing as HeatPumpGenerator).copCurve]
                      curve[i] = { ...curve[i], cop: Number(v) }
                      updateField('copCurve' as keyof Generator, curve as never)
                    }} type="number" step="0.1" />
                    <button
                      onClick={() => {
                        const curve = (editing as HeatPumpGenerator).copCurve.filter((_, j) => j !== i)
                        updateField('copCurve' as keyof Generator, curve as never)
                      }}
                      className="btn-danger mb-0.5"
                    >Entfernen</button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const curve = [...(editing as HeatPumpGenerator).copCurve, { outdoorTempC: 0, cop: 3.5 }]
                    updateField('copCurve' as keyof Generator, curve as never)
                  }}
                  className="btn-secondary text-sm mt-2"
                >+ Messpunkt hinzufügen</button>
              </Section>
            </>
          )}

          {/* Heizkessel-spezifische Felder */}
          {editing.type === 'boiler' && (
            <Section title="Kessel-Daten" defaultOpen={true} badge="Heizkessel">
              <div className="grid grid-cols-3 gap-4">
                <SelectField label="Brennstoffart" value={(editing as BoilerGenerator).fuelType} onChange={(v) => updateField('fuelType' as keyof Generator, v)} options={fuelOptions} />
                <InputField label="Nennleistung" value={(editing as BoilerGenerator).nominalPowerKw} onChange={(v) => updateField('nominalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                <InputField label="Wirkungsgrad" value={(editing as BoilerGenerator).efficiency} onChange={(v) => updateField('efficiency' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1.1} hint="Brennwert kann >1 sein" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Modulation Min" value={(editing as BoilerGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
                <InputField label="Modulation Max" value={(editing as BoilerGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Max. Vorlauftemp." value={(editing as BoilerGenerator).flowTemperatureMaxC} onChange={(v) => updateField('flowTemperatureMaxC' as keyof Generator, Number(v))} type="number" unit="°C" />
                <InputField label="Min. Rücklauftemp." value={(editing as BoilerGenerator).returnTemperatureMinC} onChange={(v) => updateField('returnTemperatureMinC' as keyof Generator, Number(v))} type="number" unit="°C" hint="Für Brennwert-Nutzung" />
                <InputField label="Mindestlaufzeit" value={(editing as BoilerGenerator).minimumRunTimeMin} onChange={(v) => updateField('minimumRunTimeMin' as keyof Generator, Number(v))} type="number" unit="min" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Brennstoffkosten" value={(editing as BoilerGenerator).fuelCostCtPerKwh} onChange={(v) => updateField('fuelCostCtPerKwh' as keyof Generator, Number(v))} type="number" unit="ct/kWh" step="0.1" />
                <InputField label="Abgasverluste" value={(editing as BoilerGenerator).flueGasLosses} onChange={(v) => updateField('flueGasLosses' as keyof Generator, Number(v))} type="number" step="0.01" min={0} max={1} />
                <CheckboxField label="Brennwertgerät" checked={(editing as BoilerGenerator).condensing} onChange={(v) => updateField('condensing' as keyof Generator, v)} />
              </div>
            </Section>
          )}

          {/* Kältemaschine-spezifische Felder */}
          {editing.type === 'chiller' && (
            <Section title="Kältemaschinen-Daten" defaultOpen={true} badge="Kältemaschine">
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Kälteleistung" value={(editing as ChillerGenerator).coolingPowerKw} onChange={(v) => updateField('coolingPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                <InputField label="Elektr. Aufnahme" value={(editing as ChillerGenerator).electricalPowerKw} onChange={(v) => updateField('electricalPowerKw' as keyof Generator, Number(v))} type="number" unit="kW" step="0.1" />
                <InputField label="EER" value={(editing as ChillerGenerator).eerRated} onChange={(v) => updateField('eerRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Energy Efficiency Ratio" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="SEER" value={(editing as ChillerGenerator).seerRated} onChange={(v) => updateField('seerRated' as keyof Generator, Number(v))} type="number" step="0.1" hint="Seasonal EER" />
                <InputField label="Kältemittel" value={(editing as ChillerGenerator).refrigerant} onChange={(v) => updateField('refrigerant' as keyof Generator, v)} placeholder="z.B. R410A" />
                <InputField label="Kühlmedium" value={(editing as ChillerGenerator).coolantType} onChange={(v) => updateField('coolantType' as keyof Generator, v)} placeholder="z.B. Wasser/Glykol" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <InputField label="Vorlauftemp." value={(editing as ChillerGenerator).flowTemperatureC} onChange={(v) => updateField('flowTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
                <InputField label="Rücklauftemp." value={(editing as ChillerGenerator).returnTemperatureC} onChange={(v) => updateField('returnTemperatureC' as keyof Generator, Number(v))} type="number" unit="°C" />
                <InputField label="Modulation Min" value={(editing as ChillerGenerator).modulationMinPercent} onChange={(v) => updateField('modulationMinPercent' as keyof Generator, Number(v))} type="number" unit="%" />
                <InputField label="Modulation Max" value={(editing as ChillerGenerator).modulationMaxPercent} onChange={(v) => updateField('modulationMaxPercent' as keyof Generator, Number(v))} type="number" unit="%" />
              </div>
            </Section>
          )}

          {/* Energie-Ports */}
          <PortEditor
            ports={editing.ports || []}
            onChange={(ports) => updateField('ports' as keyof Generator, ports as never)}
            onReset={() => updateField('ports' as keyof Generator, createDefaultPorts(editing.type, 'coolingCapable' in editing ? (editing as HeatPumpGenerator).coolingCapable : false) as never)}
            nodeName={editing.name || typeLabels[editing.type]}
            nodeColor={genNodeColors[editing.type]}
          />

          {/* Kommunikation */}
          <CommunicationForm
            config={editing.communication}
            onChange={(c) => updateField('communication' as keyof Generator, c as never)}
          />

          {/* Notizen */}
          <Section title="Notizen" defaultOpen={false}>
            <TextareaField label="Bemerkungen" value={editing.notes} onChange={(v) => updateField('notes', v)} placeholder="Freitext für zusätzliche Informationen..." />
          </Section>

          {/* Aktionen */}
          <div className="flex gap-3 pt-4 border-t">
            <button onClick={save} className="btn-primary" disabled={!editing.name}>Speichern</button>
            <button onClick={cancel} className="btn-secondary">Abbrechen</button>
          </div>
        </div>
      </div>
    )
  }

  // Listenansicht
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header">Erzeuger</h1>
          <p className="text-sm text-dark-faded mt-1">Alle Energieerzeuger der Anlage konfigurieren</p>
        </div>
      </div>

      {/* Typ-Auswahl zum Hinzufügen */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {typeOptions.map(({ value, label }) => {
          const Icon = typeIcons[value as GeneratorType]
          return (
            <button
              key={value}
              onClick={() => startAdd(value as GeneratorType)}
              className="card hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col items-center gap-2 py-4 cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColors[value as GeneratorType]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-center">{label}</span>
              <Plus className="w-4 h-4 text-dark-faded" />
            </button>
          )
        })}
      </div>

      {/* Liste */}
      {generators.length === 0 ? (
        <div className="card text-center py-12">
          <Sun className="w-12 h-12 text-dark-border mx-auto mb-3" />
          <p className="text-dark-faded">Noch keine Erzeuger konfiguriert</p>
          <p className="text-sm text-dark-faded mt-1">Wähle oben einen Typ aus, um einen Erzeuger hinzuzufügen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generators.map((g) => {
            const Icon = typeIcons[g.type]
            return (
              <div key={g.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${typeColors[g.type]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-text">{g.name || 'Unbenannt'}</h3>
                    <span className="px-2 py-0.5 bg-dark-hover text-dark-faded text-xs rounded-full">{typeLabels[g.type]}</span>
                  </div>
                  <p className="text-sm text-dark-faded mt-0.5">{getGeneratorSummary(g)}</p>
                  {g.manufacturer && <p className="text-xs text-dark-faded mt-0.5">{g.manufacturer} {g.model}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => duplicate(g)} className="btn-icon" title="Duplizieren"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(g)} className="btn-icon" title="Bearbeiten"><Edit2 className="w-4 h-4" /></button>
                  <ConfirmDelete onConfirm={() => removeGenerator(g.id)} itemName={g.name} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
