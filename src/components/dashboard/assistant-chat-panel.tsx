"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { IconChat } from "@/components/marketing/icons";
import { MarkdownContent } from "@/components/markdown-content";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChapterOption = {
  position: number;
  title: string;
  locked: boolean;
};

const SUGGESTIONS = [
  "Explique-moi ce chapitre simplement",
  "Donne-moi un exemple concret",
  "Pose-moi une question pour vérifier ma compréhension",
  "Fais-moi un résumé",
];

// Prompt 06.5 : assistant en espace séparé — même route /api/chat que le
// chat flottant de la lecture (chapter-chat.tsx), donc mêmes garanties
// serveur (contenu relu depuis Supabase, jamais fait confiance au
// navigateur ; verrouillage plan gratuit appliqué indépendamment de ce que
// ce composant affiche). Pas d'historique persistant ici non plus (aucune
// table ne le stocke) : au rechargement de la page, la conversation
// recommence à zéro, comme le chat existant.
export function AssistantChatPanel({
  courseId,
  courseTitle,
  chapters,
  initialChapterIndex,
}: {
  courseId: string;
  courseTitle: string;
  chapters: ChapterOption[];
  initialChapterIndex: number;
}) {
  const [chapterIndex, setChapterIndex] = useState(initialChapterIndex);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Changer de chapitre (ou de formation) recommence la conversation : le
  // contexte envoyé à Tavyra change, un fil mélangeant deux chapitres n'aurait
  // pas de sens. Ajusté PENDANT le rendu (pattern React recommandé) plutôt
  // que dans un effet, pour éviter un rendu en cascade inutile.
  const [resetKey, setResetKey] = useState(`${courseId}:${initialChapterIndex}`);
  const currentKey = `${courseId}:${chapterIndex}`;
  if (currentKey !== resetKey) {
    setResetKey(currentKey);
    setMessages([]);
    setError(null);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ courseId, currentChapterIndex: chapterIndex, messages: newMessages }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.clone().json().catch(() => null);
        throw new Error(payload?.error ?? "La connexion à Tavyra a échoué.");
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

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-background-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={28} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Assistant</p>
            <p className="truncate text-xs text-foreground-muted">{courseTitle}</p>
          </div>
        </div>
        <select
          value={chapterIndex}
          onChange={(e) => setChapterIndex(Number(e.target.value))}
          className="max-w-[60%] rounded-full border border-border-subtle bg-overlay/[0.03] px-3 py-1.5 text-xs text-foreground focus:border-accent-violet/50 focus:outline-none"
        >
          {chapters.map((chapter) => (
            <option key={chapter.position} value={chapter.position} disabled={chapter.locked}>
              Chapitre {chapter.position + 1} · {chapter.title}
              {chapter.locked ? " (verrouillé)" : ""}
            </option>
          ))}
        </select>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <>
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
                <IconChat width={16} height={16} />
              </span>
              <span>Une question sur ce chapitre ? Demande-moi par exemple :</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-border-subtle bg-overlay/[0.03] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-overlay/20 hover:bg-overlay/[0.06] hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((message, i) => (
          <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {message.role === "user" ? (
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-accent-blue to-accent-violet px-3.5 py-2 text-sm text-white shadow-[0_4px_16px_-6px_var(--accent-violet)]">
                {message.content}
              </p>
            ) : message.content ? (
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border-subtle bg-overlay/[0.04] px-3.5 py-2 text-sm text-foreground">
                <MarkdownContent content={message.content} />
              </div>
            ) : (
              <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-border-subtle bg-overlay/[0.04] px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-violet-light" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-violet-light [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-violet-light [animation-delay:300ms]" />
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

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle p-3.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-overlay/[0.03] px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none transition-colors focus:border-accent-violet/60"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accent-blue to-accent-violet text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          aria-label="Envoyer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
  );
}
