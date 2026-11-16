import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type DeepAnalysisListItemData = {
  id: string;
  title: string;
  domain: string;
  caseCount: number;
};

export function DeepAnalysisListItem({ analysis }: { analysis: DeepAnalysisListItemData }) {
  return (
    <li>
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{analysis.title}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {analysis.domain} · {analysis.caseCount} cas analysé{analysis.caseCount > 1 ? "s" : ""}
            </p>
          </div>
          <Badge tone="accent">Analyse approfondie</Badge>
        </div>

        <div className="mt-3 flex justify-end">
          <Button href={`/dashboard/analyses/${analysis.id}`} variant="secondary" size="sm">
            Consulter
          </Button>
        </div>
      </Card>
    </li>
  );
}
