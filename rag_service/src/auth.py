from typing import Annotated

import httpx
from fastapi import Depends, Header, HTTPException, status

from .schemas import UserContext
from .settings import Settings, get_settings


async def _supabase_get(settings: Settings, path: str, token: str, params: dict | None = None):
    headers = {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.supabase_url}{path}", headers=headers, params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida o vencida")
    return response.json()


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_demo_user: Annotated[str | None, Header()] = None,
    x_demo_role: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> UserContext:
    if settings.demo_mode and x_demo_user and x_demo_role in {"admin", "kinesiologo", "paciente"}:
        return UserContext(user_id=x_demo_user, full_name="Usuario de demostración", role=x_demo_role)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token de acceso")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase no está configurado en el servicio RAG")

    token = authorization.removeprefix("Bearer ").strip()
    auth_user = await _supabase_get(settings, "/auth/v1/user", token)
    profiles = await _supabase_get(
        settings,
        "/rest/v1/profiles",
        token,
        {"id": f"eq.{auth_user['id']}", "select": "id,full_name,role,active"},
    )
    if not profiles or not profiles[0]["active"]:
        raise HTTPException(status_code=403, detail="Perfil inactivo o inexistente")
    profile = profiles[0]
    return UserContext(user_id=profile["id"], full_name=profile["full_name"], role=profile["role"])
