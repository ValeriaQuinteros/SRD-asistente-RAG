import csv
import json
from pathlib import Path

from langchain_core.documents import Document
from pypdf import PdfReader


def _metadata(path: Path, source_type: str) -> dict:
    return {
        "title": path.stem.replace("_", " ").title(),
        "source": str(path),
        "source_type": source_type,
        "allowed_roles": "admin,kinesiologo,paciente",
    }


def _document_url(content: str) -> str | None:
    for line in content.splitlines():
        if line.startswith("URL: "):
            return line.removeprefix("URL: ").strip()
    return None


def load_csv(path: Path, source_type: str) -> list[Document]:
    documents = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row_number, row in enumerate(csv.DictReader(stream), start=2):
            content = "\n".join(f"{key}: {value}" for key, value in row.items() if value)
            meta = _metadata(path, source_type) | {"location": f"fila {row_number}"}
            documents.append(Document(page_content=content, metadata=meta))
    return documents


def load_json(path: Path, source_type: str) -> list[Document]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload if isinstance(payload, list) else [payload]
    documents = []
    for index, item in enumerate(items, start=1):
        meta = _metadata(path, source_type) | {"location": f"registro {index}"}
        documents.append(
            Document(page_content=json.dumps(item, ensure_ascii=False, indent=2), metadata=meta)
        )
    return documents


def load_documents(data_path: Path) -> list[Document]:
    documents: list[Document] = []
    for source_type in ("internal", "external"):
        directory = data_path / source_type
        for path in sorted(directory.glob("*")):
            if path.suffix.lower() == ".csv":
                documents.extend(load_csv(path, source_type))
            elif path.suffix.lower() == ".json":
                documents.extend(load_json(path, source_type))
            elif path.suffix.lower() in {".md", ".txt"}:
                content = path.read_text(encoding="utf-8")
                meta = _metadata(path, source_type)
                url = _document_url(content)
                if url:
                    meta["url"] = url
                documents.append(Document(page_content=content, metadata=meta))
            elif path.suffix.lower() == ".pdf":
                reader = PdfReader(str(path))
                for page_number, page in enumerate(reader.pages, start=1):
                    content = page.extract_text() or ""
                    if content.strip():
                        meta = _metadata(path, source_type) | {"location": f"página {page_number}"}
                        documents.append(Document(page_content=content, metadata=meta))
    return documents
