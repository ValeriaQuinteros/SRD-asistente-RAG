from __future__ import annotations

import hashlib
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .schemas import ChatMessage


CONVERSATION_ID_PATTERN = re.compile(
    r"^[A-Za-z0-9_-]{8,64}$"
)
ALLOWED_ROLES = {"user", "assistant"}


def _hash_identifier(identifier: str) -> str:
    return hashlib.sha256(
        identifier.encode("utf-8")
    ).hexdigest()[:16]


def _clean_content(content: str) -> str:
    return re.sub(r"\s+", " ", content).strip()


class ConversationMemory:
    """
    Memoria conversacional persistente de corto plazo.

    Los mensajes se guardan por conversación y usuario.
    El identificador real del usuario se transforma en un hash
    antes de almacenarse.
    """

    def __init__(
        self,
        database_path: str | Path,
        window_size: int = 6,
    ):
        if window_size < 2:
            raise ValueError(
                "La ventana de memoria debe contener "
                "al menos dos mensajes."
            )

        self.database_path = Path(database_path)
        self.window_size = window_size
        self.database_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        self._initialize_database()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.database_path,
            timeout=10,
        )
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_database(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    user_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_conversation_user_messages
                ON conversation_messages (
                    conversation_id,
                    user_hash,
                    id
                )
                """
            )

    @staticmethod
    def _validate_conversation_id(
        conversation_id: str,
    ) -> str:
        value = conversation_id.strip()

        if not CONVERSATION_ID_PATTERN.fullmatch(value):
            raise ValueError(
                "conversation_id debe contener entre 8 y 64 "
                "caracteres alfanuméricos, guion o guion bajo."
            )

        return value

    @staticmethod
    def _validate_role(role: str) -> str:
        if role not in ALLOWED_ROLES:
            raise ValueError(
                "El rol del mensaje debe ser user o assistant."
            )

        return role

    def _prune_messages(
        self,
        connection: sqlite3.Connection,
        conversation_id: str,
        user_hash: str,
    ) -> None:
        old_rows = connection.execute(
            """
            SELECT id
            FROM conversation_messages
            WHERE conversation_id = ?
              AND user_hash = ?
            ORDER BY id DESC
            LIMIT -1 OFFSET ?
            """,
            (
                conversation_id,
                user_hash,
                self.window_size,
            ),
        ).fetchall()

        if not old_rows:
            return

        old_ids = [row["id"] for row in old_rows]
        placeholders = ",".join("?" for _ in old_ids)

        connection.execute(
            f"""
            DELETE FROM conversation_messages
            WHERE id IN ({placeholders})
            """,
            old_ids,
        )

    def add_message(
        self,
        conversation_id: str,
        user_id: str,
        role: str,
        content: str,
    ) -> None:
        safe_conversation_id = (
            self._validate_conversation_id(
                conversation_id
            )
        )
        safe_role = self._validate_role(role)
        safe_content = _clean_content(content)

        if not user_id.strip():
            raise ValueError(
                "user_id no puede estar vacío."
            )

        if not safe_content:
            raise ValueError(
                "El contenido del mensaje no puede estar vacío."
            )

        if len(safe_content) > 2000:
            raise ValueError(
                "El mensaje supera el máximo de 2000 caracteres."
            )

        user_hash = _hash_identifier(user_id)

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO conversation_messages (
                    conversation_id,
                    user_hash,
                    role,
                    content,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    safe_conversation_id,
                    user_hash,
                    safe_role,
                    safe_content,
                    datetime.now(
                        timezone.utc
                    ).isoformat(),
                ),
            )
            self._prune_messages(
                connection,
                safe_conversation_id,
                user_hash,
            )

    def add_exchange(
        self,
        conversation_id: str,
        user_id: str,
        user_message: str,
        assistant_message: str,
    ) -> None:
        self.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            role="user",
            content=user_message,
        )
        self.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            role="assistant",
            content=assistant_message,
        )

    def get_messages(
        self,
        conversation_id: str,
        user_id: str,
    ) -> list[ChatMessage]:
        safe_conversation_id = (
            self._validate_conversation_id(
                conversation_id
            )
        )

        if not user_id.strip():
            raise ValueError(
                "user_id no puede estar vacío."
            )

        user_hash = _hash_identifier(user_id)

        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content
                FROM conversation_messages
                WHERE conversation_id = ?
                  AND user_hash = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (
                    safe_conversation_id,
                    user_hash,
                    self.window_size,
                ),
            ).fetchall()

        rows = list(reversed(rows))

        return [
            ChatMessage(
                role=row["role"],
                content=row["content"],
            )
            for row in rows
        ]

    def clear_conversation(
        self,
        conversation_id: str,
        user_id: str,
    ) -> int:
        safe_conversation_id = (
            self._validate_conversation_id(
                conversation_id
            )
        )
        user_hash = _hash_identifier(user_id)

        with self._connect() as connection:
            cursor = connection.execute(
                """
                DELETE FROM conversation_messages
                WHERE conversation_id = ?
                  AND user_hash = ?
                """,
                (
                    safe_conversation_id,
                    user_hash,
                ),
            )

        return cursor.rowcount

    def count_messages(
        self,
        conversation_id: str,
        user_id: str,
    ) -> int:
        safe_conversation_id = (
            self._validate_conversation_id(
                conversation_id
            )
        )
        user_hash = _hash_identifier(user_id)

        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS total
                FROM conversation_messages
                WHERE conversation_id = ?
                  AND user_hash = ?
                """,
                (
                    safe_conversation_id,
                    user_hash,
                ),
            ).fetchone()

        return int(row["total"])