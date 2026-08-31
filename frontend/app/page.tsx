"use client";

import { useState } from "react";

type Source = {
  page: number | null;
  document: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type HistoryItem = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);

  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  // Upload PDF
  const uploadPDF = async () => {
    if (!file) {
      setError("Please select a PDF first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessages([]);
    setDocumentId(null);
    setUploaded(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://localhost:8000/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log("Upload response:", data);

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || data)
        );
      }

      // Save document ID returned by FastAPI
      setDocumentId(data.document_id);
      setUploaded(true);

      // Load previous chat history for this document
      const historyResponse = await fetch(
        `http://localhost:8000/history/${data.document_id}`
      );

      const historyData = await historyResponse.json();

      console.log("History response:", historyData);

      if (historyResponse.ok && Array.isArray(historyData)) {
        const previousMessages: Message[] = [];

        historyData.forEach((item: HistoryItem) => {
          previousMessages.push({
            role: "user",
            content: item.question,
          });

          previousMessages.push({
            role: "assistant",
            content: item.answer,
          });
        });

        setMessages(previousMessages);
      }
    } catch (error) {
      console.error("Upload error:", error);

      setError(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      );

      setUploaded(false);
    } finally {
      setUploading(false);
    }
  };

  // Ask question
  const askQuestion = async () => {
    if (!question.trim()) return;

    if (!uploaded || documentId === null) {
      setError(
        "Please upload a PDF before asking a question."
      );
      return;
    }

    const userQuestion = question.trim();

    setQuestion("");
    setError("");

    // Show user's question immediately
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: userQuestion,
      },
    ]);

    setAsking(true);

    try {
      const response = await fetch(
        `http://localhost:8000/ask?query=${encodeURIComponent(
          userQuestion
        )}&document_id=${documentId}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      console.log("Ask response:", data);

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || data)
        );
      }

      // Add AI answer + sources
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      console.error("Ask error:", error);

      setError(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      );
    } finally {
      setAsking(false);
    }
  };

  // Press Enter to ask
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📄 DocChat
            </h1>

            <p className="text-sm text-gray-500">
              Chat with your PDF using AI
            </p>
          </div>

          {uploaded && (
            <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              ✓ PDF Ready
            </div>
          )}

        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col px-6 py-8">

        {/* Upload Card */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Upload a document
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Upload one PDF and ask questions about its content.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => {
                const selectedFile =
                  event.target.files?.[0] || null;

                setFile(selectedFile);
                setUploaded(false);
                setDocumentId(null);
                setMessages([]);
                setError("");
              }}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm"
            />

            <button
              onClick={uploadPDF}
              disabled={!file || uploading}
              className="rounded-lg bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Processing..."
                : "Upload PDF"}
            </button>

          </div>

          {file && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              📎 {file.name}
            </div>
          )}

        </section>

        {/* Error */}
        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Chat */}
        <section className="mt-6 flex min-h-[500px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">

          {/* Chat Header */}
          <div className="border-b px-6 py-4">

            <h2 className="font-semibold text-gray-900">
              Chat
            </h2>

            <p className="text-sm text-gray-500">
              {uploaded
                ? `Ask questions about ${file?.name}`
                : "Upload a PDF to start chatting"}
            </p>

          </div>

          {/* Messages */}
          <div className="flex-1 space-y-5 overflow-y-auto p-6">

            {messages.length === 0 && !asking && (
              <div className="flex min-h-[350px] items-center justify-center">

                <div className="text-center">

                  <div className="mb-3 text-5xl">
                    💬
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800">
                    Start a conversation
                  </h3>

                  <p className="mt-2 max-w-md text-sm text-gray-500">
                    Upload a PDF and ask anything about the
                    information inside it.
                  </p>

                </div>

              </div>
            )}

            {messages.map((message, index) => (

              <div
                key={index}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                    message.role === "user"
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >

                  <div className="mb-1 text-xs font-semibold opacity-60">
                    {message.role === "user"
                      ? "You"
                      : "AI"}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>

                  {/* Sources */}
                  {message.role === "assistant" &&
                    message.sources &&
                    message.sources.length > 0 && (

                      <div className="mt-4 border-t border-gray-300 pt-3">

                        <p className="mb-2 text-xs font-semibold text-gray-500">
                          Sources
                        </p>

                        <div className="flex flex-wrap gap-2">

                          {message.sources.map(
                            (source, sourceIndex) => (

                              <span
                                key={sourceIndex}
                                className="rounded-md bg-white px-2 py-1 text-xs text-gray-600 shadow-sm"
                              >
                                📄 {source.document}

                                {source.page !== null &&
                                  ` • Page ${source.page}`}
                              </span>

                            )
                          )}

                        </div>

                      </div>
                    )}

                </div>

              </div>

            ))}

            {/* Loading */}
            {asking && (
              <div className="flex justify-start">

                <div className="rounded-2xl bg-gray-100 px-5 py-4">

                  <div className="flex items-center gap-2">

                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />

                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />

                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Input */}
          <div className="border-t p-4">

            <div className="flex items-end gap-3 rounded-xl border bg-gray-50 p-2">

              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                onKeyDown={handleKeyDown}
                disabled={!uploaded || asking}
                placeholder={
                  uploaded
                    ? "Ask something about your PDF..."
                    : "Upload a PDF first..."
                }
                rows={2}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed"
              />

              <button
                onClick={askQuestion}
                disabled={
                  !uploaded ||
                  documentId === null ||
                  !question.trim() ||
                  asking
                }
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {asking ? "..." : "Send"}
              </button>

            </div>

            <p className="mt-2 text-center text-xs text-gray-400">
              Press Enter to send • Shift + Enter for a new line
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}