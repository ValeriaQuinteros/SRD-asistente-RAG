from functools import lru_cache
from pathlib import Path

from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    embedding_model: str = "nomic-embed-text"

    chroma_path: str = str(
        BASE_DIR / "vectorstore"
    )
    allowed_origins: str = "http://localhost:5173"
    top_k: int = 4

    enable_llm_classifier: bool = True
    enable_llm_verifier: bool = False
    demo_mode: bool = False

    memory_db_path: str = (
        "evidence/runtime/conversation_memory.sqlite3"
    )
    memory_window_size: int = 6

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def data_path(self) -> Path:
        return BASE_DIR / "data"

    @property
    def memory_path(self) -> Path:
        configured_path = Path(self.memory_db_path)

        if configured_path.is_absolute():
            return configured_path

        return BASE_DIR / configured_path

    @property
    def origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.allowed_origins.split(",")
            if item.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()