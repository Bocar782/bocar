import { CourseCover } from "./dashboard/course-cover";
import { IconTelescope } from "./marketing/icons";
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
    <li className="h-full">
      <Card padding="sm" className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <CourseCover
            seed={analysis.id}
            icon={<IconTelescope width={18} height={18} />}
            className="h-11 w-11"
          />
          <Badge tone="accent">Analyse approfondie</Badge>
        </div>

        <p className="mt-3 line-clamp-2 flex-1 font-medium leading-snug text-foreground">
          {analysis.title}
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          {analysis.domain} · {analysis.caseCount} cas analysé{analysis.caseCount > 1 ? "s" : ""}
        </p>

        <Button
          href={`/dashboard/analyses/${analysis.id}`}
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-4"
        >
          Consulter
        </Button>
      </Card>
    </li>
  );
}
