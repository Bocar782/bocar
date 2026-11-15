"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne le SaaS ?",
    answer:
      "Tu décris ce que tu veux apprendre, en une phrase. Lia analyse ta demande, construit un programme adapté à ton niveau, puis rédige une formation complète : introduction, chapitres progressifs, exemples concrets et quiz final.",
  },
  {
    question: "Comment les formations sont-elles générées ?",
    answer:
      "Un modèle d'IA (Claude, d'Anthropic) structure le programme puis rédige chaque chapitre. Quand c'est pertinent, il effectue des recherches web pour appuyer les exemples sur des cas réels et vérifiables plutôt que des généralités.",
  },
  {
    question: "Quels sujets puis-je apprendre ?",
    answer:
      "Pratiquement n'importe quel sujet : business, finance, marketing, sciences, histoire, préparation d'examens... Décris ton besoin, Lia adapte la structure de la formation au domaine.",
  },
  {
    question: "Lia peut-elle comprendre ma formation ?",
    answer:
      "Oui : pendant que tu lis, tu peux poser des questions à Lia directement sur le chapitre en cours. Elle connaît le contenu exact de ta formation et répond dans ce contexte.",
  },
  {
    question: "Comment fonctionnent les quiz ?",
    answer:
      "Chaque formation se termine par un quiz à choix multiples généré à partir du contenu réel de la formation uniquement. Tu obtiens un score, une explication pour chaque réponse, et tu peux revoir tes erreurs ou refaire le quiz.",
  },
  {
    question: "Les formations utilisent-elles des sources ?",
    answer:
      "Quand le sujet s'y prête, Lia recherche de vrais exemples (entreprises, événements, données) sur le web et cite sa source. Si un fait n'est pas vérifié, l'exemple est clairement présenté comme illustratif plutôt que réel.",
  },
  {
    question: "Puis-je annuler mon abonnement ?",
    answer:
      "Oui, à tout moment, depuis le bouton « Gérer mon abonnement » du tableau de bord, qui ouvre le portail de gestion sécurisé de notre prestataire de paiement (Stripe).",
  },
  {
    question: "Puis-je utiliser le SaaS sur téléphone ?",
    answer:
      "Oui, l'interface est entièrement responsive : génération, lecture des formations, chat et quiz fonctionnent aussi bien sur mobile, tablette que sur ordinateur.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-2xl border border-border-subtle bg-white/[0.02]"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-foreground">{item.question}</span>
              <span
                className={`shrink-0 text-accent-violet-light transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-foreground-muted">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
