// @vitest-environment jsdom
//
// Vrai test (Prompt 05.11, LOT C) : importe et rend le VRAI composant
// ExerciseBlock dans un DOM jsdom, puis simule un vrai clic sur le bouton
// pour vérifier que la correction est bien masquée par défaut et se
// révèle/se masque à l'interaction — pas une reproduction de la logique.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExerciseBlock } from "@/components/exercise-block";

// Requis par React en dehors de @testing-library/react (qui le ferait pour
// nous) : indique explicitement à React que les mises à jour déclenchées
// dans ce fichier sont bien enveloppées dans `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function clickRevealButton() {
  const button = container.querySelector("button");
  if (!button) throw new Error("Bouton de révélation introuvable");
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ExerciseBlock (vrai code, DOM réel)", () => {
  const exercise = {
    prompt: "Calcule le prix TTC d'un produit à 100€ HT avec 20% de TVA.",
    solution: "100 × 1.2 = 120€ TTC, car la TVA s'ajoute au prix HT.",
  };

  it("masque la correction par défaut et affiche la consigne", () => {
    act(() => {
      root.render(<ExerciseBlock exercise={exercise} />);
    });

    expect(container.textContent).toContain("Calcule le prix TTC");
    expect(container.textContent).not.toContain("120€ TTC");
    expect(container.textContent).toContain("Voir la correction");

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  it("révèle la correction après un clic, puis la masque à nouveau après un second clic", () => {
    act(() => {
      root.render(<ExerciseBlock exercise={exercise} />);
    });

    clickRevealButton();
    expect(container.textContent).toContain("120€ TTC");
    expect(container.textContent).toContain("Masquer la correction");
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");

    clickRevealButton();
    expect(container.textContent).not.toContain("120€ TTC");
    expect(container.textContent).toContain("Voir la correction");
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
  });
});
