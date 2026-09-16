import httpx
from langchain_core.documents import Document

from .schemas import UserContext
from .settings import Settings


async def fetch_patient_context(
    settings: Settings,
    token: str | None,
    user: UserContext,
    requested_patient_id: str | None,
) -> list[Document]:
    patient_id = requested_patient_id or user.user_id
    if user.role == "paciente" and patient_id != user.user_id:
        return []
    if settings.demo_mode or not token:
        return []

    headers = {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"}
    params = {
        "patient_id": f"eq.{patient_id}",
        "active": "eq.true",
        "select": "id,series,repetitions,frequency,start_date,end_date,exercises(name,description,instructions)",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/assignments", headers=headers, params=params
        )
    if response.status_code >= 400:
        return []

    documents = []
    for assignment in response.json():
        exercise = assignment.get("exercises") or {}
        content = (
            f"Plan autorizado del paciente {patient_id}. "
            f"Ejercicio: {exercise.get('name', 'Sin nombre')}. "
            f"Descripción: {exercise.get('description') or 'No registrada'}. "
            f"Instrucciones: {exercise.get('instructions') or 'No registradas'}. "
            f"Series: {assignment['series']}. Repeticiones: {assignment['repetitions']}. "
            f"Frecuencia: {assignment['frequency']}. Vigencia: {assignment.get('start_date')} "
            f"a {assignment.get('end_date')}"
        )
        documents.append(
            Document(
                page_content=content,
                metadata={
                    "title": "Plan terapéutico autorizado",
                    "source": f"Supabase assignments/{assignment['id']}",
                    "source_type": "clinical_record",
                    "location": assignment["id"],
                },
            )
        )
    return documents
