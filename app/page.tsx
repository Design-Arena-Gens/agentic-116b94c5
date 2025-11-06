"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PdfJobStatus {
  job_id?: string;
  status: string;
  num_pages?: number;
  pages_processed?: number;
  error?: string;
  data?: {
    type?: string;
    value?: string;
  };
  markdown?: string;
  html?: string;
  text?: string;
  pdf_url?: string;
  conversion_status?: string;
}

const POLL_INTERVAL_MS = 5000;

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<PdfJobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const container = document.getElementById("status-log");
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [status, autoScroll]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let ignore = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch(`/api/convert?jobId=${encodeURIComponent(jobId)}`);
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }
        const payload: PdfJobStatus = await response.json();
        if (ignore) {
          return;
        }
        setStatus(payload);
        setRawResponse(payload);
        const completionState = payload.status?.toLowerCase();
        if (completionState === "completed") {
          const derivedMarkdown =
            payload.data?.value ?? payload.markdown ?? payload.html ?? payload.text ?? "";
          setMarkdown(derivedMarkdown);
          return;
        }
        if (completionState === "error" || completionState === "failed") {
          setError(payload.error || "Conversion failed. Check Mathpix dashboard for details.");
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (!ignore) {
          setError((err as Error).message);
        }
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [jobId]);

  const progress = useMemo(() => {
    if (!status?.num_pages || !status?.pages_processed) {
      return 0;
    }
    if (status.num_pages === 0) {
      return 0;
    }
    return Math.min(status.pages_processed / status.num_pages, 1);
  }, [status?.num_pages, status?.pages_processed]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fileInputRef.current?.files?.length) {
      setError("Attach a PDF to convert.");
      return;
    }
    const file = fileInputRef.current.files[0];
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus(null);
    setJobId(null);
    setMarkdown("");
    setRawResponse(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }

      const payload = (await response.json()) as PdfJobStatus & {
        success?: boolean;
        id?: string;
        pdf_id?: string;
      };

      const newJobId = payload.job_id || payload.id || payload.pdf_id;
      if (!newJobId) {
        throw new Error("Upload succeeded but no job id returned by Mathpix.");
      }

      setJobId(newJobId);
      setStatus(payload);
      setRawResponse(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const conversionState = status?.status?.replace(/_/g, " ") ?? "idle";

  return (
    <main style={{ width: "100%", maxWidth: 1200, padding: "48px 32px" }}>
      <section
        style={{
          background: "rgba(10, 22, 50, 0.72)",
          border: "1px solid rgba(88, 162, 255, 0.25)",
          borderRadius: 24,
          padding: "48px 56px",
          boxShadow: "0 40px 80px rgba(2, 8, 24, 0.6)",
          backdropFilter: "blur(24px)",
        }}
      >
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "2.6rem", margin: 0, letterSpacing: "-0.04em" }}>
            Math-aware OCR Pipeline
          </h1>
          <p style={{ marginTop: 12, maxWidth: 720, lineHeight: 1.6, fontSize: "1.05rem" }}>
            Upload a math-heavy textbook PDF and receive fully editable Markdown with LaTeX equations.
            Unlimited pages supported via Mathpix PDF-as-a-service. Provide your Mathpix credentials in
            the deployment environment to activate conversions.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <label
            htmlFor="file"
            style={{
              border: "1px dashed rgba(148, 197, 255, 0.5)",
              borderRadius: 18,
              padding: "40px 32px",
              textAlign: "center",
              background: "rgba(21, 36, 79, 0.35)",
              cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
          >
            <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>Drop your PDF or click to select</div>
            <div style={{ marginTop: 8, opacity: 0.7 }}>High-resolution scans produce the best results.</div>
            <input
              ref={fileInputRef}
              id="file"
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              alignSelf: "flex-start",
              background: isSubmitting ? "rgba(93, 113, 255, 0.35)" : "linear-gradient(135deg, #627dff, #5ac8fa)",
              color: "#0b111f",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "14px 28px",
              border: "none",
              borderRadius: 999,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              boxShadow: isSubmitting ? "none" : "0 20px 40px rgba(90, 200, 250, 0.25)",
            }}
          >
            {isSubmitting ? "Submitting…" : "Convert to Markdown"}
          </button>
        </form>

        <section style={{ marginTop: 48, display: "grid", gap: 32, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <article
            style={{
              padding: 24,
              borderRadius: 18,
              background: "rgba(13, 25, 57, 0.75)",
              border: "1px solid rgba(88, 162, 255, 0.2)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Conversion Status</h2>
            <p style={{ marginTop: 12, fontSize: "0.95rem", opacity: 0.85 }}>{conversionState}</p>
            <div style={{
              marginTop: 18,
              height: 8,
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
            }}>
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: "linear-gradient(135deg, #9ef1ff, #5d8aff)",
                  height: "100%",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <ul style={{ marginTop: 18, paddingLeft: 18, lineHeight: 1.6, opacity: 0.8 }}>
              <li>Pages processed: {status?.pages_processed ?? 0}</li>
              <li>Total pages: {status?.num_pages ?? "—"}</li>
              <li>Job ID: {jobId ?? "—"}</li>
            </ul>
            {status?.pdf_url ? (
              <a
                href={status.pdf_url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 16, fontWeight: 600, color: "#8cd2ff" }}
              >
                Download reconstructed PDF
              </a>
            ) : null}
            {error ? (
              <p style={{ marginTop: 16, color: "#ff8b94", fontWeight: 600 }}>Error: {error}</p>
            ) : null}
          </article>

          <article
            style={{
              padding: 24,
              borderRadius: 18,
              background: "rgba(13, 25, 57, 0.75)",
              border: "1px solid rgba(88, 162, 255, 0.2)",
              minHeight: 260,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Raw Math Markdown</h2>
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(event) => setAutoScroll(event.target.checked)}
                />
                Auto-scroll log
              </label>
            </header>
            <div
              id="status-log"
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: "rgba(6, 16, 40, 0.85)",
                border: "1px solid rgba(90, 160, 255, 0.25)",
                minHeight: 160,
                maxHeight: 320,
                overflow: "auto",
                fontSize: "0.85rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {rawResponse ? JSON.stringify(rawResponse, null, 2) : "Waiting for conversion events."}
            </div>
          </article>
        </section>

        {markdown ? (
          <section
            style={{
              marginTop: 48,
              padding: 32,
              borderRadius: 24,
              background: "rgba(236, 244, 255, 0.06)",
              border: "1px solid rgba(134, 206, 255, 0.25)",
            }}
          >
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Typeset Preview</h2>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(markdown)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(140, 210, 255, 0.45)",
                  background: "rgba(8, 18, 46, 0.75)",
                  color: "#d5e9ff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Copy Markdown
              </button>
            </header>
            <div
              style={{
                marginTop: 24,
                background: "rgba(6, 14, 33, 0.85)",
                borderRadius: 16,
                padding: 24,
                border: "1px solid rgba(104, 166, 255, 0.2)",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {markdown}
              </ReactMarkdown>
            </div>
            <details style={{ marginTop: 24 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Show raw output</summary>
              <textarea
                readOnly
                value={markdown}
                style={{
                  width: "100%",
                  marginTop: 16,
                  minHeight: 200,
                  background: "rgba(3, 8, 19, 0.9)",
                  color: "#e9f1ff",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(88, 162, 255, 0.3)",
                }}
              />
            </details>
          </section>
        ) : null}
      </section>
    </main>
  );
}
