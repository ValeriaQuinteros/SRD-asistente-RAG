import json
import time
import uuid
from functools import lru_cache

from langchain_core.documents import Document
from langchain_ollama import ChatOllama

from .guardrails import deterministic_intent
from .long_term_memory import LongTermMemory
from .memory import ConversationMemory
from .orchestrator import AgentOrchestrator
from .prompts import INTENT_PROMPT, RAG_PROMPT, REWRITE_PROMPT, VERIFY_PROMPT
from .rag_pipeline import RAGPipeline
from .schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    SourceItem,
    TraceInfo,
    UserContext,
)
from .settings import Settings, get_settings
from .tools import build_agent_tools
from .trace_logger import write_trace


def _message_text(message) -> str:
    return message.content if hasattr(message, "content") else str(message)


class SRDAssistAgent:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0,
        )
        self.rag = RAGPipeline(settings)
        self.memory = ConversationMemory(
            database_path=settings.memory_path,
            window_size=settings.memory_window_size,
        )
        self.long_term_memory = LongTermMemory(settings)

    def classify(self, question: str, role: str) -> str:
        safe_intent = deterministic_intent(question)

        if safe_intent in {
            "CLINICAL_DECISION",
            "UNAUTHORIZED_DATA",
            "AMBIGUOUS",
        }:
            return safe_intent

        if not self.settings.enable_llm_classifier:
            return safe_intent

        try:
            result = (INTENT_PROMPT | self.llm).invoke(
                {
                    "question": question,
                    "role": role,
                }
            )
            payload = json.loads(
                _message_text(result)
                .strip()
                .removeprefix("```json")
                .removesuffix("```")
            )
            category = payload.get("category", safe_intent)
            valid_categories = {
                "INTERNAL",
                "EXTERNAL",
                "COMBINED",
                "CLINICAL_DECISION",
                "UNAUTHORIZED_DATA",
                "AMBIGUOUS",
            }
            return (
                category
                if category in valid_categories
                else safe_intent
            )
        except Exception:
            return safe_intent

    def load_history(
        self,
        request: ChatRequest,
        user: UserContext,
    ) -> list[ChatMessage]:
        try:
            stored_history = self.memory.get_messages(
                conversation_id=request.conversation_id,
                user_id=user.user_id,
            )
            if stored_history:
                return stored_history
        except (OSError, ValueError):
            pass

        return request.history[-self.settings.memory_window_size :]

    def load_long_term_context(
        self,
        request: ChatRequest,
        user: UserContext,
    ) -> str:
        try:
            memories = self.long_term_memory.search_memories(
                user_id=user.user_id,
                query=request.question,
                limit=3,
            )
            return self.long_term_memory.format_for_prompt(
                memories
            )
        except Exception:
            # La memoria semántica no debe impedir la respuesta.
            return "Sin recuerdos relevantes."

    def save_exchange(
        self,
        request: ChatRequest,
        user: UserContext,
        answer: str,
    ) -> None:
        try:
            self.memory.add_exchange(
                conversation_id=request.conversation_id,
                user_id=user.user_id,
                user_message=request.question,
                assistant_message=answer,
            )
        except (OSError, ValueError):
            # La memoria corta no debe impedir la respuesta.
            pass

        try:
            self.long_term_memory.store_explicit_preference(
                user_id=user.user_id,
                content=request.question,
                conversation_id=request.conversation_id,
            )
        except Exception:
            # La memoria semántica no debe impedir la respuesta.
            pass

    def rewrite(
        self,
        question: str,
        history: list[ChatMessage],
    ) -> str:
        if not history:
            return question

        history_text = "\n".join(
            f"{item.role}: {item.content}"
            for item in history[-self.settings.memory_window_size :]
        )

        try:
            result = (REWRITE_PROMPT | self.llm).invoke(
                {
                    "history": history_text,
                    "question": question,
                }
            )
            return _message_text(result).strip()
        except Exception:
            return question

    @staticmethod
    def format_context(documents: list[Document]) -> str:
        return "\n\n".join(
            (
                f"[S{index}] "
                f"{document.metadata.get('title', 'Fuente')}\n"
                f"{document.page_content}"
            )
            for index, document in enumerate(
                documents,
                start=1,
            )
        )

    @staticmethod
    def sources(
        documents: list[Document],
    ) -> list[SourceItem]:
        items = []

        for document in documents:
            excerpt = " ".join(
                document.page_content.split()
            )[:240]

            items.append(
                SourceItem(
                    title=document.metadata.get(
                        "title",
                        "Fuente sin título",
                    ),
                    source_type=document.metadata.get(
                        "source_type",
                        "internal",
                    ),
                    location=document.metadata.get("location"),
                    url=document.metadata.get("url"),
                    excerpt=excerpt,
                )
            )

        return items

    @staticmethod
    def documents_from_tool_result(
        tool_result: dict | None,
    ) -> list[Document]:
        if not tool_result:
            return []

        documents = []
        for item in tool_result.get("documents", []):
            content = str(item.get("content", "")).strip()
            if not content:
                continue

            documents.append(
                Document(
                    page_content=content,
                    metadata={
                        "title": item.get(
                            "title",
                            "Fuente sin título",
                        ),
                        "source_type": item.get(
                            "source_type",
                            "internal",
                        ),
                        "location": item.get("location"),
                        "url": item.get("url"),
                    },
                )
            )

        return documents

    async def answer(
        self,
        request: ChatRequest,
        user: UserContext,
        token: str | None,
    ) -> ChatResponse:
        started = time.perf_counter()
        trace_id = str(uuid.uuid4())

        history = self.load_history(request, user)
        long_term_context = self.load_long_term_context(
            request,
            user,
        )
        intent = self.classify(
            request.question,
            user.role,
        )

        rewritten = self.rewrite(
            request.question,
            history,
        )

        tools = build_agent_tools(
            settings=self.settings,
            rag=self.rag,
            user=user,
            token=token,
        )
        orchestrator = AgentOrchestrator(
            tools=tools,
            max_actions=4,
        )

        orchestration = await orchestrator.run(
            question=request.question,
            patient_id=request.patient_id,
            intent=intent,
        )
        route = orchestration.get("route", "error")
        selected_tool = orchestration.get("selected_tool")
        tool_result = orchestration.get("tool_result") or {}

        if route == "blocked":
            elapsed = int(
                (time.perf_counter() - started) * 1000
            )
            answer = orchestration.get("answer") or (
                "No puedo completar esta solicitud porque "
                "no está autorizada."
            )
            warning = orchestration.get("warning")
            self.save_exchange(request, user, answer)

            return ChatResponse(
                answer=answer,
                sources=[],
                warning=warning,
                trace=TraceInfo(
                    trace_id=trace_id,
                    intent=intent,
                    rewritten_query=rewritten,
                    retrieved_documents=0,
                    elapsed_ms=elapsed,
                ),
            )

        if route in {
            "error",
            "action_limit_reached",
        }:
            elapsed = int(
                (time.perf_counter() - started) * 1000
            )
            answer = (
                "No fue posible completar la consulta "
                "con las herramientas disponibles."
            )
            warning = orchestration.get("warning") or (
                orchestration.get("error")
                or "La ejecución del agente fue detenida."
            )
            self.save_exchange(request, user, answer)

            return ChatResponse(
                answer=answer,
                sources=[],
                warning=warning,
                trace=TraceInfo(
                    trace_id=trace_id,
                    intent=intent,
                    rewritten_query=rewritten,
                    retrieved_documents=0,
                    elapsed_ms=elapsed,
                ),
            )

        if (
            selected_tool == "registrar_solicitud"
            and route == "success"
        ):
            elapsed = int(
                (time.perf_counter() - started) * 1000
            )
            answer = tool_result.get(
                "message",
                "La solicitud quedó registrada para "
                "revisión del kinesiólogo.",
            )
            self.save_exchange(request, user, answer)

            write_trace(
                self.settings.data_path.parent / "evidence",
                trace_id,
                user,
                intent,
                [],
                elapsed,
            )

            return ChatResponse(
                answer=answer,
                sources=[],
                warning=None,
                trace=TraceInfo(
                    trace_id=trace_id,
                    intent=intent,
                    rewritten_query=rewritten,
                    retrieved_documents=0,
                    elapsed_ms=elapsed,
                ),
            )

        documents = self.documents_from_tool_result(
            tool_result
        )

        if route == "insufficient_evidence" or not documents:
            elapsed = int(
                (time.perf_counter() - started) * 1000
            )
            answer = (
                "No encontré antecedentes suficientes "
                "en las fuentes autorizadas."
            )
            warning = (
                "Consulta a tu kinesiólogo si necesitas "
                "orientación clínica."
            )
            self.save_exchange(request, user, answer)

            return ChatResponse(
                answer=answer,
                sources=[],
                warning=warning,
                trace=TraceInfo(
                    trace_id=trace_id,
                    intent=intent,
                    rewritten_query=rewritten,
                    retrieved_documents=0,
                    elapsed_ms=elapsed,
                ),
            )

        history_text = (
            "\n".join(
                f"{message.role}: {message.content}"
                for message in history[
                    -self.settings.memory_window_size :
                ]
            )
            or "Sin historial"
        )

        if long_term_context != "Sin recuerdos relevantes.":
            history_text = (
                f"{history_text}\n\n"
                "Preferencias persistentes autorizadas:\n"
                f"{long_term_context}"
            )

        context = self.format_context(documents)

        result = (RAG_PROMPT | self.llm).invoke(
            {
                "role": user.role,
                "user_id": user.user_id,
                "history": history_text,
                "context": context,
                "question": rewritten,
            }
        )
        answer = _message_text(result).strip()

        warning = None
        if self.settings.enable_llm_verifier:
            try:
                checked = (VERIFY_PROMPT | self.llm).invoke(
                    {
                        "context": context,
                        "answer": answer,
                    }
                )
                verification = json.loads(
                    _message_text(checked)
                    .strip()
                    .removeprefix("```json")
                    .removesuffix("```")
                )

                if (
                    not verification.get("supported", False)
                    or verification.get("clinical_risk", False)
                ):
                    answer = (
                        "No puedo entregar una respuesta porque "
                        "no fue posible comprobar su respaldo."
                    )
                    warning = (
                        "La validación de seguridad rechazó "
                        "la respuesta generada."
                    )
            except Exception:
                warning = (
                    "La verificación automática no estuvo "
                    "disponible; revisa las fuentes mostradas."
                )

        elapsed = int(
            (time.perf_counter() - started) * 1000
        )
        source_items = self.sources(documents)

        self.save_exchange(request, user, answer)

        write_trace(
            self.settings.data_path.parent / "evidence",
            trace_id,
            user,
            intent,
            [item.title for item in source_items],
            elapsed,
        )

        return ChatResponse(
            answer=answer,
            sources=source_items,
            warning=warning,
            trace=TraceInfo(
                trace_id=trace_id,
                intent=intent,
                rewritten_query=rewritten,
                retrieved_documents=len(documents),
                elapsed_ms=elapsed,
            ),
        )


@lru_cache
def get_agent() -> SRDAssistAgent:
    return SRDAssistAgent(get_settings())
