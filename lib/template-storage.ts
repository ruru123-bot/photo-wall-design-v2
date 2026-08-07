import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const templateStyles = ["cute", "gradient", "korean", "traditional"] as const;
export const templateSizes = ["compact", "medium", "large", "panorama"] as const;

export type TemplateStyle = (typeof templateStyles)[number];
export type TemplateSize = (typeof templateSizes)[number];

export type TemplateAsset = {
  key: string;
  title: string;
  style: TemplateStyle;
  size: TemplateSize;
  uploadedAt: string;
  url: string;
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryResource = {
  public_id: string;
  created_at?: string;
  context?: {
    custom?: Record<string, string>;
    [key: string]: unknown;
  };
};

type CloudinaryResourcesResponse = {
  resources?: CloudinaryResource[];
  next_cursor?: string;
};

type CloudinaryUploadResponse = CloudinaryResource & {
  error?: { message?: string };
};

const CLOUDINARY_ROOT = "wedding-photo-wall";

export class AdminAccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function isTemplateStyle(value: string | null): value is TemplateStyle {
  return Boolean(value && templateStyles.includes(value as TemplateStyle));
}

export function isTemplateSize(value: string | null): value is TemplateSize {
  return Boolean(value && templateSizes.includes(value as TemplateSize));
}

export async function requireTemplateAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new AdminAccessError("请先登录后再管理模板。", 401);
  return user;
}

export async function listTemplateAssets(filters?: {
  style?: TemplateStyle;
  size?: TemplateSize;
}): Promise<TemplateAsset[]> {
  const config = getCloudinaryConfig();
  const prefix = filters?.style
    ? `${CLOUDINARY_ROOT}/${filters.style}/${filters.size ? `${filters.size}/` : ""}`
    : `${CLOUDINARY_ROOT}/`;
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    const query = new URLSearchParams({
      prefix,
      max_results: "500",
      context: "true",
    });
    if (nextCursor) query.set("next_cursor", nextCursor);

    const page = await cloudinaryRequest<CloudinaryResourcesResponse>(
      config,
      `/resources/image/upload?${query.toString()}`,
    );
    resources.push(...(page.resources || []));
    nextCursor = page.next_cursor;
  } while (nextCursor);

  return resources
    .map(toTemplateAsset)
    .filter((asset): asset is TemplateAsset => Boolean(asset))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export async function uploadTemplateAsset(input: {
  file: File;
  style: TemplateStyle;
  size: TemplateSize;
  title: string;
  uploader: string;
}): Promise<TemplateAsset> {
  const config = getCloudinaryConfig();
  const uploadedAt = new Date().toISOString();
  const publicId = `${CLOUDINARY_ROOT}/${input.style}/${input.size}/${Date.now()}-${crypto.randomUUID()}`;
  const form = new FormData();
  form.set("file", input.file, input.file.name);
  form.set("public_id", publicId);
  form.set("overwrite", "false");
  form.set("tags", "wedding-photo-wall");
  form.set(
    "context",
    `title=${escapeCloudinaryContext(input.title)}|uploader=${escapeCloudinaryContext(input.uploader)}`,
  );

  const uploaded = await cloudinaryRequest<CloudinaryUploadResponse>(
    config,
    "/image/upload",
    { method: "POST", body: form },
  );

  return {
    key: uploaded.public_id || publicId,
    title: input.title,
    style: input.style,
    size: input.size,
    uploadedAt: uploaded.created_at || uploadedAt,
    url: `/api/media?key=${encodeURIComponent(uploaded.public_id || publicId)}`,
  };
}

export async function deleteTemplateAsset(publicId: string) {
  if (!isTemplatePublicId(publicId)) {
    throw new Error("无效的模板图片。");
  }

  const config = getCloudinaryConfig();
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("invalidate", "true");
  await cloudinaryRequest(config, "/image/destroy", { method: "POST", body: form });
}

export function getTemplateDeliveryUrl(publicId: string, width: number | null) {
  if (!isTemplatePublicId(publicId)) throw new Error("无效的模板图片。");

  const { cloudName } = getCloudinaryConfig();
  const transformation = width
    ? `f_auto,q_auto:eco,c_limit,w_${width}`
    : "f_auto,q_auto:eco";
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${transformation}/${encodedPublicId}`;
}

function getCloudinaryConfig(): CloudinaryConfig {
  const runtime = env as unknown as {
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
  };
  const cloudName = runtime.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = runtime.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = runtime.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary 尚未配置，请先在 Cloudflare Workers 中添加三项 Cloudinary 机密。");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    throw new Error("Cloudinary Cloud Name 格式无效。");
  }

  return { cloudName, apiKey, apiSecret };
}

async function cloudinaryRequest<T = unknown>(
  config: CloudinaryConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`);
  headers.set("Accept", "application/json");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}${path}`,
    { ...init, headers },
  );
  const payload = await response.json().catch(() => null) as
    | (T & { error?: { message?: string } })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Cloudinary 请求失败（${response.status}）。`);
  }
  if (!payload) throw new Error("Cloudinary 返回了空响应。");
  return payload;
}

function toTemplateAsset(resource: CloudinaryResource): TemplateAsset | null {
  const [root, styleValue, sizeValue] = resource.public_id.split("/");
  if (
    root !== CLOUDINARY_ROOT ||
    !isTemplateStyle(styleValue) ||
    !isTemplateSize(sizeValue)
  ) {
    return null;
  }

  const customContext = resource.context?.custom;
  const directTitle = typeof resource.context?.title === "string"
    ? resource.context.title
    : undefined;
  const title = customContext?.title || directTitle || "未命名模板";

  return {
    key: resource.public_id,
    title,
    style: styleValue,
    size: sizeValue,
    uploadedAt: resource.created_at || new Date(0).toISOString(),
    url: `/api/media?key=${encodeURIComponent(resource.public_id)}`,
  };
}

function isTemplatePublicId(value: string) {
  const [root, styleValue, sizeValue, identifier, ...rest] = value.split("/");
  return (
    root === CLOUDINARY_ROOT &&
    isTemplateStyle(styleValue) &&
    isTemplateSize(sizeValue) &&
    Boolean(identifier) &&
    rest.length === 0 &&
    !value.includes("..")
  );
}

function escapeCloudinaryContext(value: string) {
  return value.replace(/[\\=|]/g, (character) => `\\${character}`);
}
