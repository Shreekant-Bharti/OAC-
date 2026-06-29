import chromadb
from pathlib import Path
from backend.embedder import get_embedding_function

VECTOR_DB_PATH = Path("vector_db")
COLLECTION_NAME = "noc_knowledge"

_client = None
_collection = None


def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        VECTOR_DB_PATH.mkdir(exist_ok=True)
        _client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
    return _client


def get_collection():
    global _collection
    if _collection is None:
        _collection = get_client().get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=get_embedding_function(),
            metadata={"hnsw:space": "cosine"},
        )
    return _collection
