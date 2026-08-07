import {
  templateSizes,
  templateStyles,
  type TemplateSize,
  type TemplateStyle,
} from "@/lib/template-storage";

const TEMPLATE_CACHE_VERSION = "v2";
const TEMPLATE_CACHE_TTL_SECONDS = 5 * 60;

type CloudflareCacheStorage = CacheStorage & { default?: Cache };

function getDefaultEdgeCache() {
  const runtime = globalThis as typeof globalThis & { caches?: CloudflareCacheStorage };
  return runtime.caches?.default || null;
}

function templateCacheRequest(requestUrl: string, style: TemplateStyle, size: TemplateSize) {
  const url = new URL(requestUrl);
  url.pathname = `/__photo-wall-cache/${TEMPLATE_CACHE_VERSION}/${style}/${size}`;
  url.search = "";
  url.hash = "";
  return new Request(url, { method: "GET" });
}

export async function readPublicTemplateCache(
  requestUrl: string,
  style: TemplateStyle,
  size: TemplateSize,
) {
  const cache = getDefaultEdgeCache();
  if (!cache) return null;

  try {
    return await cache.match(templateCacheRequest(requestUrl, style, size));
  } catch {
    return null;
  }
}

export async function writePublicTemplateCache(
  requestUrl: string,
  style: TemplateStyle,
  size: TemplateSize,
  response: Response,
) {
  const cache = getDefaultEdgeCache();
  if (!cache) return;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${TEMPLATE_CACHE_TTL_SECONDS}`);
  const cachedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  try {
    await cache.put(templateCacheRequest(requestUrl, style, size), cachedResponse);
  } catch {
    // A cache write must never prevent the templates from loading.
  }
}

export async function purgePublicTemplateCache(
  requestUrl: string,
  filters?: { style?: TemplateStyle; size?: TemplateSize },
) {
  const cache = getDefaultEdgeCache();
  if (!cache) return;

  const styles = filters?.style ? [filters.style] : [...templateStyles];
  const sizes = filters?.size ? [filters.size] : [...templateSizes];
  await Promise.allSettled(
    styles.flatMap((style) => sizes.map((size) => (
      cache.delete(templateCacheRequest(requestUrl, style, size))
    ))),
  );
}
