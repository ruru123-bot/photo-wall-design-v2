import { env } from "cloudflare:workers";
import { getMediaBucket } from "@/lib/template-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const requestedWidth = Number.parseInt(url.searchParams.get("w") || "", 10);
  const width = Number.isFinite(requestedWidth)
    ? Math.min(2400, Math.max(160, requestedWidth))
    : null;
  if (!key || !key.startsWith("templates/") || key.includes("..")) {
    return new Response("Invalid media key", { status: 400 });
  }

  const object = await getMediaBucket().get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const images = (env as unknown as {
    IMAGES?: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
        };
      };
    };
  }).IMAGES;

  if (width && images) {
    const transformed = await images
      .input(object.body)
      .transform({ width, fit: "scale-down" })
      .output({ format: "image/webp", quality: width <= 320 ? 76 : 82 });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}
