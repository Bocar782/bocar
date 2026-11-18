import type { GeneratedDeepAnalysis } from "@/lib/analysis/schemas";
import { Badge, type BadgeTone } from "./ui/badge";
import { Card } from "./ui/card";
import { MarkdownContent } from "./markdown-content";

const OUTCOME_TONE: Record<string, BadgeTone> = {
  "succès": "success",
  "échec": "danger",
  "mixte": "warning",
};

const OUTCOME_DOT: Record<string, string> = {
  "succès": "bg-success",
  "échec": "bg-danger",
  "mixte": "bg-warning",
};

function SectionCard({ section }: { section: GeneratedDeepAnalysis["sections"][number] }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono text-accent-violet-light">
          Cas {section.position + 1}
        </span>
        <Badge tone={OUTCOME_TONE[section.outcome] ?? "neutral"}>{section.outcome}</Badge>
      </div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        {section.name}
      </h3>

      <div className="mt-4">
        <MarkdownContent content={section.content} />
      </div>

      <Card variant="accent-violet" className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-violet-light">
          Enseignements
        </span>
        <ul className="mt-2 space-y-1.5">
          {section.lessons.map((lesson, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 text-accent-violet-light">→</span>
              <span>{lesson}</span>
            </li>
          ))}
        </ul>
      </Card>

      <a
        href={section.source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-medium text-accent-violet-light underline underline-offset-2 hover:text-accent-blue-light"
      >
        Source : {section.source.title} →
      </a>
    </Card>
  );
}

export function DeepAnalysisView({ analysis }: { analysis: GeneratedDeepAnalysis }) {
  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
          {analysis.domain}
        </span>
        <span className="rounded-full border border-accent-violet/30 bg-accent-violet/10 px-3 py-1 text-accent-violet-light">
          Analyse approfondie
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {analysis.title}
      </h1>

      <div className="mt-6">
        <MarkdownContent content={analysis.introduction} />
      </div>

      {/* Sommaire des cas : navigation directe, utile dès que l'analyse
          dépasse 2-3 cas (jusqu'à 7 d'après le pipeline de génération). */}
      <nav
        aria-label="Cas analysés"
        className="mt-8 rounded-2xl border border-border-subtle bg-white/[0.02] p-4"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          {analysis.sections.length} cas analysé{analysis.sections.length > 1 ? "s" : ""}
        </span>
        <ol className="mt-3 flex flex-wrap gap-2">
          {analysis.sections.map((section, i) => (
            <li key={i}>
              <a
                href={`#cas-${i}`}
                className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-white/[0.02] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${OUTCOME_DOT[section.outcome] ?? "bg-foreground-muted"}`}
                />
                <span className="max-w-[10rem] truncate">{section.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6 space-y-6">
        {analysis.sections.map((section, i) => (
          <div key={i} id={`cas-${i}`} className="scroll-mt-20">
            <SectionCard section={section} />
          </div>
        ))}
      </div>

      <section className="mt-8">
        <Card variant="elevated">
          <h2 className="text-lg font-semibold text-foreground">Synthèse pédagogique</h2>
          <div className="mt-3">
            <MarkdownContent content={analysis.synthesis} />
          </div>
          <ul className="mt-2 space-y-2">
            {analysis.keyLessons.map((lesson, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                <span className="mt-0.5 text-accent-blue-light">★</span>
                <span>{lesson}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-8 rounded-2xl border border-border-subtle bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Sources
        </h2>
        <ol className="mt-3 space-y-2">
          {analysis.sources.map((source) => (
            <li key={source.index} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="text-foreground-muted">[{source.index + 1}]</span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate text-accent-violet-light underline underline-offset-2 hover:text-accent-blue-light"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
