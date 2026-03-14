"""
Preset-Schema — Validierung und Typen fuer Geraeteprofile.

Ein Preset beschreibt die komplette Kommunikations-Konfiguration eines
bestimmten Geraetemodells: Register-Map (Modbus), Endpoints (HTTP),
Topics (MQTT), Schreibzugriffe und berechnete Werte.
"""

from dataclasses import dataclass, field


@dataclass
class PresetRegister:
    """Ein einzelner Datenpunkt (Register/Feld) im Preset."""
    offset: int = 0
    metric: str = ""
    unit: str = ""
    scale: float = 1.0
    data_type: str = "int16"
    writable: bool = False


@dataclass
class PresetRegisterGroup:
    """Gruppe von Registern mit gemeinsamer Basisadresse."""
    name: str = ""
    base_address: int = 0
    source: str = ""              # Measurement-Source (z.B. "outdoor", "heat_pump")
    source_template: str = ""     # Fuer wiederholbare Gruppen: "hp_{instance}"
    repeatable: bool = False      # Kann mehrere Instanzen haben (WP 1-3, HK 1-12)
    max_instances: int = 1
    instance_offset: int = 100    # Adress-Offset zwischen Instanzen
    probe_offset: int = 3         # Register-Offset fuer Auto-Detection
    registers: list[dict] = field(default_factory=list)


@dataclass
class PresetWriteEntry:
    """Ein beschreibbarer Stellwert."""
    address: int = 0
    scale: float = 1.0
    data_type: str = "int16"


@dataclass
class PresetSetpointRoute:
    """Routing: Controller-Setpoint → Geraete-Schreibbefehl."""
    target: str = ""          # Key in write_map
    transform: str = ""       # z.B. "value * 1000"


@dataclass
class PresetEndpoint:
    """HTTP/REST Endpoint fuer ein Geraet."""
    name: str = ""
    path: str = ""
    method: str = "GET"
    source: str = ""
    value_mappings: list[dict] = field(default_factory=list)


@dataclass
class PresetComputedValue:
    """Berechneter Wert aus anderen Messwerten."""
    metric: str = ""
    source_metric: str = ""
    transform: str = ""       # z.B. "value / 1000"


@dataclass
class DevicePreset:
    """Vollstaendiges Geraeteprofil."""
    id: str = ""
    manufacturer: str = ""
    model: str = ""
    category: str = ""        # heat_pump, inverter, battery, meter, wallbox, boiler, chp
    protocol: str = ""        # modbus_tcp, http_rest, mqtt, sunspec, ...
    version: str = "1.0"
    description: str = ""

    # Default-Verbindungsparameter
    defaults: dict = field(default_factory=dict)

    # Modbus: Register-Gruppen
    register_groups: list[dict] = field(default_factory=list)

    # HTTP: Endpoints
    endpoints: list[dict] = field(default_factory=list)

    # MQTT: Topics
    mqtt_topics: list[dict] = field(default_factory=list)

    # Schreibbare Stellgroessen
    write_map: dict = field(default_factory=dict)

    # Controller-Setpoint → Geraete-Befehl Routing
    setpoint_routing: dict = field(default_factory=dict)

    # Berechnete Werte
    computed_values: list[dict] = field(default_factory=list)

    # Zustandstexte
    state_maps: dict = field(default_factory=dict)


def validate_preset(data: dict) -> DevicePreset:
    """Validiert und konvertiert ein Preset-Dict in ein DevicePreset."""
    required = ["id", "manufacturer", "model", "category", "protocol"]
    for key in required:
        if key not in data:
            raise ValueError(f"Preset fehlt Pflichtfeld: {key}")

    return DevicePreset(
        id=data["id"],
        manufacturer=data["manufacturer"],
        model=data["model"],
        category=data["category"],
        protocol=data["protocol"],
        version=data.get("version", "1.0"),
        description=data.get("description", ""),
        defaults=data.get("defaults", {}),
        register_groups=data.get("register_groups", []),
        endpoints=data.get("endpoints", []),
        mqtt_topics=data.get("mqtt_topics", []),
        write_map=data.get("write_map", {}),
        setpoint_routing=data.get("setpoint_routing", {}),
        computed_values=data.get("computed_values", []),
        state_maps=data.get("state_maps", {}),
    )
