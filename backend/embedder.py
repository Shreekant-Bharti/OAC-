import ollama
import chromadb

EMBEDDING_MODEL = "nomic-embed-text"


class OllamaEmbeddingFunction(chromadb.EmbeddingFunction):
    """ChromaDB-compatible embedding function that calls Ollama locally."""

    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
        response = ollama.embed(model=EMBEDDING_MODEL, input=input)
        return response.embeddings


_embedding_fn: OllamaEmbeddingFunction | None = None


def get_embedding_function() -> OllamaEmbeddingFunction:
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = OllamaEmbeddingFunction()
    return _embedding_fn
