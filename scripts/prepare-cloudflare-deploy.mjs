import { readFile, writeFile } from "node:fs/promises";

const configUrl = new URL("../dist/server/wrangler.json", import.meta.url);
const generated = JSON.parse(await readFile(configUrl, "utf8"));

const cloudflareConfig = {
  name: "photo-wall-design",
  main: "index.js",
  compatibility_date: generated.compatibility_date || "2026-05-15",
  compatibility_flags: [...new Set(generated.compatibility_flags || ["nodejs_compat"])],
  no_bundle: true,
  assets: {
    directory: "../client",
  },
  r2_buckets: [
    {
      binding: "MEDIA",
      bucket_name: "photo-wall-design-media",
    },
  ],
  rules: [
    {
      type: "ESModule",
      globs: ["**/*.js", "**/*.mjs"],
    },
  ],
  observability: {
    enabled: true,
  },
};

await writeFile(configUrl, `${JSON.stringify(cloudflareConfig, null, 2)}\n`, "utf8");
