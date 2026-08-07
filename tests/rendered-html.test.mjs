import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function requestSite(pathname = "/", options = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://photo-wall-design.example${pathname}`, {
      headers: { accept: "text/html", ...options.headers },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...options.env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the current mobile wedding photo wall homepage", async () => {
  const response = await requestSite();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>匠心照片墙设计｜婚礼模板与打印定制<\/title>/);
  assert.match(html, /匠心照片墙设计/);
  assert.match(html, /wedding-hero-mobile-h264-v13\.mp4/);
  assert.ok(html.indexOf("传统红底排版风") < html.indexOf("渐变小众风"));
  assert.ok(html.indexOf("渐变小众风") < html.indexOf("韩系抠图简约风"));
  assert.ok(html.indexOf("韩系抠图简约风") < html.indexOf("卡通可爱风"));
  assert.doesNotMatch(html, /LUMI[ÈE]RE|让婚礼的第一眼/);
});

test("protects the Cloudflare template management routes", async () => {
  const response = await requestSite("/admin", {
    env: {
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "correct-password",
    },
  });

  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /^Basic\b/);
  assert.match(await response.text(), /需要管理员账号/);
});

test("keeps the repository configured for the current Workers deployment", async () => {
  const [page, preview, publicTemplatesApi, layout, hero, worker, storage, wrangler, hosting, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/templates/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HeroVideo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/template-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /匠心照片墙设计/);
  assert.doesNotMatch(page, /next\/link/);
  assert.match(page, /href=\{`\/preview\?style=/);
  assert.match(preview, /cache: "no-store"/);
  assert.doesNotMatch(preview, /sessionStorage/);
  assert.match(publicTemplatesApi, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(layout, /婚礼模板与打印定制/);
  assert.match(hero, /wedding-hero-mobile-h264-v13\.mp4/);
  assert.match(worker, /ADMIN_USERNAME/);
  assert.match(worker, /x-photo-wall-admin/);
  assert.match(worker, /CLOUDINARY_CLOUD_NAME/);
  assert.match(worker, /__PHOTO_WALL_ENV__/);
  assert.doesNotMatch(worker, /R2Bucket|MEDIA:/);
  assert.match(storage, /api\.cloudinary\.com/);
  assert.match(storage, /res\.cloudinary\.com/);
  assert.match(storage, /q_auto:eco/);
  assert.match(storage, /c_limit,w_/);
  assert.match(storage, /__PHOTO_WALL_ENV__/);
  assert.match(wrangler, /"name": "photo-wall-design"/);
  assert.doesNotMatch(wrangler, /r2_buckets|photo-wall-design-media/);
  assert.match(hosting, /"r2": null/);
  assert.match(packageJson, /"deploy:cloudflare"/);
  assert.match(packageJson, /prepare-cloudflare-deploy\.mjs/);
});
