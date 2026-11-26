"use client";

import { useState } from "react";
import { AnalysisGenerator } from "./analysis-generator";
import { CourseGenerator } from "./course-generator";

export function GeneratorTabs({
  courseRemainingGenerations,
  courseLocked,
  analysisRemainingGenerations,
  analysisIsPro,
  initialTopic,
}: {
  courseRemainingGenerations: number;
  courseLocked: boolean;
  analysisRemainingGenerations: number;
  analysisIsPro: boolean;
  initialTopic?: string;
}) {
  const [tab, setTab] = useState<"course" | "analysis">("course");

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-8 inline-flex rounded-full border border-border-subtle bg-overlay/[0.02] p-1">
        <button
          type="button"
          onClick={() => setTab("course")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === "course"
              ? "bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Formation classique
        </button>
        <button
          type="button"
          onClick={() => setTab("analysis")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === "analysis"
              ? "bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Analyse approfondie
        </button>
      </div>

      {tab === "course" ? (
        <CourseGenerator
          remainingGenerations={courseRemainingGenerations}
          locked={courseLocked}
          initialTopic={initialTopic}
        />
      ) : (
        <AnalysisGenerator
          remainingGenerations={analysisRemainingGenerations}
          isPro={analysisIsPro}
        />
      )}
    </div>
  );
}
