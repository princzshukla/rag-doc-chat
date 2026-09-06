from database import engine, Base, SessionLocal
from models import Document, ChatMessage
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

from ingest import ingest_pdf
from retrieve import retrieve_documents, generate_answer


app = FastAPI(title="RAG PDF Chat API")
Base.metadata.create_all(bind=engine)


# Allow Next.js frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://rag-doc-chat-1.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "RAG PDF Chat API is running"
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    # Save PDF
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            file.file,
            buffer
        )

    # Process PDF → ChromaDB
    ingest_pdf(file_path)

    # Save document → PostgreSQL
    db = SessionLocal()

    try:
        document = Document(
            filename=file.filename
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        document_id = document.id

    finally:
        db.close()

    return {
        "message": "PDF uploaded and processed successfully",
        "filename": file.filename,
        "document_id": document_id
    }

@app.post("/ask")
async def ask_question(
    query: str,
    document_id: int
):

    # Retrieve relevant chunks
    documents = retrieve_documents(query)

    # Generate answer
    answer = generate_answer(
        query,
        documents
    )

    # Save chat message
    db = SessionLocal()

    try:
        chat_message = ChatMessage(
            question=query,
            answer=answer,
            document_id=document_id
        )

        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)

    finally:
        db.close()

    # Sources
    sources = []

    for document in documents:

        page = document.metadata.get("page")

        if page is not None:
            page = page + 1

        sources.append({
            "page": page,
            "document": document.metadata.get(
                "document_name",
                "Uploaded PDF"
            )
        })

    return {
        "question": query,
        "answer": answer,
        "sources": sources
    }
@app.get("/history/{document_id}")
def get_chat_history(document_id: int):

    db = SessionLocal()

    try:
        messages = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.document_id == document_id
            )
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

        return [
            {
                "id": message.id,
                "question": message.question,
                "answer": message.answer,
                "created_at": message.created_at
            }
            for message in messages
        ]

    finally:
        db.close()