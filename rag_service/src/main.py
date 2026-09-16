from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .agent import SRDAssistAgent, get_agent
from .auth import current_user
from .schemas import ChatRequest, ChatResponse, UserContext
from .settings import get_settings


settings = get_settings()
app = FastAPI(title="SRD Assist API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Demo-User", "X-Demo-Role"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.ollama_model, "demo_mode": settings.demo_mode}


@app.post("/api/index")
def rebuild_index(
    user: UserContext = Depends(current_user),
    agent: SRDAssistAgent = Depends(get_agent),
):
    if user.role not in {"admin", "kinesiologo"}:
        raise HTTPException(status_code=403, detail="Solo el personal puede reconstruir el índice")
    return {"chunks_indexed": agent.rag.build_index(reset=True)}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Annotated[str | None, Header()] = None,
    user: UserContext = Depends(current_user),
    agent: SRDAssistAgent = Depends(get_agent),
):
    token = authorization.removeprefix("Bearer ").strip() if authorization else None
    return await agent.answer(request, user, token)
