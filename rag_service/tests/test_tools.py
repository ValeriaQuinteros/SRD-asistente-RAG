import asyncio
import json
from pathlib import Path

from langchain_core.documents import Document

import src.tools as tools_module
from src.schemas import UserContext
from src.tools import build_agent_tools


class FakeSettings:
    def __init__(self, base_path: Path):
        self.data_path = base_path / "data"


class FakeRAG:
    def __init__(self):
        self.last_query = None
        self.last_role = None

    def retrieve(self, query: str, role: str):
        self.last_query = query
        self.last_role = role

        return [
            Document(
                page_content=(
                    "La flexión de rodilla debe realizarse siguiendo "
                    "las instrucciones asignadas por el kinesiólogo."
                ),
                metadata={
                    "title": "Catálogo de ejercicios SRD",
                    "source_type": "internal",
                    "location": "catalogo_ejercicios_demo.csv",
                },
            )
        ]


def _tool_by_name(agent_tools, name):
    return next(item for item in agent_tools if item.name == name)


def _patient_user():
    return UserContext(
        user_id="patient-user-001",
        full_name="Paciente de prueba",
        role="paciente",
    )


def test_build_agent_tools_exposes_expected_tools(tmp_path):
    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=FakeRAG(),
        user=_patient_user(),
        token="demo-token",
    )

    names = {item.name for item in agent_tools}

    assert names == {
        "consultar_documentos",
        "consultar_plan_personal",
        "registrar_solicitud",
    }


def test_document_tool_uses_query_and_authenticated_role(tmp_path):
    fake_rag = FakeRAG()
    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=fake_rag,
        user=_patient_user(),
        token="demo-token",
    )
    document_tool = _tool_by_name(
        agent_tools,
        "consultar_documentos",
    )

    result = json.loads(
        document_tool.invoke(
            {"query": "  flexión   de rodilla  "}
        )
    )

    assert result["status"] == "success"
    assert result["count"] == 1
    assert result["documents"][0]["source_type"] == "internal"
    assert fake_rag.last_query == "flexión de rodilla"
    assert fake_rag.last_role == "paciente"


def test_patient_cannot_read_another_patient_plan(tmp_path):
    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=FakeRAG(),
        user=_patient_user(),
        token="demo-token",
    )
    plan_tool = _tool_by_name(
        agent_tools,
        "consultar_plan_personal",
    )

    result = json.loads(
        asyncio.run(
            plan_tool.ainvoke(
                {"patient_id": "another-patient"}
            )
        )
    )

    assert result["status"] == "forbidden"
    assert "no tiene autorización" in result["message"]


def test_patient_can_read_own_plan(monkeypatch, tmp_path):
    async def fake_fetch_patient_context(
        settings,
        token,
        user,
        requested_patient_id,
    ):
        assert token == "demo-token"
        assert requested_patient_id == user.user_id

        return [
            Document(
                page_content=(
                    "Ejercicio autorizado: flexión de rodilla. "
                    "Frecuencia: tres veces por semana."
                ),
                metadata={
                    "title": "Plan terapéutico autorizado",
                    "source_type": "clinical_record",
                    "location": "assignment-demo",
                },
            )
        ]

    monkeypatch.setattr(
        tools_module,
        "fetch_patient_context",
        fake_fetch_patient_context,
    )

    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=FakeRAG(),
        user=_patient_user(),
        token="demo-token",
    )
    plan_tool = _tool_by_name(
        agent_tools,
        "consultar_plan_personal",
    )

    result = json.loads(
        asyncio.run(
            plan_tool.ainvoke(
                {"patient_id": "patient-user-001"}
            )
        )
    )

    assert result["status"] == "success"
    assert result["count"] == 1
    assert (
        result["documents"][0]["source_type"]
        == "clinical_record"
    )


def test_patient_cannot_register_request_for_another_user(
    tmp_path,
):
    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=FakeRAG(),
        user=_patient_user(),
        token="demo-token",
    )
    request_tool = _tool_by_name(
        agent_tools,
        "registrar_solicitud",
    )

    result = json.loads(
        request_tool.invoke(
            {
                "subject": "Consulta de ejercicio",
                "message": "Necesito aclarar una instrucción.",
                "patient_id": "another-patient",
            }
        )
    )

    assert result["status"] == "forbidden"


def test_register_request_writes_sanitized_record(tmp_path):
    agent_tools = build_agent_tools(
        settings=FakeSettings(tmp_path),
        rag=FakeRAG(),
        user=_patient_user(),
        token="demo-token",
    )
    request_tool = _tool_by_name(
        agent_tools,
        "registrar_solicitud",
    )

    result = json.loads(
        request_tool.invoke(
            {
                "subject": "  Duda   de ejercicio ",
                "message": (
                    " Necesito   confirmar cómo realizar "
                    "el ejercicio. "
                ),
                "patient_id": "patient-user-001",
            }
        )
    )

    output_path = (
        tmp_path
        / "evidence"
        / "runtime"
        / "service_requests.jsonl"
    )

    assert result["status"] == "created"
    assert result["request_id"]
    assert output_path.exists()

    stored = json.loads(
        output_path.read_text(encoding="utf-8").strip()
    )

    assert stored["status"] == "pending_review"
    assert stored["subject"] == "Duda de ejercicio"
    assert stored["role"] == "paciente"
    assert stored["user_hash"]
    assert stored["patient_hash"]
    assert "patient-user-001" not in output_path.read_text(
        encoding="utf-8"
    )