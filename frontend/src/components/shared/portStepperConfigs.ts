/**
 * Port stepper configuration for the PropertiesPanels.
 * Defines which port groups each node type has and their constraints.
 */
export interface PortStepperDef {
  key: string
  label: string
  default: number
  min: number
  max: number
}

export const hydraulicPortConfigs: Record<string, PortStepperDef[]> = {
  boiler: [
    { key: 'portsGasLeft', label: 'Gas (links)', default: 1, min: 1, max: 4 },
    { key: 'portsHeatRight', label: 'Wärme (rechts)', default: 1, min: 1, max: 4 },
  ],
  heat_pump: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
    { key: 'portsSourceLeft', label: 'Quelle (links)', default: 1, min: 1, max: 4 },
    { key: 'portsHeatRight', label: 'Wärme (rechts)', default: 1, min: 1, max: 4 },
  ],
  chp: [
    { key: 'portsGasLeft', label: 'Gas (links)', default: 1, min: 1, max: 4 },
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
    { key: 'portsHeatRight', label: 'Wärme (rechts)', default: 1, min: 1, max: 4 },
  ],
  chiller: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
    { key: 'portsColdRight', label: 'Kälte (rechts)', default: 1, min: 1, max: 4 },
  ],
  thermal_heat: [
    { key: 'portsHeatLeft', label: 'Wärme links', default: 1, min: 1, max: 4 },
    { key: 'portsHeatRight', label: 'Wärme rechts', default: 1, min: 1, max: 4 },
  ],
  thermal_cold: [
    { key: 'portsHeatLeft', label: 'Kälte links', default: 1, min: 1, max: 4 },
    { key: 'portsHeatRight', label: 'Kälte rechts', default: 1, min: 1, max: 4 },
  ],
  hydraulic_separator: [
    { key: 'portsLeft', label: 'Erzeuger (links)', default: 1, min: 1, max: 6 },
    { key: 'portsRight', label: 'Verbraucher (rechts)', default: 3, min: 1, max: 6 },
  ],
  grid: [
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
  ],
  pv: [
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
  ],
  battery: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
  ],
  circuit: [
    { key: 'portsHeatLeft', label: 'Wärme (links)', default: 1, min: 1, max: 4 },
    { key: 'portsCircuitRight', label: 'Heizkreis (rechts)', default: 1, min: 1, max: 4 },
  ],
  consumer: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
  ],
  pump: [
    { key: 'portsFlowLeft', label: 'Zufluss (links)', default: 1, min: 1, max: 3 },
    { key: 'portsFlowRight', label: 'Abfluss (rechts)', default: 1, min: 1, max: 3 },
  ],
  mixer: [
    { key: 'portsHeatLeft', label: 'Vorlauf (links)', default: 1, min: 1, max: 3 },
    { key: 'portsReturnBottom', label: 'Rücklauf (unten)', default: 1, min: 1, max: 3 },
    { key: 'portsFlowRight', label: 'Gemischt (rechts)', default: 1, min: 1, max: 3 },
  ],
  meter: [
    { key: 'portsMeterLeft', label: 'Eingang (links)', default: 1, min: 1, max: 3 },
    { key: 'portsMeterRight', label: 'Ausgang (rechts)', default: 1, min: 1, max: 3 },
  ],
  sensor: [
    { key: 'portsMeterLeft', label: 'Eingang (links)', default: 1, min: 1, max: 3 },
    { key: 'portsMeterRight', label: 'Ausgang (rechts)', default: 1, min: 1, max: 3 },
  ],
  room: [
    { key: 'portsCircuitLeft', label: 'Heizkreis (links)', default: 1, min: 1, max: 4 },
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
  ],
  solar_thermal: [
    { key: 'portsHeatRight', label: 'Wärme (rechts)', default: 1, min: 1, max: 4 },
  ],
  electrical_bus: [
    { key: 'portsTop', label: 'Eingänge (oben)', default: 3, min: 1, max: 8 },
    { key: 'portsBottom', label: 'Abgänge (unten)', default: 4, min: 1, max: 8 },
  ],
  ground_source: [
    { key: 'portsSourceRight', label: 'Quelle (rechts)', default: 1, min: 1, max: 4 },
  ],
  air_source: [
    { key: 'portsSourceRight', label: 'Quelle (rechts)', default: 1, min: 1, max: 4 },
  ],
  well_source: [
    { key: 'portsSourceRight', label: 'Quelle (rechts)', default: 1, min: 1, max: 4 },
  ],
}

export const electricalPortConfigs: Record<string, PortStepperDef[]> = {
  transformer: [
    { key: 'portsElecTop', label: 'Netz (oben)', default: 1, min: 1, max: 4 },
    { key: 'portsElecBottom', label: 'Abgänge (unten)', default: 1, min: 1, max: 4 },
  ],
  pv_inverter: [
    { key: 'portsElecRight', label: 'AC-Ausgang (rechts)', default: 1, min: 1, max: 4 },
  ],
  battery_system: [
    { key: 'portsElecRight', label: 'AC (rechts)', default: 1, min: 1, max: 4 },
  ],
  generator: [
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
  ],
  motor_load: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
  ],
  wallbox: [
    { key: 'portsElecLeft', label: 'Strom (links)', default: 1, min: 1, max: 4 },
  ],
  consumer_load: [
    { key: 'portsElecTop', label: 'Strom (oben)', default: 1, min: 1, max: 4 },
  ],
  circuit_breaker: [
    { key: 'portsElecTop', label: 'Eingang (oben)', default: 1, min: 1, max: 3 },
    { key: 'portsElecBottom', label: 'Ausgang (unten)', default: 1, min: 1, max: 3 },
  ],
  elec_meter: [
    { key: 'portsElecLeft', label: 'Eingang (links)', default: 1, min: 1, max: 3 },
    { key: 'portsElecRight', label: 'Ausgang (rechts)', default: 1, min: 1, max: 3 },
  ],
  elec_bus: [
    { key: 'portsTop', label: 'Eingänge (oben)', default: 3, min: 1, max: 12 },
    { key: 'portsBottom', label: 'Abgänge (unten)', default: 4, min: 1, max: 12 },
  ],
  sub_distribution: [
    { key: 'outputs', label: 'LS-Abgänge', default: 4, min: 1, max: 12 },
  ],
  wind_turbine: [
    { key: 'portsMeterLeft', label: 'Messung (links)', default: 1, min: 1, max: 3 },
    { key: 'portsElecRight', label: 'Strom (rechts)', default: 1, min: 1, max: 4 },
  ],
}
