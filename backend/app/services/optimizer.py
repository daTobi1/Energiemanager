"""Optimizer — Zentrale Optimierungslogik für Einsatzplanung."""

from dataclasses import dataclass


@dataclass
class OptimizationResult:
    """Ergebnis der Optimierung für einen 15-Minuten-Zeitschritt."""
    generator_setpoints: dict[int, float]   # generator_id -> power_kw
    storage_setpoints: dict[int, float]     # storage_id -> power_kw (+charge/-discharge)
    charging_setpoints: dict[int, float]    # session_id -> power_kw
    grid_power_kw: float                    # positiv=Bezug, negativ=Einspeisung
    cost_eur: float


class Optimizer:
    """Regelbasierte Optimierungsheuristik (Phase 1).

    Wird später durch MILP-Optimierung (PuLP/OR-Tools) ersetzt.
    """

    def optimize_step(
        self,
        pv_forecast_kw: float,
        load_forecast_kw: float,
        heat_demand_kw: float,
        battery_soc_pct: float,
        battery_capacity_kwh: float,
        charging_demands: dict[int, float],  # session_id -> required_kw
        feed_in_tariff_eur: float = 0.08,
        grid_price_eur: float = 0.30,
    ) -> OptimizationResult:
        """Optimiere einen einzelnen Zeitschritt (regelbasiert)."""

        surplus_kw = pv_forecast_kw - load_forecast_kw
        storage_setpoints: dict[int, float] = {}
        charging_setpoints: dict[int, float] = {}
        remaining_surplus = surplus_kw

        # 1. Ladeanforderungen bedienen (Priorität: Modus 1 > Modus 3 > Modus 2)
        for session_id, demand_kw in sorted(
            charging_demands.items(), key=lambda x: x[1], reverse=True
        ):
            allocated = min(demand_kw, max(0, remaining_surplus))
            # Bei Bedarf Netzstrom nutzen (wird für Modus 2 ggf. auf 0 gesetzt)
            charging_setpoints[session_id] = max(allocated, 0)
            remaining_surplus -= allocated

        # 2. Batterie laden wenn Überschuss
        if remaining_surplus > 0 and battery_soc_pct < 90:
            charge_kw = remaining_surplus
            storage_setpoints[1] = charge_kw  # Vereinfacht: Batterie ID 1
            remaining_surplus -= charge_kw

        # 3. Batterie entladen wenn Defizit
        elif remaining_surplus < 0 and battery_soc_pct > 20:
            discharge_kw = min(abs(remaining_surplus), battery_capacity_kwh * 0.5)
            storage_setpoints[1] = -discharge_kw
            remaining_surplus += discharge_kw

        grid_power_kw = -remaining_surplus  # negativ = Einspeisung

        # Kosten berechnen
        if grid_power_kw > 0:
            cost = grid_power_kw * grid_price_eur * 0.25  # 15 Minuten
        else:
            cost = grid_power_kw * feed_in_tariff_eur * 0.25  # Vergütung (negativ)

        return OptimizationResult(
            generator_setpoints={},
            storage_setpoints=storage_setpoints,
            charging_setpoints=charging_setpoints,
            grid_power_kw=grid_power_kw,
            cost_eur=cost,
        )
