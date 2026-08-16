/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleExchangeApi } from "../db/exchange-api.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AWE_VERIFIER_TOKEN?: string;
  AWE_ADMIN_TOKEN?: string;
  AWE_RATE_LIMIT_SALT?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const aweHosts = new Set(["agentwex.xyz", "www.agentwex.xyz"]);

async function signupFingerprint(request: Request, salt?: string): Promise<string | null> {
  const address = request.headers.get("cf-connecting-ip");
  if (!salt || !address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${address}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

    if (["/api/exchange/signup", "/api/exchange/account", "/api/exchange/ledger", "/api/exchange/preflight", "/api/exchange/alerts", "/api/exchange/route-feedback", "/api/exchange/signing-keys", "/api/exchange/signing-keys/revoke", "/api/exchange/api-keys/rotate", "/api/exchange/contributions", "/api/exchange/queries", "/api/exchange/working-route-comps", "/api/exchange/bounties", "/api/exchange/unlock", "/api/exchange/coverage", "/api/exchange/internal/accept", "/api/exchange/internal/stats"].includes(url.pathname)
      || url.pathname.startsWith("/api/exchange/contributions/")
      || url.pathname.startsWith("/api/exchange/queries/")) {
      return handleExchangeApi(request, env.DB, {
        verifierToken: env.AWE_VERIFIER_TOKEN,
        adminToken: env.AWE_ADMIN_TOKEN,
        clientFingerprint: url.pathname === "/api/exchange/signup" ? await signupFingerprint(request, env.AWE_RATE_LIMIT_SALT) : null,
        requireClientFingerprint: true,
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
