from src.document_loader import load_documents
from src.settings import get_settings


def test_internal_and_external_sources_are_loaded():
    documents = load_documents(get_settings().data_path)
    source_types = {document.metadata["source_type"] for document in documents}
    assert "internal" in source_types
    assert "external" in source_types
    assert len(documents) >= 5


def test_all_documents_have_traceability_metadata():
    documents = load_documents(get_settings().data_path)
    for document in documents:
        assert document.metadata.get("title")
        assert document.metadata.get("source")
        assert document.metadata.get("source_type")
