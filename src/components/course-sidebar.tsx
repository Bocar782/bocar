"use client";

import { useState } from "react";
import type { GeneratedModule } from "@/lib/courses/schemas";
import { useCurrentChapterIndex } from "@/lib/use-current-chapter";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SidebarBody({
  modules,
  totalChapters,
  completedCount,
  unlockedCount,
  hasQuiz,
  currentChapterIndex,
  collapsedModules,
  onToggleModule,
}: {
  modules: GeneratedModule[];
  totalChapters: number;
  completedCount: number;
  unlockedCount: number;
  hasQuiz: boolean;
  currentChapterIndex: number;
  collapsedModules: Set<number>;
  onToggleModule: (position: number) => void;
}) {
  const percent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;

  return (
    <>
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>
            {completedCount}/{totalChapters} leçon{totalChapters > 1 ? "s" : ""} terminée
            {completedCount > 1 ? "s" : ""}
          </span>
          <span className="font-semibold text-foreground">{percent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => scrollToId("formation-top")}
          className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
        >
          Introduction
        </button>

        {modules.map((module) => {
          const isCollapsed = collapsedModules.has(module.position);
          return (
            <div key={module.position}>
              <button
                type="button"
                onClick={() => onToggleModule(module.position)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
              >
                <span className="truncate">{module.title}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={`shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                >
                  <path d="M2 2l6 3-6 3V2z" fill="currentColor" />
                </svg>
              </button>

              {!isCollapsed && (
                <div className="ml-1.5 space-y-0.5 border-l border-border-subtle pl-2.5">
                  {module.chapters.map((chapter) => {
                    const isActive = chapter.position === currentChapterIndex;
                    const isLocked = chapter.position >= unlockedCount;
                    return (
                      <button
                        key={chapter.position}
                        type="button"
                        onClick={() => scrollToId(`chapitre-${chapter.position}`)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-accent-violet/10 text-foreground"
                            : "text-foreground-muted hover:bg-white/[0.05] hover:text-foreground"
                        }`}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {chapter.completed ? (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                              <circle cx="7" cy="7" r="7" className="fill-accent-blue" />
                              <path
                                d="M4 7l2 2 4-4"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : isLocked ? (
                            <span className="text-[10px] text-foreground-muted/60" aria-hidden>
                              🔒
                            </span>
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-border-subtle" aria-hidden />
                          )}
                        </span>
                        <span className="truncate">{chapter.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {hasQuiz && (
          <button
            type="button"
            onClick={() => scrollToId("resume-section")}
            className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            Résumé &amp; quiz final
          </button>
        )}
      </nav>
    </>
  );
}

/**
 * Sommaire de la formation : hiérarchie modules → leçons, pliable/dépliable,
 * avec indication de la leçon en cours (scrollspy partagé avec le chat et
 * le suivi de progression) et des leçons terminées. Persistant en colonne
 * sur grand écran, replié en tiroir sur mobile/tablette.
 */
export function CourseSidebar({
  modules,
  totalChapters,
  completedCount,
  unlockedCount,
  hasQuiz,
  maxChapterIndex,
}: {
  modules: GeneratedModule[];
  totalChapters: number;
  completedCount: number;
  unlockedCount: number;
  hasQuiz: boolean;
  maxChapterIndex?: number;
}) {
  const currentChapterIndex = useCurrentChapterIndex(maxChapterIndex);
  const [collapsedModules, setCollapsedModules] = useState<Set<number>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleModule(position: number) {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  const sharedProps = {
    modules,
    totalChapters,
    completedCount,
    unlockedCount,
    hasQuiz,
    currentChapterIndex,
    collapsedModules,
    onToggleModule: toggleModule,
  };

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border-subtle bg-white/[0.02] px-4 py-3 text-sm font-medium text-foreground"
        >
          <span>Sommaire de la formation</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform duration-200 ${mobileOpen ? "rotate-180" : ""}`}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {mobileOpen && (
          <div className="mt-2 rounded-2xl border border-border-subtle bg-background-elevated/95 p-4">
            <SidebarBody {...sharedProps} />
          </div>
        )}
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:block lg:h-fit lg:max-h-[calc(100vh-3rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-border-subtle lg:bg-white/[0.02] lg:p-4">
        <SidebarBody {...sharedProps} />
      </aside>
    </>
  );
}
