/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
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

    if (isAdminRequest(url.pathname)) {
      const securedRequest = authorizeAdminRequest(request, env, url);
      if (securedRequest instanceof Response) return securedRequest;
      request = securedRequest;
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

    return handler.fetch(request, env, ctx);
  },
};

function isAdminRequest(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}

function authorizeAdminRequest(request: Request, env: Env, url: URL): Request | Response {
  const headers = new Headers(request.headers);
  headers.delete("x-photo-wall-admin");

  // ChatGPT Sites injects trusted identity headers and keeps its existing sign-in flow.
  if (
    headers.has("oai-authenticated-user-id") &&
    headers.has("oai-authenticated-user-email")
  ) {
    return new Request(request, { headers });
  }

  // The ChatGPT-hosted copy owns /signin-with-chatgpt. Do not replace that flow.
  if (url.hostname.endsWith(".chatgpt.site")) {
    return new Request(request, { headers });
  }

  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) {
    return new Response("模板管理后台尚未设置管理员账号，请先在 Cloudflare Workers 中添加 ADMIN_USERNAME 和 ADMIN_PASSWORD。", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const credentials = readBasicCredentials(headers.get("authorization"));
  if (
    !credentials ||
    !safeEqual(credentials.username, username) ||
    !safeEqual(credentials.password, password)
  ) {
    return new Response("需要管理员账号才能进入模板管理后台。", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="Wedding Photo Wall Admin", charset="UTF-8"',
      },
    });
  }

  headers.delete("authorization");
  headers.set("x-photo-wall-admin", username);
  return new Request(request, { headers });
}

function readBasicCredentials(value: string | null) {
  if (!value?.startsWith("Basic ")) return null;

  try {
    const bytes = Uint8Array.from(atob(value.slice(6)), (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export default worker;
