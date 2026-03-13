"""
Controller — Setzt Optimierer-Fahrplan in Stellgroessen um.

Modi:
- auto:   Fahrplan wird automatisch ausgefuehrt
- manual: Nur manuelle Overrides, kein automatischer Fahrplan
- off:    Simulator laeuft mit eigener Heuristik (wie bisher)

Sicherheitslogik ist immer aktiv, unabhaengig vom Modus.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Setpoints:
    """Aktive Stellgroessen fuer die Anlage."""
    battery_kw: float = 0.0       # +laden, -entladen
    hp_modulation_pct: float = 0.0  # 0-100% WP-Modulation
    hp_thermal_kw: float = 0.0     # Thermische Soll-Leistung WP
    boiler_kw: float = 0.0         # Kessel-Leistung
    flow_temp_c: float = 35.0      # Vorlauftemperatur-Sollwert
    wallbox_kw: float = 0.0        # Wallbox-Ladeleistung
    source: str = "off"            # Woher: "schedule", "manual", "safety", "heuristic"
    strategy: str = ""             # Aktuelle Strategie-Beschreibung


@dataclass
class ControllerHistory:
    """Ein Eintrag im Soll-Ist-Vergleich."""
    timestamp: str
    setpoint_battery_kw: float
    actual_battery_kw: float
    setpoint_grid_kw: float
    actual_grid_kw: float
    setpoint_hp_kw: float
    actual_hp_kw: float
    deviation_pct: float


class EnergyController:
    """Zentraler Regler: Fahrplan -> Stellgroessen -> Anlage."""

    def __init__(self):
        self._mode: str = "off"  # auto | manual | off
        self._active_setpoints = Setpoints()
        self._schedule: dict | None = None
        self._schedule_time: datetime | None = None
        self._manual_overrides: dict[str, float] = {}
        self._history: list[dict] = []  # Letzte 288 Eintraege (24h bei 5min)
        self._safety_active: str | None = None

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def setpoints(self) -> Setpoints:
        return self._active_setpoints

    def set_mode(self, mode: str) -> str:
        """Modus umschalten."""
        if mode not in ("auto", "manual", "off"):
            return f"Ungueltiger Modus: {mode}"
        old = self._mode
        self._mode = mode
        if mode == "off":
            self._active_setpoints = Setpoints(source="off", strategy="Aus")
            self._manual_overrides.clear()
        elif mode == "manual":
            self._active_setpoints.source = "manual"
        logger.info("Controller Modus: %s -> %s", old, mode)
        return f"Modus auf {mode} gesetzt"

    def set_manual_override(self, key: str, value: float):
        """Manuellen Override setzen (nur im manual-Modus)."""
        valid_keys = {"battery_kw", "hp_modulation_pct", "boiler_kw", "wallbox_kw", "flow_temp_c"}
        if key not in valid_keys:
            return f"Ungueltiger Key: {key}. Erlaubt: {valid_keys}"
        self._manual_overrides[key] = value
        return f"{key} = {value}"

    def clear_overrides(self):
        """Alle manuellen Overrides loeschen."""
        self._manual_overrides.clear()

    def update_schedule(self, schedule: dict):
        """Neuen Fahrplan uebernehmen."""
        self._schedule = schedule
        self._schedule_time = datetime.now(timezone.utc)
        logger.info("Neuer Fahrplan geladen: %d Stunden", schedule.get("hours", 0))

    def get_setpoints_for_step(
        self,
        sim_time: datetime,
        state: Any,
    ) -> Setpoints:
        """
        Berechnet Stellgroessen fuer den aktuellen Zeitschritt.

        Wird vom Simulator pro Step aufgerufen.
        """
        # Sicherheitslogik IMMER zuerst
        safety = self._check_safety(state)
        if safety:
            self._safety_active = safety.strategy
            self._active_setpoints = safety
            return safety

        self._safety_active = None

        if self._mode == "off":
            return Setpoints(source="heuristic", strategy="Simulator-Heuristik")

        if self._mode == "manual":
            sp = Setpoints(source="manual", strategy="Manueller Betrieb")
            for key, val in self._manual_overrides.items():
                setattr(sp, key, val)
            self._active_setpoints = sp
            return sp

        # auto-Modus: Fahrplan auslesen
        if self._mode == "auto" and self._schedule:
            sp = self._get_schedule_setpoint(sim_time)
            if sp:
                self._active_setpoints = sp
                return sp

        # Fallback
        return Setpoints(source="heuristic", strategy="Kein Fahrplan verfuegbar")

    def _get_schedule_setpoint(self, sim_time: datetime) -> Setpoints | None:
        """Liest den passenden Stunden-Setpoint aus dem Fahrplan."""
        if not self._schedule or "hourly" not in self._schedule:
            return None

        hourly = self._schedule["hourly"]
        time_str = sim_time.strftime("%Y-%m-%dT%H:00")

        for h in hourly:
            if h.get("time") == time_str:
                hp_total_kw = h.get("hp_thermal_kw", 0)
                # HP-Modulation: geschaetzte Modulation basierend auf thermischer Leistung
                # Braucht Maximalleistung aus Config — hier vereinfacht
                hp_mod = min(100, max(0, hp_total_kw / max(1, 13) * 100))

                return Setpoints(
                    battery_kw=h.get("battery_setpoint_kw", 0),
                    hp_modulation_pct=round(hp_mod, 1),
                    hp_thermal_kw=hp_total_kw,
                    boiler_kw=h.get("boiler_kw", 0),
                    flow_temp_c=h.get("flow_temp_c", 35),
                    source="schedule",
                    strategy=h.get("strategy", "Fahrplan"),
                )

        # Kein passender Eintrag fuer diese Stunde
        return None

    def _check_safety(self, state: Any) -> Setpoints | None:
        """
        Sicherheitslogik — IMMER aktiv, egal welcher Modus.
        Gibt Safety-Setpoints zurueck wenn ein Grenzwert verletzt ist.
        """
        if state is None:
            return None

        soc = getattr(state, "battery_soc_pct", 50)
        cap = getattr(state, "battery_capacity_kwh", 0)
        storage_temp = getattr(state, "heat_storage_temp_c", 50)

        # Batterie-Tiefschutz
        if soc < 5 and cap > 0:
            return Setpoints(
                battery_kw=cap * 0.2,  # Notladung 20% der Kapazitaet
                source="safety",
                strategy="SICHERHEIT: Batterie Tiefschutz (SOC < 5%)",
            )

        # Batterie-Ueberladeschutz
        if soc > 98 and cap > 0:
            return Setpoints(
                battery_kw=0,
                source="safety",
                strategy="SICHERHEIT: Batterie voll (SOC > 98%)",
            )

        # Pufferspeicher Uebertemperatur
        if storage_temp > 85:
            return Setpoints(
                hp_modulation_pct=0,
                hp_thermal_kw=0,
                boiler_kw=0,
                source="safety",
                strategy="SICHERHEIT: Speicher-Uebertemperatur (> 85°C)",
            )

        # Pufferspeicher Untertemperatur — Notbetrieb Kessel
        if storage_temp < 35:
            return Setpoints(
                boiler_kw=30,  # Kessel 50% Notbetrieb
                source="safety",
                strategy="SICHERHEIT: Speicher-Untertemperatur (< 35°C)",
            )

        return None

    def record_deviation(
        self,
        timestamp: str,
        setpoint_battery: float,
        actual_battery: float,
        setpoint_grid: float,
        actual_grid: float,
        setpoint_hp: float,
        actual_hp: float,
    ):
        """Soll-Ist-Abweichung aufzeichnen."""
        # Relative Abweichung (gewichtet)
        deviations = []
        if abs(setpoint_battery) > 0.1:
            deviations.append(abs(actual_battery - setpoint_battery) / max(1, abs(setpoint_battery)))
        if abs(setpoint_grid) > 0.1:
            deviations.append(abs(actual_grid - setpoint_grid) / max(1, abs(setpoint_grid)))
        if abs(setpoint_hp) > 0.1:
            deviations.append(abs(actual_hp - setpoint_hp) / max(1, abs(setpoint_hp)))

        avg_deviation = sum(deviations) / max(1, len(deviations)) * 100

        entry = {
            "timestamp": timestamp,
            "setpoint_battery_kw": round(setpoint_battery, 2),
            "actual_battery_kw": round(actual_battery, 2),
            "setpoint_grid_kw": round(setpoint_grid, 2),
            "actual_grid_kw": round(actual_grid, 2),
            "setpoint_hp_kw": round(setpoint_hp, 2),
            "actual_hp_kw": round(actual_hp, 2),
            "deviation_pct": round(avg_deviation, 1),
        }
        self._history.append(entry)
        # Max 288 Eintraege (24h bei 5min-Intervall)
        if len(self._history) > 288:
            self._history = self._history[-288:]

    @property
    def status(self) -> dict:
        """Aktueller Controller-Status."""
        sp = self._active_setpoints
        return {
            "mode": self._mode,
            "safety_active": self._safety_active,
            "schedule_loaded": self._schedule is not None,
            "schedule_hours": self._schedule.get("hours", 0) if self._schedule else 0,
            "schedule_strategy": self._schedule.get("strategy", "") if self._schedule else "",
            "manual_overrides": dict(self._manual_overrides),
            "active_setpoints": {
                "battery_kw": sp.battery_kw,
                "hp_modulation_pct": sp.hp_modulation_pct,
                "hp_thermal_kw": sp.hp_thermal_kw,
                "boiler_kw": sp.boiler_kw,
                "flow_temp_c": sp.flow_temp_c,
                "wallbox_kw": sp.wallbox_kw,
                "source": sp.source,
                "strategy": sp.strategy,
            },
            "history_count": len(self._history),
            "avg_deviation_pct": round(
                sum(h["deviation_pct"] for h in self._history[-12:]) / max(1, len(self._history[-12:])),
                1,
            ) if self._history else 0,
        }

    @property
    def history(self) -> list[dict]:
        """Soll-Ist-Vergleich Historie."""
        return list(self._history)


# Singleton
controller = EnergyController()
