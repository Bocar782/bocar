import Link from "next/link";

type DeepAnalysisListItemData = {
  id: string;
  title: string;
  domain: string;
  caseCount: number;
};

export function DeepAnalysisListItem({ analysis }: { analysis: DeepAnalysisListItemData }) {
  return (
    <li className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{analysis.title}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {analysis.domain} · {analysis.caseCount} cas analysé{analysis.caseCount > 1 ? "s" : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-violet/15 px-2.5 py-1 text-xs font-medium text-accent-violet-light">
          Analyse approfondie
        </span>
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          href={`/dashboard/analyses/${analysis.id}`}
          className="rounded-full border border-border-subtle bg-white/5 px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
        >
          Consulter
        </Link>
      </div>
    </li>
  );
}
