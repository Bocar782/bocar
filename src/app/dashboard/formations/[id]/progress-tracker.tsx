"use client";

import { useEffect, useRef } from "react";
import { updateChapterProgress } from "@/lib/courses/progress-actions";
import { useCurrentChapterIndex } from "@/lib/use-current-chapter";

const DEBOUNCE_MS = 1500;

/** Enregistre en base le chapitre actuellement lu, pour le bouton "Continuer". */
export function ProgressTracker({
  courseId,
  maxChapterIndex,
}: {
  courseId: string;
  /** Formation verrouillée : ne pas enregistrer de progression au-delà du contenu débloqué. */
  maxChapterIndex?: number;
}) {
  const currentChapterIndex = useCurrentChapterIndex(maxChapterIndex);
  const lastSaved = useRef<number | null>(null);

  useEffect(() => {
    if (currentChapterIndex === lastSaved.current) return;

    const timeout = setTimeout(() => {
      lastSaved.current = currentChapterIndex;
      updateChapterProgress(courseId, currentChapterIndex);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [courseId, currentChapterIndex]);

  return null;
}
