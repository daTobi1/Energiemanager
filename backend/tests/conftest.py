import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.core.database import engine as main_engine
from app.models.base import Base

# Alle Modelle importieren damit Base.metadata alle Tabellen kennt
from app.models import config as _config_models  # noqa: F401
from app.models import ml_status as _ml_models  # noqa: F401
from app.models import thermal_params as _thermal_models  # noqa: F401
from app.models import weather as _weather_models  # noqa: F401
from app.models import alarm as _alarm_models  # noqa: F401
from app.models import user as _user_models  # noqa: F401

from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    # Tabellen auf beiden Engines erstellen (Test-Engine + Main-Engine)
    # Main-Engine wird von Services benoetigt die async_session() direkt nutzen
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with main_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    async with main_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
