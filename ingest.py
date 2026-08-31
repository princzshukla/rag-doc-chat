import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

load_dotenv()

CHROMA_DIR = "chroma_db"

CURRENT_COLLECTION = "current_pdf"


def ingest_pdf(pdf_path: str):

    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
    )

    chunks = splitter.split_documents(docs)

    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )

    # Add document name to metadata
    document_name = os.path.basename(pdf_path)

    for chunk in chunks:
        chunk.metadata["document_name"] = document_name

    vectordb = Chroma(
        collection_name=CURRENT_COLLECTION,
        embedding_function=embeddings,
        persist_directory=CHROMA_DIR,
    )

    # Remove old PDF chunks
    existing = vectordb.get()

    if existing["ids"]:
        vectordb.delete(ids=existing["ids"])

    # Add new PDF chunks
    vectordb.add_documents(chunks)

    print(f"Ingested {len(chunks)} chunks from {pdf_path}")

    return vectordb