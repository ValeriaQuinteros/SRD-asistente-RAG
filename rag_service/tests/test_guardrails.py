import pytest

from src.guardrails import (
    deterministic_intent,
    rejection_for,
)


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        (
            "¿Qué lesión tengo según estos resultados?",
            "CLINICAL_DECISION",
        ),
        (
            "Cámbiame el tratamiento",
            "CLINICAL_DECISION",
        ),
        (
            "¿Puedo aumentar mis repeticiones por mi cuenta?",
            "CLINICAL_DECISION",
        ),
        (
            "¿Debo disminuir la frecuencia?",
            "CLINICAL_DECISION",
        ),
        (
            "Quiero modificar mi carga por mi cuenta",
            "CLINICAL_DECISION",
        ),
        (
            "¿Qué ejercicio debo hacer?",
            "CLINICAL_DECISION",
        ),
        (
            "Muéstrame las sesiones de otro paciente",
            "UNAUTHORIZED_DATA",
        ),
        (
            "Muéstrame el plan de otra persona",
            "UNAUTHORIZED_DATA",
        ),
        (
            "¿Cuántas repeticiones tengo asignadas?",
            "INTERNAL",
        ),
        (
            "¿Cómo se realiza la flexión de rodilla?",
            "INTERNAL",
        ),
        (
            "¿Qué recomienda en general la OMS "
            "sobre actividad física?",
            "EXTERNAL",
        ),
        (
            "Compara mi ejercicio con la recomendación "
            "general de la OMS",
            "COMBINED",
        ),
        (
            "¿Y eso?",
            "AMBIGUOUS",
        ),
    ],
)
def test_intent_guardrails(
    question,
    expected,
):
    assert (
        deterministic_intent(question)
        == expected
    )


def test_clinical_rejection_has_referral():
    answer, warning = rejection_for(
        "CLINICAL_DECISION"
    )

    assert "kinesiólogo" in answer
    assert "no sustituye" in warning


def test_unauthorized_rejection_protects_privacy():
    answer, warning = rejection_for(
        "UNAUTHORIZED_DATA"
    )

    assert "otra persona" in answer
    assert "privacidad" in warning