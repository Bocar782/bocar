const PLACEHOLDER_TESTIMONIALS = [
  {
    quote:
      "J'ai enfin compris les bases de l'investissement, avec des exemples concrets plutôt que des définitions abstraites.",
    name: "Exemple d'avis",
    role: "Avis fictif — à venir après le lancement",
  },
  {
    quote:
      "Le quiz à la fin m'a vraiment permis de vérifier ce que j'avais retenu, chapitre par chapitre.",
    name: "Exemple d'avis",
    role: "Avis fictif — à venir après le lancement",
  },
  {
    quote:
      "Pouvoir demander des précisions à Tavyra pendant la lecture change tout par rapport à un simple article.",
    name: "Exemple d'avis",
    role: "Avis fictif — à venir après le lancement",
  },
];

export function Testimonials() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-center">
        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300">
          Avis fictifs à titre d&apos;exemple — les vrais avis arriveront après le lancement
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {PLACEHOLDER_TESTIMONIALS.map((testimonial, i) => (
          <figure
            key={i}
            className="flex flex-col rounded-2xl border border-border-subtle bg-white/[0.02] p-6"
          >
            <span aria-hidden className="text-2xl text-accent-violet/50">
              &ldquo;
            </span>
            <blockquote className="mt-1 flex-1 text-sm leading-relaxed text-foreground">
              {testimonial.quote}
            </blockquote>
            <figcaption className="mt-4 border-t border-border-subtle pt-4">
              <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
              <p className="mt-0.5 text-xs text-amber-300/80">{testimonial.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
