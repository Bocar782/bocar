"use client";

import { useMemo, useState } from "react";
import { CourseListItem } from "@/components/course-list-item";
import { DeepAnalysisListItem } from "@/components/deep-analysis-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { IconGraduationCap } from "@/components/marketing/icons";
import { IconSearch } from "./icons";

type CourseItem = {
  id: string;
  title: string;
  domain: string;
  level: string;
  chapterCount: number;
  currentChapterIndex: number | null;
  quizScore: number | null;
  quizTotal: number | null;
};

type AnalysisItem = {
  id: string;
  title: string;
  domain: string;
  caseCount: number;
};

type Filter = "all" | "courses" | "analyses";

// Prompt 06.1 : bibliothèque — recherche texte (titre + domaine) côté
// client, sur des données déjà chargées côté serveur (pas de requête
// supplémentaire : la liste complète de l'utilisateur tient largement en
// mémoire, même logique que les listes déjà existantes sur le dashboard).
export function LibraryBrowser({
  courses,
  analyses,
  initialQuery = "",
}: {
  courses: CourseItem[];
  analyses: AnalysisItem[];
  /** Pré-remplit la recherche, ex. venant de la barre de recherche globale
   *  du shell (`?q=...`) — simple état initial, l'utilisateur garde le
   *  contrôle ensuite. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    if (filter === "analyses") return [];
    if (!normalizedQuery) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(normalizedQuery) ||
        c.domain.toLowerCase().includes(normalizedQuery),
    );
  }, [courses, filter, normalizedQuery]);

  const filteredAnalyses = useMemo(() => {
    if (filter === "courses") return [];
    if (!normalizedQuery) return analyses;
    return analyses.filter(
      (a) =>
        a.title.toLowerCase().includes(normalizedQuery) ||
        a.domain.toLowerCase().includes(normalizedQuery),
    );
  }, [analyses, filter, normalizedQuery]);

  const totalResults = filteredCourses.length + filteredAnalyses.length;
  const hasAnyContent = courses.length + analyses.length > 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted">
            <IconSearch width={16} height={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une formation ou une analyse…"
            className="w-full rounded-full border border-border-subtle bg-overlay/[0.03] py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-violet/50 focus:outline-none"
          />
        </div>

        <div className="inline-flex rounded-full border border-border-subtle bg-overlay/[0.02] p-1 text-xs">
          {([
            ["all", "Tout"],
            ["courses", "Formations"],
            ["analyses", "Analyses"],
          ] as [Filter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                filter === value
                  ? "bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasAnyContent && (
        <EmptyState
          className="mt-8"
          icon={<IconGraduationCap width={22} height={22} />}
          title="Ta bibliothèque est vide pour l'instant"
          description="Lance ta première génération — ta formation apparaîtra ici, prête à reprendre où tu veux."
        />
      )}

      {hasAnyContent && totalResults === 0 && (
        <p className="mt-10 text-center text-sm text-foreground-muted">
          Aucun résultat pour « {query} ».
        </p>
      )}

      {filteredCourses.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Formations
            <span className="ml-2 text-foreground-muted/70">{filteredCourses.length}</span>
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseListItem key={course.id} course={course} />
            ))}
          </ul>
        </section>
      )}

      {filteredAnalyses.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Analyses approfondies
            <span className="ml-2 text-foreground-muted/70">{filteredAnalyses.length}</span>
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAnalyses.map((analysis) => (
              <DeepAnalysisListItem key={analysis.id} analysis={analysis} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
