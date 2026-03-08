from pydantic import BaseModel

from app.models.generator import EnergyForm, GeneratorType


class GeneratorBase(BaseModel):
    name: str
    type: GeneratorType
    energy_form: EnergyForm
    max_power_kw: float
    min_power_kw: float = 0.0
    efficiency: float = 1.0
    is_controllable: bool = True


class GeneratorCreate(GeneratorBase):
    pass


class GeneratorResponse(GeneratorBase):
    id: int
    is_active: bool
    current_power_kw: float

    model_config = {"from_attributes": True}


class GeneratorControl(BaseModel):
    target_power_kw: float | None = None
    is_active: bool | None = None
