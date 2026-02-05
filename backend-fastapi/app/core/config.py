import os


def getenv_int(key: str, default: int) -> int:
    v = os.getenv(key)
    return int(v) if v is not None else default


class Settings:
    APP_ENV = os.getenv("APP_ENV", "local")
    WS_PATH = os.getenv("WS_PATH", "/ws/meeting")

    CHUNK_MS = getenv_int("CHUNK_MS", 1000)
    BUFFER_MS = getenv_int("BUFFER_MS", 2000)
    SAMPLE_RATE = getenv_int("SAMPLE_RATE", 16000)
    STT_WINDOW_MS = getenv_int("STT_WINDOW_MS", 4000)


settings = Settings()
