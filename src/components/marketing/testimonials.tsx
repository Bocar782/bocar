import Image from "next/image";

// Prompt 06.11 : vrais avis d'utilisateurs de Tavyra, fournis directement
// par l'équipe avec leur texte et leur photo réelle — jamais un
// témoignage inventé (voir Prompt 05.22, où les témoignages fictifs
// précédents avaient été retirés pour cette même raison). Le texte a
// seulement été corrigé pour l'orthographe/la ponctuation, jamais
// reformulé sur le fond.
//
// Prompt 06.12 : `rating` est une appréciation éditoriale de la pertinence
// de chaque avis (5 par défaut, 4 pour un avis qui reste positif mais
// nuance avec une réserve concrète — ex. Evan ci-dessous) — jamais une
// note transmise par la personne elle-même, qui ne nous en a donné aucune.
export const TESTIMONIALS = [
  {
    name: "Camille",
    photo: "/testimonials/camille.jpg",
    rating: 5,
    quote:
      "J'utilise Tavyra pour développer mes connaissances en marketing digital. Les formations sont rapides à générer, bien présentées et surtout faciles à comprendre.",
  },
  {
    name: "Maelys",
    photo: "/testimonials/maelys.jpg",
    rating: 5,
    quote:
      "10/10, j'utilise l'app à chaque nouvelle idée de business qui me passe par la tête, et pour le tarif ça en vaut la peine. Je recommande ☺️",
  },
  {
    name: "Fatou",
    photo: "/testimonials/fatou.jpg",
    rating: 5,
    quote:
      "Je fais des petites fiches de révision avec les formations générées, et c'est la chose la plus rentable que j'ai pu faire jusqu'à maintenant.",
  },
  {
    name: "Ibrahim",
    photo: "/testimonials/ibrahim.jpg",
    rating: 5,
    quote:
      "J'étais débutant dans l'immobilier, je voyais énormément d'informations sur internet, jusqu'à ce que mes formateurs me recommandent cette application. En quelques cours, elle m'en a plus appris qu'en plusieurs années d'études.",
  },
  {
    name: "Evan",
    photo: "/testimonials/evan.jpg",
    rating: 4,
    quote:
      "J'ai une marque e-commerce, je faisais du 1k/jour mais je régressais, je n'avais pas de stratégie. J'ai retravaillé ça avec Tavyra et revu mes stratégies : aujourd'hui je suis sur la ligne des 3k 💪 J'aimerais juste qu'il y ait un palier d'abonnement au-dessus pour les utilisateurs réguliers.",
  },
  {
    name: "Chloé",
    photo: "/testimonials/chloe.jpg",
    rating: 5,
    quote:
      "Je suis à la fac, j'étudie le droit constitutionnel. Avant, j'échouais à mes QCM et mes partiels. Depuis que j'utilise l'app au quotidien, franchement je recommande pour ceux qui ont du mal dans une matière précise.",
  },
  {
    name: "Arnauld",
    photo: "/testimonials/arnauld.jpg",
    rating: 5,
    quote:
      "Je suis prof de philo, j'ai connu cette app par mes élèves. Elle m'est très utile : je base mes évaluations sur les questions-réponses du quiz, essentielles pour suivre la progression de l'apprentissage. Je recommande fortement.",
  },
  {
    name: "Mathis",
    photo: "/testimonials/mathis.jpg",
    rating: 5,
    quote:
      "J'ai 16 ans, j'ai lancé plusieurs business et acheté énormément de formations — une grosse erreur. J'aurais aimé découvrir cette app avant : elle m'a fait plus apprendre que ces formations, et m'a fait gagner du temps et de l'argent. Je suis actuellement à 600€ la semaine grâce à elle, merci infiniment 👌🏼",
  },
  {
    name: "Mehdi",
    photo: "/testimonials/mehdi.jpg",
    rating: 5,
    quote:
      "Cette app m'a énormément servi pour mon fils, qui avait du mal à l'école : elle lui génère directement un cours qui donne envie d'être lu. Le plus satisfaisant, c'est le quiz à la fin — on est partis de 4/10 pour arriver autour de 8-9/10 après quelques utilisations au quotidien. Un gain de temps pour moi, et un vrai boost pour mon fils.",
  },
] as const;

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <path
        d="M10 1.5l2.47 5.39 5.93.6-4.47 4.04 1.27 5.84L10 14.6l-5.2 2.77 1.27-5.84L1.6 7.49l5.93-.6L10 1.5z"
        fill={filled ? "var(--accent-violet-light)" : "none"}
        stroke="var(--accent-violet-light)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} filled={i < rating} />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <figure
          key={t.name}
          className="glass-card lift relative flex flex-col overflow-hidden rounded-2xl p-6"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute right-5 top-2 font-display text-6xl leading-none text-accent-violet/25"
          >
            &rdquo;
          </span>
          <StarRating rating={t.rating} />
          <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">
            {t.quote}
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3 border-t border-border-subtle pt-4">
            <Image
              src={t.photo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-accent-violet/40"
            />
            <span className="block text-sm font-semibold text-foreground">{t.name}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
