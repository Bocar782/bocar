"use client";

import { useRef, useState, type FormEvent } from "react";

const SUGGESTIONS = [
  "Le e-commerce de A à Z",
  "Les bases de la finance personnelle",
  "L'histoire de la Rome antique",
  "Python pour débutants",
  "Le marketing digital",
];

const MAX_LENGTH = 500;

export function GenerateForm() {
  const [topic, setTopic] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }

  function applySuggestion(suggestion: string) {
    setTopic(suggestion);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      resizeTextarea();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim()) return;
    // La génération sera branchée sur le pipeline IA à l'étape suivante.
  }

  const isEmpty = topic.trim().length === 0;

  return (
    <div id="generer" className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={handleSubmit}
        className="group relative rounded-[28px] p-px"
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/50 via-white/10 to-accent-violet/50 opacity-60 transition-opacity duration-500 group-focus-within:opacity-100"
        />
        <div className="relative rounded-[28px] bg-background-elevated/80 p-3 shadow-[0_20px_60px_-20px_rgba(76,124,243,0.25)] backdrop-blur-xl sm:p-4">
          <textarea
            ref={textareaRef}
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value.slice(0, MAX_LENGTH));
              resizeTextarea();
            }}
            placeholder="Que veux-tu apprendre ?"
            rows={2}
            maxLength={MAX_LENGTH}
            className="max-h-[360px] w-full resize-none bg-transparent px-3 py-4 text-xl leading-relaxed text-foreground placeholder:text-foreground-muted/70 focus:outline-none sm:text-2xl"
          />

          <div className="flex flex-col-reverse items-start gap-3 border-t border-border-subtle px-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-foreground-muted">
              {topic.length}/{MAX_LENGTH}
            </span>

            <button
              type="submit"
              disabled={isEmpty}
              className="inline-flex items-center gap-2 self-stretch justify-center rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:self-auto"
            >
              Générer ma formation
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M3.5 8h9M8.5 3.5 13 8l-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => applySuggestion(suggestion)}
            className="rounded-full border border-border-subtle bg-white/[0.03] px-4 py-2 text-xs text-foreground-muted transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
