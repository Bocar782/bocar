"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GeneratedCourse } from "@/lib/courses/schemas";
import { useCurrentChapterIndex } from "@/lib/use-current-chapter";
import { MarkdownContent } from "./markdown-content";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Je n'ai pas compris cette partie",
  "Explique-moi ça plus simplement",
  "Donne-moi un autre exemple",
  "Fais-moi un résumé de ce chapitre",
];

export function ChapterChat({
  course,
  courseId,
  maxChapterIndex,
}: {
  course: GeneratedCourse;
  /**
   * Identifiant persisté de la formation. Le contenu réel utilisé par
   * l'assistant est toujours relu et vérifié côté serveur à partir de cet
   * identifiant (jamais depuis `course`, qui ne sert ici qu'à l'affichage
   * local). Si la formation n'a pas pu être sauvegardée (ex. erreur
   * d'enregistrement juste après génération), il n'existe aucune source de
   * vérité côté serveur à interroger : le chat reste indisponible plutôt que
   * de faire confiance au contenu du navigateur.
   */
  courseId: string | null;
  /** Formation verrouillée : ne pas donner à Tavyra de contexte au-delà du contenu débloqué. */
  maxChapterIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  // Repère le chapitre actuellement visible à l'écran, pour donner le bon
  // contexte à Tavyra sans que l'utilisateur ait à le préciser.
  const currentChapterIndex = useCurrentChapterIndex(maxChapterIndex);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!courseId) return null;

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isStreaming) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, currentChapterIndex, messages: newMessages }),
      });

      if (!response.ok || !response.body) {
        throw new Error("La connexion à Tavyra a échoué.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  const currentChapter = course.chapters[currentChapterIndex];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le chat avec Tavyra" : "Ouvrir le chat avec Tavyra"}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-transform hover:scale-105 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[32rem] max-h-[70vh] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border-subtle bg-background-elevated/95 shadow-2xl backdrop-blur-xl sm:bottom-24 sm:right-6">
          <header className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet text-xs font-semibold text-white">
              L
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Tavyra</p>
              {currentChapter && (
                <p className="truncate text-xs text-foreground-muted">
                  Chapitre {currentChapterIndex + 1} · {currentChapter.title}
                </p>
              )}
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <>
                <p className="text-sm text-foreground-muted">
                  Une question sur ce chapitre ? Demande-moi par exemple :
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendMessage(suggestion)}
                      className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((message, i) => (
              <div
                key={i}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {message.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl bg-gradient-to-r from-accent-blue to-accent-violet px-3.5 py-2 text-sm text-white">
                    {message.content}
                  </p>
                ) : message.content ? (
                  <div className="max-w-[85%] rounded-2xl bg-white/[0.04] px-3.5 py-2 text-sm text-foreground">
                    <MarkdownContent content={message.content} />
                  </div>
                ) : (
                  <div className="flex gap-1 rounded-2xl bg-white/[0.04] px-3.5 py-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            ))}

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose ta question..."
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none focus:border-accent-violet/60"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accent-blue to-accent-violet text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Envoyer"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8h9M8.5 3.5 13 8l-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
