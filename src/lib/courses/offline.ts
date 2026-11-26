import type {
  Analysis,
  ChapterContent,
  CourseSummary,
  DiagnosticAnswer,
  GeneratedChapter,
  Programme,
  QuizQuestion,
} from "./schemas";

// Mode de génération SANS appel à l'API Anthropic (demande explicite de
// l'utilisateur, pour tester le produit sans frais). Actif par défaut ;
// pour revenir à la vraie génération par Claude, définir la variable
// d'environnement TAVYRA_LIVE_AI=1 (Netlify → Environment variables).
// Jamais actif pendant les tests automatisés (NODE_ENV=test), qui vérifient
// le vrai parcours avec un client Anthropic simulé.
export function isOfflineAI(): boolean {
  return process.env.TAVYRA_LIVE_AI !== "1" && process.env.NODE_ENV !== "test";
}

function cleanTopic(topic: string): string {
  const t = topic.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  return t.length > 0 ? t : "ce sujet";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function levelFromAnswers(answers?: DiagnosticAnswer[]): Analysis["level"] {
  const first = answers?.[0]?.answer.toLowerCase() ?? "";
  if (/avanc|expert|maîtris|bien/.test(first)) return "avancé";
  if (/interm|bases|un peu|quelques/.test(first)) return "intermédiaire";
  return "débutant";
}

export function offlineAnalysis(topic: string, answers?: DiagnosticAnswer[]): Analysis {
  const t = cleanTopic(topic);
  return {
    title: `${capitalize(t)} : comprendre, pratiquer, maîtriser`,
    domain: "Formation générale",
    level: levelFromAnswers(answers),
    angle: `Partir des bases de ${t}, les appliquer à des situations concrètes, puis consolider avec une méthode personnelle.`,
    usesRealWorldExamples: false,
    moduleCount: 3,
  };
}

function subjectOf(analysis: Analysis): string {
  return analysis.title.split(" : ")[0].toLowerCase();
}

export function offlineProgramme(analysis: Analysis): Programme {
  const t = subjectOf(analysis);
  return {
    introduction: `Cette formation t'accompagne pas à pas dans l'apprentissage de **${t}**, au niveau ${analysis.level}. L'objectif n'est pas d'accumuler des informations, mais de construire une compréhension solide, puis de la transformer en compétence concrète.\n\nLe parcours est organisé en trois modules progressifs : d'abord les fondamentaux et le vocabulaire, ensuite la mise en pratique avec une méthode claire et les erreurs à éviter, enfin l'approfondissement et la construction de ton propre plan d'action. Chaque leçon se termine par un encadré « à retenir », et chaque module par un quiz pour vérifier tes acquis.`,
    objectives: [
      `Expliquer avec tes propres mots ce qu'est ${t} et pourquoi c'est important`,
      `Maîtriser le vocabulaire et les principes essentiels de ${t}`,
      `Appliquer une méthode en quatre étapes pour passer à la pratique`,
      `Repérer et éviter les erreurs les plus fréquentes des débutants`,
      `Construire un plan d'action personnel pour continuer à progresser`,
    ],
    modules: [
      {
        title: `Les fondamentaux de ${t}`,
        objective: `Comprendre ce qu'est ${t}, en maîtriser le vocabulaire et les grands principes.`,
        chapters: [
          { title: `Comprendre ${t} : définition et enjeux`, summary: "Définir le sujet, son utilité et son périmètre.", exampleIndex: null },
          { title: `Le vocabulaire essentiel de ${t}`, summary: "Les termes clés à connaître pour suivre la suite.", exampleIndex: null },
          { title: `Les grands principes qui structurent ${t}`, summary: "Les règles de fond qui expliquent le fonctionnement du sujet.", exampleIndex: null },
        ],
      },
      {
        title: `Mettre ${t} en pratique`,
        objective: `Appliquer une méthode concrète et éviter les erreurs classiques.`,
        chapters: [
          { title: `Une méthode en quatre étapes pour aborder ${t}`, summary: "Observer, comprendre, essayer, ajuster.", exampleIndex: null },
          { title: "Les erreurs fréquentes et comment les éviter", summary: "Les pièges les plus courants et leurs parades.", exampleIndex: null },
          { title: `Étude de cas : ${t} en situation`, summary: "Un cas complet déroulé du début à la fin.", exampleIndex: null },
        ],
      },
      {
        title: `Approfondir et progresser en ${t}`,
        objective: `Consolider ses acquis et organiser sa progression sur la durée.`,
        chapters: [
          { title: `Les notions avancées de ${t}`, summary: "Ce qui distingue un niveau confirmé d'un niveau débutant.", exampleIndex: null },
          { title: "Construire ton plan d'action personnel", summary: "Fixer des objectifs, planifier, mesurer ses progrès.", exampleIndex: null },
          { title: "Aller plus loin : la pratique régulière", summary: "Entretenir et développer ses compétences dans le temps.", exampleIndex: null },
        ],
      },
    ],
    summaryAngle: "Récapituler la progression et donner envie de passer à l'action.",
  };
}

type ChapterInput = {
  moduleIndex: number;
  positionInModule: number;
  title: string;
  moduleTitle: string;
};

export function offlineChapter(analysis: Analysis, plan: ChapterInput): ChapterContent {
  const t = subjectOf(analysis);
  const key = plan.moduleIndex * 3 + plan.positionInModule;
  const intro = `## ${plan.title}\n\nCette leçon fait partie du module « ${plan.moduleTitle} ».`;

  const bodies: string[] = [
    `${intro} Avant de chercher à maîtriser ${t}, il faut savoir précisément de quoi on parle. Un sujet mal défini mène presque toujours à un apprentissage dispersé : on lit beaucoup, on retient peu.\n\n### Une définition de travail\n\nRetiens cette idée simple : **${t} est un ensemble de connaissances et de pratiques qui répondent à un besoin concret**. Pour le comprendre, pose-toi trois questions : à quoi cela sert-il ? Qui l'utilise ? Que se passe-t-il quand on le maîtrise mal ?\n\n### Pourquoi c'est important\n\nComprendre les enjeux te donne une motivation durable et un fil conducteur. Chaque nouvelle notion pourra ensuite être rattachée à ce besoin de départ, ce qui la rend beaucoup plus facile à mémoriser.\n\n### Délimiter le périmètre\n\nUn bon apprentissage commence par un périmètre clair : ce que tu veux savoir faire à la fin, et ce que tu laisses volontairement de côté pour l'instant. C'est ce qui évite la surcharge d'informations.`,
    `${intro} Chaque domaine possède son propre vocabulaire. Le maîtriser, c'est pouvoir lire, comprendre et échanger sans être bloqué à chaque phrase.\n\n### Pourquoi apprendre le vocabulaire en premier\n\nLes termes techniques sont des raccourcis : un seul mot résume souvent une idée entière. Tant que tu ne les connais pas, chaque explication semble plus compliquée qu'elle ne l'est réellement.\n\n### La méthode des trois colonnes\n\nPour chaque nouveau terme lié à ${t}, note : **1)** le mot, **2)** sa définition avec tes propres mots, **3)** un exemple concret. Reformuler avec tes mots est l'étape la plus importante : c'est elle qui prouve que tu as compris, et pas seulement lu.\n\n### Réviser intelligemment\n\nRelis ta liste le lendemain, puis trois jours plus tard, puis une semaine plus tard. Cette répétition espacée ancre durablement les notions avec très peu d'effort.`,
    `${intro} Derrière les détails, ${t} repose sur quelques grands principes. Les identifier permet de comprendre plutôt que d'apprendre par cœur.\n\n### Principe 1 : partir des bases\n\nLes notions avancées s'appuient toujours sur les fondamentaux. Une difficulté sur un point avancé vient très souvent d'une base mal comprise : c'est là qu'il faut revenir.\n\n### Principe 2 : relier les notions entre elles\n\nUne notion isolée s'oublie vite ; une notion reliée à d'autres devient un réflexe. Pour chaque idée, demande-toi à quoi elle se rattache dans ce que tu sais déjà.\n\n### Principe 3 : le contexte change tout\n\nUne même règle peut s'appliquer différemment selon la situation. Comprendre **pourquoi** une règle existe te permet de savoir quand l'adapter, au lieu de l'appliquer aveuglément.`,
    `${intro} Passer de la théorie à la pratique est souvent l'étape où l'on bloque. Voici une méthode simple, applicable à ${t}.\n\n### Étape 1 : observer\n\nCommence par regarder comment les choses se font : exemples, situations réelles, travaux d'autres personnes. L'objectif est de repérer ce qui revient souvent.\n\n### Étape 2 : comprendre\n\nPour chaque élément observé, cherche la raison : pourquoi est-ce fait ainsi ? Tu relies ici la pratique aux principes vus dans le module précédent.\n\n### Étape 3 : essayer\n\nLance-toi sur un cas simple et limité. Le but n'est pas la perfection, mais de produire un premier résultat concret.\n\n### Étape 4 : ajuster\n\nCompare ton résultat à ce que tu as observé, identifie les écarts, corrige, puis recommence sur un cas un peu plus difficile. **Observer, comprendre, essayer, ajuster** : c'est ce cycle répété qui crée la compétence.`,
    `${intro} Connaître les erreurs classiques te fait gagner un temps considérable. Voici les plus fréquentes quand on apprend ${t}.\n\n### Erreur 1 : vouloir tout apprendre d'un coup\n\nC'est la cause numéro un d'abandon. La parade : avancer par petites étapes, une notion à la fois, et valider chaque étape avant de passer à la suivante.\n\n### Erreur 2 : rester dans la théorie\n\nLire sans pratiquer donne une illusion de maîtrise. La parade : après chaque leçon, faire au moins un petit exercice d'application.\n\n### Erreur 3 : ne pas vérifier ses acquis\n\nOn surestime presque toujours ce qu'on a retenu. La parade : se tester régulièrement, par exemple avec les quiz de cette formation, et revenir sur les points ratés.\n\n### Erreur 4 : se comparer aux experts\n\nComparer ses débuts au niveau d'un expert décourage. Compare-toi plutôt à toi-même d'il y a un mois : c'est la seule comparaison utile.`,
    `${intro} Pour relier tout ce qui précède, suivons une situation complète, de bout en bout.\n\n### La situation de départ\n\nImaginons une personne qui découvre ${t} et veut obtenir un premier résultat concret en quelques semaines. Elle dispose de peu de temps : environ trente minutes par jour.\n\n### Ce qu'elle fait\n\nElle délimite d'abord un objectif précis et mesurable. Elle consacre la première semaine au vocabulaire et aux principes, puis applique la méthode en quatre étapes sur un cas simple. Chaque fin de semaine, elle se teste et note ce qui reste flou.\n\n### Le résultat\n\nAu bout d'un mois, elle n'est pas experte, mais elle sait expliquer les bases, a produit plusieurs résultats concrets et sait exactement sur quoi travailler ensuite. **La régularité et la vérification des acquis ont fait la différence**, bien plus que la quantité d'informations lues.`,
    `${intro} Une fois les bases solides, certaines notions permettent de passer à un niveau supérieur en ${t}.\n\n### Penser en systèmes\n\nUn niveau confirmé ne voit plus des éléments isolés mais des ensembles qui interagissent. Face à un problème, il se demande quelles parties sont concernées et comment elles s'influencent.\n\n### Savoir arbitrer\n\nEn situation réelle, il y a rarement une seule bonne réponse. Progresser, c'est apprendre à peser les avantages et les inconvénients de plusieurs options selon le contexte.\n\n### Transmettre\n\nExpliquer ${t} à quelqu'un d'autre est l'un des meilleurs moyens de vérifier sa maîtrise : si tu peux l'expliquer simplement, tu l'as vraiment compris.`,
    `${intro} Apprendre sans plan, c'est avancer sans direction. Construisons ensemble ton plan d'action pour ${t}.\n\n### 1. Fixer un objectif précis\n\nUn bon objectif est concret, mesurable et daté. « Progresser » n'est pas un objectif ; « savoir réaliser telle tâche d'ici quatre semaines » en est un.\n\n### 2. Découper en étapes\n\nTransforme ton objectif en petites étapes hebdomadaires. Chaque étape doit pouvoir être validée clairement.\n\n### 3. Bloquer du temps\n\nLa régularité compte plus que la durée : vingt à trente minutes par jour valent mieux que trois heures une fois par semaine.\n\n### 4. Mesurer et ajuster\n\nChaque semaine, fais le point : qu'est-ce qui a marché, qu'est-ce qui bloque ? Ajuste ton plan en conséquence.`,
    `${intro} Maîtriser ${t} n'est pas une ligne d'arrivée, c'est une pratique qui s'entretient.\n\n### Pratiquer régulièrement\n\nLes compétences qu'on n'utilise pas s'érodent. Prévois des occasions régulières de mettre en œuvre ce que tu as appris, même brièvement.\n\n### Varier les situations\n\nAppliquer ${t} dans des contextes différents renforce ta compréhension et te prépare aux situations imprévues.\n\n### Garder une trace\n\nTiens un petit journal de progression : ce que tu as appris, ce que tu as réussi, ce qui reste à travailler. Relire ce journal est très motivant et t'aide à choisir tes prochaines étapes.`,
  ];

  const takeaways = [
    `Bien définir ${t} et son périmètre est la première étape d'un apprentissage efficace : cela évite la dispersion.`,
    "Pour chaque terme : le mot, sa définition avec tes propres mots, un exemple. Puis révise de façon espacée.",
    "Partir des bases, relier les notions entre elles et comprendre le contexte : trois principes pour comprendre plutôt que mémoriser.",
    "Observer, comprendre, essayer, ajuster : c'est la répétition de ce cycle qui crée la compétence.",
    "Avancer par petites étapes, pratiquer après chaque leçon, se tester régulièrement et se comparer à soi-même.",
    "Un objectif précis, une pratique régulière et la vérification des acquis comptent plus que la quantité d'informations.",
    "Penser en systèmes, savoir arbitrer et être capable de transmettre : les marqueurs d'un niveau confirmé.",
    "Un objectif concret et daté, découpé en étapes hebdomadaires, avec un point régulier pour ajuster.",
    "Pratiquer régulièrement, varier les situations et garder une trace de sa progression.",
  ];

  const examples = [
    `Une personne qui commence ${t} en notant d'abord « ce que je veux savoir faire dans un mois » progresse plus vite qu'une autre qui lit tout ce qu'elle trouve sans but précis.`,
    `Un apprenant crée un tableau de trois colonnes pour ${t} : après deux semaines, il maîtrise une trentaine de termes et comprend des explications qui lui semblaient obscures au départ.`,
    "Face à une difficulté sur une notion avancée, un apprenant revient au principe de base correspondant : le blocage disparaît en quelques minutes.",
    `Pour s'initier à ${t}, une personne observe trois exemples, en comprend la logique, réalise une première tentative simple, puis l'améliore deux fois en comparant avec les modèles.`,
    "Un apprenant qui voulait tout maîtriser en une semaine abandonne ; un autre qui avance d'une notion par jour termine le parcours et retient l'essentiel.",
    "Avec trente minutes par jour et un point chaque fin de semaine, une débutante obtient en un mois ses premiers résultats concrets.",
    "Face à deux options valables, une personne confirmée compare leurs effets selon la situation au lieu de chercher « la » bonne réponse universelle.",
    "Un apprenant remplace « progresser » par un objectif daté et découpé en quatre étapes : il sait chaque semaine exactement quoi faire.",
    "En relisant son journal de progression après deux mois, une apprenante mesure le chemin parcouru et choisit sa prochaine compétence à développer.",
  ];

  const exercises: (ChapterContent["exercise"])[] = [
    {
      prompt: `Écris en trois phrases : ce qu'est ${t} pour toi, à quoi cela te servira, et ce que tu veux savoir faire à la fin de cette formation.`,
      solution: "Une bonne réponse est concrète : elle cite un usage réel et un objectif mesurable (« savoir faire X d'ici un mois »). Si ta réponse reste vague, reformule-la jusqu'à pouvoir vérifier si l'objectif est atteint.",
    },
    {
      prompt: `Choisis cinq termes liés à ${t} et remplis pour chacun les trois colonnes : le mot, ta définition, un exemple.`,
      solution: "L'essentiel est la deuxième colonne : ta définition doit être écrite avec tes mots, sans recopier. Si tu n'y arrives pas pour un terme, c'est le signe qu'il faut le revoir avant d'aller plus loin.",
    },
    null,
    {
      prompt: `Applique les quatre étapes (observer, comprendre, essayer, ajuster) à un mini-cas lié à ${t}. Note ce que tu fais à chaque étape.`,
      solution: "Vérifie que chaque étape a bien produit quelque chose : des observations notées, une explication du « pourquoi », un premier résultat, puis au moins une correction. C'est l'étape « ajuster » qui est le plus souvent oubliée.",
    },
    {
      prompt: "Parmi les quatre erreurs présentées, laquelle te concerne le plus ? Écris une action concrète pour l'éviter cette semaine.",
      solution: "Une bonne action est précise et réalisable : par exemple « après chaque leçon, je fais un exercice de dix minutes » plutôt que « je vais pratiquer plus ».",
    },
    null,
    null,
    {
      prompt: `Rédige ton plan d'action pour ${t} : un objectif daté, quatre étapes hebdomadaires, et le moment de la journée où tu pratiqueras.`,
      solution: "Ton plan est bon s'il est vérifiable : chaque étape doit pouvoir être cochée. Fixe aussi un moment précis de point hebdomadaire pour ajuster.",
    },
    null,
  ];

  return {
    explanation: bodies[key % bodies.length],
    example: { isReal: false, description: examples[key % examples.length], sourceUrl: null, sourceTitle: null },
    keyTakeaway: takeaways[key % takeaways.length],
    exercise: exercises[key % exercises.length],
  };
}

export function offlineSummary(analysis: Analysis, chapters: GeneratedChapter[]): CourseSummary {
  const t = subjectOf(analysis);
  return {
    summary: `Tu as parcouru l'essentiel de **${t}** : les fondamentaux et le vocabulaire, une méthode concrète pour passer à la pratique, les erreurs à éviter, puis les notions qui permettent de progresser durablement.\n\nRetiens surtout que la maîtrise vient de la régularité : un objectif précis, une pratique quotidienne même courte, et la vérification régulière de tes acquis. Reviens sur les leçons dont les quiz t'ont posé difficulté, puis applique ton plan d'action dès cette semaine.`,
    keyPoints: chapters.slice(0, 6).map((c) => c.keyTakeaway),
  };
}

type QuizSeed = { q: string; choices: string[]; correct: number; why: string };

function toQuestions(seeds: QuizSeed[]): QuizQuestion[] {
  return seeds.map((s, i) => ({
    position: i,
    chapterIndex: null,
    question: s.q,
    choices: s.choices,
    correctChoiceIndex: s.correct,
    correctChoiceIndexes: null,
    questionType: s.choices.length === 2 ? "true_false" : "single_choice",
    explanation: s.why,
  })) as QuizQuestion[];
}

const MODULE_QUIZZES: QuizSeed[][] = [
  [
    { q: "Quelle est la première étape d'un apprentissage efficace selon ce module ?", choices: ["Lire un maximum de contenus", "Définir le sujet et son périmètre", "Se comparer aux experts", "Commencer par les notions avancées"], correct: 1, why: "Bien définir le sujet et son périmètre évite la dispersion et la surcharge d'informations." },
    { q: "Dans la méthode des trois colonnes, que contient la deuxième colonne ?", choices: ["Un exemple concret", "Le mot lui-même", "La définition avec tes propres mots", "Une date de révision"], correct: 2, why: "La deuxième colonne est la définition reformulée avec tes mots : c'est elle qui prouve la compréhension." },
    { q: "Une difficulté sur une notion avancée vient souvent d'une base mal comprise.", choices: ["Vrai", "Faux"], correct: 0, why: "Principe 1 : les notions avancées s'appuient sur les fondamentaux ; c'est là qu'il faut revenir." },
  ],
  [
    { q: "Quel est l'ordre de la méthode en quatre étapes ?", choices: ["Essayer, observer, ajuster, comprendre", "Observer, comprendre, essayer, ajuster", "Comprendre, essayer, observer, ajuster", "Observer, essayer, comprendre, ajuster"], correct: 1, why: "Observer, comprendre, essayer, ajuster : c'est la répétition de ce cycle qui crée la compétence." },
    { q: "Quelle est la parade à l'erreur « vouloir tout apprendre d'un coup » ?", choices: ["Lire plus vite", "Avancer par petites étapes, une notion à la fois", "Sauter les bases", "Éviter les quiz"], correct: 1, why: "Avancer par petites étapes et valider chacune avant la suivante évite l'abandon." },
    { q: "Dans l'étude de cas, ce qui a fait la différence est la quantité d'informations lues.", choices: ["Vrai", "Faux"], correct: 1, why: "C'est la régularité et la vérification des acquis qui ont fait la différence, pas la quantité lue." },
  ],
  [
    { q: "Lequel de ces objectifs est le mieux formulé ?", choices: ["Progresser", "Devenir bon un jour", "Savoir réaliser une tâche précise d'ici quatre semaines", "Tout savoir sur le sujet"], correct: 2, why: "Un bon objectif est concret, mesurable et daté." },
    { q: "Qu'est-ce qui compte le plus pour progresser selon ce module ?", choices: ["La régularité de la pratique", "De longues séances rares", "La comparaison aux experts", "L'apprentissage par cœur"], correct: 0, why: "Vingt à trente minutes par jour valent mieux que trois heures une fois par semaine." },
    { q: "Expliquer le sujet à quelqu'un d'autre est un bon moyen de vérifier sa maîtrise.", choices: ["Vrai", "Faux"], correct: 0, why: "Si tu peux l'expliquer simplement, tu l'as vraiment compris." },
  ],
];

export function offlineModuleQuiz(moduleIndex: number): QuizQuestion[] {
  return toQuestions(MODULE_QUIZZES[moduleIndex % MODULE_QUIZZES.length]);
}

export function offlineFinalQuiz(): QuizQuestion[] {
  return toQuestions([
    { q: "Pourquoi reformuler une définition avec ses propres mots ?", choices: ["Pour aller plus vite", "Pour prouver qu'on a compris et pas seulement lu", "Pour éviter de réviser", "Ce n'est pas utile"], correct: 1, why: "Reformuler avec ses mots est l'étape qui prouve la compréhension." },
    { q: "Que faire face à une notion avancée qui bloque ?", choices: ["Abandonner la notion", "Revenir au principe de base correspondant", "Apprendre par cœur", "Passer au module suivant"], correct: 1, why: "Les difficultés avancées viennent souvent d'une base mal comprise." },
    { q: "Quelle étape de la méthode est le plus souvent oubliée ?", choices: ["Observer", "Comprendre", "Essayer", "Ajuster"], correct: 3, why: "L'ajustement (comparer, corriger, recommencer) est l'étape la plus souvent oubliée." },
    { q: "Lire sans pratiquer donne une illusion de maîtrise.", choices: ["Vrai", "Faux"], correct: 0, why: "Il faut au moins un petit exercice d'application après chaque leçon." },
    { q: "À qui est-il le plus utile de se comparer ?", choices: ["Aux experts", "À ses amis", "À soi-même d'il y a un mois", "À personne"], correct: 2, why: "Se comparer à soi-même est la seule comparaison utile et motivante." },
    { q: "Qu'est-ce qui distingue un niveau confirmé ?", choices: ["Connaître plus de termes", "Penser en systèmes et savoir arbitrer", "Aller plus vite", "Ne jamais faire d'erreur"], correct: 1, why: "Un niveau confirmé voit des ensembles qui interagissent et sait peser plusieurs options." },
    { q: "Un bon plan d'action doit pouvoir être vérifié étape par étape.", choices: ["Vrai", "Faux"], correct: 0, why: "Chaque étape doit pouvoir être cochée, avec un point hebdomadaire pour ajuster." },
    { q: "Pourquoi tenir un journal de progression ?", choices: ["Pour mesurer le chemin parcouru et choisir ses prochaines étapes", "Pour remplacer la pratique", "Pour éviter les quiz", "Ce n'est pas recommandé"], correct: 0, why: "Le journal motive et aide à choisir les prochaines compétences à travailler." },
  ]);
}
