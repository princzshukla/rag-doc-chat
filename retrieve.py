from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

load_dotenv()

CHROMA_DIR = "chroma_db"
CURRENT_COLLECTION = "current_pdf"


def retrieve_documents(query: str, k: int = 3):

    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2"
    )

    vectordb = Chroma(
        collection_name=CURRENT_COLLECTION,
        persist_directory=CHROMA_DIR,
        embedding_function=embeddings,
    )

    results = vectordb.similarity_search(
        query,
        k=k
    )

    return results


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