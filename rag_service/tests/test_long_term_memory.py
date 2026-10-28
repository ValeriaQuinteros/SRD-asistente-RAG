import pytest
from langchain_core.documents import Document

from src.long_term_memory import (
    LongTermMemory,
    anonymize_user_id,
    sanitize_memory_content,
)
from src.settings import Settings


class FakeVectorStore:
    def __init__(self):
        self.documents = []
        self.ids = []
        self.last_filter = None

    def add_documents(self, documents, ids):
        self.documents.extend(documents)
        self.ids.extend(ids)

    def similarity_search(
        self,
        query,
        k=3,
        filter=None,
    ):
        self.last_filter = filter
        query_terms = set(query.lower().split())

        allowed_documents = [
            document
            for document in self.documents
            if all(
                document.metadata.get(key) == value
                for key, value in (filter or {}).items()
            )
        ]

        return sorted(
            allowed_documents,
            key=lambda document: len(
                query_terms.intersection(
                    document.page_content.lower().split()
                )
            ),
            reverse=True,
        )[:k]


@pytest.fixture
def memory():
    return LongTermMemory(
        settings=Settings(),
        vectorstore=FakeVectorStore(),
    )


def test_anonymize_user_id_is_stable():
    first_hash = anonymize_user_id("usuario-001")
    second_hash = anonymize_user_id("usuario-001")

    assert first_hash == second_hash
    assert "usuario-001" not in first_hash
    assert len(first_hash) == 24


def test_anonymize_user_id_rejects_empty_value():
    with pytest.raises(ValueError):
        anonymize_user_id("   ")


def test_sanitize_memory_normalizes_spaces():
    result = sanitize_memory_content(
        "  Prefiero   respuestas   breves.  "
    )

    assert result == "Prefiero respuestas breves."


@pytest.mark.parametrize(
    "content",
    [
        "Mi correo es paciente@example.com",
        "Mi diagnóstico es una lesión deportiva",
        "La dosis del medicamento fue modificada",
        "Mi contraseña es secreto123",
        "Siento dolor durante el ejercicio",
    ],
)
def test_sanitize_memory_rejects_sensitive_content(
    content,
):
    with pytest.raises(ValueError):
        sanitize_memory_content(content)


def test_store_memory_uses_anonymized_metadata(memory):
    memory_id = memory.store_memory(
        user_id="usuario-001",
        content="Prefiero explicaciones paso a paso.",
        category="communication_preference",
        conversation_id="conversation-001",
    )

    stored_document = memory.vectorstore.documents[0]

    assert memory_id
    assert (
        stored_document.page_content
        == "Prefiero explicaciones paso a paso."
    )
    assert (
        stored_document.metadata["user_hash"]
        == anonymize_user_id("usuario-001")
    )
    assert (
        stored_document.metadata["conversation_id"]
        == "conversation-001"
    )
    assert "usuario-001" not in str(
        stored_document.metadata
    )


def test_store_memory_rejects_unknown_category(memory):
    with pytest.raises(ValueError):
        memory.store_memory(
            user_id="usuario-001",
            content="Prefiero respuestas breves.",
            category="clinical_diagnosis",
        )


def test_search_memories_isolates_users(memory):
    memory.store_memory(
        user_id="usuario-001",
        content="Prefiero respuestas breves.",
        category="communication_preference",
    )
    memory.store_memory(
        user_id="usuario-002",
        content="Prefiero explicaciones detalladas.",
        category="communication_preference",
    )

    results = memory.search_memories(
        user_id="usuario-001",
        query="respuestas breves",
    )

    assert len(results) == 1
    assert (
        results[0].page_content
        == "Prefiero respuestas breves."
    )
    assert memory.vectorstore.last_filter == {
        "user_hash": anonymize_user_id(
            "usuario-001"
        )
    }


def test_search_memories_orders_relevant_content(memory):
    memory.store_memory(
        user_id="usuario-001",
        content="Prefiero respuestas breves y directas.",
        category="communication_preference",
    )
    memory.store_memory(
        user_id="usuario-001",
        content="Necesito explicaciones paso a paso.",
        category="accessibility_preference",
    )

    results = memory.search_memories(
        user_id="usuario-001",
        query="explicaciones paso a paso",
        limit=2,
    )

    assert len(results) == 2
    assert (
        results[0].page_content
        == "Necesito explicaciones paso a paso."
    )


def test_search_memories_rejects_invalid_limit(memory):
    with pytest.raises(ValueError):
        memory.search_memories(
            user_id="usuario-001",
            query="preferencias",
            limit=6,
        )


def test_search_memories_returns_empty_for_empty_query(
    memory,
):
    results = memory.search_memories(
        user_id="usuario-001",
        query="   ",
    )

    assert results == []


def test_format_for_prompt(memory):
    memories = [
        Document(
            page_content="Prefiero respuestas breves.",
            metadata={
                "category": "communication_preference"
            },
        )
    ]

    result = memory.format_for_prompt(memories)

    assert "communication_preference" in result
    assert "Prefiero respuestas breves." in result


def test_store_explicit_preference(memory):
    memory_id = memory.store_explicit_preference(
        user_id="usuario-001",
        content="Prefiero respuestas breves.",
        conversation_id="conversation-001",
    )

    assert memory_id is not None
    assert len(memory.vectorstore.documents) == 1


def test_store_explicit_preference_ignores_regular_text(
    memory,
):
    memory_id = memory.store_explicit_preference(
        user_id="usuario-001",
        content="¿Cómo se realiza este ejercicio?",
    )

    assert memory_id is None
    assert memory.vectorstore.documents == []


def test_store_explicit_preference_rejects_sensitive_data(
    memory,
):
    memory_id = memory.store_explicit_preference(
        user_id="usuario-001",
        content="Prefiero respuestas sobre mi diagnóstico.",
    )

    assert memory_id is None
    assert memory.vectorstore.documents == []