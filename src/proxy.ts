import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "../utils/supabase/middleware";
import { rateLimit } from "@/lib/rate-limit";

// Best-effort abuse dampening on the most sensitive endpoints. Limits are
// generous (normal use is unaffected); the check FAILS OPEN on any error so a
// limiter bug can never block legitimate traffic. See src/lib/rate-limit.ts for
// the serverless caveat and the production (shared-store) upgrade path.
const RATE_RULES: { test: RegExp; limit: number; windowMs: number }[] = [
  { test: /^\/api\/auth\//, limit: 20, windowMs: 60_000 },
  { test: /^\/api\/(ask-mba|tutor|sessions)\b/, limit: 40, windowMs: 60_000 },
];

/**
 * Runs on every request to keep the Supabase session fresh · refreshes the
 * auth cookie before it expires so server components and API routes see a
 * valid user. Also applies best-effort rate limiting to sensitive routes.
 */
export async function proxy(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname;
    const rule = RATE_RULES.find((r) => r.test.test(path));
    if (rule) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const result = rateLimit(`${rule.test.source}:${ip}`, rule.limit, rule.windowMs);
      if (!result.allowed) {
        return NextResponse.json(
          { error: "rate_limited", message: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))) },
          },
        );
      }
    }
  } catch {
    /* fail open — never block legitimate traffic on a limiter error */
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths EXCEPT static assets, the SW, and known public files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|demo.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
