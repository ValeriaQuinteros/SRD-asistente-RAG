import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings

from .settings import Settings


ALLOWED_MEMORY_CATEGORIES = {
    "communication_preference",
    "accessibility_preference",
    "interaction_summary",
}

SENSITIVE_PATTERNS = (
    re.compile(
        r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:contraseña|password|token|clave secreta)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:diagnóstico|diagnosticado|enfermedad|patología)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:medicamento|medicación|dosis|receta)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:dolor|inflamación|lesión|síntoma|síntomas)\b",
        re.IGNORECASE,
    ),
)

PREFERENCE_PATTERN = re.compile(
    (
        r"\b(?:prefiero|me resulta más fácil|"
        r"necesito que me expliques|"
        r"necesito que respondas|"
        r"explícame paso a paso)\b"
    ),
    re.IGNORECASE,
)


def anonymize_user_id(user_id: str) -> str:
    normalized = user_id.strip()

    if not normalized:
        raise ValueError("user_id no puede estar vacío.")

    return hashlib.sha256(
        normalized.encode("utf-8")
    ).hexdigest()[:24]


def sanitize_memory_content(content: str) -> str:
    normalized = " ".join(content.split()).strip()

    if not normalized:
        raise ValueError(
            "El contenido de memoria no puede estar vacío."
        )

    if len(normalized) > 500:
        raise ValueError(
            "El contenido de memoria supera los 500 caracteres."
        )

    if any(
        pattern.search(normalized)
        for pattern in SENSITIVE_PATTERNS
    ):
        raise ValueError(
            "El contenido contiene información clínica, "
            "personal o sensible que no puede almacenarse."
        )

    return normalized


class LongTermMemory:
    def __init__(
        self,
        settings: Settings,
        vectorstore: Any | None = None,
    ):
        self.settings = settings

        if vectorstore is not None:
            self.vectorstore = vectorstore
            return

        embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )

        self.vectorstore = Chroma(
            collection_name="srd_long_term_memory",
            embedding_function=embeddings,
            persist_directory=settings.chroma_path,
        )

    def store_memory(
        self,
        user_id: str,
        content: str,
        category: str,
        conversation_id: str | None = None,
    ) -> str:
        if category not in ALLOWED_MEMORY_CATEGORIES:
            raise ValueError(
                "La categoría de memoria no está autorizada."
            )

        safe_content = sanitize_memory_content(content)
        user_hash = anonymize_user_id(user_id)
        memory_id = str(uuid.uuid4())

        metadata = {
            "memory_id": memory_id,
            "user_hash": user_hash,
            "category": category,
            "created_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "source_type": "long_term_memory",
        }

        if conversation_id:
            metadata["conversation_id"] = conversation_id

        document = Document(
            page_content=safe_content,
            metadata=metadata,
        )

        self.vectorstore.add_documents(
            [document],
            ids=[memory_id],
        )

        return memory_id

    def store_explicit_preference(
        self,
        user_id: str,
        content: str,
        conversation_id: str | None = None,
    ) -> str | None:
        if not PREFERENCE_PATTERN.search(content):
            return None

        try:
            return self.store_memory(
                user_id=user_id,
                content=content,
                category="communication_preference",
                conversation_id=conversation_id,
            )
        except ValueError:
            # Una preferencia con datos sensibles no se almacena.
            return None

    def search_memories(
        self,
        user_id: str,
        query: str,
        limit: int = 3,
    ) -> list[Document]:
        safe_query = " ".join(query.split()).strip()

        if not safe_query:
            return []

        if limit < 1 or limit > 5:
            raise ValueError(
                "El límite debe estar entre 1 y 5."
            )

        user_hash = anonymize_user_id(user_id)

        return self.vectorstore.similarity_search(
            safe_query,
            k=limit,
            filter={
                "user_hash": user_hash,
            },
        )

    def format_for_prompt(
        self,
        memories: list[Document],
    ) -> str:
        if not memories:
            return "Sin recuerdos relevantes."

        return "\n".join(
            (
                f"- [{document.metadata.get('category', 'contexto')}] "
                f"{document.page_content}"
            )
            for document in memories
        )