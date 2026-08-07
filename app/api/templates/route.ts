import {
  getTemplateDeliveryUrl,
  isTemplateSize,
  isTemplateStyle,
  listTemplateAssets,
} from "@/lib/template-storage";
import {
  readPublicTemplateCache,
  writePublicTemplateCache,
} from "@/lib/template-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const style = url.searchParams.get("style");
    const size = url.searchParams.get("size");

    if (!isTemplateStyle(style) || !isTemplateSize(size)) {
      return Response.json({ error: "请选择有效的风格和尺寸。" }, { status: 400 });
    }

    const cached = await readPublicTemplateCache(request.url, style, size);
    if (cached) return publicTemplateResponse(cached, "HIT");

    const templates = await listTemplateAssets({ style, size });
    const payload = {
      templates: templates.map((template) => ({
        key: template.key,
        title: template.title,
        uploadedAt: template.uploadedAt,
        thumbnailUrl: template.thumbnailUrl,
        gridUrl: template.adminUrl,
        previewUrl: template.previewUrl,
        fullUrl: getTemplateDeliveryUrl(template.key, 1800),
      })),
    };
    const response = Response.json(payload);
    await writePublicTemplateCache(request.url, style, size, response.clone());
    return publicTemplateResponse(response, "MISS");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "读取模板失败。" },
      { status: 500 },
    );
  }
}

function publicTemplateResponse(response: Response, cacheStatus: "HIT" | "MISS") {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  headers.set("X-Template-Cache", cacheStatus);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
