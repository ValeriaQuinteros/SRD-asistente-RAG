from types import SimpleNamespace

from langchain_core.documents import Document

from src.agent import SRDAssistAgent
from src.schemas import ChatRequest, UserContext


class FakeShortTermMemory:
    def __init__(self):
        self.saved_exchanges = []

    def add_exchange(
        self,
        conversation_id,
        user_id,
        user_message,
        assistant_message,
    ):
        self.saved_exchanges.append(
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "user_message": user_message,
                "assistant_message": assistant_message,
            }
        )


class FakeLongTermMemory:
    def __init__(
        self,
        search_error=False,
        store_error=False,
    ):
        self.search_error = search_error
        self.store_error = store_error
        self.search_calls = []
        self.saved_preferences = []

    def search_memories(
        self,
        user_id,
        query,
        limit,
    ):
        if self.search_error:
            raise RuntimeError(
                "Almacén semántico no disponible."
            )

        self.search_calls.append(
            {
                "user_id": user_id,
                "query": query,
                "limit": limit,
            }
        )

        return [
            Document(
                page_content="Prefiero respuestas breves.",
                metadata={
                    "category": "communication_preference"
                },
            )
        ]

    def format_for_prompt(self, memories):
        if not memories:
            return "Sin recuerdos relevantes."

        return "\n".join(
            document.page_content
            for document in memories
        )

    def store_explicit_preference(
        self,
        user_id,
        content,
        conversation_id,
    ):
        if self.store_error:
            raise RuntimeError(
                "No fue posible guardar la preferencia."
            )

        self.saved_preferences.append(
            {
                "user_id": user_id,
                "content": content,
                "conversation_id": conversation_id,
            }
        )

        return "memory-001"


def build_agent(
    long_term_memory=None,
    short_term_memory=None,
):
    agent = object.__new__(SRDAssistAgent)
    agent.settings = SimpleNamespace(
        memory_window_size=6
    )
    agent.memory = (
        short_term_memory
        or FakeShortTermMemory()
    )
    agent.long_term_memory = (
        long_term_memory
        or FakeLongTermMemory()
    )
    return agent


def build_request():
    return ChatRequest(
        question="Prefiero respuestas breves.",
        conversation_id="conversation-001",
    )


def build_user():
    return UserContext(
        user_id="usuario-001",
        full_name="Paciente de prueba",
        role="paciente",
    )


def test_agent_recovers_long_term_context_for_user():
    long_term_memory = FakeLongTermMemory()
    agent = build_agent(
        long_term_memory=long_term_memory
    )

    context = agent.load_long_term_context(
        build_request(),
        build_user(),
    )

    assert context == "Prefiero respuestas breves."
    assert long_term_memory.search_calls == [
        {
            "user_id": "usuario-001",
            "query": "Prefiero respuestas breves.",
            "limit": 3,
        }
    ]


def test_agent_continues_when_semantic_search_fails():
    agent = build_agent(
        long_term_memory=FakeLongTermMemory(
            search_error=True
        )
    )

    context = agent.load_long_term_context(
        build_request(),
        build_user(),
    )

    assert context == "Sin recuerdos relevantes."


def test_agent_saves_short_and_long_term_memory():
    short_term_memory = FakeShortTermMemory()
    long_term_memory = FakeLongTermMemory()
    agent = build_agent(
        long_term_memory=long_term_memory,
        short_term_memory=short_term_memory,
    )

    agent.save_exchange(
        request=build_request(),
        user=build_user(),
        answer="Responderé de manera breve.",
    )

    assert len(
        short_term_memory.saved_exchanges
    ) == 1
    assert len(
        long_term_memory.saved_preferences
    ) == 1

    assert (
        long_term_memory.saved_preferences[0]["user_id"]
        == "usuario-001"
    )
    assert (
        long_term_memory.saved_preferences[0][
            "conversation_id"
        ]
        == "conversation-001"
    )


def test_semantic_store_failure_does_not_remove_short_memory():
    short_term_memory = FakeShortTermMemory()
    agent = build_agent(
        long_term_memory=FakeLongTermMemory(
            store_error=True
        ),
        short_term_memory=short_term_memory,
    )

    agent.save_exchange(
        request=build_request(),
        user=build_user(),
        answer="Responderé de manera breve.",
    )

    assert len(
        short_term_memory.saved_exchanges
    ) == 1