// Vrai test (Prompt 05.11, LOT A) : importe et rend le VRAI composant
// MarkdownContent (react-dom/server, aucun DOM nécessaire) — pas une
// reproduction de sa logique. Vérifie le rendu des tableaux GFM et des
// blocs de code (nouveaux), et que l'ancien contenu (titres, paragraphes,
// listes, gras, liens) continue de s'afficher avec les mêmes classes
// qu'avant cette évolution.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "@/components/markdown-content";

function render(content: string): string {
  return renderToStaticMarkup(<MarkdownContent content={content} />);
}

describe("MarkdownContent (vrai code) — nouveautés LOT A", () => {
  it("rend un tableau GFM comme un vrai <table> stylé", () => {
    const html = render("| Option | Coût |\n| --- | --- |\n| A | 10€ |\n| B | 20€ |");

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("Option");
    expect(html).toContain("10€");
    // Sans remark-gfm, ce même texte ne produirait aucune balise <table> —
    // la présence de <table> prouve que le plugin est bien actif.
  });

  it("rend un bloc de code avec un conteneur <pre> stylé et sans pastille interne dupliquée", () => {
    const html = render("```js\nconst x = 1;\n```");

    expect(html).toContain("<pre");
    expect(html).toContain("const x = 1;");
    // Le <code> à l'intérieur du <pre> ne doit PAS recevoir le fond "pastille"
    // réservé au code inline (sinon double fond visuel) : la classe neutralisante
    // posée sur <pre> (sélecteur descendant, "&" échappé en "&amp;" dans le
    // HTML statique rendu) doit être présente.
    expect(html).toContain("_code]:bg-transparent");
  });

  it("rend le code inline avec sa pastille distincte", () => {
    const html = render("Utilise la fonction `maFonction()` ici.");

    expect(html).toContain("<code");
    expect(html).toContain("maFonction()");
    expect(html).toContain("bg-white/[0.08]");
    // Pas de <pre> pour du code inline isolé dans un paragraphe.
    expect(html).not.toContain("<pre");
  });
});

describe("MarkdownContent (vrai code) — compatibilité de l'ancien contenu", () => {
  it("rend toujours les titres, paragraphes, listes, gras et liens avec les mêmes classes qu'avant", () => {
    const html = render(
      "## Titre\n\nUn paragraphe avec du **gras** et un [lien](https://example.com).\n\n- un point\n- un autre point",
    );

    expect(html).toContain('class="mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0"');
    expect(html).toContain('class="mb-4 leading-relaxed text-foreground-muted last:mb-0"');
    expect(html).toContain('class="font-semibold text-foreground"');
    expect(html).toContain('class="mb-4 ml-5 list-disc space-y-1.5 text-foreground-muted"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Titre");
    expect(html).toContain("gras");
    expect(html).toContain("un point");
  });

  it("ne rend aucun <table> pour un contenu ancien qui n'en contient pas (pas de faux positif du plugin)", () => {
    const html = render("Un texte tout simple, sans tableau ni code.");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<pre");
  });
});
