"""Erzeugungsmanagement — steuert alle Energieerzeuger."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generator import Generator, GeneratorType


class GenerationManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_total_generation_kw(self) -> dict[str, float]:
        """Aktuelle Gesamterzeugung nach Energieform."""
        result = await self.db.execute(select(Generator).where(Generator.is_active))
        generators = result.scalars().all()

        totals = {"electricity": 0.0, "heat": 0.0, "cold": 0.0}
        for gen in generators:
            totals[gen.energy_form.value] += gen.current_power_kw
        return totals

    async def get_pv_power_kw(self) -> float:
        """Aktuelle PV-Leistung."""
        result = await self.db.execute(
            select(Generator).where(
                Generator.type == GeneratorType.PV, Generator.is_active
            )
        )
        return sum(g.current_power_kw for g in result.scalars().all())

    async def get_surplus_kw(self, total_consumption_kw: float) -> float:
        """Berechne aktuellen Erzeugungsüberschuss (Strom)."""
        totals = await self.get_total_generation_kw()
        return totals["electricity"] - total_consumption_kw

    async def set_generator_power(self, generator_id: int, power_kw: float) -> Generator | None:
        """Setze Leistung eines steuerbaren Erzeugers."""
        generator = await self.db.get(Generator, generator_id)
        if not generator or not generator.is_controllable:
            return None

        power_kw = max(generator.min_power_kw, min(power_kw, generator.max_power_kw))
        generator.current_power_kw = power_kw
        return generator
