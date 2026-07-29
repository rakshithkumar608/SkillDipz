from pydantic_settings import BaseSettings

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

    class Config:
        env_file = ".env"

settings = Settings()