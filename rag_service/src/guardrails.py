import re
import unicodedata


CLINICAL_PATTERNS = (
    r"\bque (lesion|enfermedad|diagnostico) tengo\b",
    r"\bdiagnostica(me|r)?\b",
    r"\bcambia(r|me)? (el |mi )?tratamiento\b",
    r"\bque medicamento\b",
    r"\bcuanto(s)? medicamento(s)?\b",
    r"\bdebo dejar (el |mi )?(ejercicio|tratamiento)\b",
    (
        r"\b(puedo|debo|conviene) "
        r"(aumentar|disminuir|cambiar|modificar) "
        r"(mi |mis |la |las )?"
        r"(repeticiones|frecuencia|series|carga|peso|ejercicios)\b"
    ),
    (
        r"\b(aumentar|disminuir|cambiar|modificar) "
        r"(mi |mis |la |las )?"
        r"(repeticiones|frecuencia|series|carga|peso) "
        r"por mi cuenta\b"
    ),
    r"\bque ejercicio (debo|puedo) hacer\b",
)

UNAUTHORIZED_PATTERNS = (
    r"\botro paciente\b",
    r"\botra persona\b",
    r"\btodos los pacientes\b",
    r"\bficha de [a-z]",
    r"\bsesiones de [a-z]",
)


def normalize(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFD",
        value.lower(),
    )
    return "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )


def deterministic_intent(question: str) -> str:
    text = normalize(question)

    if any(
        re.search(pattern, text)
        for pattern in CLINICAL_PATTERNS
    ):
        return "CLINICAL_DECISION"

    if any(
        re.search(pattern, text)
        for pattern in UNAUTHORIZED_PATTERNS
    ):
        return "UNAUTHORIZED_DATA"

    if len(text.split()) < 3:
        return "AMBIGUOUS"

    internal_terms = (
        "mi plan",
        "mis sesiones",
        "repeticiones",
        "asignado",
        "ejercicio",
    )
    external_terms = (
        "recomendacion general",
        "oms",
        "minsal",
        "actividad fisica",
    )

    has_internal = any(
        term in text
        for term in internal_terms
    )
    has_external = any(
        term in text
        for term in external_terms
    )

    if has_internal and has_external:
        return "COMBINED"

    if has_external:
        return "EXTERNAL"

    return "INTERNAL"


def rejection_for(
    intent: str,
) -> tuple[str, str] | None:
    if intent == "CLINICAL_DECISION":
        return (
            "No puedo realizar diagnósticos ni indicar "
            "cambios de tratamiento. Comunícate con tu "
            "kinesiólogo para una evaluación profesional.",
            "SRD Assist entrega apoyo informativo y no "
            "sustituye una evaluación clínica.",
        )

    if intent == "UNAUTHORIZED_DATA":
        return (
            "No puedo mostrar información clínica "
            "de otra persona.",
            "El acceso fue limitado para proteger "
            "la privacidad de los pacientes.",
        )

    if intent == "AMBIGUOUS":
        return (
            "Necesito un poco más de información para "
            "buscar una respuesta segura. Indica el "
            "ejercicio, sesión o tema que deseas consultar.",
            "No se realizó una búsqueda porque la consulta "
            "era ambigua.",
        )

    return None
