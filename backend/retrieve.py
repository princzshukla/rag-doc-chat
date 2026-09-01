import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.documents import Document

from qdrant_client import QdrantClient, models


QDRANT_URL = os.getenv("QDRANT_URL", "").strip()
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip()

COLLECTION_NAME = "current_pdf"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    cloud_inference=True,
)


def retrieve_documents(query: str, k: int = 3):

    results = client.query_points(
        collection_name=COLLECTION_NAME,

        query=models.Document(
            text=query,
            model=EMBEDDING_MODEL,
        ),

        using="dense",

        limit=k,

        with_payload=True,
    )

    documents = []

    for result in results.points:

        payload = result.payload or {}

        documents.append(
            Document(
                page_content=payload.get(
                    "page_content",
                    ""
                ),

                metadata={
                    "document_name": payload.get(
                        "document_name",
                        "Uploaded PDF"
                    ),

                    "page": payload.get(
                        "page"
                    ),
                },
            )
        )

    return documents


def generate_answer(query: str, documents):

    context = "\n\n".join(
        document.page_content
        for document in documents
    )

    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        temperature=0,
    )

    prompt = f"""
You are a helpful assistant answering questions about a PDF.

Answer the user's question using ONLY the information
provided in the context.

If the answer is not present in the context, say:

"I don't know based on the provided document."

Do not make up information.

Context:
{context}

Question:
{query}

Answer:
"""

    response = llm.invoke(prompt)

    return response.content