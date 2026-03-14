"""Tests fuer das Preset-System (Geraeteprofile)."""

import pytest
from app.drivers.presets import get_preset, get_preset_raw, list_presets, reload_presets
from app.drivers.presets._schema import validate_preset, DevicePreset


class TestPresetRegistry:
    """Tests fuer die Preset-Registry."""

    def test_list_presets_returns_all(self):
        reload_presets()
        presets = list_presets()
        assert len(presets) >= 5  # lambda, sma, fronius, sdm630, byd, goe

    def test_list_presets_filter_by_category(self):
        presets = list_presets(category="heat_pump")
        assert len(presets) >= 1
        for p in presets:
            assert p["category"] == "heat_pump"

    def test_list_presets_filter_inverters(self):
        presets = list_presets(category="inverter")
        assert len(presets) >= 2  # sma + fronius

    def test_get_preset_lambda(self):
        preset = get_preset("lambda_eu_l")
        assert preset is not None
        assert preset.manufacturer == "Lambda"
        assert preset.protocol == "modbus_tcp"
        assert len(preset.register_groups) == 7
        assert len(preset.write_map) > 0
        assert len(preset.setpoint_routing) > 0

    def test_get_preset_raw_lambda(self):
        raw = get_preset_raw("lambda_eu_l")
        assert raw is not None
        assert "register_groups" in raw
        assert "write_map" in raw
        assert "setpoint_routing" in raw
        assert "state_maps" in raw

    def test_get_preset_nonexistent(self):
        preset = get_preset("nonexistent_device")
        assert preset is None

    def test_preset_sorted_by_category(self):
        presets = list_presets()
        categories = [p["category"] for p in presets]
        assert categories == sorted(categories)

    def test_preset_has_required_fields(self):
        presets = list_presets()
        for p in presets:
            assert "id" in p
            assert "manufacturer" in p
            assert "model" in p
            assert "category" in p
            assert "protocol" in p
            assert "writable_keys" in p
            assert "setpoint_keys" in p


class TestPresetSchema:
    """Tests fuer die Preset-Validierung."""

    def test_validate_minimal_preset(self):
        data = {
            "id": "test",
            "manufacturer": "Test Corp",
            "model": "Test Model",
            "category": "meter",
            "protocol": "modbus_tcp",
        }
        preset = validate_preset(data)
        assert isinstance(preset, DevicePreset)
        assert preset.id == "test"
        assert preset.version == "1.0"

    def test_validate_missing_required_field(self):
        data = {"id": "test", "manufacturer": "Test"}
        with pytest.raises(ValueError, match="Pflichtfeld"):
            validate_preset(data)

    def test_lambda_preset_register_groups(self):
        raw = get_preset_raw("lambda_eu_l")
        assert raw is not None
        groups = raw["register_groups"]

        # Pruefe Ambient-Gruppe
        ambient = next(g for g in groups if g["name"] == "ambient")
        assert ambient["base_address"] == 0
        assert ambient["source"] == "outdoor"
        assert not ambient.get("repeatable", False)

        # Pruefe Heat-Pump Gruppe (repeatable)
        hp = next(g for g in groups if g["name"] == "heat_pump")
        assert hp["repeatable"] is True
        assert hp["max_instances"] == 3
        assert hp["instance_offset"] == 100
        assert hp["base_address"] == 1000

    def test_lambda_write_map(self):
        raw = get_preset_raw("lambda_eu_l")
        wm = raw["write_map"]
        assert "pv_surplus_w" in wm
        assert wm["pv_surplus_w"]["address"] == 102
        assert "hp_requested_flow_temp_c" in wm
        assert wm["hp_requested_flow_temp_c"]["scale"] == 10.0

    def test_lambda_setpoint_routing(self):
        raw = get_preset_raw("lambda_eu_l")
        sr = raw["setpoint_routing"]
        assert "hp_thermal_kw" in sr
        assert sr["hp_thermal_kw"]["target"] == "pv_surplus_w"
        assert "1000" in sr["hp_thermal_kw"]["transform"]


class TestPresetDevices:
    """Tests fuer einzelne Geraetepresets."""

    def test_sma_sunspec_preset(self):
        preset = get_preset("sma_sunspec")
        assert preset is not None
        assert preset.protocol == "sunspec"
        assert preset.defaults.get("unitId") == 3

    def test_fronius_http_preset(self):
        preset = get_preset("fronius_http")
        assert preset is not None
        assert preset.protocol == "http_rest"
        assert len(preset.endpoints) > 0

    def test_sdm630_meter_preset(self):
        preset = get_preset("sdm630_modbus")
        assert preset is not None
        assert preset.category == "meter"

    def test_byd_battery_preset(self):
        preset = get_preset("byd_hvs")
        assert preset is not None
        assert preset.category == "battery"
        assert len(preset.write_map) > 0
        assert len(preset.setpoint_routing) > 0

    def test_goe_charger_preset(self):
        preset = get_preset("goe_charger")
        assert preset is not None
        assert preset.category == "wallbox"
        assert preset.protocol == "http_rest"
