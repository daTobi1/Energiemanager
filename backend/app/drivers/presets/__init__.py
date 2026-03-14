"""
Preset-Registry — Laedt und verwaltet alle Geraeteprofile.

Scannt beim Import alle JSON-Dateien in den Unterverzeichnissen
und registriert sie im globalen Preset-Katalog.
"""

import json
import logging
from pathlib import Path

from app.drivers.presets._schema import DevicePreset, validate_preset

logger = logging.getLogger(__name__)

# Globaler Preset-Katalog: id → DevicePreset
_registry: dict[str, DevicePreset] = {}
_raw_data: dict[str, dict] = {}


def _load_all():
    """Scannt alle JSON-Dateien und laedt sie in die Registry."""
    preset_dir = Path(__file__).parent
    count = 0

    for json_file in preset_dir.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            preset = validate_preset(data)
            _registry[preset.id] = preset
            _raw_data[preset.id] = data
            count += 1
        except Exception as e:
            logger.warning("Preset %s fehlerhaft: %s", json_file.name, e)

    if count > 0:
        logger.info("Preset-Registry: %d Geraeteprofile geladen", count)


def get_preset(preset_id: str) -> DevicePreset | None:
    """Gibt ein Preset anhand seiner ID zurueck."""
    if not _registry:
        _load_all()
    return _registry.get(preset_id)


def get_preset_raw(preset_id: str) -> dict | None:
    """Gibt die rohen JSON-Daten eines Presets zurueck."""
    if not _raw_data:
        _load_all()
    return _raw_data.get(preset_id)


def list_presets(category: str | None = None) -> list[dict]:
    """
    Listet alle verfuegbaren Presets auf.

    Args:
        category: Optional filtern nach Kategorie (heat_pump, inverter, ...)

    Returns: Liste von {id, manufacturer, model, category, protocol, description}
    """
    if not _registry:
        _load_all()

    result = []
    for preset in _registry.values():
        if category and preset.category != category:
            continue
        result.append({
            "id": preset.id,
            "manufacturer": preset.manufacturer,
            "model": preset.model,
            "category": preset.category,
            "protocol": preset.protocol,
            "description": preset.description,
            "defaults": preset.defaults,
            "writable_keys": list(preset.write_map.keys()),
            "setpoint_keys": list(preset.setpoint_routing.keys()),
        })

    return sorted(result, key=lambda x: (x["category"], x["manufacturer"], x["model"]))


def reload_presets():
    """Laedt alle Presets neu (z.B. nach Aenderungen)."""
    _registry.clear()
    _raw_data.clear()
    _load_all()
