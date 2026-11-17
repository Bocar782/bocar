// Vrai test : importe le vrai proxy() de src/proxy.ts et un vrai
// NextRequest, et vérifie l'argument exact transmis au vrai
// createServerClient de @supabase/ssr (mocké uniquement à cette frontière
// externe) — notamment `cookieOptions` (Prompt 05.16.4).
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn(async () => ({ data: { user: null } }));
const mockCreateServerClient = vi.fn();
mockCreateServerClient.mockReturnValue({ auth: { getUser: mockGetUser } });
vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  mockCreateServerClient.mockClear();
});

function stubRequiredSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key-test");
}

describe("proxy (src/proxy.ts)", () => {
  it("transmet cookieOptions.secure=false à createServerClient en dehors de la production", async () => {
    stubRequiredSupabaseEnv();
    vi.stubEnv("NODE_ENV", "development");

    const { proxy } = await import("@/proxy");
    await proxy(new NextRequest("http://localhost:3000/dashboard"));

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
    const [, , options] = mockCreateServerClient.mock.calls[0] as [string, string, { cookieOptions: { secure: boolean } }];
    expect(options.cookieOptions).toEqual({ secure: false });
  });

  it("transmet cookieOptions.secure=true à createServerClient en production", async () => {
    stubRequiredSupabaseEnv();
    vi.stubEnv("NODE_ENV", "production");

    const { proxy } = await import("@/proxy");
    await proxy(new NextRequest("http://localhost:3000/dashboard"));

    const [, , options] = mockCreateServerClient.mock.calls[0] as [string, string, { cookieOptions: { secure: boolean } }];
    expect(options.cookieOptions).toEqual({ secure: true });
  });
});
