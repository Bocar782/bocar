import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h3 className="mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h3 className="mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-4 mb-2 text-base font-semibold text-foreground">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed text-foreground-muted last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-5 list-disc space-y-1.5 text-foreground-muted">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-5 list-decimal space-y-1.5 text-foreground-muted">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-violet-light underline underline-offset-2 hover:text-accent-blue-light"
          >
            {children}
          </a>
        ),
        // Tableaux (remark-gfm) : enveloppe scrollable horizontalement
        // (`overflow-x-auto`) pour rester lisible sur mobile sans jamais
        // casser la mise en page, plutôt que de forcer une largeur ou de
        // tronquer le contenu.
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-white/[0.04] text-foreground">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-border-subtle">{children}</tbody>
        ),
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 align-top leading-relaxed text-foreground-muted">
            {children}
          </td>
        ),
        // Bloc de code (```...```) : react-markdown rend toujours un `code`
        // à l'intérieur d'un `pre` pour un bloc, jamais pour du code inline.
        // `code` ci-dessous porte toujours le même style "pastille" (pour le
        // cas inline, le seul où il apparaît sans `pre`) ; les sélecteurs
        // `[&_code]:...` neutralisent cette pastille UNIQUEMENT pour le
        // `code` imbriqué ici, pour ne jamais doubler fond/marge à
        // l'intérieur du bloc déjà stylé par `pre` lui-même.
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-xl border border-border-subtle bg-black/30 p-4 text-sm leading-relaxed text-foreground [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-foreground">
            {children}
          </pre>
        ),
        // Code inline (`...`) : stylé en "pastille" — neutralisé ci-dessus
        // quand ce même composant est rendu à l'intérieur d'un bloc `pre`.
        code: ({ children, className }) => (
          <code className={`rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.85em] text-accent-blue-light ${className ?? ""}`}>
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
