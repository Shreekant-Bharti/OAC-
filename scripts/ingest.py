import sys
import logging
import hashlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.vector_store import get_collection, get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

KNOWLEDGE_BASE_DIR = Path("knowledge_base")

# Larger chunks to preserve table rows and incident records intact
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 120

# Splitter respects structural boundaries before breaking mid-line
SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " "],
    keep_separator=True,
)


def extract_pages(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append({"text": text, "page": i})
    return pages


def chunk_pages(pages: list[dict], source: str) -> tuple[list, list, list]:
    ids, docs, metas = [], [], []
    for page in pages:
        raw_chunks = SPLITTER.split_text(page["text"])
        for chunk in raw_chunks:
            chunk = chunk.strip()
            if len(chunk) < 40:
                continue
            chunk_id = hashlib.md5(f"{source}::{chunk[:100]}".encode()).hexdigest()
            ids.append(chunk_id)
            docs.append(chunk)
            metas.append({"source": source, "page": page["page"]})
    return ids, docs, metas


def ingest_pdf(pdf_path: Path, collection, existing_ids: set) -> int:
    log.info(f"Processing: {pdf_path.name}")
    pages = extract_pages(pdf_path)
    if not pages:
        log.warning(f"  No extractable text: {pdf_path.name}")
        return 0

    ids, docs, metas = chunk_pages(pages, pdf_path.name)
    new_indices = [i for i, id_ in enumerate(ids) if id_ not in existing_ids]

    if not new_indices:
        log.info(f"  Already ingested ({len(ids)} chunks): {pdf_path.name}")
        return 0

    batch_ids = [ids[i] for i in new_indices]
    batch_docs = [docs[i] for i in new_indices]
    batch_metas = [metas[i] for i in new_indices]

    collection.add(documents=batch_docs, ids=batch_ids, metadatas=batch_metas)
    log.info(f"  Stored {len(batch_ids)}/{len(ids)} chunks from {pdf_path.name}")
    return len(batch_ids)


def reset_collection(collection_name: str) -> None:
    client = get_client()
    try:
        client.delete_collection(collection_name)
        log.info(f"Deleted collection: {collection_name}")
    except Exception:
        pass


def run(force: bool = False) -> None:
    if not KNOWLEDGE_BASE_DIR.exists():
        log.error(f"Directory not found: {KNOWLEDGE_BASE_DIR}")
        sys.exit(1)

    pdfs = sorted(KNOWLEDGE_BASE_DIR.glob("*.pdf"))
    if not pdfs:
        log.error("No PDF files found in knowledge_base/")
        sys.exit(1)

    if force:
        log.info("--force flag set: resetting collection...")
        from backend.vector_store import COLLECTION_NAME
        reset_collection(COLLECTION_NAME)

    log.info(f"Found {len(pdfs)} PDF(s) | chunk_size={CHUNK_SIZE} overlap={CHUNK_OVERLAP}")
    collection = get_collection()
    existing_ids = set(collection.get()["ids"])
    log.info(f"Collection '{collection.name}' | existing chunks: {len(existing_ids)}")

    total_new = sum(ingest_pdf(p, collection, existing_ids) for p in pdfs)

    log.info("=" * 50)
    log.info(f"Ingestion complete | new chunks: {total_new}")
    log.info(f"Total chunks in DB : {collection.count()}")
    log.info("=" * 50)


if __name__ == "__main__":
    force = "--force" in sys.argv
    run(force=force)
