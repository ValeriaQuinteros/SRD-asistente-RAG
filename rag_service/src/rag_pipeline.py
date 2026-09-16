from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .document_loader import load_documents
from .settings import Settings


class RAGPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )
        self.vectorstore = Chroma(
            collection_name="srd_assist",
            embedding_function=self.embeddings,
            persist_directory=settings.chroma_path,
        )

    def build_index(self, reset: bool = False) -> int:
        if reset:
            try:
                self.vectorstore.delete_collection()
            except ValueError:
                pass
            self.vectorstore = Chroma(
                collection_name="srd_assist",
                embedding_function=self.embeddings,
                persist_directory=self.settings.chroma_path,
            )

        documents = load_documents(self.settings.data_path)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100,
            separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
        )
        chunks = splitter.split_documents(documents)
        if chunks:
            ids = [f"{Path(d.metadata['source']).stem}-{index}" for index, d in enumerate(chunks)]
            self.vectorstore.add_documents(chunks, ids=ids)
        return len(chunks)

    def retrieve(self, query: str, role: str) -> list[Document]:
        results = self.vectorstore.similarity_search(query, k=max(self.settings.top_k * 2, 6))
        allowed = []
        for document in results:
            roles = document.metadata.get("allowed_roles", "").split(",")
            if role in roles:
                allowed.append(document)
            if len(allowed) == self.settings.top_k:
                break
        return allowed
