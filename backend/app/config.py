from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "dev"
    database_url: str = "sqlite+aiosqlite:///./cookguide.db"
    # Any OpenAI-compatible chat API works. Defaults target Groq's free plan.
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:5173"]
    generate_rate: str = "10/minute"


settings = Settings()
