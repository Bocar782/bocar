// Vrai test : importe la vraie fonction getSupabaseCookieOptions().
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

describe("getSupabaseCookieOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("secure=false en dehors de la production (dev local en HTTP)", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getSupabaseCookieOptions()).toEqual({ secure: false });
  });

  it("secure=true en production (NODE_ENV=production, build/déploiement réel)", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(getSupabaseCookieOptions()).toEqual({ secure: true });
  });

  it("secure=false sous test (NODE_ENV=test, valeur par défaut de Vitest)", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(getSupabaseCookieOptions()).toEqual({ secure: false });
  });

  it("ne fixe ni sameSite ni httpOnly : seuls les défauts de @supabase/ssr s'appliquent pour ces deux attributs", () => {
    const options = getSupabaseCookieOptions();

    expect(options).not.toHaveProperty("sameSite");
    expect(options).not.toHaveProperty("httpOnly");
  });
});
