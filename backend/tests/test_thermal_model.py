"""Tests fuer das thermische Raum-Modell."""

import pytest
from app.services.room_thermal_model import (
    RoomThermalParams,
    step_room_temperature,
    calculate_optimal_flow_temp,
    calculate_preheat_start,
    get_default_params,
)


class TestStepRoomTemperature:
    """Tests fuer die RC-Modell Simulation."""

    def test_heating_raises_temperature(self):
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        t_new = step_room_temperature(
            params, t_current=18.0, t_outdoor=0.0, t_flow=50.0, dt_h=0.25,
        )
        assert t_new > 18.0, "Temperatur muss steigen bei Heizung"

    def test_cooling_when_no_heat(self):
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        t_new = step_room_temperature(
            params, t_current=22.0, t_outdoor=0.0, t_flow=0.0, dt_h=0.25,
        )
        assert t_new < 22.0, "Temperatur muss sinken ohne Heizung bei kalter Aussentemp"

    def test_fbh_slower_than_radiator(self):
        """FBH (tau=2.5h) reagiert langsamer als Radiator (tau=0.4h)."""
        radiator = RoomThermalParams(
            room_id="rad", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        fbh = RoomThermalParams(
            room_id="fbh", area_m2=30, volume_m3=75,
            circuit_id="hk2", circuit_type="floor_heating",
            target_temp_c=21, tau_response_h=2.5, tau_loss_h=40,
        )

        t_rad = step_room_temperature(radiator, 18.0, 0.0, 50.0, 0.25)
        t_fbh = step_room_temperature(fbh, 18.0, 0.0, 35.0, 0.25)

        # Radiator reagiert schneller
        assert (t_rad - 18.0) > (t_fbh - 18.0)

    def test_stable_at_equilibrium(self):
        """Nahe am Gleichgewicht aendert sich die Temperatur kaum."""
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        # Wenn Raum = 21, Aussen = 20, Flow = 21 → kaum Aenderung
        t_new = step_room_temperature(params, 21.0, 20.0, 21.0, 0.25)
        assert abs(t_new - 21.0) < 0.5


class TestDefaultParams:
    """Tests fuer die Default-Parameter."""

    def test_underfloor_defaults(self):
        room = {"id": "r1", "areaM2": 30, "heightM": 2.5}
        circuit = {"id": "hk1", "distributionType": "floor_heating"}
        params = get_default_params(room, circuit)
        assert params.tau_response_h == 2.5
        assert params.circuit_type == "floor_heating"

    def test_radiator_defaults(self):
        room = {"id": "r1", "areaM2": 30, "heightM": 2.5}
        circuit = {"id": "hk1", "distributionType": "radiator"}
        params = get_default_params(room, circuit)
        assert params.tau_response_h == 0.4

    def test_fancoil_defaults(self):
        room = {"id": "r1", "areaM2": 20, "heightM": 2.5}
        circuit = {"id": "hk1", "distributionType": "fan_coil"}
        params = get_default_params(room, circuit)
        assert params.tau_response_h == 0.15


class TestOptimalFlowTemp:
    """Tests fuer die optimale Vorlauftemperatur-Berechnung."""

    def test_colder_outdoor_needs_higher_flow(self):
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        rooms_temps = {"test": 20.0}
        targets = {"test": 21.0}

        flow_cold = calculate_optimal_flow_temp([params], rooms_temps, -10.0, targets)
        flow_mild = calculate_optimal_flow_temp([params], rooms_temps, 10.0, targets)

        assert flow_cold > flow_mild, "Kaeltere Aussentemp braucht hoehere Vorlauftemp"

    def test_empty_rooms_returns_minimum(self):
        flow = calculate_optimal_flow_temp([], {}, 0.0, {})
        assert flow >= 20.0  # Minimum-Vorlauftemperatur


class TestPreheatStart:
    """Tests fuer die Vorheizzeit-Berechnung."""

    def test_preheat_needed_for_cold_room(self):
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="floor_heating",
            target_temp_c=21, tau_response_h=2.5, tau_loss_h=40,
        )
        hours = calculate_preheat_start(
            params, t_current=17.0, t_target=21.0, t_outdoor=0.0,
        )
        assert hours > 0, "Vorheizzeit muss positiv sein"
        assert hours > 0.5, "FBH braucht mindestens 30min Vorheizen"

    def test_no_preheat_when_already_warm(self):
        params = RoomThermalParams(
            room_id="test", area_m2=30, volume_m3=75,
            circuit_id="hk1", circuit_type="radiator",
            target_temp_c=21, tau_response_h=0.4, tau_loss_h=40,
        )
        hours = calculate_preheat_start(
            params, t_current=21.5, t_target=21.0, t_outdoor=0.0,
        )
        assert hours == 0.0, "Kein Vorheizen noetig wenn schon warm"
