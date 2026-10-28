from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone

from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from .rag_pipeline import RAGPipeline
from .schemas import UserContext
from .settings import Settings
from .supabase_context import fetch_patient_context


class DocumentQueryInput(BaseModel):
    query: str = Field(
        min_length=2,
        max_length=500,
        description="Consulta que se buscará en las fuentes internas y externas.",
    )


class PatientPlanInput(BaseModel):
    patient_id: str | None = Field(
        default=None,
        description=(
            "Identificador del paciente. Un paciente solo puede consultar "
            "su propio identificador."
        ),
    )


class FollowUpRequestInput(BaseModel):
    subject: str = Field(
        min_length=3,
        max_length=100,
        description="Tema breve de la solicitud.",
    )
    message: str = Field(
        min_length=5,
        max_length=500,
        description="Duda o solicitud que debe revisar el kinesiólogo.",
    )
    patient_id: str | None = Field(
        default=None,
        description="Identificador del paciente relacionado con la solicitud.",
    )


def _clean_text(value: str, max_length: int) -> str:
    """Normaliza texto antes de registrarlo."""
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned[:max_length]


def _user_hash(user_id: str) -> str:
    """Genera un identificador para trazabilidad sin guardar el UUID visible."""
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]


def _document_payload(documents) -> list[dict]:
    """Convierte documentos de LangChain en una salida serializable."""
    payload = []

    for document in documents:
        payload.append(
            {
                "title": document.metadata.get("title", "Fuente sin título"),
                "source_type": document.metadata.get(
                    "source_type", "internal"
                ),
                "location": document.metadata.get("location"),
                "url": document.metadata.get("url"),
                "content": " ".join(document.page_content.split()),
            }
        )

    return payload


def build_agent_tools(
    settings: Settings,
    rag: RAGPipeline,
    user: UserContext,
    token: str | None,
) -> list[BaseTool]:
    """
    Crea herramientas vinculadas al usuario autenticado.

    El LLM puede seleccionar las herramientas, pero no recibe permisos
    para cambiar el rol, el token ni el identificador del usuario.
    """

    @tool(
        "consultar_documentos",
        args_schema=DocumentQueryInput,
        return_direct=False,
    )
    def consultar_documentos(query: str) -> str:
        """
        Busca información en los documentos internos y externos autorizados.

        Se utiliza para consultar ejercicios, protocolos, preguntas
        frecuentes y orientaciones generales.
        """
        safe_query = _clean_text(query, 500)
        documents = rag.retrieve(safe_query, user.role)

        result = {
            "tool": "consultar_documentos",
            "status": "success" if documents else "insufficient_evidence",
            "query": safe_query,
            "documents": _document_payload(documents),
            "count": len(documents),
        }

        return json.dumps(result, ensure_ascii=False)

    @tool(
        "consultar_plan_personal",
        args_schema=PatientPlanInput,
        return_direct=False,
    )
    async def consultar_plan_personal(
        patient_id: str | None = None,
    ) -> str:
        """
        Consulta el plan de ejercicios del paciente autorizado.

        La herramienta respeta el JWT y las políticas RLS de Supabase.
        No permite que un paciente consulte información de otra persona.
        """
        requested_patient = patient_id or user.user_id

        if (
            user.role == "paciente"
            and requested_patient != user.user_id
        ):
            return json.dumps(
                {
                    "tool": "consultar_plan_personal",
                    "status": "forbidden",
                    "message": (
                        "El usuario no tiene autorización para consultar "
                        "el plan de otra persona."
                    ),
                },
                ensure_ascii=False,
            )

        documents = await fetch_patient_context(
            settings=settings,
            token=token,
            user=user,
            requested_patient_id=requested_patient,
        )

        result = {
            "tool": "consultar_plan_personal",
            "status": "success" if documents else "not_found",
            "patient_id": requested_patient,
            "documents": _document_payload(documents),
            "count": len(documents),
        }

        return json.dumps(result, ensure_ascii=False)

    @tool(
        "registrar_solicitud",
        args_schema=FollowUpRequestInput,
        return_direct=False,
    )
    def registrar_solicitud(
        subject: str,
        message: str,
        patient_id: str | None = None,
    ) -> str:
        """
        Registra una duda para que sea revisada por un kinesiólogo.

        No modifica diagnósticos, ejercicios, frecuencias ni tratamientos.
        En el prototipo, la solicitud se guarda en un registro local
        sanitizado para demostrar una herramienta de escritura.
        """
        requested_patient = patient_id or user.user_id

        if (
            user.role == "paciente"
            and requested_patient != user.user_id
        ):
            return json.dumps(
                {
                    "tool": "registrar_solicitud",
                    "status": "forbidden",
                    "message": (
                        "El usuario no puede registrar solicitudes "
                        "para otra persona."
                    ),
                },
                ensure_ascii=False,
            )

        request_id = str(uuid.uuid4())
        record = {
            "request_id": request_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "user_hash": _user_hash(user.user_id),
            "role": user.role,
            "patient_hash": _user_hash(requested_patient),
            "subject": _clean_text(subject, 100),
            "message": _clean_text(message, 500),
            "status": "pending_review",
        }

        output_path = (
            settings.data_path.parent
            / "evidence"
            / "runtime"
            / "service_requests.jsonl"
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with output_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

        return json.dumps(
            {
                "tool": "registrar_solicitud",
                "status": "created",
                "request_id": request_id,
                "message": (
                    "La solicitud quedó registrada para revisión "
                    "del kinesiólogo."
                ),
            },
            ensure_ascii=False,
        )

    return [
        consultar_documentos,
        consultar_plan_personal,
        registrar_solicitud,
    ]