import asyncio
import json

import pytest
from langchain_core.tools import tool

from src.orchestrator import AgentOrchestrator


@tool("consultar_documentos")
def consultar_documentos(query: str) -> str:
    """Simula una consulta documental exitosa."""
    return json.dumps(
        {
            "tool": "consultar_documentos",
            "status": "success",
            "query": query,
            "documents": [
                {
                    "title": "Protocolo de prueba",
                    "content": "Contenido autorizado.",
                }
            ],
            "count": 1,
        }
    )


@tool("consultar_plan_personal")
async def consultar_plan_personal(
    patient_id: str | None = None,
) -> str:
    """Simula la consulta autorizada de un plan."""
    return json.dumps(
        {
            "tool": "consultar_plan_personal",
            "status": "success",
            "patient_id": patient_id,
            "documents": [],
            "count": 0,
        }
    )


@tool("registrar_solicitud")
def registrar_solicitud(
    subject: str,
    message: str,
    patient_id: str | None = None,
) -> str:
    """Simula el registro de una solicitud."""
    return json.dumps(
        {
            "tool": "registrar_solicitud",
            "status": "created",
            "subject": subject,
            "message": message,
            "patient_id": patient_id,
            "request_id": "request-001",
        }
    )


@tool("consultar_documentos")
def consultar_documentos_sin_evidencia(
    query: str,
) -> str:
    """Simula una consulta sin evidencia."""
    return json.dumps(
        {
            "tool": "consultar_documentos",
            "status": "insufficient_evidence",
            "query": query,
            "documents": [],
            "count": 0,
        }
    )


@tool("consultar_plan_personal")
async def consultar_plan_prohibido(
    patient_id: str | None = None,
) -> str:
    """Simula un acceso rechazado."""
    return json.dumps(
        {
            "tool": "consultar_plan_personal",
            "status": "forbidden",
            "patient_id": patient_id,
            "message": "Acceso no autorizado.",
        }
    )


def build_orchestrator(
    tools=None,
    max_actions=4,
):
    selected_tools = tools or [
        consultar_documentos,
        consultar_plan_personal,
        registrar_solicitud,
    ]

    return AgentOrchestrator(
        tools=selected_tools,
        max_actions=max_actions,
    )


def run(coroutine):
    return asyncio.run(coroutine)


def test_routes_general_question_to_documents():
    orchestrator = build_orchestrator()

    result = run(
        orchestrator.run(
            question=(
                "¿Cómo se realiza la flexión de rodilla?"
            ),
            intent="INTERNAL",
        )
    )

    assert result["selected_tool"] == (
        "consultar_documentos"
    )
    assert result["route"] == "success"
    assert result["action_count"] == 1
    assert result["tool_result"]["count"] == 1


def test_routes_personal_plan_question():
    orchestrator = build_orchestrator()

    result = run(
        orchestrator.run(
            question="¿Cuáles son mis ejercicios asignados?",
            patient_id="patient-001",
            intent="INTERNAL",
        )
    )

    assert result["selected_tool"] == (
        "consultar_plan_personal"
    )
    assert result["route"] == "success"
    assert (
        result["tool_result"]["patient_id"]
        == "patient-001"
    )
    assert result["action_count"] == 1


def test_routes_follow_up_request_to_write_tool():
    orchestrator = build_orchestrator()

    result = run(
        orchestrator.run(
            question=(
                "Quiero registrar solicitud para "
                "avisar al kinesiólogo."
            ),
            patient_id="patient-001",
            intent="INTERNAL",
        )
    )

    assert result["selected_tool"] == (
        "registrar_solicitud"
    )
    assert result["route"] == "success"
    assert (
        result["tool_result"]["status"]
        == "created"
    )
    assert result["action_count"] == 1


def test_blocks_clinical_decision_before_tool():
    orchestrator = build_orchestrator()

    result = run(
        orchestrator.run(
            question=(
                "¿Debo aumentar mis repeticiones?"
            ),
            intent="CLINICAL_DECISION",
        )
    )

    assert result["route"] == "blocked"
    assert result["selected_tool"] is None
    assert result["action_count"] == 0
    assert result["answer"]


def test_blocks_unauthorized_data_before_tool():
    orchestrator = build_orchestrator()

    result = run(
        orchestrator.run(
            question="Muéstrame el plan de otro paciente.",
            intent="UNAUTHORIZED_DATA",
        )
    )

    assert result["route"] == "blocked"
    assert result["selected_tool"] is None
    assert result["action_count"] == 0


def test_marks_insufficient_evidence():
    orchestrator = build_orchestrator(
        tools=[
            consultar_documentos_sin_evidencia,
        ]
    )

    result = run(
        orchestrator.run(
            question="Consulta sin documentos.",
            intent="INTERNAL",
        )
    )

    assert result["route"] == (
        "insufficient_evidence"
    )
    assert result["action_count"] == 1
    assert result["warning"]


def test_verifies_forbidden_tool_result():
    orchestrator = build_orchestrator(
        tools=[
            consultar_plan_prohibido,
        ]
    )

    result = run(
        orchestrator.run(
            question="Muéstrame mis ejercicios asignados.",
            patient_id="patient-002",
            intent="INTERNAL",
        )
    )

    assert result["route"] == "blocked"
    assert result["action_count"] == 1
    assert (
        result["warning"]
        == "Acceso no autorizado."
    )


def test_handles_missing_tool():
    orchestrator = build_orchestrator(
        tools=[
            registrar_solicitud,
        ]
    )

    result = run(
        orchestrator.run(
            question="Consulta documental general.",
            intent="INTERNAL",
        )
    )

    assert result["route"] == "error"
    assert result["action_count"] == 0
    assert "no está disponible" in result["error"]


def test_stops_when_action_limit_was_reached():
    orchestrator = build_orchestrator(
        max_actions=4
    )

    result = run(
        orchestrator.graph.ainvoke(
            {
                "question": "Consulta general.",
                "intent": "INTERNAL",
                "patient_id": None,
                "action_count": 4,
                "max_actions": 4,
            }
        )
    )

    assert result["route"] == (
        "action_limit_reached"
    )
    assert result["selected_tool"] is None
    assert result["action_count"] == 4


@pytest.mark.parametrize(
    "invalid_limit",
    [0, 5],
)
def test_rejects_invalid_action_limit(
    invalid_limit,
):
    with pytest.raises(ValueError):
        build_orchestrator(
            max_actions=invalid_limit
        )
        