from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    APP_NAME: str = "NEXUS IT ASSET MANAGER"
    API_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./ublock.db"
    
    # Security & JWT
    SECRET_KEY: str = "default-insecure-key-for-dev-only-32-chars-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Device Status Threshold (minutes without communication to be considered OFFLINE)
    ONLINE_THRESHOLD_MINUTES: int = 15
    STALE_THRESHOLD_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    # Bootstrap settings
    BOOTSTRAP_ADMIN_EMAIL: str = "admin@ubook.com.br"
    BOOTSTRAP_ADMIN_PASSWORD: str = "UblockAdmin2026!"
    BOOTSTRAP_ADMIN_NAME: str = "Administrador Nexus"
    BOOTSTRAP_ORG_NAME: str = "Ubook Tecnologia"
    BOOTSTRAP_ORG_SLUG: str = "ubook"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["*"]


settings = Settings()
