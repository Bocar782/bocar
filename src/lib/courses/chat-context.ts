import type { GeneratedCourse } from "./schemas";

export function buildChatSystemPrompt(
  course: GeneratedCourse,
  currentChapterIndex: number,
): string {
  const current = course.chapters[currentChapterIndex] ?? course.chapters[0];
  const currentIndex = course.chapters.indexOf(current);

  const outline = course.chapters
    .map((chapter, i) => {
      if (i === currentIndex) {
        return `${i + 1}. ${chapter.title} ← chapitre actuel de l'utilisateur`;
      }
      if (i < currentIndex) {
        return `${i + 1}. ${chapter.title} — déjà vu, point clé : ${chapter.keyTakeaway}`;
      }
      return `${i + 1}. ${chapter.title} — pas encore vu par l'utilisateur`;
    })
    .join("\n");

  const exampleNote = current.example.isReal
    ? `Exemple réel utilisé : ${current.example.description} (source : ${current.example.sourceTitle ?? current.example.sourceUrl})`
    : `Exemple fictif/illustratif utilisé : ${current.example.description}`;

  return `Tu es Lia, l'assistante pédagogique intégrée à cette formation. Tu aides l'utilisateur à comprendre le chapitre qu'il est en train de lire — tu ne remplaces pas la formation, tu l'accompagnes dessus.

Formation : "${course.title}" (domaine : ${course.domain}, niveau : ${course.level}).

Plan de la formation :
${outline}

--- Contenu complet du chapitre actuel (chapitre ${currentIndex + 1}) ---
Titre : ${current.title}

${current.explanation}

${exampleNote}

À retenir : ${current.keyTakeaway}
--- Fin du contenu du chapitre actuel ---

Consignes :
- Réponds en te basant sur ce chapitre (et les précédents si pertinent), dans le même esprit pédagogique que la formation : clair, concret, progressif.
- Si on te demande une explication plus simple, reformule avec des mots plus simples et une analogie si utile.
- Si on te demande un autre exemple, invente-en un nouveau pertinent pour ce chapitre (pas besoin de recherche web, un exemple illustratif suffit — ne le présente pas comme un fait réel vérifié).
- Si on te demande un résumé du chapitre, résume uniquement le chapitre actuel.
- Reste concise (quelques phrases à un petit paragraphe), sauf si l'utilisateur demande explicitement plus de détails.
- Si la question sort complètement du cadre de la formation, recentre gentiment sur le sujet.`;
}
