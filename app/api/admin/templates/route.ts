import {
  AdminAccessError,
  deleteTemplateAsset,
  isTemplateSize,
  isTemplateStyle,
  listTemplateAssets,
  requireTemplateAdmin,
  uploadTemplateAsset,
} from "@/lib/template-storage";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxUploadBytes = 10 * 1024 * 1024;

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
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: "仅支持 JPG、PNG 和 WebP 图片。" }, { status: 400 });
    }
    if (file.size > maxUploadBytes) {
      return Response.json({ error: "Cloudinary 免费方案要求单张图片不超过 10MB。" }, { status: 400 });
    }

    const template = await uploadTemplateAsset({
      file,
      style,
      size,
      title,
      uploader: user.email,
    });
    return Response.json({ template }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireTemplateAdmin();
    const key = new URL(request.url).searchParams.get("key");
    if (!key) {
      return Response.json({ error: "无效的模板图片。" }, { status: 400 });
    }

    await deleteTemplateAsset(key);
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
