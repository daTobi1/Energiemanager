from app.models.generator import EnergyForm, Generator, GeneratorType
from app.services.generation_manager import GenerationManager


async def test_get_pv_power(db_session):
    pv = Generator(
        name="PV Dach",
        type=GeneratorType.PV,
        energy_form=EnergyForm.ELECTRICITY,
        max_power_kw=10.0,
        min_power_kw=0.0,
        current_power_kw=7.5,
        is_controllable=False,
    )
    db_session.add(pv)
    await db_session.flush()

    manager = GenerationManager(db_session)
    power = await manager.get_pv_power_kw()
    assert power == 7.5


async def test_surplus_calculation(db_session):
    pv = Generator(
        name="PV",
        type=GeneratorType.PV,
        energy_form=EnergyForm.ELECTRICITY,
        max_power_kw=10.0,
        min_power_kw=0.0,
        current_power_kw=8.0,
        is_controllable=False,
    )
    db_session.add(pv)
    await db_session.flush()

    manager = GenerationManager(db_session)
    surplus = await manager.get_surplus_kw(total_consumption_kw=3.0)
    assert surplus == 5.0


async def test_set_generator_power_respects_limits(db_session):
    gen = Generator(
        name="WP",
        type=GeneratorType.HEAT_PUMP,
        energy_form=EnergyForm.HEAT,
        max_power_kw=12.0,
        min_power_kw=3.0,
        current_power_kw=0.0,
        is_controllable=True,
    )
    db_session.add(gen)
    await db_session.flush()

    manager = GenerationManager(db_session)

    # Over max -> clamped
    result = await manager.set_generator_power(gen.id, 20.0)
    assert result.current_power_kw == 12.0

    # Under min -> clamped
    result = await manager.set_generator_power(gen.id, 1.0)
    assert result.current_power_kw == 3.0
