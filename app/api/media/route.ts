import { getTemplateDeliveryUrl } from "@/lib/template-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const requestedWidth = Number.parseInt(url.searchParams.get("w") || "", 10);
    const width = Number.isFinite(requestedWidth)
      ? Math.min(2400, Math.max(160, requestedWidth))
      : null;

    if (!key) return new Response("Invalid media key", { status: 400 });

    return Response.redirect(getTemplateDeliveryUrl(key, width), 302);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid media key", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
