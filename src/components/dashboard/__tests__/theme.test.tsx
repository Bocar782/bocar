// @vitest-environment jsdom
//
// Vrai test (Prompt 06.7) : rend le VRAI DashboardShell et le VRAI
// ThemeToggle dans un DOM jsdom, et vérifie que l'attribut data-theme
// posé par DashboardShell (seul point d'application du thème clair/sombre,
// voir globals.css) suit réellement la préférence stockée en
// localStorage, et que ThemeToggle la change immédiatement sans
// rechargement de page.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { THEME_STORAGE_KEY } from "@/components/dashboard/theme-context";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderShell() {
  return act(async () => {
    root.render(
      <DashboardShell userEmail="demo@tavyra.app" isPro={false} onSignOut={() => {}}>
        <ThemeToggle />
      </DashboardShell>,
    );
  });
}

function shellRoot(): HTMLElement {
  return container.querySelector("[data-theme]") as HTMLElement;
}

describe("Thème clair/sombre de l'intérieur de l'app (Prompt 06.7)", () => {
  it("applique data-theme=\"dark\" par défaut, sans préférence enregistrée", async () => {
    await renderShell();
    expect(shellRoot().dataset.theme).toBe("dark");
  });

  it("applique data-theme=\"light\" si la préférence est déjà enregistrée en localStorage", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    await renderShell();
    expect(shellRoot().dataset.theme).toBe("light");
  });

  it("basculer sur « Clair » dans ThemeToggle met à jour data-theme ET localStorage immédiatement", async () => {
    await renderShell();
    expect(shellRoot().dataset.theme).toBe("dark");

    const clairButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Blanc",
    ) as HTMLButtonElement;
    expect(clairButton).not.toBeUndefined();

    await act(async () => {
      clairButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(shellRoot().dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("revenir sur « Sombre » restaure data-theme=\"dark\"", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    await renderShell();
    expect(shellRoot().dataset.theme).toBe("light");

    const sombreButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Violet",
    ) as HTMLButtonElement;

    await act(async () => {
      sombreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(shellRoot().dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
