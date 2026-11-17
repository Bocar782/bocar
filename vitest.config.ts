import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// Config minimale : seul "@/*" (voir tsconfig.json) doit être résolu pour
// que les tests puissent importer les vrais modules du projet avec les
// mêmes chemins que le code applicatif.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Voir vitest.server-only-stub.ts : ce garde-fou n'a de sens que
      // dans le bundler Next.js, jamais en test Node.
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    // Prompt 05.18 : exclut la suite Playwright (e2e/*.spec.ts), qui n'est
    // exécutable que par `playwright test` (son propre test runner, fixture
    // `page`/`test` incompatible avec celle de Vitest), jamais par Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
