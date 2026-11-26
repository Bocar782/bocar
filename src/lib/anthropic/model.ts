// Modèle utilisé pour toutes les générations (formations, diagnostic,
// analyses, assistant). Par défaut Claude Haiku 5.5, le moins coûteux ;
// pour monter en gamme sans toucher au code, définir TAVYRA_AI_MODEL sur
// Netlify (ex. "claude-sonnet-5-5" ou "claude-opus-5-5").
export const AI_MODEL = process.env.TAVYRA_AI_MODEL?.trim() || "claude-haiku-5-5";

// La recherche web « dynamique » (web_search_20260209) n'est documentée que
// pour les modèles Opus/Sonnet récents : Haiku utilise la version de base.
export function webSearchTool(maxUses: number) {
  const dynamic = /opus|sonnet|fable|mythos/.test(AI_MODEL);
  return dynamic
    ? ({ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: maxUses })
    : ({ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: maxUses });
}
