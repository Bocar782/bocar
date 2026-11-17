// Vrai test : importe le vrai createClient() de server.ts, et vérifie
// l'argument exact transmis au vrai createServerClient de @supabase/ssr
// (mocké uniquement à cette frontière externe) — notamment `cookieOptions`,
// pour prouver que l'attribut `Secure` (Prompt 05.16.4) est réellement
// propagé jusqu'à la librairie Supabase, pas seulement défini isolément.
import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreateServerClient = vi.fn();
mockCreateServerClient.mockReturnValue({ fake: "client" });
vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

const mockCookieStore = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: async () => mockCookieStore,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  mockCreateServerClient.mockClear();
});

function stubRequiredSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-test");
}

describe("createClient (src/lib/supabase/server.ts)", () => {
  it("transmet cookieOptions.secure=false à createServerClient en dehors de la production", async () => {
    stubRequiredSupabaseEnv();
    vi.stubEnv("NODE_ENV", "development");

    const { createClient } = await import("@/lib/supabase/server");
    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
    const [, , options] = mockCreateServerClient.mock.calls[0] as [string, string, { cookieOptions: { secure: boolean } }];
    expect(options.cookieOptions).toEqual({ secure: false });
  });

  it("transmet cookieOptions.secure=true à createServerClient en production", async () => {
    stubRequiredSupabaseEnv();
    vi.stubEnv("NODE_ENV", "production");

    const { createClient } = await import("@/lib/supabase/server");
    await createClient();

    const [, , options] = mockCreateServerClient.mock.calls[0] as [string, string, { cookieOptions: { secure: boolean } }];
    expect(options.cookieOptions).toEqual({ secure: true });
  });
});
