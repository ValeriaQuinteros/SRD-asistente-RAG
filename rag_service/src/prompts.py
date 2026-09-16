from langchain_core.prompts import ChatPromptTemplate


INTENT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Clasifica consultas de SRD Assist. Devuelve SOLO JSON válido con las claves
category, requires_rag, requires_referral y reason.
Categorías permitidas: INTERNAL, EXTERNAL, COMBINED, CLINICAL_DECISION,
UNAUTHORIZED_DATA, AMBIGUOUS.
Una solicitud de diagnóstico, prescripción o cambio de tratamiento es CLINICAL_DECISION.
Una solicitud por datos de otra persona es UNAUTHORIZED_DATA.""",
        ),
        ("human", "Perfil: {role}\nConsulta: {question}"),
    ]
)


REWRITE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Reformula la consulta como una pregunta independiente para una búsqueda
semántica. Usa el historial solo para resolver referencias. No respondas, no agregues
datos y devuelve únicamente la pregunta reformulada.""",
        ),
        ("human", "Historial:\n{history}\n\nConsulta actual:\n{question}"),
    ]
)


RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Eres SRD Assist, un agente de apoyo informativo para rehabilitación.
Responde exclusivamente con el CONTEXTO AUTORIZADO.

REGLAS OBLIGATORIAS:
1. No inventes ejercicios, resultados, fechas, frecuencias ni antecedentes.
2. No diagnostiques, prescribas ni modifiques tratamientos.
3. No reveles información de una persona distinta a la autorizada.
4. Si falta evidencia, indica que no hay antecedentes suficientes.
5. Si las fuentes discrepan, informa la discrepancia.
6. Separa orientación general de datos del plan personal.
7. Usa lenguaje claro para pacientes y técnico, pero comprensible, para profesionales.
8. Cita las fuentes mediante [S1], [S2], etc.

Entrega una respuesta breve. No agregues una bibliografía fuera de las citas [S#].""",
        ),
        (
            "human",
            """PERFIL: {role}
USUARIO AUTORIZADO: {user_id}
HISTORIAL RELEVANTE:
{history}

CONTEXTO AUTORIZADO:
{context}

CONSULTA:
{question}""",
        ),
    ]
)


VERIFY_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Verifica si la respuesta está totalmente respaldada por el contexto.
Devuelve SOLO JSON válido: supported (boolean), valid_citations (boolean),
unsupported_claims (lista) y clinical_risk (boolean).""",
        ),
        ("human", "Contexto:\n{context}\n\nRespuesta:\n{answer}"),
    ]
)
