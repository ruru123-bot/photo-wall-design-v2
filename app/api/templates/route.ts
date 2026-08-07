import {
  isTemplateSize,
  isTemplateStyle,
  listTemplateAssets,
} from "@/lib/template-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const style = url.searchParams.get("style");
    const size = url.searchParams.get("size");

    if (!isTemplateStyle(style) || !isTemplateSize(size)) {
      return Response.json({ error: "请选择有效的风格和尺寸。" }, { status: 400 });
    }

    const templates = await listTemplateAssets({ style, size });
    return Response.json(
      { templates },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "CDN-Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "读取模板失败。" },
      { status: 500 },
    );
  }
}
