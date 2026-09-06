"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { aiOutlineToTree } from "@/lib/aiToNodes";
import { ReviewPanel } from "./ReviewPanel";

const MAX_FILE_BYTES = 32 * 1024 * 1024;

// Advances on a timer, not on real server checkpoints — Pass 1 is one
// request/response, not a stream, so there's no way to know exactly
// when Claude moves from "reading" to "structuring". Still more honest
// than a bare spinner: these are the real stages, in the real order,
// just approximately timed rather than exactly synced.
const STAGE_LABELS = {
  reading: "Reading document…",
  identifying: "Identifying modules…",
  structuring: "Structuring topics…",
};

function validateFile(file) {
  if (file.type !== "application/pdf") return "Only PDF files are supported.";
  if (file.size > MAX_FILE_BYTES) return "File is too large. The maximum size is 32 MB.";
  return null;
}

export function UploadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | reading | identifying | structuring | reviewing | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [outline, setOutline] = useState(null);
  const [tree, setTree] = useState(null);

  function reset() {
    setStage("idle");
    setErrorMessage(null);
    setOutline(null);
    setTree(null);
  }

  function close() {
    setIsOpen(false);
    reset();
  }

  async function handleFile(file) {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStage("reading");
    const timers = [
      setTimeout(() => setStage("identifying"), 4000),
      setTimeout(() => setStage("structuring"), 10000),
    ];

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/parse-curriculum", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setStage("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        return;
      }

      setOutline(data);
      setTree(aiOutlineToTree(data));
      setStage("reviewing");
    } catch {
      setStage("error");
      setErrorMessage("Could not reach the server. Check your connection and try again.");
    } finally {
      timers.forEach(clearTimeout);
    }
  }

  function handleInputChange(event) {
    const file = event.target.files[0];
    if (file) handleFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const isBusy = stage === "reading" || stage === "identifying" || stage === "structuring";

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-md bg-(--brand) px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => setIsOpen(true)}
      >
        <Upload size={14} />
        Upload Curriculum
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Upload Curriculum</h2>
              <button onClick={close} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {stage === "reviewing" && outline && tree ? (
              <ReviewPanel outline={outline} tree={tree} onDismiss={close} onRetry={reset} />
            ) : isBusy ? (
              <div className="py-8 text-center text-sm text-neutral-500">
                {STAGE_LABELS[stage]}
              </div>
            ) : (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center ${
                  isDragging ? "border-(--brand) bg-(--brand-soft)" : "border-neutral-300"
                }`}
              >
                <Upload size={24} className="text-neutral-400" />
                <p className="text-sm text-neutral-500">Drag a PDF here, or</p>
                <label className="cursor-pointer text-sm font-semibold text-(--brand)">
                  Browse files
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </label>
                {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
