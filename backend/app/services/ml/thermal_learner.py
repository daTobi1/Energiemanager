"""
Thermal Learner — Lernt pro Raum thermische Parameter aus Messdaten.

1. tau (Zeitkonstante): Exponentialkurve an Aufheiz-/Abkuehlvorgaenge fitten
2. Heizkurve (steepness, parallelShift): Stationaere Phasen erkennen
3. Vorheizzeit: Aus gelerntem tau ableiten

Benoetigt mindestens 7 Tage Messdaten, sonst werden Defaults verwendet.
Leichtgewichtig fuer Raspberry Pi: Rastersuche statt Gradient-Optimierung.
"""

import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.core.database import async_session
from app.models.config import CircuitConfig, RoomConfig, SystemSettingsConfig
from app.models.thermal_params import ThermalLearnedParams

logger = logging.getLogger(__name__)

MIN_DAYS = 7
MIN_POINTS = 24  # Mindestens 24 Messpunkte fuer einen Fit


class ThermalLearner:
    """Lernt thermische Raumparameter aus historischen Messdaten."""

    async def learn_all(self, days_back: int = 28) -> dict:
        """
        Lernt Parameter fuer alle Raeume mit genuegend Daten.

        Returns: Dict mit Ergebnissen pro Raum.
        """
        results = {}

        async with async_session() as db:
            room_r = await db.execute(select(RoomConfig))
            rooms = [r.data for r in room_r.scalars()]

            circuit_r = await db.execute(select(CircuitConfig))
            circuits_list = [r.data for r in circuit_r.scalars()]
            circuits_map = {c["id"]: c for c in circuits_list}

            settings_r = await db.execute(select(SystemSettingsConfig))
            row = settings_r.scalar_one_or_none()
            settings = row.data if row else {}

        for room in rooms:
            room_id = room.get("id", "")
            circuit_id = room.get("heatingCircuitId", "")
            if not room_id or not circuit_id:
                continue

            circuit = circuits_map.get(circuit_id)
            if not circuit:
                continue

            try:
                result = await self._learn_room(room, circuit, settings, days_back)
                results[room_id] = result
            except Exception as e:
                logger.warning("Lernen fehlgeschlagen fuer Raum %s: %s", room.get("name", room_id), e)
                results[room_id] = {"success": False, "error": str(e)}

        return results

    async def _learn_room(self, room: dict, circuit: dict, settings: dict, days_back: int) -> dict:
        """Lernt tau und Heizkurve fuer einen einzelnen Raum."""
        room_id = room.get("id", "")
        room_name = room.get("name", room_id)
        circuit_type = circuit.get("distributionType", "radiator")

        # Messdaten laden
        temp_data = await self._load_room_temperatures(room_id, days_back)
        outdoor_data = await self._load_outdoor_temperatures(days_back)
        flow_data = await self._load_circuit_flow_temps(room.get("heatingCircuitId", ""), days_back)

        if len(temp_data) < MIN_POINTS:
            return {
                "success": False,
                "error": f"Zu wenig Daten: {len(temp_data)} Punkte (min {MIN_POINTS})",
                "room_name": room_name,
            }

        # tau_response fitten
        tau_response = self._fit_tau_response(temp_data, flow_data, outdoor_data, circuit_type)

        # tau_loss fitten (Abkuehlphasen)
        tau_loss = self._fit_tau_loss(temp_data, outdoor_data)

        # Heizkurve fitten (steepness, parallelShift)
        steepness, parallel_shift = self._fit_heating_curve(
            temp_data, outdoor_data, flow_data,
            circuit.get("designOutdoorTemperatureC", -12),
            circuit.get("flowTemperatureC", 55),
        )

        learned = {
            "room_id": room_id,
            "room_name": room_name,
            "circuit_id": room.get("heatingCircuitId", ""),
            "circuit_type": circuit_type,
            "tau_response_h": round(tau_response, 2),
            "tau_loss_h": round(tau_loss, 1),
            "heating_curve_steepness": round(steepness, 3),
            "heating_curve_parallel_shift": round(parallel_shift, 1),
            "data_points": len(temp_data),
            "learned_at": datetime.now(timezone.utc).isoformat(),
        }

        # In DB speichern
        await self._save_learned_params(room_id, learned)

        logger.info(
            "Raum %s: tau_resp=%.2fh, tau_loss=%.1fh, steepness=%.3f, shift=%.1f (%d Punkte)",
            room_name, tau_response, tau_loss, steepness, parallel_shift, len(temp_data),
        )

        return {"success": True, **learned}

    def _fit_tau_response(
        self,
        temp_data: list[tuple[datetime, float]],
        flow_data: list[tuple[datetime, float]],
        outdoor_data: list[tuple[datetime, float]],
        circuit_type: str,
    ) -> float:
        """
        Fittet tau_response an Aufheizvorgaenge.

        Sucht Phasen wo Temperatur deutlich steigt (>0.5K/h) und fittet
        Exponentialkurve: T(t) = T_final - (T_final-T_start) * exp(-t/tau)
        """
        from app.services.room_thermal_model import TAU_RESPONSE_DEFAULTS

        default_tau = TAU_RESPONSE_DEFAULTS.get(circuit_type, 0.5)

        if len(temp_data) < MIN_POINTS:
            return default_tau

        # Aufheizvorgaenge erkennen (Temperaturanstieg > 0.3K in 1h)
        heating_events = []
        for i in range(1, len(temp_data)):
            t0, v0 = temp_data[i - 1]
            t1, v1 = temp_data[i]
            dt_h = (t1 - t0).total_seconds() / 3600.0
            if 0.05 < dt_h < 2.0 and (v1 - v0) / dt_h > 0.3:
                heating_events.append((t0, t1, v0, v1, dt_h))

        if len(heating_events) < 3:
            return default_tau

        # Rastersuche fuer tau
        best_tau = default_tau
        best_error = float("inf")

        for tau_test in [x * 0.1 for x in range(1, 60)]:  # 0.1h bis 6.0h
            total_error = 0.0
            count = 0
            for _, _, v0, v1, dt_h in heating_events:
                # Angenommene Endtemperatur = v0 + (v1-v0) * 2 (vereinfacht)
                v_final = v0 + (v1 - v0) * 2.0
                v_predicted = v_final - (v_final - v0) * math.exp(-dt_h / tau_test)
                total_error += (v_predicted - v1) ** 2
                count += 1

            if count > 0:
                mse = total_error / count
                if mse < best_error:
                    best_error = mse
                    best_tau = tau_test

        return max(0.1, min(6.0, best_tau))

    def _fit_tau_loss(
        self,
        temp_data: list[tuple[datetime, float]],
        outdoor_data: list[tuple[datetime, float]],
    ) -> float:
        """
        Fittet tau_loss an Abkuehlvorgaenge.

        Sucht Phasen wo Temperatur sinkt und die Heizung offensichtlich aus ist.
        """
        if len(temp_data) < MIN_POINTS:
            return 40.0

        # Outdoor-Temperaturen als Dict fuer schnellen Zugriff
        outdoor_map = {}
        for t, v in outdoor_data:
            key = t.strftime("%Y-%m-%d %H")
            outdoor_map[key] = v

        # Abkuehlvorgaenge erkennen
        cooling_rates = []
        for i in range(1, len(temp_data)):
            t0, v0 = temp_data[i - 1]
            t1, v1 = temp_data[i]
            dt_h = (t1 - t0).total_seconds() / 3600.0
            if dt_h < 0.1 or dt_h > 4.0:
                continue

            rate = (v0 - v1) / dt_h  # K/h Abkuehlung
            if rate < 0.1:
                continue  # Nur Abkuehlung

            # Outdoor-Temperatur finden
            key = t0.strftime("%Y-%m-%d %H")
            t_outdoor = outdoor_map.get(key, 5.0)

            delta = v0 - t_outdoor
            if delta > 5:  # Nur wenn signifikanter Unterschied
                # tau = delta / rate (aus dT/dt = -delta/tau)
                tau_est = delta / rate
                if 5 < tau_est < 200:
                    cooling_rates.append(tau_est)

        if not cooling_rates:
            return 40.0

        # Median nehmen (robust gegen Ausreisser)
        cooling_rates.sort()
        median_tau = cooling_rates[len(cooling_rates) // 2]

        return max(10.0, min(150.0, median_tau))

    def _fit_heating_curve(
        self,
        temp_data: list[tuple[datetime, float]],
        outdoor_data: list[tuple[datetime, float]],
        flow_data: list[tuple[datetime, float]],
        design_outdoor_c: float,
        design_flow_c: float,
    ) -> tuple[float, float]:
        """
        Fittet Heizkurven-Parameter (steepness, parallelShift).

        Sucht stationaere Phasen (Raumtemp stabil +-0.3K ueber 30min)
        und korreliert Outdoor-Temp mit Flow-Temp.
        """
        if len(flow_data) < MIN_POINTS or len(outdoor_data) < MIN_POINTS:
            return 1.2, 0.0

        # Outdoor-Map
        outdoor_map = {}
        for t, v in outdoor_data:
            key = t.strftime("%Y-%m-%d %H")
            outdoor_map[key] = v

        # Flow-Map
        flow_map = {}
        for t, v in flow_data:
            key = t.strftime("%Y-%m-%d %H")
            flow_map[key] = v

        # Stationaere Phasen finden
        stable_points = []  # (outdoor_temp, flow_temp, room_temp)
        for i in range(2, len(temp_data)):
            t0, v0 = temp_data[i - 2]
            t1, v1 = temp_data[i - 1]
            t2, v2 = temp_data[i]

            # Stabil: alle drei Werte innerhalb 0.3K
            if abs(v0 - v1) < 0.3 and abs(v1 - v2) < 0.3:
                key = t1.strftime("%Y-%m-%d %H")
                t_out = outdoor_map.get(key)
                t_flow = flow_map.get(key)

                if t_out is not None and t_flow is not None and t_out < v1 - 3:
                    stable_points.append((t_out, t_flow, v1))

        if len(stable_points) < 5:
            return 1.2, 0.0

        # Rastersuche fuer steepness und parallelShift
        best_steepness = 1.2
        best_shift = 0.0
        best_error = float("inf")
        indoor_target = 21.0

        for steep_10 in range(5, 20):  # 0.5 bis 2.0
            steepness = steep_10 / 10.0
            for shift_10 in range(-30, 31, 5):  # -3.0 bis 3.0
                shift = shift_10 / 10.0
                total_error = 0.0

                for t_out, t_flow_actual, t_room in stable_points:
                    ratio = (indoor_target - t_out) / max(1, indoor_target - design_outdoor_c)
                    ratio = max(0, min(1.5, ratio))
                    t_flow_predicted = indoor_target + steepness * (design_flow_c - indoor_target) * ratio + shift
                    total_error += (t_flow_predicted - t_flow_actual) ** 2

                if total_error < best_error:
                    best_error = total_error
                    best_steepness = steepness
                    best_shift = shift

        return best_steepness, best_shift

    async def _load_room_temperatures(
        self, room_id: str, days_back: int,
    ) -> list[tuple[datetime, float]]:
        """Laedt Raumtemperatur-Messwerte."""
        try:
            async with async_session() as db:
                sql = text("""
                    SELECT timestamp, value
                    FROM measurements
                    WHERE source = :source AND metric = 'temperature_c'
                        AND timestamp >= datetime('now', :days_offset)
                    ORDER BY timestamp
                """)
                result = await db.execute(sql, {
                    "source": f"room_{room_id}",
                    "days_offset": f"-{days_back} days",
                })
                return [(row[0] if isinstance(row[0], datetime) else datetime.fromisoformat(str(row[0])),
                         float(row[1])) for row in result.fetchall()]
        except Exception as e:
            logger.debug("Raumtemperaturen nicht ladbar fuer %s: %s", room_id, e)
            return []

    async def _load_outdoor_temperatures(self, days_back: int) -> list[tuple[datetime, float]]:
        """Laedt Aussentemperatur-Messwerte."""
        try:
            async with async_session() as db:
                sql = text("""
                    SELECT timestamp, value
                    FROM measurements
                    WHERE source = 'outdoor' AND metric = 'temperature_c'
                        AND timestamp >= datetime('now', :days_offset)
                    ORDER BY timestamp
                """)
                result = await db.execute(sql, {"days_offset": f"-{days_back} days"})
                return [(row[0] if isinstance(row[0], datetime) else datetime.fromisoformat(str(row[0])),
                         float(row[1])) for row in result.fetchall()]
        except Exception as e:
            logger.debug("Aussentemperaturen nicht ladbar: %s", e)
            return []

    async def _load_circuit_flow_temps(
        self, circuit_id: str, days_back: int,
    ) -> list[tuple[datetime, float]]:
        """Laedt Vorlauftemperatur-Messwerte eines Kreises."""
        try:
            async with async_session() as db:
                sql = text("""
                    SELECT timestamp, value
                    FROM measurements
                    WHERE source = :source AND metric = 'flow_temp_c'
                        AND timestamp >= datetime('now', :days_offset)
                    ORDER BY timestamp
                """)
                result = await db.execute(sql, {
                    "source": f"circuit_{circuit_id}",
                    "days_offset": f"-{days_back} days",
                })
                return [(row[0] if isinstance(row[0], datetime) else datetime.fromisoformat(str(row[0])),
                         float(row[1])) for row in result.fetchall()]
        except Exception as e:
            logger.debug("Vorlauftemperaturen nicht ladbar fuer %s: %s", circuit_id, e)
            return []

    async def _save_learned_params(self, room_id: str, data: dict):
        """Speichert gelernte Parameter in der DB."""
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(ThermalLearnedParams).where(ThermalLearnedParams.id == room_id)
                )
                entry = result.scalar_one_or_none()

                if entry:
                    entry.data = data
                else:
                    db.add(ThermalLearnedParams(id=room_id, data=data))

                await db.commit()
        except Exception as e:
            logger.warning("Gelernte Parameter speichern fehlgeschlagen: %s", e)

    async def get_learned_params(self) -> dict[str, dict]:
        """Alle gelernten Parameter laden."""
        try:
            async with async_session() as db:
                result = await db.execute(select(ThermalLearnedParams))
                return {row.id: row.data for row in result.scalars()}
        except Exception:
            return {}


# Singleton
thermal_learner = ThermalLearner()
