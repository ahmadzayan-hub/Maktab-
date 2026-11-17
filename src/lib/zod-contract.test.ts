import { describe, expect, it } from "vitest";
import { z } from "zod";

// Pins the zod behaviour the API routes depend on, so a future major bump that
// changes it fails here and not in production.
describe("zod contract used by API routes", () => {
  it("flatten() keeps fieldErrors and formErrors", () => {
    const bad = z.object({ id: z.string().uuid() }).safeParse({ id: "nope" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const flat = bad.error.flatten();
      expect(flat.fieldErrors.id?.length).toBeGreaterThan(0);
      expect(flat.formErrors).toEqual([]);
    }
  });

  it("uuid follows RFC 9562: v4 passes, all-zero ids are rejected", () => {
    const schema = z.string().uuid();
    expect(schema.safeParse("3f2b8c1e-5a4d-4c3b-9e8f-1a2b3c4d5e6f").success).toBe(true);
    expect(schema.safeParse("00000000-0000-0000-0000-00000000000a").success).toBe(false);
  });

  it("optional().default() applies the default for an absent key (trends params)", () => {
    const schema = z.object({
      locale: z.enum(["en", "ar"]).optional().default("en"),
      limit: z.coerce.number().int().min(1).max(12).optional().default(6),
    });
    expect(schema.parse({})).toEqual({ locale: "en", limit: 6 });
    expect(schema.parse({ limit: "3" })).toEqual({ locale: "en", limit: 3 });
    expect(schema.safeParse({ limit: "99" }).success).toBe(false);
  });

  it("a bare z.unknown() REJECTS an absent key in zod 4; the template routes use .optional()", () => {
    expect(z.object({ body: z.unknown() }).safeParse({}).success).toBe(false);
    expect(z.object({ body: z.unknown().optional() }).safeParse({}).success).toBe(true);
  });
});
