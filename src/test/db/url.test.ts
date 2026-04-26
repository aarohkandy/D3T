import { describe, expect, it } from "vitest";

import { normalizeDatabaseUrl } from "../../lib/db/url.ts";

describe("normalizeDatabaseUrl", () => {
  it("adds the Supabase project ref to pooler usernames that are missing it", () => {
    const url = normalizeDatabaseUrl(
      "postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      "https://kkkjfvjfxmlscntgnfug.supabase.co",
    );

    const parsed = new URL(url);
    expect(parsed.username).toBe("postgres.kkkjfvjfxmlscntgnfug");
    expect(parsed.password).toBe("secret");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("does not double-append the project ref", () => {
    const url = normalizeDatabaseUrl(
      "postgresql://postgres.kkkjfvjfxmlscntgnfug:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
      "https://kkkjfvjfxmlscntgnfug.supabase.co",
    );

    const parsed = new URL(url);
    expect(parsed.username).toBe("postgres.kkkjfvjfxmlscntgnfug");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("leaves non-pooler URLs alone", () => {
    const raw = "postgresql://postgres:secret@db.kkkjfvjfxmlscntgnfug.supabase.co:5432/postgres";

    expect(normalizeDatabaseUrl(raw, "https://kkkjfvjfxmlscntgnfug.supabase.co")).toBe(raw);
  });
});
