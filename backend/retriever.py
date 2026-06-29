from backend.vector_store import get_collection

TOP_K = 3


def retrieve_context(question: str, top_k: int = TOP_K) -> list[dict]:
    collection = get_collection()
    results = collection.query(
        query_texts=[question],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "content": doc,
            "source": meta.get("source", "unknown"),
            "page": meta.get("page", 0),
            "score": round(1 - dist, 4),
        })

    return chunks
