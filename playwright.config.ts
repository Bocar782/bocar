import { defineConfig, devices } from "@playwright/test";

// Prompt 05.18 : suite E2E réelle (vrai navigateur, vrai serveur `next dev`)
// pour les parcours qui ne nécessitent PAS de session Supabase authentifiée
// réelle. Voir e2e/README.md pour la limitation d'environnement qui motive
// ce périmètre (le projet Supabase réel de .env.local n'est pas joignable
// depuis ce bac à sable — démontré empiriquement, pas une simple prudence).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    // La version de @playwright/test installée dans ce projet (1.65.1)
    // attend une révision de Chromium différente de celle préinstallée
    // dans ce bac à sable (chromium-1243) : on force explicitement ce
    // binaire plutôt que le "headless shell" que Playwright chercherait
    // par défaut (absent ici).
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
