import Image from "next/image";

// Prompt 06.11 : vrais avis d'utilisateurs de Tavyra, fournis directement
// par l'équipe avec leur texte et leur photo réelle — jamais un
// témoignage inventé (voir Prompt 05.22, où les témoignages fictifs
// précédents avaient été retirés pour cette même raison). Le texte a
// seulement été corrigé pour l'orthographe/la ponctuation, jamais
// reformulé sur le fond.
const TESTIMONIALS = [
  {
    name: "Camille",
    photo: "/testimonials/camille.jpg",
    quote:
      "J'utilise Tavyra pour développer mes connaissances en marketing digital. Les formations sont rapides à générer, bien présentées et surtout faciles à comprendre.",
  },
  {
    name: "Maelys",
    photo: "/testimonials/maelys.jpg",
    quote:
      "10/10, j'utilise l'app à chaque nouvelle idée de business qui me passe par la tête, et pour le tarif ça en vaut la peine. Je recommande ☺️",
  },
  {
    name: "Fatou",
    photo: "/testimonials/fatou.jpg",
    quote:
      "Je fais des petites fiches de révision avec les formations générées, et c'est la chose la plus rentable que j'ai pu faire jusqu'à maintenant.",
  },
  {
    name: "Ibrahim",
    photo: "/testimonials/ibrahim.jpg",
    quote:
      "J'étais débutant dans l'immobilier, je voyais énormément d'informations sur internet, jusqu'à ce que mes formateurs me recommandent cette application. En quelques cours, elle m'en a plus appris qu'en plusieurs années d'études.",
  },
  {
    name: "Evan",
    photo: "/testimonials/evan.jpg",
    quote:
      "J'ai une marque e-commerce, je faisais du 1k/jour mais je régressais, je n'avais pas de stratégie. J'ai retravaillé ça avec Tavyra et revu mes stratégies : aujourd'hui je suis sur la ligne des 3k 💪 J'aimerais juste qu'il y ait un palier d'abonnement au-dessus pour les utilisateurs réguliers.",
  },
  {
    name: "Chloé",
    photo: "/testimonials/chloe.jpg",
    quote:
      "Je suis à la fac, j'étudie le droit constitutionnel. Avant, j'échouais à mes QCM et mes partiels. Depuis que j'utilise l'app au quotidien, franchement je recommande pour ceux qui ont du mal dans une matière précise.",
  },
  {
    name: "Arnauld",
    photo: "/testimonials/arnauld.jpg",
    quote:
      "Je suis prof de philo, j'ai connu cette app par mes élèves. Elle m'est très utile : je base mes évaluations sur les questions-réponses du quiz, essentielles pour suivre la progression de l'apprentissage. Je recommande fortement.",
  },
  {
    name: "Mathis",
    photo: "/testimonials/mathis.jpg",
    quote:
      "J'ai 16 ans, j'ai lancé plusieurs business et acheté énormément de formations — une grosse erreur. J'aurais aimé découvrir cette app avant : elle m'a fait plus apprendre que ces formations, et m'a fait gagner du temps et de l'argent. Je suis actuellement à 600€ la semaine grâce à elle, merci infiniment 👌🏼",
  },
  {
    name: "Mehdi",
    photo: "/testimonials/mehdi.jpg",
    quote:
      "Cette app m'a énormément servi pour mon fils, qui avait du mal à l'école : elle lui génère directement un cours qui donne envie d'être lu. Le plus satisfaisant, c'est le quiz à la fin — on est partis de 4/10 pour arriver autour de 8-9/10 après quelques utilisations au quotidien. Un gain de temps pour moi, et un vrai boost pour mon fils.",
  },
] as const;

export function Testimonials() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <figure
          key={t.name}
          className="flex flex-col rounded-2xl border border-border-subtle bg-background-card p-6"
        >
          <blockquote className="flex-1 text-sm leading-relaxed text-foreground-muted">
            « {t.quote} »
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            <Image
              src={t.photo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
            <span className="text-sm font-semibold text-foreground">{t.name}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
