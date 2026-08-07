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

type OwnerRecord = {
  userId: string;
  email: string;
  claimedAt: string;
};

const OWNER_KEY = "__admin/owner.json";

export class AdminAccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function getMediaBucket(): R2Bucket {
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!bucket) throw new Error("图片存储暂未启用，请重新部署网站后再试。");
  return bucket;
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

  const bucket = getMediaBucket();
  const currentOwner = await bucket.get(OWNER_KEY);

  if (!currentOwner) {
    const owner: OwnerRecord = {
      userId: user.userId,
      email: user.email,
      claimedAt: new Date().toISOString(),
    };
    await bucket.put(OWNER_KEY, JSON.stringify(owner), {
      httpMetadata: { contentType: "application/json" },
    });
    return user;
  }

  const owner = await currentOwner.json<OwnerRecord>();
  if (owner.userId !== user.userId) {
    throw new AdminAccessError("当前账号没有模板管理权限。", 403);
  }

  return user;
}

export async function listTemplateAssets(filters?: {
  style?: TemplateStyle;
  size?: TemplateSize;
}): Promise<TemplateAsset[]> {
  const bucket = getMediaBucket();
  const prefix = filters?.style
    ? `templates/${filters.style}/${filters.size ? `${filters.size}/` : ""}`
    : "templates/";
  const objects: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({
      prefix,
      cursor,
      limit: 1000,
      include: ["customMetadata"],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects
    .map((object) => toTemplateAsset(object))
    .filter((asset): asset is TemplateAsset => Boolean(asset))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

function toTemplateAsset(object: R2Object): TemplateAsset | null {
  const [, styleValue, sizeValue] = object.key.split("/");
  if (!isTemplateStyle(styleValue) || !isTemplateSize(sizeValue)) return null;

  const uploadedAt = object.customMetadata?.uploadedAt || object.uploaded.toISOString();
  const encodedTitle = object.customMetadata?.title;
  const title = encodedTitle ? safeDecode(encodedTitle) : "未命名模板";

  return {
    key: object.key,
    title,
    style: styleValue,
    size: sizeValue,
    uploadedAt,
    url: `/api/media?key=${encodeURIComponent(object.key)}`,
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
