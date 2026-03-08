from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://energiemanager:secret@localhost:5432/energiemanager"
    timescale_enabled: bool = True

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Weather
    weather_api_key: str = ""
    weather_api_provider: str = "openweathermap"
    latitude: float = 51.1657
    longitude: float = 10.4515

    # Security
    secret_key: str = "change-me-in-production"
    api_key: str = "change-me-in-production"

    # ML
    ml_model_dir: str = "./ml_models"
    ml_retrain_interval_hours: int = 168

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
