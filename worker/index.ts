/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
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

const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_SESSION_COOKIE = "__Host-photo_wall_admin";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Vinext loads route handlers from separate server chunks. Bridge the
    // request-scoped Worker bindings so those chunks can reliably read the
    // production variables and secrets configured in Cloudflare.
    const runtime = globalThis as typeof globalThis & {
      __PHOTO_WALL_ENV__?: Env;
    };
    runtime.__PHOTO_WALL_ENV__ = env;

    const url = new URL(request.url);

    if (url.pathname === ADMIN_LOGIN_PATH) {
      return handleAdminLoginRequest(request, env, url);
    }

    if (isAdminRequest(url.pathname)) {
      const securedRequest = await authorizeAdminRequest(request, env, url);
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

async function authorizeAdminRequest(
  request: Request,
  env: Env,
  url: URL,
): Promise<Request | Response> {
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
    return isAdminApiRequest(url.pathname)
      ? adminJsonError("模板管理后台尚未设置管理员账号。", 503)
      : Response.redirect(new URL(ADMIN_LOGIN_PATH, url), 303);
  }

  const authenticated = await verifyAdminSession(
    readCookie(headers.get("cookie"), ADMIN_SESSION_COOKIE),
    username,
    password,
  );
  if (!authenticated) {
    return isAdminApiRequest(url.pathname)
      ? adminJsonError("登录已失效，请重新登录。", 401)
      : Response.redirect(new URL(ADMIN_LOGIN_PATH, url), 303);
  }

  headers.set("x-photo-wall-admin", username);
  return new Request(request, { headers });
}

async function handleAdminLoginRequest(request: Request, env: Env, url: URL) {
  if (url.hostname.endsWith(".chatgpt.site")) {
    return Response.redirect(new URL("/admin", url), 303);
  }

  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) {
    return adminLoginPage({
      status: 503,
      message: "后台账号尚未配置，请先在 Cloudflare 中设置管理员账号和密码。",
    });
  }

  if (request.method === "GET" || request.method === "HEAD") {
    if (
      await verifyAdminSession(
        readCookie(request.headers.get("cookie"), ADMIN_SESSION_COOKIE),
        username,
        password,
      )
    ) {
      return Response.redirect(new URL("/admin", url), 303);
    }
    return adminLoginPage();
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST" },
    });
  }

  const form = await request.formData().catch(() => null);
  const submittedUsername = textFormValue(form?.get("username"));
  const submittedPassword = textFormValue(form?.get("password"), false);
  if (
    !safeEqual(submittedUsername, username) ||
    !safeEqual(submittedPassword, password)
  ) {
    return adminLoginPage({
      status: 401,
      message: "账号或密码不正确，请重新输入。",
      username: submittedUsername,
    });
  }

  const session = await createAdminSession(username, password);
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: "/admin",
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
    },
  });
}

function adminLoginPage(options: {
  status?: number;
  message?: string;
  username?: string;
} = {}) {
  const message = options.message
    ? `<p class="message" role="alert">${escapeHtml(options.message)}</p>`
    : '<p class="hint">登录后即可上传和管理照片墙模板</p>';
  const username = escapeHtml(options.username || "");

  return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>匠心设计｜模板管理登录</title>
  <style>
    :root{color-scheme:light;--ink:#342d25;--muted:#817467;--gold:#b6935c;--line:#dfd1bd;--cream:#f7f2e9}
    *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 5%,#fff 0,transparent 38%),linear-gradient(145deg,#f7f2e9,#e9dfd0);font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink)}
    .card{width:min(100%,430px);padding:40px 30px 32px;border:1px solid rgba(182,147,92,.38);border-radius:30px;background:rgba(255,255,255,.82);box-shadow:0 24px 70px rgba(91,72,46,.14);backdrop-filter:blur(16px)}
    .eyebrow{margin:0 0 12px;color:var(--gold);font:600 12px/1.4 Georgia,serif;letter-spacing:.24em}.title{margin:0;font:400 clamp(30px,8vw,42px)/1.16 Georgia,"Songti SC",serif}.hint,.message{margin:14px 0 26px;color:var(--muted);font-size:14px;line-height:1.7}.message{padding:11px 13px;border-radius:12px;background:#fff2ef;color:#a04335}
    label{display:block;margin:16px 0 8px;font-size:14px;font-weight:600}input{width:100%;min-height:52px;border:1px solid var(--line);border-radius:14px;padding:0 15px;background:#fff;color:var(--ink);font:16px/1.2 inherit;outline:none}input:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(182,147,92,.13)}
    button{width:100%;min-height:54px;margin-top:24px;border:0;border-radius:999px;background:linear-gradient(105deg,#a98550,#cfb17b);color:#fff;font:600 16px/1 inherit;letter-spacing:.08em;box-shadow:0 12px 26px rgba(169,133,80,.25);cursor:pointer}.back{display:block;margin-top:19px;text-align:center;color:var(--muted);font-size:13px;text-decoration:none}
    @media(max-width:480px){body{place-items:start center;padding:9vh 18px 24px}.card{padding:34px 22px 28px;border-radius:25px}}
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">ARTISAN DESIGN</p>
    <h1 class="title">模板管理后台</h1>
    ${message}
    <form method="post" action="${ADMIN_LOGIN_PATH}">
      <label for="username">管理员账号</label>
      <input id="username" name="username" value="${username}" autocomplete="username" required autofocus>
      <label for="password">管理密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">进入管理后台</button>
    </form>
    <a class="back" href="/">返回网站首页</a>
  </main>
</body>
</html>`, {
    status: options.status || 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

async function createAdminSession(username: string, password: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ username, expiresAt })),
  );
  return `${payload}.${await signSessionPayload(payload, password)}`;
}

async function verifyAdminSession(
  session: string | null,
  username: string,
  password: string,
) {
  if (!session) return false;

  try {
    const [payload, signature, ...rest] = session.split(".");
    if (!payload || !signature || rest.length > 0) return false;
    const key = await importSessionKey(password);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(payload),
    );
    if (!validSignature) return false;

    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as { username?: unknown; expiresAt?: unknown };
    return (
      typeof decoded.username === "string" &&
      safeEqual(decoded.username, username) &&
      typeof decoded.expiresAt === "number" &&
      decoded.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

async function signSessionPayload(payload: string, password: string) {
  const key = await importSessionKey(password);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function importSessionKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=") || null;
  }
  return null;
}

function textFormValue(value: FormDataEntryValue | null | undefined, trim = true) {
  if (typeof value !== "string") return "";
  return trim ? value.trim() : value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function isAdminApiRequest(pathname: string) {
  return pathname.startsWith("/api/admin/");
}

function adminJsonError(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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
