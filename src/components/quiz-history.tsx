"use client";

import { useEffect, useState } from "react";
import {
  getQuizAttemptHistory,
  type QuizAttemptSummary,
} from "@/lib/courses/progress-actions";
import { Badge } from "./ui/badge";
import { Callout } from "./ui/callout";
import { Card } from "./ui/card";
import { EmptyState } from "./ui/empty-state";

type Status = "loading" | "error" | "ready";

type LoadedState =
  | { key: string; attempts: QuizAttemptSummary[] }
  | { key: string; failed: true };

/**
 * La "meilleure" tentative est celle au pourcentage le plus élevé ; en cas
 * d'égalité, la plus récente l'emporte (le tableau `attempts` est supposé
 * déjà trié du plus récent au plus ancien, comme le renvoie
 * `getQuizAttemptHistory`). Exportée pour être testable isolément.
 */
export function pickBestAttempt(attempts: QuizAttemptSummary[]): QuizAttemptSummary | null {
  if (attempts.length === 0) return null;
  return attempts.reduce((best, current) => (current.percent > best.percent ? current : best));
}

function formatAttemptDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Historique des tentatives du quiz final. `refreshToken` force un
 * rechargement (incrémenté par le parent juste après qu'une nouvelle
 * tentative a été soumise), pour que le résultat qu'on vient d'obtenir
 * apparaisse sans recharger la page.
 */
export function QuizHistory({
  quizId,
  refreshToken,
}: {
  quizId: string | null;
  refreshToken: number;
}) {
  // `loaded` ne contient le résultat que pour la clé (quizId + refreshToken)
  // qui a terminé de charger. L'état "loading" est dérivé en comparant
  // cette clé à la clé courante, plutôt que posé par un setState() direct
  // dans le corps de l'effet (ce que React déconseille) : tant que
  // `loaded` ne correspond pas encore à la requête en cours, on est en
  // chargement, sans avoir besoin d'un setState synchrone supplémentaire.
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    const key = `${quizId}:${refreshToken}`;

    getQuizAttemptHistory(quizId)
      .then((attempts) => {
        if (cancelled) return;
        setLoaded({ key, attempts });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ key, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, refreshToken]);

  // Pas encore de quiz persisté (génération fraîche) : rien à afficher,
  // même logique que pour le reste des fonctionnalités liées à un id réel.
  if (!quizId) return null;

  const currentKey = `${quizId}:${refreshToken}`;
  const current = loaded?.key === currentKey ? loaded : null;
  const status: Status = !current ? "loading" : "failed" in current ? "error" : "ready";
  const attempts = current && "attempts" in current ? current.attempts : [];

  const best = pickBestAttempt(attempts);

  return (
    <section className="mt-6">
      <Card variant="elevated">
        <h2 className="text-lg font-semibold text-foreground">Historique des tentatives</h2>

        {status === "loading" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-foreground-muted">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground-muted [animation-delay:300ms]" />
            </span>
            Chargement de l&apos;historique...
          </div>
        )}

        {status === "error" && (
          <Callout tone="error" className="mt-4">
            Impossible de charger l&apos;historique pour le moment.
          </Callout>
        )}

        {status === "ready" && attempts.length === 0 && (
          <EmptyState
            className="mt-4 text-left"
            description="Aucune tentative enregistrée pour l'instant — ton résultat apparaîtra ici après ton premier essai."
          />
        )}

        {status === "ready" && attempts.length > 0 && best && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Card padding="sm">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Dernier résultat
                </span>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {attempts[0].score}/{attempts[0].total}{" "}
                  <span className="text-sm text-foreground-muted">({attempts[0].percent}%)</span>
                </p>
              </Card>
              <Card variant="accent-violet">
                <span className="text-xs font-medium uppercase tracking-wide text-accent-violet-light">
                  Meilleur score
                </span>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {best.score}/{best.total}{" "}
                  <span className="text-sm text-foreground-muted">({best.percent}%)</span>
                </p>
              </Card>
            </div>

            <ul className="mt-5 space-y-2">
              {attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted">
                      {formatAttemptDate(attempt.completedAt)}
                    </span>
                    {attempt.id === best.id && <Badge tone="accent">Meilleur</Badge>}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {attempt.score}/{attempt.total} · {attempt.percent}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
