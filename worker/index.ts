/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleExchangeApi } from "../db/exchange-api.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AWE_VERIFIER_TOKEN?: string;
  AWE_ADMIN_TOKEN?: string;
  AWE_OWNER_EMAIL?: string;
  AWE_OWNER_NODE_ALIASES?: string;
  AWE_RATE_LIMIT_SALT?: string;
  GA4_API_SECRET?: string;
  AWE_COMMUNITY_BOUNTIES_ENABLED?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const aweHosts = new Set(["agentwex.xyz", "www.agentwex.xyz"]);

function ownerAliases(value?: string): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter(([key, label]) => typeof key === "string" && typeof label === "string")
      .map(([key, label]) => [key.slice(0, 120), (label as string).slice(0, 80)]));
  } catch { return {}; }
}

async function signupFingerprint(request: Request, salt?: string): Promise<string | null> {
  const address = request.headers.get("cf-connecting-ip");
  if (!salt || !address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${address}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function forwardGa4Conversion(ctx: ExecutionContext, env: Env, eventName: string, acquisitionId: string, parameters: Record<string, unknown>) {
  if (!env.GA4_API_SECRET) return;
  const endpoint = new URL("https://www.google-analytics.com/mp/collect");
  endpoint.searchParams.set("measurement_id", "G-D91GKT9Y5H");
  endpoint.searchParams.set("api_secret", env.GA4_API_SECRET);
  const safeParameters = Object.fromEntries(Object.entries(parameters)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 100) : value]));
  ctx.waitUntil(fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: acquisitionId,
      events: [{ name: eventName, params: { ...safeParameters, engagement_time_msec: 1 } }],
    }),
  }).then(() => undefined).catch(() => undefined));
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (["/api/exchange/signup", "/api/exchange/account", "/api/exchange/ledger", "/api/exchange/preflight", "/api/exchange/alerts", "/api/exchange/route-feedback", "/api/exchange/signing-keys", "/api/exchange/signing-keys/revoke", "/api/exchange/api-keys/rotate", "/api/exchange/contributions", "/api/exchange/queries", "/api/exchange/working-route-comps", "/api/exchange/bounties", "/api/exchange/research-bounties", "/api/exchange/unlock", "/api/exchange/coverage", "/api/exchange/acquisition-events", "/api/exchange/lifecycle-events", "/api/exchange/internal/accept", "/api/exchange/internal/research-bounty-funding/verify", "/api/exchange/internal/research-bounties/moderate", "/api/exchange/internal/lab-enroll", "/api/exchange/internal/owner-snapshot", "/api/exchange/internal/stats"].includes(url.pathname)
      || url.pathname.startsWith("/api/exchange/contributions/")
      || url.pathname.startsWith("/api/exchange/queries/")
      || url.pathname.startsWith("/api/exchange/research-bounties/")) {
      return handleExchangeApi(request, env.DB, {
        verifierToken: env.AWE_VERIFIER_TOKEN,
        adminToken: env.AWE_ADMIN_TOKEN,
        ownerEmail: env.AWE_OWNER_EMAIL,
        ownerAliases: ownerAliases(env.AWE_OWNER_NODE_ALIASES),
        clientFingerprint: ["/api/exchange/signup", "/api/exchange/acquisition-events"].includes(url.pathname) ? await signupFingerprint(request, env.AWE_RATE_LIMIT_SALT) : null,
        communityBountiesEnabled: env.AWE_COMMUNITY_BOUNTIES_ENABLED === "enabled",
        requireClientFingerprint: true,
        forwardConversion: (eventName: string, acquisitionId: string, parameters: Record<string, unknown>) =>
          forwardGa4Conversion(ctx, env, eventName, acquisitionId, parameters),
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (aweHosts.has(url.hostname) && url.pathname === "/") {
      url.pathname = "/exchange";
      return handler.fetch(new Request(url, request), env, ctx);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
