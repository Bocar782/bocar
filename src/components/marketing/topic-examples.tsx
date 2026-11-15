import {
  IconAtom,
  IconCart,
  IconChartLine,
  IconGraduationCap,
  IconLandmark,
  IconMegaphone,
  IconRocket,
} from "./icons";

const TOPICS = [
  { Icon: IconRocket, domain: "Business", title: "Créer son entreprise" },
  { Icon: IconCart, domain: "E-commerce", title: "Créer une boutique en ligne" },
  { Icon: IconChartLine, domain: "Finance", title: "Comprendre les marchés financiers" },
  { Icon: IconMegaphone, domain: "Marketing", title: "Maîtriser la publicité en ligne" },
  { Icon: IconLandmark, domain: "Histoire", title: "Comprendre la Révolution française" },
  { Icon: IconAtom, domain: "Sciences", title: "Comprendre la physique" },
  { Icon: IconGraduationCap, domain: "Études", title: "Préparer un examen" },
];

export function TopicExamples() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOPICS.map((topic) => (
        <div
          key={topic.title}
          className="group rounded-2xl border border-border-subtle bg-white/[0.02] p-5 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
            <topic.Icon width={20} height={20} />
          </span>
          <span className="mt-4 block text-xs font-medium uppercase tracking-wide text-accent-violet-light">
            {topic.domain}
          </span>
          <p className="mt-1 text-base font-medium text-foreground">{topic.title}</p>
        </div>
      ))}
    </div>
  );
}
