import type { AnalysisBrief, VerifiedCase } from "./schemas";

// Analyse approfondie SANS appel à l'API Anthropic (mode test, voir
// isOfflineAI dans lib/courses/offline.ts). Les cas sont illustratifs et
// présentés comme tels : jamais de fausse source réelle.
const ILLUSTRATIVE_SOURCE = "#mode-test";

function cleanTopic(topic: string): string {
  const t = topic.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  return t.length > 0 ? t : "ce sujet";
}

export function offlineBrief(topic: string): AnalysisBrief {
  const t = cleanTopic(topic);
  return {
    title: `Analyse approfondie : ${t}`,
    domain: "Analyse de cas",
    introduction: `Cette analyse étudie **${t}** à travers trois cas contrastés : une réussite, un échec et un parcours mixte. Comparer des trajectoires différentes est le moyen le plus efficace de comprendre ce qui fait réellement la différence, au-delà des conseils généraux.\n\nPour chaque cas, nous verrons le contexte, les décisions clés, les causes du résultat obtenu et les enseignements transférables. Une synthèse finale met en évidence les motifs communs.\n\n*Mode test : les cas présentés sont illustratifs et ne s'appuient pas sur des sources réelles.*`,
    researchAngle: `Comparer une réussite, un échec et un parcours mixte liés à ${t}.`,
    caseCount: 3,
    searchQueries: [`${t} réussite`, `${t} échec`, `${t} stratégie`, `${t} chiffres clés`],
  };
}

export function offlineCases(brief: AnalysisBrief): VerifiedCase[] {
  const t = brief.title.replace(/^Analyse approfondie : /, "");
  return [
    {
      name: "Cas A : une progression méthodique",
      summary: `Un porteur de projet aborde ${t} avec un objectif précis, avance par étapes courtes et mesure ses résultats chaque semaine. Il ajuste sa stratégie dès que les chiffres le justifient.`,
      outcome: "succès",
      sourceUrl: ILLUSTRATIVE_SOURCE,
      sourceTitle: "Cas illustratif (mode test, sans source réelle)",
    },
    {
      name: "Cas B : la croissance trop rapide",
      summary: `Un acteur se lance dans ${t} avec beaucoup de moyens mais sans valider ses hypothèses de départ. Il investit massivement avant d'avoir confirmé l'intérêt de son public et doit tout arrêter.`,
      outcome: "échec",
      sourceUrl: ILLUSTRATIVE_SOURCE,
      sourceTitle: "Cas illustratif (mode test, sans source réelle)",
    },
    {
      name: "Cas C : le pivot réussi",
      summary: `Un projet lié à ${t} démarre mal, mais l'équipe analyse ses erreurs, écoute ses utilisateurs et change d'approche. Le redressement est réel mais plus lent que prévu.`,
      outcome: "mixte",
      sourceUrl: ILLUSTRATIVE_SOURCE,
      sourceTitle: "Cas illustratif (mode test, sans source réelle)",
    },
  ];
}

export function offlineSection(brief: AnalysisBrief, c: VerifiedCase): { content: string; lessons: string[] } {
  const verdict =
    c.outcome === "succès"
      ? "Ce cas a réussi parce que chaque décision était testée à petite échelle avant d'être généralisée."
      : c.outcome === "échec"
        ? "Ce cas a échoué parce que les décisions coûteuses ont été prises avant d'avoir vérifié les hypothèses de départ."
        : "Ce cas illustre qu'une erreur de départ n'est pas fatale si elle est analysée rapidement et honnêtement.";
  return {
    content: `## ${c.name}\n\n### Le contexte\n\n${c.summary}\n\n### Les décisions clés\n\nTrois moments ont été déterminants : la définition de l'objectif de départ, la manière de tester les premières hypothèses, et la réaction face aux premiers résultats. C'est à chacun de ces moments que la trajectoire s'est jouée.\n\n### Pourquoi ce résultat\n\n${verdict} On retrouve ici un mécanisme classique : la qualité de la boucle « décider, mesurer, ajuster » compte davantage que les moyens engagés au départ.\n\n### Ce qu'il faut en retenir\n\nAppliqué à ${brief.title.replace(/^Analyse approfondie : /, "")}, ce cas montre l'importance de valider tôt, de mesurer régulièrement et de garder la capacité de changer de direction sans attendre qu'il soit trop tard.`,
    lessons:
      c.outcome === "succès"
        ? ["Fixer un objectif précis et mesurable", "Tester à petite échelle avant de généraliser", "Mesurer chaque semaine et ajuster"]
        : c.outcome === "échec"
          ? ["Valider ses hypothèses avant d'investir", "Se méfier d'une croissance trop rapide", "Écouter les premiers signaux faibles"]
          : ["Analyser ses erreurs sans complaisance", "Écouter ses utilisateurs", "Accepter qu'un redressement prenne du temps"],
  };
}

export function offlineSynthesis(): { synthesis: string; keyLessons: string[] } {
  return {
    synthesis: `Les trois cas convergent vers un même enseignement : **la réussite dépend moins des moyens de départ que de la qualité de la boucle d'apprentissage**. Le cas réussi teste, mesure et ajuste en continu ; le cas raté engage des ressources importantes avant d'avoir validé ses hypothèses ; le cas mixte montre qu'un mauvais départ peut être rattrapé par une analyse lucide et un changement d'approche.\n\nPour ta propre démarche, retiens qu'il vaut mieux avancer par petites étapes vérifiables, regarder les résultats en face et décider vite quand il faut changer de direction.`,
    keyLessons: [
      "Valider ses hypothèses à petite échelle avant d'investir",
      "Mesurer régulièrement et ajuster sans attendre",
      "Une erreur analysée rapidement n'est pas fatale",
      "La méthode compte plus que les moyens de départ",
    ],
  };
}
