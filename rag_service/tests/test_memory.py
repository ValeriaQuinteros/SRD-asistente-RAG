import pytest

from src.memory import ConversationMemory


def _create_memory(tmp_path, window_size=6):
    return ConversationMemory(
        database_path=tmp_path / "memory.sqlite3",
        window_size=window_size,
    )


def test_memory_persists_between_instances(tmp_path):
    first_instance = _create_memory(tmp_path)

    first_instance.add_exchange(
        conversation_id="conversation-001",
        user_id="patient-001",
        user_message="¿Cómo hago la flexión de rodilla?",
        assistant_message=(
            "Debes seguir las instrucciones de tu plan."
        ),
    )

    second_instance = _create_memory(tmp_path)
    messages = second_instance.get_messages(
        conversation_id="conversation-001",
        user_id="patient-001",
    )

    assert len(messages) == 2
    assert messages[0].role == "user"
    assert "flexión de rodilla" in messages[0].content
    assert messages[1].role == "assistant"


def test_memory_keeps_only_configured_window(tmp_path):
    memory = _create_memory(
        tmp_path,
        window_size=6,
    )

    for index in range(8):
        memory.add_message(
            conversation_id="conversation-002",
            user_id="patient-001",
            role="user",
            content=f"Mensaje número {index}",
        )

    messages = memory.get_messages(
        conversation_id="conversation-002",
        user_id="patient-001",
    )

    assert len(messages) == 6
    assert messages[0].content == "Mensaje número 2"
    assert messages[-1].content == "Mensaje número 7"


def test_memory_is_isolated_by_user(tmp_path):
    memory = _create_memory(tmp_path)

    memory.add_message(
        conversation_id="shared-conversation",
        user_id="patient-001",
        role="user",
        content="Información del primer paciente",
    )
    memory.add_message(
        conversation_id="shared-conversation",
        user_id="patient-002",
        role="user",
        content="Información del segundo paciente",
    )

    first_user_messages = memory.get_messages(
        conversation_id="shared-conversation",
        user_id="patient-001",
    )
    second_user_messages = memory.get_messages(
        conversation_id="shared-conversation",
        user_id="patient-002",
    )

    assert len(first_user_messages) == 1
    assert len(second_user_messages) == 1
    assert (
        first_user_messages[0].content
        == "Información del primer paciente"
    )
    assert (
        second_user_messages[0].content
        == "Información del segundo paciente"
    )


def test_memory_does_not_store_visible_user_id(tmp_path):
    database_path = tmp_path / "memory.sqlite3"
    memory = ConversationMemory(
        database_path=database_path,
        window_size=6,
    )

    memory.add_message(
        conversation_id="conversation-003",
        user_id="private-user-identifier",
        role="user",
        content="Consulta de demostración",
    )

    database_content = database_path.read_bytes()

    assert b"private-user-identifier" not in database_content


def test_clear_conversation_only_removes_selected_user(
    tmp_path,
):
    memory = _create_memory(tmp_path)

    memory.add_message(
        conversation_id="conversation-004",
        user_id="patient-001",
        role="user",
        content="Mensaje del primer paciente",
    )
    memory.add_message(
        conversation_id="conversation-004",
        user_id="patient-002",
        role="user",
        content="Mensaje del segundo paciente",
    )

    removed = memory.clear_conversation(
        conversation_id="conversation-004",
        user_id="patient-001",
    )

    assert removed == 1
    assert (
        memory.count_messages(
            conversation_id="conversation-004",
            user_id="patient-001",
        )
        == 0
    )
    assert (
        memory.count_messages(
            conversation_id="conversation-004",
            user_id="patient-002",
        )
        == 1
    )


@pytest.mark.parametrize(
    "conversation_id",
    [
        "short",
        "contains spaces",
        "../unsafe-path",
        "invalid!",
    ],
)
def test_invalid_conversation_id_is_rejected(
    tmp_path,
    conversation_id,
):
    memory = _create_memory(tmp_path)

    with pytest.raises(ValueError):
        memory.add_message(
            conversation_id=conversation_id,
            user_id="patient-001",
            role="user",
            content="Mensaje de prueba",
        )


def test_message_content_is_normalized(tmp_path):
    memory = _create_memory(tmp_path)

    memory.add_message(
        conversation_id="conversation-005",
        user_id="patient-001",
        role="user",
        content="  ¿Cuántas    veces debo hacerlo?  ",
    )

    messages = memory.get_messages(
        conversation_id="conversation-005",
        user_id="patient-001",
    )

    assert (
        messages[0].content
        == "¿Cuántas veces debo hacerlo?"
    )