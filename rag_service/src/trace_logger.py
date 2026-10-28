import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .schemas import UserContext


def anonymize(identifier: str) -> str:
    return hashlib.sha256(
        identifier.encode("utf-8")
    ).hexdigest()[:12]


def write_trace(
    evidence_path: Path,
    trace_id: str,
    user: UserContext,
    intent: str,
    source_titles: list[str],
    elapsed_ms: int,
) -> None:
    runtime = evidence_path / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)

    record = {
        "trace_id": trace_id,
        "timestamp_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "user_hash": anonymize(user.user_id),
        "role": user.role,
        "intent": intent,
        "sources": source_titles,
        "elapsed_ms": elapsed_ms,
    }

    trace_file = runtime / "traces.jsonl"

    with trace_file.open(
        "a",
        encoding="utf-8",
    ) as stream:
        stream.write(
            json.dumps(
                record,
                ensure_ascii=False,
            )
            + "\n"
        )