from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: int = 8000
    MONGODB_URI: str
    REDIS_URL: str  # Set in .env — use Upstash: rediss://default:<password>@<endpoint>.upstash.io:6379
    JWT_SECRET_KEY: str
    JWT_ACCESS_EXPIRATION_MINUTES: int = 30
    JWT_REFRESH_EXPIRATION_DAYS: int = 7
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    FRONTEND_URL: str = "http://localhost:3000"
    SMTP_EMAIL: str          # Your Gmail address
    SMTP_PASSWORD: str       # Gmail App Password (not your real password)
    YOUTUBE_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    QUIZ_API_KEY: str = "" 


    # Cookie / Session
    COOKIE_NAME: str = "session_id"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    SESSION_EXPIRE_DAYS: int = 7
    
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

settings = Settings()