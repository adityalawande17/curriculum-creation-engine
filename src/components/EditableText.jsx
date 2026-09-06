"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Click-to-edit text, Notion-style. Two modes:
 *  - not editing: a <div> showing the value (or a low-contrast placeholder)
 *  - editing: a <textarea> that looks identical to the div
 *
 * Both modes render the exact same `shared` class string, so there's
 * nothing to accidentally mismatch between them (Known Trap #5).
 *
 * variant="title"       -> Enter commits and exits (titles are one line)
 * variant="description" -> Enter inserts a newline (descriptions are multi-line)
 */
export function EditableText({
  value,
  onChange,
  placeholder = "",
  variant = "description",
  autoFocus = false,
  className = "",
}) {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef(null);

  // Runs after the textarea actually exists in the page. Focuses it,
  // puts the caret at the end (not the start), and sizes it to fit
  // whatever text is already there.
  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [isEditing]);

  function startEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function commit() {
    onChange(draft);
    setIsEditing(false);
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  function handleChange(event) {
    setDraft(event.target.value);
    // Auto-grow: reset height first so scrollHeight reflects the new
    // content, not the previous (possibly taller) render.
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === "Enter" && variant === "title") {
      event.preventDefault();
      commit();
    }
    // Enter on a description falls through and does nothing special —
    // the textarea's own default behavior inserts a newline.
  }

  const shared = `block w-full bg-transparent outline-none border-none p-0 m-0 ${className}`;

  if (!isEditing) {
    return (
      <div
        className={`${shared} cursor-text whitespace-pre-wrap ${!value ? "text-neutral-300" : ""}`}
        onClick={startEditing}
        tabIndex={0}
        role="button"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            startEditing();
          }
        }}
      >
        {value || placeholder}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      className={`${shared} resize-none`}
      value={draft}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      rows={1}
    />
  );
}
