"""
Simulator — Erzeugt realistische Messwerte basierend auf der konfigurierten Anlage.

Simuliert:
- PV-Erzeugung nach Sonnenstand (Glockenkurve)
- Lastprofile (Haushalt-Tageskurve mit Rauschen)
- Wärmepumpe (abhängig von Außentemperatur)
- Batteriespeicher (Laden bei Überschuss, Entladen bei Defizit)
- Netz-Import/Export (Bilanzierung)

Schreibt Measurement-Datensätze und broadcastet per WebSocket.
"""

import asyncio
import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.api.websocket import broadcast
from app.core.database import async_session
from app.models.config import (
    CircuitConfig,
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    RoomConfig,
    StorageConfig,
    SystemSettingsConfig,
)
from app.models.measurement import Measurement
from app.services.room_thermal_model import (
    get_default_params,
    get_room_target_at_time,
    step_room_temperature,
)

logger = logging.getLogger(__name__)


class SimulatorState:
    """Transiente Zustandsvariablen der Simulation."""

    def __init__(self):
        self.battery_soc_pct: float = 50.0
        self.battery_capacity_kwh: float = 0.0
        self.heat_storage_temp_c: float = 45.0
        self.outdoor_temp_c: float = 5.0
        self.total_energy_import_kwh: float = 0.0
        self.total_energy_export_kwh: float = 0.0
        self.total_pv_kwh: float = 0.0
        self.room_temperatures: dict[str, float] = {}  # room_id -> T_raum


class Simulator:
    """Erzeugt realistische Energiemesswerte ohne echte Hardware."""

    def __init__(self):
        self._running = False
        self._interval_seconds = 5
        self._speed_factor = 1  # 1 = Echtzeit, 60 = 1 min pro Sekunde
        self._state = SimulatorState()
        self._config: dict[str, Any] = {}
        self._task: asyncio.Task | None = None
        self._sim_time: datetime | None = None  # Simulierte Uhrzeit
        self._controller = None  # Wird bei start() gesetzt wenn verfuegbar

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def status(self) -> dict:
        result = {
            "running": self._running,
            "interval_seconds": self._interval_seconds,
            "speed_factor": self._speed_factor,
            "sim_time": self._sim_time.isoformat() if self._sim_time else None,
            "state": {
                "battery_soc_pct": round(self._state.battery_soc_pct, 1),
                "heat_storage_temp_c": round(self._state.heat_storage_temp_c, 1),
                "outdoor_temp_c": round(self._state.outdoor_temp_c, 1),
                "total_pv_kwh": round(self._state.total_pv_kwh, 1),
                "total_import_kwh": round(self._state.total_energy_import_kwh, 1),
                "total_export_kwh": round(self._state.total_energy_export_kwh, 1),
            },
            "bus_connections": self._get_bus_connections(),
        }
        return result

    def _get_bus_connections(self) -> list[dict]:
        """Simulierte Bus-Verbindungen aus der Anlagenkonfiguration."""
        if not self._running:
            return []
        connections = []
        for gen in self._config.get("generators", []):
            comm = gen.get("communication", {})
            if comm.get("enabled"):
                connections.append({
                    "source": gen.get("name", gen.get("type", "?")),
                    "entity_type": "generator",
                    "protocol": comm.get("protocol", "unknown"),
                    "ip": comm.get("ipAddress", ""),
                    "port": comm.get("port", 0),
                    "status": "simulated",
                    "interval": comm.get("pollingIntervalSeconds", 5),
                })
        for stor in self._config.get("storages", []):
            comm = stor.get("communication", {})
            if comm.get("enabled"):
                connections.append({
                    "source": stor.get("name", stor.get("type", "?")),
                    "entity_type": "storage",
                    "protocol": comm.get("protocol", "unknown"),
                    "ip": comm.get("ipAddress", ""),
                    "port": comm.get("port", 0),
                    "status": "simulated",
                    "interval": comm.get("pollingIntervalSeconds", 5),
                })
        for cons in self._config.get("consumers", []):
            comm = cons.get("communication", {})
            if comm.get("enabled"):
                connections.append({
                    "source": cons.get("name", cons.get("type", "?")),
                    "entity_type": "consumer",
                    "protocol": comm.get("protocol", "unknown"),
                    "ip": comm.get("ipAddress", ""),
                    "port": comm.get("port", 0),
                    "status": "simulated",
                    "interval": comm.get("pollingIntervalSeconds", 5),
                })
        return connections

    async def start(self, interval: int = 5, speed_factor: int = 1):
        if self._running:
            return
        self._interval_seconds = interval
        self._speed_factor = speed_factor
        self._running = True
        self._state = SimulatorState()
        self._sim_time = datetime.now(timezone.utc)
        await self._load_config()
        # Controller anbinden (optional)
        try:
            from app.services.controller import controller
            self._controller = controller
            logger.info("Controller angebunden (Modus: %s)", controller.mode)
        except Exception:
            self._controller = None
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Simulator gestartet (interval=%ds, speed=%dx)", interval, speed_factor)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Simulator gestoppt")

    async def _load_config(self):
        """Lade aktuelle Anlagenkonfiguration aus den JSONB-Tabellen."""
        async with async_session() as db:
            gen_result = await db.execute(select(GeneratorConfig))
            self._config["generators"] = [r.data for r in gen_result.scalars()]

            stor_result = await db.execute(select(StorageConfig))
            self._config["storages"] = [r.data for r in stor_result.scalars()]

            cons_result = await db.execute(select(ConsumerConfig))
            self._config["consumers"] = [r.data for r in cons_result.scalars()]

            meter_result = await db.execute(select(MeterConfig))
            self._config["meters"] = [r.data for r in meter_result.scalars()]

            circuit_result = await db.execute(select(CircuitConfig))
            self._config["circuits"] = [r.data for r in circuit_result.scalars()]

            room_result = await db.execute(select(RoomConfig))
            self._config["rooms"] = [r.data for r in room_result.scalars()]

            settings_result = await db.execute(select(SystemSettingsConfig))
            row = settings_result.scalar_one_or_none()
            self._config["settings"] = row.data if row else {}

        # Raum-Thermik-Parameter initialisieren
        self._room_params = {}
        circuits_map = {c["id"]: c for c in self._config.get("circuits", [])}
        insulation = self._config.get("settings", {}).get("insulationStandard", "good")
        for room in self._config.get("rooms", []):
            circuit_id = room.get("heatingCircuitId", "")
            circuit = circuits_map.get(circuit_id)
            if circuit_id:
                params = get_default_params(room, circuit, insulation)
                self._room_params[room["id"]] = params
                # Initiale Raumtemperatur auf Sollwert setzen
                self._state.room_temperatures[room["id"]] = params.target_temp_c

        # Batterie-Kapazität initialisieren
        for s in self._config.get("storages", []):
            if s.get("type") == "battery":
                self._state.battery_capacity_kwh += s.get("capacityKwh", 0)

        if not self._config.get("generators"):
            logger.warning("Keine Erzeuger konfiguriert — Simulation läuft mit Nullwerten")

    async def _run_loop(self):
        try:
            while self._running:
                await self._simulation_step()
                await asyncio.sleep(self._interval_seconds)
        except asyncio.CancelledError:
            pass

    async def _simulation_step(self):
        # Simulierte Uhrzeit: pro Schritt um interval*speed Sekunden voranschreiten
        sim_delta = timedelta(seconds=self._interval_seconds * self._speed_factor)
        self._sim_time = self._sim_time + sim_delta  # type: ignore[operator]
        now = self._sim_time  # type: ignore[assignment]
        hour = now.hour + now.minute / 60.0

        # Simulierte Außentemperatur (Tagesgang)
        month = now.month
        self._state.outdoor_temp_c = self._simulate_outdoor_temp(hour, month)

        # === PV-Erzeugung (immer physikbasiert) ===
        pv_power_kw = self._simulate_pv(hour)

        # === Haushaltslast (immer physikbasiert) ===
        load_kw = self._simulate_load(hour)

        # === Controller-gesteuert oder Heuristik ===
        ctrl_setpoints = None
        if self._controller and self._controller.mode != "off":
            ctrl_setpoints = self._controller.get_setpoints_for_step(now, self._state)

        if ctrl_setpoints and ctrl_setpoints.source != "heuristic":
            # Controller-Modus: Setpoints uebernehmen
            hp_power_kw, hp_heat_kw = self._apply_hp_setpoint(ctrl_setpoints, hour)
            boiler_heat_kw = ctrl_setpoints.boiler_kw

            total_generation_kw = pv_power_kw
            total_consumption_kw = load_kw + hp_power_kw
            surplus_kw = total_generation_kw - total_consumption_kw

            battery_power_kw = self._apply_battery_setpoint(ctrl_setpoints, surplus_kw)
        else:
            # Heuristik-Modus (wie bisher)
            hp_power_kw, hp_heat_kw = self._simulate_heat_pump(hour)
            boiler_heat_kw = self._simulate_boiler()

            total_generation_kw = pv_power_kw
            total_consumption_kw = load_kw + hp_power_kw
            surplus_kw = total_generation_kw - total_consumption_kw

            battery_power_kw = 0.0
            if self._state.battery_capacity_kwh > 0:
                battery_power_kw = self._simulate_battery(surplus_kw)

        # Wärmespeicher-Update bei Controller-Modus
        if ctrl_setpoints and ctrl_setpoints.source != "heuristic":
            dt_h = self._interval_seconds * self._speed_factor / 3600.0
            heat_loss_kw = max(0, (self._state.heat_storage_temp_c - 20) * 0.05)
            net_heat = (hp_heat_kw + boiler_heat_kw - heat_loss_kw) * dt_h
            temp_change = net_heat / 1.7
            self._state.heat_storage_temp_c = max(25, min(85,
                self._state.heat_storage_temp_c + temp_change
            ))

        # === Netz ===
        grid_power_kw = total_consumption_kw - total_generation_kw + battery_power_kw
        # positiv=Bezug, negativ=Einspeisung

        # Soll-Ist-Abweichung aufzeichnen
        if ctrl_setpoints and ctrl_setpoints.source == "schedule" and self._controller:
            self._controller.record_deviation(
                timestamp=now.isoformat(),
                setpoint_battery=ctrl_setpoints.battery_kw,
                actual_battery=battery_power_kw,
                setpoint_grid=0,  # Netz ist Ergebnis, kein Setpoint
                actual_grid=grid_power_kw,
                setpoint_hp=ctrl_setpoints.hp_thermal_kw,
                actual_hp=hp_heat_kw,
            )

        # Energie-Zähler aktualisieren
        dt_h = self._interval_seconds * self._speed_factor / 3600.0
        if grid_power_kw > 0:
            self._state.total_energy_import_kwh += grid_power_kw * dt_h
        else:
            self._state.total_energy_export_kwh += abs(grid_power_kw) * dt_h
        self._state.total_pv_kwh += pv_power_kw * dt_h

        # Autarkiegrad
        self_consumption_kw = min(total_generation_kw, total_consumption_kw)
        self_sufficiency = (
            (self_consumption_kw / total_consumption_kw * 100)
            if total_consumption_kw > 0 else 0
        )

        # === Raum-Temperaturen simulieren ===
        room_measurements = self._simulate_rooms(now, ctrl_setpoints)

        # === Messwerte sammeln ===
        measurements = [
            ("pv", "power_kw", round(pv_power_kw, 2), "kW"),
            ("grid", "power_kw", round(grid_power_kw, 2), "kW"),
            ("grid", "import_kwh", round(self._state.total_energy_import_kwh, 2), "kWh"),
            ("grid", "export_kwh", round(self._state.total_energy_export_kwh, 2), "kWh"),
            ("load", "power_kw", round(total_consumption_kw, 2), "kW"),
            ("battery", "power_kw", round(battery_power_kw, 2), "kW"),
            ("battery", "soc_pct", round(self._state.battery_soc_pct, 1), "%"),
            ("heat_pump", "power_kw", round(hp_power_kw, 2), "kW"),
            ("heat_pump", "heat_kw", round(hp_heat_kw, 2), "kW"),
            ("boiler", "heat_kw", round(boiler_heat_kw, 2), "kW"),
            ("outdoor", "temperature_c", round(self._state.outdoor_temp_c, 1), "\u00b0C"),
            ("heat_storage", "temperature_c", round(self._state.heat_storage_temp_c, 1), "\u00b0C"),
            ("system", "self_sufficiency_pct", round(self_sufficiency, 1), "%"),
            ("system", "self_consumption_kw", round(self_consumption_kw, 2), "kW"),
        ]
        measurements.extend(room_measurements)

        # In DB schreiben
        async with async_session() as db:
            for source, metric, value, unit in measurements:
                db.add(Measurement(
                    timestamp=now, source=source, metric=metric, value=value, unit=unit,
                ))
            await db.commit()

        # WebSocket broadcast
        ws_data = {
            "type": "measurements",
            "timestamp": now.isoformat(),
            "data": {
                "pv_power_kw": round(pv_power_kw, 2),
                "grid_power_kw": round(grid_power_kw, 2),
                "load_power_kw": round(total_consumption_kw, 2),
                "battery_power_kw": round(battery_power_kw, 2),
                "battery_soc_pct": round(self._state.battery_soc_pct, 1),
                "heat_pump_power_kw": round(hp_power_kw, 2),
                "heat_pump_heat_kw": round(hp_heat_kw, 2),
                "boiler_heat_kw": round(boiler_heat_kw, 2),
                "outdoor_temp_c": round(self._state.outdoor_temp_c, 1),
                "heat_storage_temp_c": round(self._state.heat_storage_temp_c, 1),
                "self_sufficiency_pct": round(self_sufficiency, 1),
                "import_kwh": round(self._state.total_energy_import_kwh, 1),
                "export_kwh": round(self._state.total_energy_export_kwh, 1),
                "room_temperatures": {
                    rid: round(t, 1)
                    for rid, t in self._state.room_temperatures.items()
                },
            },
        }
        await broadcast(ws_data)

    # ------------------------------------------------------------------
    # Simulationsmodelle
    # ------------------------------------------------------------------

    def _simulate_rooms(self, sim_time: datetime, ctrl_setpoints=None) -> list[tuple[str, str, float, str]]:
        """
        Simuliert Raumtemperaturen fuer alle konfigurierten Raeume mit RC-Modell.

        Returns: Liste von (source, metric, value, unit) Messwerten.
        """
        if not hasattr(self, "_room_params") or not self._room_params:
            return []

        dt_h = self._interval_seconds * self._speed_factor / 3600.0
        hour = sim_time.hour + sim_time.minute / 60.0
        weekday = sim_time.weekday()
        outdoor_temp = self._state.outdoor_temp_c
        measurements = []

        # Heizkreise sammeln: circuit_id -> flow_temp
        circuits_map = {c["id"]: c for c in self._config.get("circuits", [])}
        circuit_flow_temps: dict[str, float] = {}

        # Vorlauftemp pro Kreis: aus Controller-Setpoints oder Heizkurve
        for cid, circuit in circuits_map.items():
            if ctrl_setpoints and hasattr(ctrl_setpoints, "circuit_setpoints"):
                # Pro-Kreis Setpoints vom Controller
                for cs in ctrl_setpoints.circuit_setpoints:
                    if cs.circuit_id == cid:
                        circuit_flow_temps[cid] = cs.flow_temp_c
                        break
                else:
                    circuit_flow_temps[cid] = self._calc_circuit_flow_temp(circuit, outdoor_temp)
            elif ctrl_setpoints and hasattr(ctrl_setpoints, "flow_temp_c"):
                # Globaler Flow-Temp-Setpoint
                circuit_flow_temps[cid] = ctrl_setpoints.flow_temp_c
            else:
                circuit_flow_temps[cid] = self._calc_circuit_flow_temp(circuit, outdoor_temp)

        # Jeder Raum: RC-Modell anwenden
        for room_id, params in self._room_params.items():
            t_current = self._state.room_temperatures.get(room_id, params.target_temp_c)
            t_flow = circuit_flow_temps.get(params.circuit_id, 35.0)

            # Soll-Temperatur aus Schedule
            target = get_room_target_at_time(params.schedule, hour, weekday, params.target_temp_c)

            # Heizung nur wenn Bedarf (Raum unter Soll oder Frostschutz)
            if t_current >= target + 0.5 and t_current > params.min_temp_c + 2:
                t_flow_eff = t_current  # Keine Heizung
            else:
                t_flow_eff = t_flow

            # RC-Modell Schritt
            t_new = step_room_temperature(params, t_current, outdoor_temp, t_flow_eff, dt_h)
            self._state.room_temperatures[room_id] = t_new

            # Messwerte
            measurements.append((f"room_{room_id}", "temperature_c", round(t_new, 2), "\u00b0C"))
            measurements.append((f"room_{room_id}", "target_temp_c", round(target, 1), "\u00b0C"))

        # Kreis-Messwerte (Vorlauf/Ruecklauf)
        for cid, flow_temp in circuit_flow_temps.items():
            measurements.append((f"circuit_{cid}", "flow_temp_c", round(flow_temp, 1), "\u00b0C"))
            # Ruecklauftemp: Mischtemperatur der Raeume (vereinfacht)
            room_temps_on_circuit = [
                self._state.room_temperatures.get(rid, 20)
                for rid, p in self._room_params.items()
                if p.circuit_id == cid
            ]
            if room_temps_on_circuit:
                return_temp = sum(room_temps_on_circuit) / len(room_temps_on_circuit) + 3.0
            else:
                return_temp = flow_temp - 10.0
            measurements.append((f"circuit_{cid}", "return_temp_c", round(return_temp, 1), "\u00b0C"))

        return measurements

    def _calc_circuit_flow_temp(self, circuit: dict, outdoor_temp: float) -> float:
        """Berechnet Vorlauftemperatur aus Heizkurve des Kreises."""
        design_outdoor = circuit.get("designOutdoorTemperatureC", -12)
        design_flow = circuit.get("flowTemperatureC", 55)
        hc = circuit.get("heatingCurve", {})
        steepness = hc.get("steepness", 1.2)
        parallel_shift = hc.get("parallelShift", 0)
        indoor_target = 21.0

        if outdoor_temp >= indoor_target:
            return indoor_target

        ratio = (indoor_target - outdoor_temp) / max(1, indoor_target - design_outdoor)
        ratio = max(0, min(1.5, ratio))
        flow_temp = indoor_target + steepness * (design_flow - indoor_target) * ratio + parallel_shift
        return max(indoor_target, min(75.0, flow_temp))

    def _simulate_outdoor_temp(self, hour: float, month: int) -> float:
        """Tagesgang der Außentemperatur, monatlich variierend."""
        # Monatliche Durchschnittstemperaturen (München ca.)
        monthly_avg = [-1, 0, 5, 9, 14, 17, 19, 19, 15, 10, 4, 1]
        base = monthly_avg[month - 1]
        # Tagesgang: ±4°C, Minimum 5:00, Maximum 15:00
        amplitude = 4.0
        daily = amplitude * math.sin((hour - 5) / 24 * 2 * math.pi)
        noise = random.gauss(0, 0.3)
        return base + daily + noise

    def _simulate_pv(self, hour: float) -> float:
        """PV-Erzeugung als Glockenkurve um Sonnenhöchststand."""
        total_peak_kwp = sum(
            g.get("peakPowerKwp", 0)
            for g in self._config.get("generators", [])
            if g.get("type") == "pv"
        )
        if total_peak_kwp == 0:
            return 0.0

        # Glockenkurve: Maximum bei 12:30 (Sonnenhöchststand), Breite ~5h
        solar_noon = 12.5
        sigma = 2.8
        solar_factor = math.exp(-0.5 * ((hour - solar_noon) / sigma) ** 2)

        # Nachts = 0
        if hour < 6 or hour > 20:
            solar_factor = 0

        # Wolken-Rauschen (±15%)
        cloud_factor = 1.0 + random.gauss(0, 0.08)
        cloud_factor = max(0.2, min(1.1, cloud_factor))

        # Saisonaler Faktor (max im Juni, min im Dezember)
        day_of_year = (self._sim_time or datetime.now(timezone.utc)).timetuple().tm_yday
        seasonal = 0.5 + 0.5 * math.sin((day_of_year - 80) / 365 * 2 * math.pi)

        power = total_peak_kwp * solar_factor * cloud_factor * seasonal * 0.85
        return max(0, power)

    def _simulate_heat_pump(self, hour: float) -> tuple[float, float]:
        """Wärmepumpe: elektrische + thermische Leistung."""
        hp_configs = [
            g for g in self._config.get("generators", [])
            if g.get("type") == "heat_pump"
        ]
        if not hp_configs:
            return 0.0, 0.0

        total_heating_kw = sum(g.get("heatingPowerKw", 0) for g in hp_configs)

        # COP abhängig von Außentemperatur (Luft-WP)
        cop = max(2.0, 5.0 - 0.08 * (20 - self._state.outdoor_temp_c))

        # Heizlast: abhängig von Außentemperatur + Tageszeit
        outdoor = self._state.outdoor_temp_c
        if outdoor >= 18:
            demand_factor = 0.0  # Keine Heizung nötig
        elif outdoor <= -5:
            demand_factor = 1.0
        else:
            demand_factor = (18 - outdoor) / 23.0

        # Nachtabsenkung (22-6 Uhr)
        if 22 <= hour or hour < 6:
            demand_factor *= 0.6

        heat_kw = total_heating_kw * demand_factor
        # Modulation: WP läuft nicht unter 30% Teillast
        if 0 < heat_kw < total_heating_kw * 0.3:
            heat_kw = total_heating_kw * 0.3

        electric_kw = heat_kw / cop if cop > 0 else 0

        # Wärmespeicher-Temperatur aktualisieren
        dt_h = self._interval_seconds * self._speed_factor / 3600.0
        heat_loss_kw = max(0, (self._state.heat_storage_temp_c - 20) * 0.05)
        net_heat = (heat_kw - heat_loss_kw) * dt_h
        # Annahme: 1500 L Wasser → ~1.7 kWh/°C
        temp_change = net_heat / 1.7
        self._state.heat_storage_temp_c = max(25, min(85,
            self._state.heat_storage_temp_c + temp_change
        ))

        return round(electric_kw, 2), round(heat_kw, 2)

    def _simulate_boiler(self) -> float:
        """Gaskessel springt ein wenn Pufferspeicher zu kalt."""
        boiler_configs = [
            g for g in self._config.get("generators", [])
            if g.get("type") == "boiler"
        ]
        if not boiler_configs:
            return 0.0

        total_power_kw = sum(g.get("nominalPowerKw", 0) for g in boiler_configs)

        # Kessel startet unter 40°C, Hysterese
        if self._state.heat_storage_temp_c < 38:
            heat_kw = total_power_kw * 0.7  # Teillast
        elif self._state.heat_storage_temp_c < 42:
            heat_kw = total_power_kw * 0.4
        else:
            heat_kw = 0

        # Wärmespeicher aufheizen
        if heat_kw > 0:
            dt_h = self._interval_seconds * self._speed_factor / 3600.0
            temp_change = (heat_kw * dt_h) / 1.7
            self._state.heat_storage_temp_c = min(85,
                self._state.heat_storage_temp_c + temp_change
            )

        return round(heat_kw, 2)

    def _simulate_load(self, hour: float) -> float:
        """Haushaltslast nach typischem Tagesprofil (VDI 4655 angelehnt)."""
        total_annual_kwh = sum(
            c.get("annualConsumptionKwh", 3000)
            for c in self._config.get("consumers", [])
        )
        if total_annual_kwh == 0:
            total_annual_kwh = 5000  # Fallback

        # Durchschnittliche Stundenleistung
        avg_kw = total_annual_kwh / 8760

        # Tagesprofil-Faktoren (normalisiert auf ~1.0)
        profile = [
            0.4, 0.3, 0.3, 0.3, 0.35, 0.5,   # 0-5 Uhr
            0.7, 1.2, 1.4, 1.1, 0.9, 0.85,     # 6-11 Uhr
            1.3, 1.1, 0.9, 0.85, 0.9, 1.3,      # 12-17 Uhr
            1.8, 2.0, 1.7, 1.3, 0.8, 0.5,       # 18-23 Uhr
        ]

        hour_idx = int(hour) % 24
        # Interpolation zwischen Stunden
        frac = hour - int(hour)
        next_idx = (hour_idx + 1) % 24
        factor = profile[hour_idx] * (1 - frac) + profile[next_idx] * frac

        # Zufallsvariation (±20%)
        noise = 1.0 + random.gauss(0, 0.1)
        noise = max(0.5, min(1.5, noise))

        power = avg_kw * factor * noise
        return max(0.1, power)

    def _apply_hp_setpoint(self, setpoints, hour: float) -> tuple[float, float]:
        """WP nach Controller-Setpoint betreiben."""
        hp_configs = [
            g for g in self._config.get("generators", [])
            if g.get("type") == "heat_pump"
        ]
        if not hp_configs:
            return 0.0, 0.0

        total_heating_kw = sum(g.get("heatingPowerKw", 0) for g in hp_configs)

        # COP abhaengig von Aussentemperatur
        cop = max(2.0, 5.0 - 0.08 * (20 - self._state.outdoor_temp_c))

        # Controller gibt thermische Leistung vor
        heat_kw = min(setpoints.hp_thermal_kw, total_heating_kw)

        # Mindest-Modulation
        if 0 < heat_kw < total_heating_kw * 0.3:
            heat_kw = total_heating_kw * 0.3

        electric_kw = heat_kw / cop if cop > 0 else 0
        return round(electric_kw, 2), round(heat_kw, 2)

    def _apply_battery_setpoint(self, setpoints, surplus_kw: float) -> float:
        """Batterie nach Controller-Setpoint betreiben."""
        if self._state.battery_capacity_kwh <= 0:
            return 0.0

        target_kw = setpoints.battery_kw
        dt_h = self._interval_seconds * self._speed_factor / 3600.0

        # Max-Lade/Entladeleistung aus Konfiguration
        max_charge_kw = 0.0
        max_discharge_kw = 0.0
        for s in self._config.get("storages", []):
            if s.get("type") == "battery":
                max_charge_kw += s.get("maxChargePowerKw", s.get("capacityKwh", 10) * 0.5)
                max_discharge_kw += s.get("maxDischargePowerKw", s.get("capacityKwh", 10) * 0.5)

        if target_kw > 0:
            # Laden
            charge = min(target_kw, max_charge_kw)
            if self._state.battery_soc_pct >= 95:
                return 0.0
            energy_kwh = charge * dt_h * 0.95
            new_soc = self._state.battery_soc_pct + (energy_kwh / self._state.battery_capacity_kwh * 100)
            self._state.battery_soc_pct = min(100, new_soc)
            return round(charge, 2)
        elif target_kw < 0:
            # Entladen
            discharge = min(abs(target_kw), max_discharge_kw)
            if self._state.battery_soc_pct <= 10:
                return 0.0
            energy_kwh = discharge * dt_h / 0.95
            new_soc = self._state.battery_soc_pct - (energy_kwh / self._state.battery_capacity_kwh * 100)
            self._state.battery_soc_pct = max(5, new_soc)
            return round(-discharge, 2)
        return 0.0

    def _simulate_battery(self, surplus_kw: float) -> float:
        """
        Batteriespeicher: Laden bei Überschuss, Entladen bei Defizit.
        Rückgabe: positiv = Laden (Verbrauch), negativ = Entladen (Erzeugung).
        """
        if self._state.battery_capacity_kwh <= 0:
            return 0.0

        # Max-Lade/Entladeleistung aus Konfiguration
        max_charge_kw = 0.0
        max_discharge_kw = 0.0
        for s in self._config.get("storages", []):
            if s.get("type") == "battery":
                max_charge_kw += s.get("maxChargePowerKw", s.get("capacityKwh", 10) * 0.5)
                max_discharge_kw += s.get("maxDischargePowerKw", s.get("capacityKwh", 10) * 0.5)

        if max_charge_kw == 0:
            max_charge_kw = self._state.battery_capacity_kwh * 0.5
        if max_discharge_kw == 0:
            max_discharge_kw = self._state.battery_capacity_kwh * 0.5

        battery_power = 0.0
        dt_h = self._interval_seconds * self._speed_factor / 3600.0

        if surplus_kw > 0.1 and self._state.battery_soc_pct < 95:
            # Laden mit Überschuss
            battery_power = min(surplus_kw, max_charge_kw)
            energy_kwh = battery_power * dt_h * 0.95  # 95% Ladewirkungsgrad
            new_soc = self._state.battery_soc_pct + (energy_kwh / self._state.battery_capacity_kwh * 100)
            self._state.battery_soc_pct = min(100, new_soc)

        elif surplus_kw < -0.1 and self._state.battery_soc_pct > 10:
            # Entladen bei Defizit
            deficit = abs(surplus_kw)
            battery_power = -min(deficit, max_discharge_kw)
            energy_kwh = abs(battery_power) * dt_h / 0.95
            new_soc = self._state.battery_soc_pct - (energy_kwh / self._state.battery_capacity_kwh * 100)
            self._state.battery_soc_pct = max(5, new_soc)

        return round(battery_power, 2)


# Singleton-Instanz
simulator = Simulator()
