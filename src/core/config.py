from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Класс для управления всеми настройками приложения.
    Pydantic автоматически прочитает файл .env и сопоставит переменные.
    """

    db_user: str
    db_pass: str
    db_name: str

    database_url: str
    valkey_url: str

    # Секретный ключ для создания JWT токенов
    secret_key: str = "change_me_in_production"

    sla_check_interval_seconds: int = 60
    worker_batch_size: int = 100

    cors_origins: list[str] = ["http://localhost:8001", "http://localhost:8002"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()  # type: ignore
