import Link from "next/link";
import type { ReactNode } from "react";
import type { ActivityEvent } from "@/lib/dashboard/stats";
import { IconCheck } from "@/components/marketing/icons";
import { IconHome, IconPlusCircle } from "./icons";

// Prompt 06.1 : fil d'activité basé sur des événements RÉELS (création de
// formation, leçon terminée, quiz complété) — aucune activité inventée.

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / dayMs);

  if (diffDays === 0) {
    return `Aujourd'hui à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Hier à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function eventLabel(event: ActivityEvent): { title: string; icon: ReactNode } {
  switch (event.type) {
    case "course_created":
      return {
        title: `Formation créée : « ${event.courseTitle} »`,
        icon: <IconPlusCircle width={16} height={16} />,
      };
    case "lesson_completed":
      return {
        title: `Chapitre terminé « ${event.chapterTitle} » — ${event.courseTitle}`,
        icon: <IconHome width={16} height={16} />,
      };
    case "quiz_completed":
      return {
        title: `Quiz ${event.kind === "final" ? "final" : "de module"} réussi : ${event.score}/${event.total} — ${event.courseTitle}`,
        icon: <IconCheck width={16} height={16} />,
      };
  }
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        Ton activité apparaîtra ici dès que tu commenceras une formation.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {events.map((event, i) => {
        const { title, icon } = eventLabel(event);
        return (
          <li key={`${event.type}-${event.at}-${i}`}>
            <Link
              href={`/dashboard/formations/${event.courseId}`}
              className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-violet/15 text-accent-violet-light">
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{title}</span>
                <span className="block text-xs text-foreground-muted">
                  {formatRelativeDate(event.at)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
