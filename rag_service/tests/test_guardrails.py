import pytest

from src.guardrails import deterministic_intent, rejection_for


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("¿Qué lesión tengo según estos resultados?", "CLINICAL_DECISION"),
        ("Cámbiame el tratamiento", "CLINICAL_DECISION"),
        ("Muéstrame las sesiones de otro paciente", "UNAUTHORIZED_DATA"),
        ("¿Cuántas repeticiones tengo asignadas?", "INTERNAL"),
        ("¿Qué recomienda en general la OMS sobre actividad física?", "EXTERNAL"),
        ("¿Y eso?", "AMBIGUOUS"),
    ],
)
def test_intent_guardrails(question, expected):
    assert deterministic_intent(question) == expected


def test_clinical_rejection_has_referral():
    answer, warning = rejection_for("CLINICAL_DECISION")
    assert "kinesiólogo" in answer
    assert "no sustituye" in warning
