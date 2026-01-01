from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
# core -> app -> Backend -> CollabSpace

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REDIS_URL: str

    class Config:
        env_file = BASE_DIR / ".env"

settings = Settings()
