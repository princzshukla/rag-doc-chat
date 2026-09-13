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
        "https://rag-doc-chat-1.onrender.com/upload",
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
        `https://rag-doc-chat-1.onrender.com/history/${data.document_id}`
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
        `https://rag-doc-chat-1.onrender.com/ask?query=${encodeURIComponent(
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
    <main className="min-h-screen bg-[#07090d] text-white selection:bg-violet-500/30">
      <div className="flex min-h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#0b0e13] lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg shadow-lg shadow-violet-500/20">
              ✦
            </div>
            <div>
              <h1 className="font-semibold tracking-tight">DocChat</h1>
              <p className="text-xs text-zinc-500">RAG document assistant</p>
            </div>
          </div>

          <div className="p-4">
            <button
              onClick={() => {
                setFile(null);
                setDocumentId(null);
                setUploaded(false);
                setMessages([]);
                setQuestion("");
                setError("");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium transition hover:bg-white/[0.1]"
            >
              <span className="text-lg">＋</span>
              New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Current document
            </p>

            {file ? (
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400">
                    PDF
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {uploaded ? "Ready to chat" : uploading ? "Processing..." : "Selected"}
                    </p>
                  </div>
                </div>
                {uploaded && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Document indexed
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-zinc-500">
                  PDF
                </div>
                <p className="text-xs text-zinc-500">No document loaded</p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-zinc-500">
              <div className="mb-1 flex items-center gap-2 text-zinc-300">
                <span>✦</span> AI-powered search
              </div>
              Answers are grounded in your uploaded document.
            </div>
          </div>
        </aside>

        {/* Main workspace */}
        <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.13),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.07),transparent_28%)]">
          {/* Header */}
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 bg-[#080b10]/80 px-5 backdrop-blur-xl md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-violet-300 lg:hidden">
                ✦
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-zinc-100 md:text-base">
                  {file?.name || "New document chat"}
                </h2>
                <p className="text-xs text-zinc-500">
                  {uploaded ? "Ask questions about your document" : "Upload a PDF to get started"}
                </p>
              </div>
            </div>

            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                uploaded
                  ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-400"
                  : "border-white/10 bg-white/[0.04] text-zinc-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${uploaded ? "bg-emerald-400" : "bg-zinc-600"}`} />
              {uploaded ? "Ready" : "Waiting"}
            </div>
          </header>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Upload */}
            {!uploaded && (
              <div className="px-4 pt-5 md:px-8 md:pt-8">
                <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
                  <div className="p-5 md:p-7">
                    <div className="mb-5">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-lg bg-violet-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                          Get started
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                        Bring a document to life
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Upload a PDF and ask questions using AI-powered retrieval.
                      </p>
                    </div>

                    <label className="group block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/10 p-7 transition hover:border-violet-400/40 hover:bg-violet-500/[0.035] md:p-10">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const selectedFile = event.target.files?.[0] || null;
                          setFile(selectedFile);
                          setUploaded(false);
                          setDocumentId(null);
                          setMessages([]);
                          setError("");
                        }}
                      />
                      <div className="mx-auto max-w-md text-center">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/10 text-xl ring-1 ring-white/10 transition group-hover:scale-105">
                          ↑
                        </div>
                        <p className="font-medium text-zinc-200">
                          Drop your PDF here or <span className="text-violet-300">browse</span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">PDF documents only</p>
                      </div>
                    </label>

                    {file && (
                      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-xs font-bold text-red-400">
                            PDF
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                            <p className="text-xs text-zinc-600">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={uploadPDF}
                          disabled={uploading}
                          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uploading ? "Processing…" : "Process PDF →"}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-4 mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-300 md:mx-8">
                <div className="flex gap-3">
                  <span>!</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
              <div className="mx-auto max-w-3xl">
                {messages.length === 0 && !asking ? (
                  <div className="flex min-h-[320px] items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-500/15 to-cyan-400/10 text-2xl text-violet-300 ring-1 ring-white/10">
                        ✦
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-200">
                        Your document is ready to talk
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                        {uploaded
                          ? "Ask a question and I’ll find the most relevant information from your PDF."
                          : "Upload a PDF above, then ask anything about its contents."}
                      </p>

                      {uploaded && (
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {["Summarize this document", "What are the key points?", "Explain the main idea"].map(
                            (prompt) => (
                              <button
                                key={prompt}
                                onClick={() => {
                                  setQuestion(prompt);
                                }}
                                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-zinc-400 transition hover:border-violet-400/30 hover:text-zinc-200"
                              >
                                {prompt}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {messages.map((message, index) => (
                      <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                        {message.role === "assistant" && (
                          <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold text-white">
                            AI
                          </div>
                        )}

                        <div className={`${message.role === "user" ? "max-w-[85%]" : "max-w-[90%]"}`}>
                          <div
                            className={`rounded-2xl px-4 py-3.5 text-sm leading-7 ${
                              message.role === "user"
                                ? "rounded-br-md bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                                : "rounded-bl-md border border-white/10 bg-white/[0.045] text-zinc-300"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>

                            {message.role === "assistant" &&
                              message.sources &&
                              message.sources.length > 0 && (
                                <div className="mt-4 border-t border-white/10 pt-3">
                                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                    Sources
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {message.sources.map((source, sourceIndex) => (
                                      <div
                                        key={sourceIndex}
                                        className="rounded-xl border border-white/10 bg-black/15 p-3"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/10 text-[9px] font-bold text-red-400">
                                            PDF
                                          </span>
                                          <div className="min-w-0">
                                            <p className="truncate text-xs font-medium text-zinc-300">
                                              {source.document}
                                            </p>
                                            {source.page !== null && (
                                              <p className="mt-0.5 text-[11px] text-zinc-600">
                                                Page {source.page}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                          <p className={`mt-1.5 px-1 text-[10px] text-zinc-700 ${message.role === "user" ? "text-right" : ""}`}>
                            {message.role === "user" ? "You" : "Document AI"}
                          </p>
                        </div>
                      </div>
                    ))}

                    {asking && (
                      <div className="flex gap-3">
                        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold">
                          AI
                        </div>
                        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div className="shrink-0 px-4 pb-5 md:px-8 md:pb-7">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl border border-white/10 bg-[#0d1118]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl focus-within:border-violet-400/30">
                  <div className="flex items-end gap-2">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-600">
                      ＋
                    </div>
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={!uploaded || asking}
                      placeholder={uploaded ? "Ask anything about your PDF…" : "Upload a PDF to start chatting…"}
                      rows={1}
                      className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={askQuestion}
                      disabled={!uploaded || documentId === null || !question.trim() || asking}
                      aria-label="Send message"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      ↑
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-zinc-700">
                  Enter to send · Shift + Enter for a new line
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );

}
