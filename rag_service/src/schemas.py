from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["admin", "kinesiologo", "paciente"]


class UserContext(BaseModel):
    user_id: str
    full_name: str
    role: Role


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    patient_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list, max_length=6)


class SourceItem(BaseModel):
    title: str
    source_type: Literal["internal", "external", "clinical_record"]
    location: str | None = None
    url: str | None = None
    excerpt: str


class TraceInfo(BaseModel):
    trace_id: str
    intent: str
    rewritten_query: str
    retrieved_documents: int
    elapsed_ms: int


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]
    warning: str | None = None
    trace: TraceInfo
