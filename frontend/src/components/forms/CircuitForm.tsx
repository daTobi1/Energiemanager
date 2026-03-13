import { InputField, SelectField, CheckboxField, TextareaField, Section } from '../ui/FormField'
import type { HeatingCoolingCircuit, CircuitType, DistributionType, PumpType, ControllableComponent, CommunicationConfig, EnergyPort } from '../../types'
import { createDefaultControllableComponent } from '../../types'
import { mkPort } from '../ui/PortEditor'

const circuitTypeOptions = [
  { value: 'heating', label: 'Heizkreis' },
  { value: 'cooling', label: 'Kältekreis' },
  { value: 'combined', label: 'Kombiniert (Heizen & Kühlen)' },
]

const distributionOptions = [
  { value: 'floor_heating', label: 'Fußbodenheizung' },
  { value: 'radiator', label: 'Heizkörper' },
  { value: 'fan_coil', label: 'Gebläsekonvektor (Fan Coil)' },
  { value: 'ceiling_cooling', label: 'Deckenstrahlplatten' },
  { value: 'mixed', label: 'Gemischt' },
]

const pumpTypeOptions = [
  { value: 'fixed_speed', label: 'Konstantdrehzahl' },
  { value: 'variable_speed', label: 'Drehzahlgeregelt' },
  { value: 'high_efficiency', label: 'Hocheffizienz (HE)' },
]

export function createDefaultCircuitPorts(type: CircuitType): EnergyPort[] {
  switch (type) {
    case 'heating':  return [mkPort('input', 'heat', 'Wärme'), mkPort('output', 'heat', 'Wärmeabgabe')]
    case 'cooling':  return [mkPort('input', 'cold', 'Kälte'), mkPort('output', 'cold', 'Kälteabgabe')]
    case 'combined': return [mkPort('input', 'heat', 'Wärme'), mkPort('input', 'cold', 'Kälte'), mkPort('output', 'heat', 'Wärmeabgabe'), mkPort('output', 'cold', 'Kälteabgabe')]
  }
}

function CompactCommConfig({ config, onChange }: { config: CommunicationConfig; onChange: (c: CommunicationConfig) => void }) {
  const protocolOptions = [
    { value: 'modbus_tcp', label: 'Modbus TCP' },
    { value: 'sunspec', label: 'SunSpec' },
    { value: 'mqtt', label: 'MQTT' },
    { value: 'http_rest', label: 'HTTP/REST' },
    { value: 'bacnet_ip', label: 'BACnet/IP' },
    { value: 'knx_ip', label: 'KNX/IP' },
    { value: 'opc_ua', label: 'OPC UA' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 mt-2">
      <SelectField label="Protokoll" value={config.protocol} onChange={(v) => onChange({ ...config, protocol: v as CommunicationConfig['protocol'] })} options={protocolOptions} />
      <InputField label="IP-Adresse" value={config.ipAddress} onChange={(v) => onChange({ ...config, ipAddress: v })} placeholder="192.168.1.x" />
      <InputField label="Port" value={config.port} onChange={(v) => onChange({ ...config, port: Number(v) })} type="number" />
    </div>
  )
}

function ControllableBlock({ label, hint, component, onChange }: {
  label: string; hint: string; component: ControllableComponent; onChange: (c: ControllableComponent) => void
}) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${component.enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-dark-bg border-dark-border'}`}>
      <CheckboxField
        label={label} checked={component.enabled}
        onChange={(v) => onChange(v ? { ...component, enabled: true } : { ...createDefaultControllableComponent(), enabled: false })}
        hint={hint}
      />
      {component.enabled && (
        <CompactCommConfig config={component.communication} onChange={(c) => onChange({ ...component, communication: c })} />
      )}
    </div>
  )
}

interface Props {
  entity: HeatingCoolingCircuit
  onChange: (entity: HeatingCoolingCircuit) => void
}

export function CircuitForm({ entity, onChange }: Props) {
  const update = <K extends keyof HeatingCoolingCircuit>(key: K, value: HeatingCoolingCircuit[K]) => {
    onChange({ ...entity, [key]: value })
  }

  const countActive = () => {
    let n = 0
    if (entity.flowTempSetpoint.enabled) n++
    if (entity.mixerValve.enabled) n++
    if (entity.pumpControl.enabled) n++
    if (entity.zoneValves.enabled) n++
    return n
  }

  return (
    <>
      <Section title="Grunddaten" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Bezeichnung" value={entity.name} onChange={(v) => update('name', v)} placeholder="z.B. FBH Erdgeschoss, Heizkörper OG" />
          <SelectField label="Typ" value={entity.type} onChange={(v) => { update('type', v as CircuitType); update('ports', createDefaultCircuitPorts(v as CircuitType)) }} options={circuitTypeOptions} />
        </div>
        <SelectField label="Verteilsystem" value={entity.distributionType} onChange={(v) => {
          const dt = v as DistributionType
          const updates: Partial<HeatingCoolingCircuit> = { distributionType: dt }
          if (dt === 'floor_heating') {
            updates.flowTemperatureC = 35; updates.returnTemperatureC = 28
            updates.heatingCurve = { steepness: 0.6, parallelShift: entity.heatingCurve.parallelShift }
          } else if (dt === 'radiator') {
            updates.flowTemperatureC = 55; updates.returnTemperatureC = 45
            updates.heatingCurve = { steepness: 1.4, parallelShift: entity.heatingCurve.parallelShift }
          } else if (dt === 'fan_coil' || dt === 'ceiling_cooling') {
            updates.flowTemperatureC = 16; updates.returnTemperatureC = 20
            updates.heatingCurve = { steepness: 0.4, parallelShift: entity.heatingCurve.parallelShift }
          }
          onChange({ ...entity, ...updates })
        }} options={distributionOptions} info="Art der Wärme-/Kälteabgabe im Raum. Temperaturen und Heizkurve werden automatisch vorbelegt." />
      </Section>

      <Section title="Regelung" defaultOpen={true} badge={entity.controllable ? `${countActive()} Komponenten` : undefined}>
        <CheckboxField label="Regelkreis regelbar" checked={entity.controllable} onChange={(v) => update('controllable', v)} hint="Kann vom EMS aktiv geregelt werden" />
        {entity.controllable && (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-dark-faded">
              Welche Komponenten soll das EMS ansteuern? Jede Komponente kann über ein eigenes Busprotokoll angesprochen werden.
            </p>
            <ControllableBlock label="Vorlaufsollwert-Vorgabe" hint="EMS gibt die Vorlauftemperatur vor (Standard-Regelgröße)" component={entity.flowTempSetpoint} onChange={(c) => update('flowTempSetpoint', c)} />
            <ControllableBlock label="Mischventil" hint="Motorischer Mischer zur Vorlauftemperatur-Regelung" component={entity.mixerValve} onChange={(c) => update('mixerValve', c)} />
            <ControllableBlock label="Umwälzpumpe" hint="Pumpe ein/aus oder Drehzahlregelung" component={entity.pumpControl} onChange={(c) => update('pumpControl', c)} />
            <ControllableBlock label="Zonenventile / Stellantriebe" hint="Einzelraumregelung über Stellventile an Verteilern" component={entity.zoneValves} onChange={(c) => update('zoneValves', c)} />
          </div>
        )}
      </Section>

      <Section title="Temperaturen" defaultOpen={true}>
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Vorlauftemperatur" value={entity.flowTemperatureC} onChange={(v) => update('flowTemperatureC', Number(v))} type="number" unit="°C" info="Auslegungsvorlauftemperatur des Kreises" />
          <InputField label="Rücklauftemperatur" value={entity.returnTemperatureC} onChange={(v) => update('returnTemperatureC', Number(v))} type="number" unit="°C" info="Auslegungsrücklauftemperatur" />
          <InputField label="Auslegungsaußentemp." value={entity.designOutdoorTemperatureC} onChange={(v) => update('designOutdoorTemperatureC', Number(v))} type="number" unit="°C" info="Normaußentemperatur für die Heizlastberechnung (z.B. -12°C für München)" />
        </div>
      </Section>

      {(entity.type === 'heating' || entity.type === 'combined') && (
        <Section title="Heizkurve" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Steilheit" value={entity.heatingCurve.steepness} onChange={(v) => update('heatingCurve', { ...entity.heatingCurve, steepness: Number(v) })} type="number" step="0.1" min={0.2} max={3.0} info="Steilheit der Heizkurve. Niedrig (0.4-0.8) für FBH, hoch (1.0-1.8) für Heizkörper." />
            <InputField label="Parallelverschiebung" value={entity.heatingCurve.parallelShift} onChange={(v) => update('heatingCurve', { ...entity.heatingCurve, parallelShift: Number(v) })} type="number" step="0.5" min={-5} max={5} unit="K" info="Verschiebt die gesamte Heizkurve nach oben (+) oder unten (-)" />
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border mt-2">
            <p className="text-xs text-dark-faded mb-1">Berechnete Vorlauftemperaturen (Heizkurve):</p>
            <div className="flex gap-4 text-xs text-dark-muted">
              {[-10, -5, 0, 5, 10, 15].map((outdoor) => {
                const vl = Math.round(20 + entity.heatingCurve.steepness * (20 - outdoor) + entity.heatingCurve.parallelShift)
                return (
                  <span key={outdoor}>
                    {outdoor}°C → <strong className="text-dark-text">{vl}°C</strong>
                  </span>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      <Section title="Umwälzpumpe" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Pumpentyp" value={entity.pumpType} onChange={(v) => update('pumpType', v as PumpType)} options={pumpTypeOptions} info="Hocheffizienzpumpen sparen bis zu 80% Pumpenstrom" />
          <InputField label="Pumpenleistung" value={entity.pumpPowerW} onChange={(v) => update('pumpPowerW', Number(v))} type="number" unit="W" info="Elektrische Leistungsaufnahme der Umwälzpumpe" />
        </div>
      </Section>

      <Section title="Notizen" defaultOpen={false}>
        <TextareaField label="Bemerkungen" value={entity.notes} onChange={(v) => update('notes', v)} />
      </Section>
    </>
  )
}
