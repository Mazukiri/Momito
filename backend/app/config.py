from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/momito"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    anthropic_api_key: str
    api_bearer_token: str
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
