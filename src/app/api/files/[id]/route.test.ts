import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

vi.mock("@/lib/db/supabase-server", () => ({ requireUser: vi.fn() }));
import { DELETE } from "./route";
import { requireUser } from "@/lib/db/supabase-server";

const requireUserMock = requireUser as unknown as ReturnType<typeof vi.fn>;

// Minimal chainable Supabase stub that records which tables get .delete()d.
function makeSupabase(file: unknown) {
  const deletes: string[] = [];
  const storageRemove = vi.fn().mockResolvedValue({});
  const supabase = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        single: async () => ({ data: file }),
        delete() {
          deletes.push(table);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    storage: { from: () => ({ remove: storageRemove }) },
  };
  return { supabase, deletes, storageRemove };
}

const req = {} as NextRequest;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("DELETE /api/files/[id] — object-level authorization (BOLA/IDOR)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unauthenticated caller with 401", async () => {
    requireUserMock.mockResolvedValue({
      user: null,
      supabase: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    expect((await DELETE(req, ctx("f1"))).status).toBe(401);
  });

  it("will NOT delete a file owned by another user (404, no deletes, no storage removal)", async () => {
    const { supabase, deletes, storageRemove } = makeSupabase({ storage_path: "p", user_id: "another-user" });
    requireUserMock.mockResolvedValue({ user: { id: "me" }, supabase, unauthorized: null });

    const res = await DELETE(req, ctx("f1"));
    expect(res.status).toBe(404);
    expect(deletes).toEqual([]);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("deletes a file owned by the caller (204, chunks + record removed)", async () => {
    const { supabase, deletes } = makeSupabase({ storage_path: "p", user_id: "me" });
    requireUserMock.mockResolvedValue({ user: { id: "me" }, supabase, unauthorized: null });

    const res = await DELETE(req, ctx("f1"));
    expect(res.status).toBe(204);
    expect(deletes).toContain("document_chunks");
    expect(deletes).toContain("private_files");
  });
});
