"""
Seed-Script: Erzeugt realistische Lade-Simulationsdaten.

Erstellt:
- 2 Fahrzeuge (Tesla Model 3, VW ID.4)
- 1 Wallbox (falls keine existiert)
- ~25 abgeschlossene Ladesessions ueber 90 Tage verteilt
  mit realistischen Energiewerten, Solar/Grid-Split, Kosten und Dauern
"""

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import async_session, engine  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models import config as _  # noqa: E402, F401
from app.models import charging as _c  # noqa: E402, F401
from app.models.charging import (  # noqa: E402
    ChargingMode,
    ChargingSession,
    SessionStatus,
    Vehicle,
    Wallbox,
)
from sqlalchemy import select, delete  # noqa: E402

random.seed(42)

# Fahrzeug-Definitionen
VEHICLES = [
    {
        "name": "Tesla Model 3",
        "brand": "Tesla",
        "model": "Model 3 LR",
        "license_plate": "M-EM 301",
        "battery_kwh": 75.0,
        "consumption_per_100km": 15.5,
        "default_soc_limit_pct": 80.0,
        "max_ac_power_kw": 11.0,
        "connector_type": "type2",
        "color": "#cc0000",
        "year": 2023,
    },
    {
        "name": "VW ID.4",
        "brand": "Volkswagen",
        "model": "ID.4 Pro",
        "license_plate": "M-EM 404",
        "battery_kwh": 77.0,
        "consumption_per_100km": 17.2,
        "default_soc_limit_pct": 80.0,
        "max_ac_power_kw": 11.0,
        "connector_type": "type2",
        "color": "#0066cc",
        "year": 2024,
    },
]

# Session-Vorlagen: (mode, energy_range_kwh, solar_pct_range, hour_range)
SESSION_TEMPLATES = [
    # Sofort-Laden: abends/nachts, hohe Energie, wenig Solar
    (ChargingMode.MAX_SPEED, (15, 45), (0, 15), (18, 23)),
    (ChargingMode.MAX_SPEED, (20, 55), (0, 10), (20, 6)),
    # PV-Laden: tagsüber, mittlere Energie, viel Solar
    (ChargingMode.PV_SURPLUS, (8, 25), (70, 98), (9, 16)),
    (ChargingMode.PV_SURPLUS, (5, 18), (80, 100), (10, 15)),
    # Min+PV: ganztags, garantierte Mindestmenge
    (ChargingMode.MIN_PV, (12, 35), (40, 75), (8, 18)),
    (ChargingMode.MIN_PV, (10, 28), (35, 65), (7, 17)),
    # Ziel-Laden: über Nacht, zielgerichtet
    (ChargingMode.TARGET_CHARGE, (20, 50), (5, 25), (22, 7)),
    (ChargingMode.TARGET_CHARGE, (15, 40), (10, 30), (21, 6)),
]

GRID_PRICE_CT = 30.0  # ct/kWh Netzstrom


def random_session(
    vehicle: Vehicle,
    wallbox_id: int,
    base_date: datetime,
) -> ChargingSession:
    """Erzeugt eine realistische Ladesession."""
    tmpl = random.choice(SESSION_TEMPLATES)
    mode, energy_range, solar_range, hour_range = tmpl

    # Startzeit
    start_hour = random.randint(hour_range[0], hour_range[1]) if hour_range[0] <= hour_range[1] \
        else random.choice(list(range(hour_range[0], 24)) + list(range(0, hour_range[1] + 1)))
    start_min = random.randint(0, 59)
    started_at = base_date.replace(hour=start_hour, minute=start_min, second=random.randint(0, 59))

    # Energie
    energy_kwh = round(random.uniform(*energy_range), 1)
    solar_pct = random.uniform(*solar_range) / 100
    solar_kwh = round(energy_kwh * solar_pct, 2)
    grid_kwh = round(energy_kwh - solar_kwh, 2)

    # Kosten: nur Netzstrom kostet
    cost_ct = round(grid_kwh * GRID_PRICE_CT, 1)

    # Ladeleistung: 3-11 kW je nach Modus
    if mode == ChargingMode.MAX_SPEED:
        avg_power = random.uniform(8.5, 11.0)
    elif mode == ChargingMode.PV_SURPLUS:
        avg_power = random.uniform(2.5, 7.5)
    elif mode == ChargingMode.MIN_PV:
        avg_power = random.uniform(4.0, 9.0)
    else:  # TARGET_CHARGE
        avg_power = random.uniform(3.5, 8.0)

    # Dauer aus Energie/Leistung
    duration_h = energy_kwh / avg_power
    completed_at = started_at + timedelta(hours=duration_h)

    # SoC
    start_soc = random.uniform(15, 55)
    charged_soc = (energy_kwh / vehicle.battery_kwh) * 100
    end_soc = min(start_soc + charged_soc, vehicle.default_soc_limit_pct)

    vehicle_name = f"{vehicle.brand} {vehicle.model}".strip() or vehicle.name

    session = ChargingSession(
        wallbox_id=wallbox_id,
        vehicle_id=vehicle.id,
        mode=mode.value,
        status=SessionStatus.COMPLETED.value,
        current_power_kw=0.0,
        energy_charged_kwh=energy_kwh,
        solar_energy_kwh=solar_kwh,
        grid_energy_kwh=grid_kwh,
        cost_ct=cost_ct,
        vehicle_battery_capacity_kwh=vehicle.battery_kwh,
        vehicle_soc_pct=round(end_soc, 1),
        vehicle_efficiency_kwh_per_km=vehicle.consumption_per_100km / 100,
        vehicle_name=vehicle_name,
        soc_limit_pct=vehicle.default_soc_limit_pct,
        started_at=started_at,
        completed_at=completed_at,
    )

    if mode == ChargingMode.TARGET_CHARGE:
        session.target_km = round(energy_kwh / (vehicle.consumption_per_100km / 100), 0)
        session.target_time = completed_at + timedelta(minutes=random.randint(30, 120))
        session.target_energy_kwh = energy_kwh

    return session


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Alte Sessions löschen
        await db.execute(delete(ChargingSession))
        await db.execute(delete(Vehicle))
        await db.flush()
        print("Alte Ladesessions und Fahrzeuge gelöscht.")

        # Fahrzeuge anlegen
        vehicles = []
        for vdata in VEHICLES:
            v = Vehicle(**vdata)
            db.add(v)
            await db.flush()
            await db.refresh(v)
            vehicles.append(v)
            print(f"  Fahrzeug: {v.name} (ID {v.id})")

        # Wallbox prüfen/anlegen
        wb_result = await db.execute(select(Wallbox).limit(1))
        wallbox = wb_result.scalar_one_or_none()
        if not wallbox:
            wallbox = Wallbox(
                name="Wallbox Garage",
                max_power_kw=11.0,
                min_power_kw=1.4,
                phases=3,
                is_active=True,
            )
            db.add(wallbox)
            await db.flush()
            await db.refresh(wallbox)
            print(f"  Wallbox erstellt: {wallbox.name} (ID {wallbox.id})")
        else:
            print(f"  Wallbox vorhanden: {wallbox.name} (ID {wallbox.id})")

        # Wallbox dem ersten Fahrzeug zuweisen
        wallbox.assigned_vehicle_id = vehicles[0].id
        await db.flush()

        # Sessions erzeugen: 90 Tage, ~25 Sessions
        now = datetime.now(timezone.utc)
        sessions_created = 0

        for days_ago in range(90, 0, -1):
            # Nicht jeden Tag laden — ca. 3-4 Ladungen pro Woche
            if random.random() < 0.6:
                continue

            base_date = now - timedelta(days=days_ago)
            vehicle = random.choice(vehicles)
            session = random_session(vehicle, wallbox.id, base_date)
            db.add(session)
            sessions_created += 1

            # Manchmal zwei Sessions am Tag (zweites Fahrzeug)
            if random.random() < 0.25:
                vehicle2 = [v for v in vehicles if v.id != vehicle.id][0]
                session2 = random_session(vehicle2, wallbox.id, base_date)
                db.add(session2)
                sessions_created += 1

        await db.commit()
        print(f"\n{sessions_created} Ladesessions erstellt (90 Tage).")

        # Zusammenfassung
        result = await db.execute(select(ChargingSession))
        all_s = result.scalars().all()
        total_e = sum(s.energy_charged_kwh for s in all_s)
        total_s = sum(s.solar_energy_kwh for s in all_s)
        total_c = sum(s.cost_ct for s in all_s)
        print(f"  Gesamt: {total_e:.1f} kWh ({total_s:.1f} kWh Solar = {total_s/total_e*100:.0f}%)")
        print(f"  Kosten: {total_c/100:.2f} EUR")
        modes = {}
        for s in all_s:
            modes[s.mode] = modes.get(s.mode, 0) + 1
        for m, c in sorted(modes.items()):
            print(f"  {m}: {c} Sessions")


if __name__ == "__main__":
    print("=== Lade-Simulationsdaten ===\n")
    asyncio.run(seed())
    print("\nFertig!")
