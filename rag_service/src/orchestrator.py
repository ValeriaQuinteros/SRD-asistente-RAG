from __future__ import annotations

import json
from typing import Any, TypedDict

from langchain_core.tools import BaseTool
from langgraph.graph import END, START, StateGraph

from .guardrails import (
    deterministic_intent,
    rejection_for,
)


MAX_ACTIONS_PER_QUERY = 4


class AgentState(TypedDict, total=False):
    question: str
    patient_id: str | None
    intent: str
    selected_tool: str | None
    tool_arguments: dict[str, Any]
    tool_result: dict[str, Any] | None
    action_count: int
    max_actions: int
    route: str
    answer: str | None
    warning: str | None
    error: str | None


class AgentOrchestrator:
    def __init__(
        self,
        tools: list[BaseTool],
        max_actions: int = MAX_ACTIONS_PER_QUERY,
    ):
        if max_actions < 1 or max_actions > 4:
            raise ValueError(
                "El máximo de acciones debe estar entre 1 y 4."
            )

        self.tools = {
            current_tool.name: current_tool
            for current_tool in tools
        }
        self.max_actions = max_actions
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node(
            "analyze_intent",
            self._analyze_intent,
        )
        workflow.add_node(
            "apply_guardrails",
            self._apply_guardrails,
        )
        workflow.add_node(
            "plan_action",
            self._plan_action,
        )
        workflow.add_node(
            "execute_tool",
            self._execute_tool,
        )
        workflow.add_node(
            "verify_result",
            self._verify_result,
        )

        workflow.add_edge(
            START,
            "analyze_intent",
        )
        workflow.add_edge(
            "analyze_intent",
            "apply_guardrails",
        )
        workflow.add_conditional_edges(
            "apply_guardrails",
            self._route_after_guardrails,
            {
                "blocked": END,
                "continue": "plan_action",
            },
        )
        workflow.add_conditional_edges(
            "plan_action",
            self._route_after_plan,
            {
                "execute": "execute_tool",
                "stop": END,
            },
        )
        workflow.add_edge(
            "execute_tool",
            "verify_result",
        )
        workflow.add_edge(
            "verify_result",
            END,
        )

        return workflow.compile()

    @staticmethod
    def _analyze_intent(
        state: AgentState,
    ) -> AgentState:
        question = state["question"].strip()
        supplied_intent = state.get("intent")

        intent = (
            supplied_intent
            if supplied_intent
            else deterministic_intent(question)
        )

        return {
            "intent": intent,
            "route": "intent_analyzed",
        }

    @staticmethod
    def _apply_guardrails(
        state: AgentState,
    ) -> AgentState:
        rejection = rejection_for(state["intent"])

        if not rejection:
            return {
                "route": "guardrails_passed",
            }

        return {
            "route": "blocked",
            "answer": rejection[0],
            "warning": rejection[1],
            "selected_tool": None,
        }

    @staticmethod
    def _route_after_guardrails(
        state: AgentState,
    ) -> str:
        if state.get("route") == "blocked":
            return "blocked"

        return "continue"

    @staticmethod
    def _plan_action(
        state: AgentState,
    ) -> AgentState:
        current_actions = state.get(
            "action_count",
            0,
        )
        max_actions = state.get(
            "max_actions",
            MAX_ACTIONS_PER_QUERY,
        )

        if current_actions >= max_actions:
            return {
                "route": "action_limit_reached",
                "selected_tool": None,
                "warning": (
                    "Se alcanzó el límite de acciones "
                    "permitidas para esta consulta."
                ),
            }

        question = state["question"].strip()
        normalized_question = question.lower()
        patient_id = state.get("patient_id")

        follow_up_terms = (
            "registrar solicitud",
            "crear solicitud",
            "avisar al kinesiólogo",
            "contactar al kinesiólogo",
            "solicitar seguimiento",
            "pedir seguimiento",
        )
        personal_plan_terms = (
            "mi plan",
            "mis ejercicios",
            "ejercicios asignados",
            "mi sesión",
            "mis sesiones",
            "mi frecuencia",
            "mis repeticiones",
            "plan del paciente",
        )

        if any(
            term in normalized_question
            for term in follow_up_terms
        ):
            return {
                "route": "tool_planned",
                "selected_tool": "registrar_solicitud",
                "tool_arguments": {
                    "subject": "Solicitud de seguimiento",
                    "message": question[:500],
                    "patient_id": patient_id,
                },
            }

        if any(
            term in normalized_question
            for term in personal_plan_terms
        ):
            return {
                "route": "tool_planned",
                "selected_tool": "consultar_plan_personal",
                "tool_arguments": {
                    "patient_id": patient_id,
                },
            }

        return {
            "route": "tool_planned",
            "selected_tool": "consultar_documentos",
            "tool_arguments": {
                "query": question[:500],
            },
        }

    @staticmethod
    def _route_after_plan(
        state: AgentState,
    ) -> str:
        if (
            state.get("route")
            == "action_limit_reached"
        ):
            return "stop"

        if not state.get("selected_tool"):
            return "stop"

        return "execute"

    async def _execute_tool(
        self,
        state: AgentState,
    ) -> AgentState:
        selected_tool = state.get("selected_tool")
        current_actions = state.get(
            "action_count",
            0,
        )
        max_actions = state.get(
            "max_actions",
            self.max_actions,
        )

        if current_actions >= max_actions:
            return {
                "route": "action_limit_reached",
                "warning": (
                    "Se alcanzó el límite de acciones "
                    "permitidas para esta consulta."
                ),
            }

        current_tool = self.tools.get(
            selected_tool or ""
        )

        if current_tool is None:
            return {
                "route": "tool_not_available",
                "error": (
                    f"La herramienta {selected_tool!r} "
                    "no está disponible."
                ),
                "action_count": current_actions,
            }

        try:
            raw_result = await current_tool.ainvoke(
                state.get(
                    "tool_arguments",
                    {},
                )
            )
        except Exception as error:
            return {
                "route": "tool_error",
                "error": str(error),
                "action_count": current_actions + 1,
            }

        try:
            parsed_result = (
                json.loads(raw_result)
                if isinstance(raw_result, str)
                else raw_result
            )
        except json.JSONDecodeError:
            parsed_result = {
                "status": "invalid_response",
                "raw_result": str(raw_result),
            }

        return {
            "route": "tool_executed",
            "tool_result": parsed_result,
            "action_count": current_actions + 1,
        }

    @staticmethod
    def _verify_result(
        state: AgentState,
    ) -> AgentState:
        if state.get("route") == "tool_error":
            return {
                "route": "error",
                "warning": (
                    "La herramienta seleccionada no pudo "
                    "completar la operación."
                ),
            }

        if state.get("route") == "tool_not_available":
            return {
                "route": "error",
            }

        result = state.get("tool_result") or {}
        status = result.get(
            "status",
            "invalid_response",
        )

        if status in {
            "success",
            "created",
        }:
            return {
                "route": "success",
            }

        if status in {
            "insufficient_evidence",
            "not_found",
        }:
            return {
                "route": "insufficient_evidence",
                "warning": (
                    "La herramienta no encontró evidencia "
                    "suficiente para responder."
                ),
            }

        if status == "forbidden":
            return {
                "route": "blocked",
                "warning": result.get(
                    "message",
                    "El acceso solicitado no está autorizado.",
                ),
            }

        return {
            "route": "error",
            "warning": (
                "La respuesta de la herramienta "
                "no pudo ser validada."
            ),
        }

    async def run(
        self,
        question: str,
        patient_id: str | None = None,
        intent: str | None = None,
    ) -> AgentState:
        initial_state: AgentState = {
            "question": question,
            "patient_id": patient_id,
            "action_count": 0,
            "max_actions": self.max_actions,
        }

        if intent:
            initial_state["intent"] = intent

        return await self.graph.ainvoke(
            initial_state
        )