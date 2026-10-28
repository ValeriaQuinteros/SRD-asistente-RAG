import asyncio
from pathlib import Path
from types import SimpleNamespace

import src.agent as agent_module
from src.agent import SRDAssistAgent
from src.schemas import ChatRequest, UserContext


def build_request(
    question="¿Cómo realizo este ejercicio?",
):
    return ChatRequest(
        question=question,
        patient_id="patient-001",
        conversation_id="conversation-001",
    )


def build_user():
    return UserContext(
        user_id="usuario-001",
        full_name="Paciente de prueba",
        role="paciente",
    )


def build_agent(saved_exchanges):
    agent = object.__new__(SRDAssistAgent)
    agent.settings = SimpleNamespace(
        memory_window_size=6,
        data_path=Path("rag_service/data/internal"),
        enable_llm_verifier=False,
    )
    agent.rag = object()

    agent.load_history = lambda request, user: []
    agent.load_long_term_context = (
        lambda request, user: "Sin recuerdos relevantes."
    )
    agent.classify = (
        lambda question, role: "INTERNAL"
    )
    agent.rewrite = (
        lambda question, history: question
    )
    agent.save_exchange = (
        lambda request, user, answer: (
            saved_exchanges.append(answer)
        )
    )

    return agent


def install_fake_orchestrator(
    monkeypatch,
    orchestration_result,
    captured,
):
    def fake_build_agent_tools(
        settings,
        rag,
        user,
        token,
    ):
        captured["tool_user"] = user.user_id
        captured["tool_token"] = token
        return ["tool-for-test"]

    class FakeOrchestrator:
        def __init__(
            self,
            tools,
            max_actions,
        ):
            captured["tools"] = tools
            captured["max_actions"] = max_actions

        async def run(
            self,
            question,
            patient_id=None,
            intent=None,
        ):
            captured["question"] = question
            captured["patient_id"] = patient_id
            captured["intent"] = intent
            return orchestration_result

    monkeypatch.setattr(
        agent_module,
        "build_agent_tools",
        fake_build_agent_tools,
    )
    monkeypatch.setattr(
        agent_module,
        "AgentOrchestrator",
        FakeOrchestrator,
    )
    monkeypatch.setattr(
        agent_module,
        "write_trace",
        lambda *args, **kwargs: None,
    )


def test_answer_uses_orchestrator_and_four_action_limit(
    monkeypatch,
):
    captured = {}
    saved_exchanges = []

    install_fake_orchestrator(
        monkeypatch,
        {
            "route": "blocked",
            "selected_tool": None,
            "answer": "Solicitud bloqueada.",
            "warning": "Acción no autorizada.",
            "action_count": 0,
        },
        captured,
    )

    agent = build_agent(saved_exchanges)

    response = asyncio.run(
        agent.answer(
            request=build_request(),
            user=build_user(),
            token="jwt-prueba",
        )
    )

    assert response.answer == "Solicitud bloqueada."
    assert response.warning == "Acción no autorizada."
    assert captured["max_actions"] == 4
    assert captured["tool_user"] == "usuario-001"
    assert captured["tool_token"] == "jwt-prueba"
    assert captured["patient_id"] == "patient-001"
    assert saved_exchanges == ["Solicitud bloqueada."]


def test_answer_returns_created_request_without_llm(
    monkeypatch,
):
    captured = {}
    saved_exchanges = []

    install_fake_orchestrator(
        monkeypatch,
        {
            "route": "success",
            "selected_tool": "registrar_solicitud",
            "tool_result": {
                "status": "created",
                "request_id": "request-001",
                "message": (
                    "La solicitud quedó registrada "
                    "para revisión del kinesiólogo."
                ),
            },
            "action_count": 1,
        },
        captured,
    )

    agent = build_agent(saved_exchanges)

    response = asyncio.run(
        agent.answer(
            request=build_request(
                "Quiero registrar solicitud de seguimiento."
            ),
            user=build_user(),
            token="jwt-prueba",
        )
    )

    assert "quedó registrada" in response.answer
    assert response.sources == []
    assert response.warning is None
    assert len(saved_exchanges) == 1


def test_answer_handles_orchestration_error(
    monkeypatch,
):
    captured = {}
    saved_exchanges = []

    install_fake_orchestrator(
        monkeypatch,
        {
            "route": "error",
            "selected_tool": "consultar_documentos",
            "error": "Herramienta no disponible.",
            "action_count": 0,
        },
        captured,
    )

    agent = build_agent(saved_exchanges)

    response = asyncio.run(
        agent.answer(
            request=build_request(),
            user=build_user(),
            token="jwt-prueba",
        )
    )

    assert "No fue posible completar" in response.answer
    assert (
        response.warning
        == "Herramienta no disponible."
    )
    assert len(saved_exchanges) == 1


def test_documents_are_created_from_tool_result():
    documents = (
        SRDAssistAgent.documents_from_tool_result(
            {
                "status": "success",
                "documents": [
                    {
                        "title": "Protocolo SRD",
                        "source_type": "internal",
                        "location": "protocolo.md",
                        "url": None,
                        "content": (
                            "Contenido recuperado "
                            "por la herramienta."
                        ),
                    }
                ],
            }
        )
    )

    assert len(documents) == 1
    assert (
        documents[0].page_content
        == "Contenido recuperado por la herramienta."
    )
    assert (
        documents[0].metadata["title"]
        == "Protocolo SRD"
    )
    assert (
        documents[0].metadata["source_type"]
        == "internal"
    )


def test_empty_tool_documents_are_ignored():
    documents = (
        SRDAssistAgent.documents_from_tool_result(
            {
                "status": "success",
                "documents": [
                    {
                        "title": "Fuente vacía",
                        "content": "   ",
                    }
                ],
            }
        )
    )

    assert documents == []