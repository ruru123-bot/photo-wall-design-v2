"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TemplateAsset = {
  key: string;
  title: string;
  style: string;
  size: string;
  uploadedAt: string;
  url: string;
  adminUrl?: string;
};

type NoticeTone = "info" | "success" | "error";

const maxUploadBytes = 10 * 1024 * 1024;
const targetUploadBytes = 9 * 1024 * 1024;
const maxSourceBytes = 40 * 1024 * 1024;

const styleOptions = [
  ["cute", "卡通可爱风"],
  ["gradient", "渐变小众风"],
  ["korean", "韩系抠图简约风"],
  ["traditional", "传统红底排版风"],
] as const;

const sizeOptions = [
  ["compact", "3–5米长"],
  ["medium", "6–9米长"],
  ["large", "10–15米长"],
  ["panorama", "16–22米长"],
] as const;

const styleLabels = Object.fromEntries(styleOptions);
const sizeLabels = Object.fromEntries(sizeOptions);

export default function AdminDashboard({ displayName, email }: { displayName: string; email: string }) {
  const [templates, setTemplates] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<NoticeTone>("info");
  const [selectedFileText, setSelectedFileText] = useState("");
  const [filterStyle, setFilterStyle] = useState("all");
  const [filterSize, setFilterSize] = useState("all");

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/templates", { cache: "no-store" });
      if (redirectToLoginIfNeeded(response)) return;
      const payload = await response.json() as { templates?: TemplateAsset[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "读取模板失败。");
      setTemplates(payload.templates || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取模板失败。");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadTemplates());
    return () => window.cancelAnimationFrame(frame);
  }, [loadTemplates]);

  const visibleTemplates = useMemo(() => templates.filter((item) => (
    (filterStyle === "all" || item.style === filterStyle)
    && (filterSize === "all" || item.size === filterSize)
  )), [filterSize, filterStyle, templates]);

  const uploadTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage("正在上传图片…");
    setMessageTone("info");

    try {
      const originalFile = data.get("file");
      if (!(originalFile instanceof File) || originalFile.size === 0) {
        throw new Error("请先选择需要上传的图片。");
      }
      if (originalFile.size > maxSourceBytes) {
        throw new Error("源图片超过 40MB，请先导出较小版本后再上传。");
      }

      let uploadFile = originalFile;
      let optimized = false;
      if (originalFile.size > maxUploadBytes) {
        setMessage(`图片有 ${formatFileSize(originalFile.size)}，正在自动优化，请稍候…`);
        uploadFile = await optimizeTemplateImage(originalFile);
        optimized = uploadFile !== originalFile;
        data.set("file", uploadFile, uploadFile.name);
      }

      const response = await fetch("/api/admin/templates", { method: "POST", body: data });
      if (redirectToLoginIfNeeded(response)) return;
      const payload = await readApiPayload<{ template?: TemplateAsset; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "上传失败。");
      if (!payload.template) throw new Error("图片已上传，但没有收到模板信息，请刷新图库重试。");
      form.reset();
      setSelectedFileText("");
      setTemplates((current) => [
        payload.template!,
        ...current.filter((item) => item.key !== payload.template!.key),
      ]);
      setMessage(
        optimized
          ? `上传成功！大图已自动优化为 ${formatFileSize(uploadFile.size)}，并进入对应尺寸预览。`
          : "上传成功！图片已经进入对应尺寸的预览页面。",
      );
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
      setMessageTone("error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async (item: TemplateAsset) => {
    if (!window.confirm(`确定删除“${item.title}”吗？删除后无法恢复。`)) return;
    setMessage("正在删除…");
    setMessageTone("info");

    try {
      const response = await fetch(`/api/admin/templates?key=${encodeURIComponent(item.key)}`, { method: "DELETE" });
      if (redirectToLoginIfNeeded(response)) return;
      const payload = await readApiPayload<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "删除失败。");
      setTemplates((current) => current.filter((template) => template.key !== item.key));
      setMessage("模板已删除。");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
      setMessageTone("error");
    }
  };

  return (
    <main className="admin-page">
      <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      <header className="admin-header">
        <div>
          <Link className="admin-brand" href="/">匠心设计 <small>ARTISAN DESIGN</small></Link>
          <p>模板管理后台</p>
        </div>
        <Link className="admin-home-link" href="/#templates">查看网站</Link>
      </header>

      <section className="admin-hero">
        <p>CONTENT MANAGEMENT</p>
        <h1>上传照片墙模板</h1>
        <span>{displayName} · {email}</span>
      </section>

      <section className="admin-panel admin-upload-panel">
        <div className="admin-panel-heading">
          <span>01</span>
          <div><h2>新增模板</h2><p>选择风格和尺寸，上传后会自动归入对应预览页面。</p></div>
        </div>
        <form className="admin-upload-form" onSubmit={uploadTemplate}>
          <label>
            <span>模板名称</span>
            <input name="title" type="text" maxLength={80} placeholder="例如：奶油蝴蝶结照片墙" required />
          </label>
          <div className="admin-form-row">
            <label>
              <span>所属风格</span>
              <select name="style" defaultValue="cute">
                {styleOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>照片墙长度</span>
              <select name="size" defaultValue="compact">
                {sizeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="admin-file-field">
            <span>模板图片</span>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setSelectedFileText(file
                  ? `${file.name} · ${formatFileSize(file.size)}${file.size > maxUploadBytes ? " · 上传时自动优化" : ""}`
                  : "");
              }}
            />
            <small>支持 JPG、PNG、WebP；超过 10MB 会自动优化后上传</small>
            {selectedFileText && <strong className="admin-selected-file">{selectedFileText}</strong>}
          </label>
          <button className="admin-submit" type="submit" disabled={submitting}>
            {submitting ? "正在上传…" : "上传并发布到预览"}
          </button>
        </form>
        {message && <p className="admin-message" data-tone={messageTone} role="status" aria-live="polite">{message}</p>}
      </section>

      <section className="admin-panel admin-library-panel">
        <div className="admin-panel-heading">
          <span>02</span>
          <div><h2>模板图库</h2><p>已上传 {templates.length} 张，可按风格和尺寸筛选。</p></div>
        </div>
        <div className="admin-filters">
          <select value={filterStyle} onChange={(event) => setFilterStyle(event.target.value)} aria-label="按风格筛选">
            <option value="all">全部风格</option>
            {styleOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <select value={filterSize} onChange={(event) => setFilterSize(event.target.value)} aria-label="按尺寸筛选">
            <option value="all">全部尺寸</option>
            {sizeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="admin-empty">正在读取模板…</p>
        ) : visibleTemplates.length === 0 ? (
          <p className="admin-empty">这个分类暂时还没有图片，上传第一张模板吧。</p>
        ) : (
          <div className="admin-template-grid">
            {visibleTemplates.map((item) => (
              <article className="admin-template-card" key={item.key}>
                <img src={item.adminUrl || `${item.url}&w=720`} alt={item.title} loading="lazy" decoding="async" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{styleLabels[item.style]} · {sizeLabels[item.size]}</p>
                  <span>{new Date(item.uploadedAt).toLocaleDateString("zh-CN")}</span>
                  <button type="button" onClick={() => void deleteTemplate(item)}>删除模板</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function redirectToLoginIfNeeded(response: Response) {
  if (response.status !== 401) return false;
  window.location.assign("/admin/login");
  return true;
}

async function readApiPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok
      ? "服务器返回了无法识别的上传结果，请刷新后重试。"
      : `上传失败（${response.status}），请稍后重试。`);
  }
}

async function optimizeTemplateImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("请选择 JPG、PNG 或 WebP 图片。");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("无法读取这张图片，请重新导出为 JPG、PNG 或 WebP 后再试。");
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器无法处理大图，请先压缩后再上传。");

    const longestSide = Math.max(bitmap.width, bitmap.height);
    const startingScale = Math.min(1, 4096 / longestSide);
    const dimensionScales = [startingScale, startingScale * 0.86, startingScale * 0.72, startingScale * 0.6];
    const qualities = [0.9, 0.82, 0.74, 0.66];
    let smallestBlob: Blob | null = null;

    for (const scale of dimensionScales) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, "image/webp", quality);
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (blob.size <= targetUploadBytes) return webpFile(blob, file.name);
      }
    }

    if (smallestBlob && smallestBlob.size <= maxUploadBytes) return webpFile(smallestBlob, file.name);
    throw new Error("图片优化后仍超过 10MB，请先导出为尺寸较小的 JPG 或 WebP。");
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片优化失败，请换一张图片重试。"));
    }, type, quality);
  });
}

function webpFile(blob: Blob, originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "template";
  return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
