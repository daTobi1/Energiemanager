import { InputField, SelectField, Section } from './FormField'
import { Wifi } from 'lucide-react'
import type { CommunicationConfig } from '../../types'
import { createDefaultModbus, createDefaultMqtt, createDefaultHttp } from '../../types'

const protocolOptions = [
  { value: 'modbus_tcp', label: 'Modbus TCP' },
  { value: 'sunspec', label: 'SunSpec (Modbus TCP)' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'http_rest', label: 'HTTP / REST' },
  { value: 'bacnet_ip', label: 'BACnet/IP' },
  { value: 'knx_ip', label: 'KNX/IP' },
  { value: 'opc_ua', label: 'OPC UA' },
  { value: 'sml_tcp', label: 'SML (Smart Meter)' },
  { value: 'mbus_tcp', label: 'M-Bus (TCP Gateway)' },
  { value: 'ocpp', label: 'OCPP (Ladestation)' },
]

const defaultPorts: Record<string, number> = {
  modbus_tcp: 502,
  sunspec: 502,
  mqtt: 1883,
  http_rest: 80,
  bacnet_ip: 47808,
  knx_ip: 3671,
  opc_ua: 4840,
  sml_tcp: 7000,
  mbus_tcp: 10001,
  ocpp: 9000,
}

interface Props {
  config: CommunicationConfig
  onChange: (config: CommunicationConfig) => void
  defaultOpen?: boolean
}

export function CommunicationForm({ config, onChange, defaultOpen = false }: Props) {
  const update = (partial: Partial<CommunicationConfig>) => {
    onChange({ ...config, ...partial })
  }

  const handleProtocolChange = (protocol: string) => {
    const port = defaultPorts[protocol] ?? 502
    const newConfig: CommunicationConfig = { ...config, protocol: protocol as CommunicationConfig['protocol'], port }
    if (protocol === 'modbus_tcp' || protocol === 'sunspec') {
      newConfig.modbus = newConfig.modbus ?? createDefaultModbus()
    }
    if (protocol === 'mqtt') {
      newConfig.mqtt = newConfig.mqtt ?? createDefaultMqtt()
    }
    if (protocol === 'http_rest') {
      newConfig.http = newConfig.http ?? createDefaultHttp()
    }
    onChange(newConfig)
  }

  return (
    <Section title="Kommunikation" icon={<Wifi className="w-4 h-4 text-blue-500" />} defaultOpen={defaultOpen}>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Protokoll"
          value={config.protocol}
          onChange={handleProtocolChange}
          options={protocolOptions}
        />
        <InputField
          label="Abfrage-Intervall"
          value={config.pollingIntervalSeconds}
          onChange={(v) => update({ pollingIntervalSeconds: Number(v) || 5 })}
          type="number"
          unit="s"
          min={1}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="IP-Adresse"
          value={config.ipAddress}
          onChange={(v) => update({ ipAddress: v })}
          placeholder="192.168.1.100"
        />
        <InputField
          label="Port"
          value={config.port}
          onChange={(v) => update({ port: Number(v) || 0 })}
          type="number"
        />
      </div>

      {/* Modbus TCP / SunSpec */}
      {(config.protocol === 'modbus_tcp' || config.protocol === 'sunspec') && (
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-700">
            {config.protocol === 'sunspec' ? 'SunSpec / Modbus' : 'Modbus'}-Einstellungen
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <InputField
              label="Unit ID"
              value={config.modbus?.unitId ?? 1}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, unitId: Number(v) || 1 } })}
              type="number"
              min={1}
              max={247}
            />
            <InputField
              label="Register-Adresse"
              value={config.modbus?.registerAddress ?? 0}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, registerAddress: Number(v) || 0 } })}
              type="number"
            />
            <InputField
              label="Anzahl Register"
              value={config.modbus?.registerCount ?? 2}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, registerCount: Number(v) || 1 } })}
              type="number"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <SelectField
              label="Register-Typ"
              value={config.modbus?.registerType ?? 'holding'}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, registerType: v as 'holding' | 'input' | 'coil' | 'discrete' } })}
              options={[
                { value: 'holding', label: 'Holding' },
                { value: 'input', label: 'Input' },
                { value: 'coil', label: 'Coil' },
                { value: 'discrete', label: 'Discrete' },
              ]}
            />
            <SelectField
              label="Datentyp"
              value={config.modbus?.dataType ?? 'float32'}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, dataType: v as 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64' } })}
              options={[
                { value: 'int16', label: 'INT16' },
                { value: 'uint16', label: 'UINT16' },
                { value: 'int32', label: 'INT32' },
                { value: 'uint32', label: 'UINT32' },
                { value: 'float32', label: 'FLOAT32' },
                { value: 'float64', label: 'FLOAT64' },
              ]}
            />
            <InputField
              label="Skalierung"
              value={config.modbus?.scaleFactor ?? 1}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, scaleFactor: Number(v) || 1 } })}
              type="number"
              step="0.001"
            />
            <SelectField
              label="Byte-Order"
              value={config.modbus?.byteOrder ?? 'big_endian'}
              onChange={(v) => update({ modbus: { ...createDefaultModbus(), ...config.modbus, byteOrder: v as 'big_endian' | 'little_endian' } })}
              options={[
                { value: 'big_endian', label: 'Big Endian' },
                { value: 'little_endian', label: 'Little Endian' },
              ]}
            />
          </div>
        </div>
      )}

      {/* MQTT */}
      {config.protocol === 'mqtt' && (
        <div className="space-y-3 p-4 bg-green-50 rounded-lg">
          <h4 className="text-sm font-semibold text-green-700">MQTT-Einstellungen</h4>
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Topic"
              value={config.mqtt?.topic ?? ''}
              onChange={(v) => update({ mqtt: { ...createDefaultMqtt(), ...config.mqtt, topic: v } })}
              placeholder="energy/pv/power"
            />
            <SelectField
              label="QoS"
              value={String(config.mqtt?.qos ?? 0)}
              onChange={(v) => update({ mqtt: { ...createDefaultMqtt(), ...config.mqtt, qos: Number(v) as 0 | 1 | 2 } })}
              options={[
                { value: '0', label: '0 — At most once' },
                { value: '1', label: '1 — At least once' },
                { value: '2', label: '2 — Exactly once' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Payload-Format"
              value={config.mqtt?.payloadFormat ?? 'json'}
              onChange={(v) => update({ mqtt: { ...createDefaultMqtt(), ...config.mqtt, payloadFormat: v as 'json' | 'plain' | 'xml' } })}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'plain', label: 'Klartext' },
                { value: 'xml', label: 'XML' },
              ]}
            />
            <InputField
              label="JSON-Pfad"
              value={config.mqtt?.valueJsonPath ?? ''}
              onChange={(v) => update({ mqtt: { ...createDefaultMqtt(), ...config.mqtt, valueJsonPath: v } })}
              placeholder="$.power"
              hint="JSONPath zum Wert"
            />
          </div>
        </div>
      )}

      {/* HTTP REST */}
      {config.protocol === 'http_rest' && (
        <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
          <h4 className="text-sm font-semibold text-purple-700">HTTP/REST-Einstellungen</h4>
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Basis-URL"
              value={config.http?.baseUrl ?? ''}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, baseUrl: v } })}
              placeholder="http://192.168.1.100"
            />
            <InputField
              label="Endpoint"
              value={config.http?.endpoint ?? ''}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, endpoint: v } })}
              placeholder="/api/status"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="Methode"
              value={config.http?.method ?? 'GET'}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, method: v as 'GET' | 'POST' | 'PUT' } })}
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
              ]}
            />
            <SelectField
              label="Authentifizierung"
              value={config.http?.authType ?? 'none'}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, authType: v as 'none' | 'basic' | 'bearer' | 'api_key' } })}
              options={[
                { value: 'none', label: 'Keine' },
                { value: 'basic', label: 'Basic Auth' },
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'api_key', label: 'API Key' },
              ]}
            />
            <InputField
              label="JSON-Pfad"
              value={config.http?.responseJsonPath ?? ''}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, responseJsonPath: v } })}
              placeholder="$.data.power"
            />
          </div>
          {config.http?.authType === 'basic' && (
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Benutzername" value={config.http?.username ?? ''} onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, username: v } })} />
              <InputField label="Passwort" value={config.http?.password ?? ''} onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, password: v } })} type="password" />
            </div>
          )}
          {(config.http?.authType === 'bearer' || config.http?.authType === 'api_key') && (
            <InputField
              label={config.http.authType === 'bearer' ? 'Bearer Token' : 'API Key'}
              value={config.http?.apiKey ?? ''}
              onChange={(v) => update({ http: { ...createDefaultHttp(), ...config.http, apiKey: v } })}
              type="password"
            />
          )}
        </div>
      )}
    </Section>
  )
}
