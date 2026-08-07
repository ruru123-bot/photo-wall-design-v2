import {
  AdminAccessError,
  getMediaBucket,
  isTemplateSize,
  isTemplateStyle,
  listTemplateAssets,
  requireTemplateAdmin,
} from "@/lib/template-storage";

export const dynamic = "force-dynamic";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxUploadBytes = 15 * 1024 * 1024;

export async function GET() {
  try {
    await requireTemplateAdmin();
    const templates = await listTemplateAssets();
    return Response.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireTemplateAdmin();
    const form = await request.formData();
    const style = textValue(form.get("style"));
    const size = textValue(form.get("size"));
    const title = textValue(form.get("title")).slice(0, 80) || "未命名模板";
    const file = form.get("file");

    if (!isTemplateStyle(style) || !isTemplateSize(size)) {
      return Response.json({ error: "请选择有效的风格和尺寸。" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "请选择需要上传的图片。" }, { status: 400 });
    }
    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return Response.json({ error: "仅支持 JPG、PNG 和 WebP 图片。" }, { status: 400 });
    }
    if (file.size > maxUploadBytes) {
      return Response.json({ error: "单张图片不能超过 15MB。" }, { status: 400 });
    }

    const uploadedAt = new Date().toISOString();
    const key = `templates/${style}/${size}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await getMediaBucket().put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        title: encodeURIComponent(title),
        uploadedAt,
        uploader: encodeURIComponent(user.email),
      },
    });

    const templates = await listTemplateAssets({ style, size });
    return Response.json({ template: templates.find((item) => item.key === key) }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireTemplateAdmin();
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !key.startsWith("templates/") || key.includes("..")) {
      return Response.json({ error: "无效的模板图片。" }, { status: 400 });
    }

    await getMediaBucket().delete(key);
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "模板管理操作失败。" },
    { status: 500 },
  );
}
