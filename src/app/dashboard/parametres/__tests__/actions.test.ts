// Vrais tests (même esprit que auth/callback/route.test.ts) : importent et
// exécutent les VRAIES actions serveur de /dashboard/parametres. Seule la
// frontière externe (client Supabase) est mockée, et uniquement pour les
// tests qui l'atteignent réellement (les validations échouent avant).
import { describe, expect, it, vi } from "vitest";
import { updateEmail, updateSettingsPassword, updateUsername } from "../actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

describe("updateUsername", () => {
  it("refuse un nom d'utilisateur vide", async () => {
    const result = await updateUsername(undefined, formData({ username: "   " }));
    expect(result).toEqual({ error: "Le nom d'utilisateur ne peut pas être vide." });
  });

  it("refuse un nom d'utilisateur trop long", async () => {
    const result = await updateUsername(undefined, formData({ username: "a".repeat(41) }));
    expect(result?.error).toMatch(/ne peut pas dépasser/);
  });

  it("appelle updateUser avec le nom d'utilisateur fourni et renvoie un succès", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: {
          getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
          updateUser,
        },
      }),
    }));
    vi.resetModules();
    const { updateUsername: fn } = await import("../actions");

    const result = await fn(undefined, formData({ username: "Bocar" }));

    expect(updateUser).toHaveBeenCalledWith({ data: { username: "Bocar" } });
    expect(result).toEqual({ success: "Nom d'utilisateur mis à jour." });

    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });
});

describe("updateEmail", () => {
  it("refuse une adresse invalide", async () => {
    const result = await updateEmail(undefined, formData({ email: "pas-un-email" }));
    expect(result).toEqual({ error: "Adresse email invalide." });
  });

  it("refuse de « changer » vers l'adresse déjà active", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: "user-1", email: "actuel@exemple.com" } },
          })),
          updateUser: vi.fn(),
        },
      }),
    }));
    vi.resetModules();
    const { updateEmail: fn } = await import("../actions");

    const result = await fn(undefined, formData({ email: "actuel@exemple.com" }));
    expect(result).toEqual({ error: "C'est déjà ton adresse actuelle." });

    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });

  it("appelle updateUser({ email }) et prévient qu'une confirmation est nécessaire", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: "user-1", email: "actuel@exemple.com" } },
          })),
          updateUser,
        },
      }),
    }));
    vi.resetModules();
    const { updateEmail: fn } = await import("../actions");

    const result = await fn(undefined, formData({ email: "nouveau@exemple.com" }));

    expect(updateUser).toHaveBeenCalledWith({ email: "nouveau@exemple.com" });
    expect(result?.success).toMatch(/nouveau@exemple\.com/);
    expect(result?.success).toMatch(/confirmation/);

    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });
});

describe("updateSettingsPassword", () => {
  it("refuse un mot de passe trop court", async () => {
    const result = await updateSettingsPassword(
      undefined,
      formData({ password: "court", confirmPassword: "court" }),
    );
    expect(result).toEqual({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  });

  it("refuse si la confirmation ne correspond pas", async () => {
    const result = await updateSettingsPassword(
      undefined,
      formData({ password: "longenough1", confirmPassword: "different1" }),
    );
    expect(result).toEqual({ error: "Les mots de passe ne correspondent pas." });
  });
});
