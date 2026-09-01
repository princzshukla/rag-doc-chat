import os
import uuid

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from qdrant_client import QdrantClient, models


load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "").strip()
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip()
COLLECTION_NAME = "current_pdf"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    cloud_inference=True,
)


def ingest_pdf(pdf_path: str):

    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
    )

    chunks = splitter.split_documents(docs)

    document_name = os.path.basename(pdf_path)

    # Delete previous collection
    if client.collection_exists(COLLECTION_NAME):
        client.delete_collection(COLLECTION_NAME)

    # Create new collection
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config={
            "dense": models.VectorParams(
                size=384,
                distance=models.Distance.COSINE,
            )
        },
    )

    points = []

    for chunk in chunks:

        payload = {
            "page_content": chunk.page_content,
            "document_name": document_name,
            "page": chunk.metadata.get("page"),
        }

        point = models.PointStruct(
            id=str(uuid.uuid4()),
            vector={
                "dense": models.Document(
                    text=chunk.page_content,
                    model=EMBEDDING_MODEL,
                )
            },
            payload=payload,
        )

        points.append(point)

    # Upload in batches
    client.upload_points(
        collection_name=COLLECTION_NAME,
        points=points,
        batch_size=32,
    )

    print(
        f"Ingested {len(chunks)} chunks from {pdf_path}"
    )

    return True