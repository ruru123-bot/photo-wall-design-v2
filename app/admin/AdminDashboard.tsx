"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type TemplateAsset = {
  key: string;
  title: string;
  style: string;
  size: string;
  uploadedAt: string;
  url: string;
};

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
  const [filterStyle, setFilterStyle] = useState("all");
  const [filterSize, setFilterSize] = useState("all");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/templates", { cache: "no-store" });
      const payload = await response.json() as { templates?: TemplateAsset[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "读取模板失败。");
      setTemplates(payload.templates || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取模板失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
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

    try {
      const response = await fetch("/api/admin/templates", { method: "POST", body: data });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "上传失败。");
      form.reset();
      setMessage("上传成功，图片已经进入对应尺寸的预览页面。");
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async (item: TemplateAsset) => {
    if (!window.confirm(`确定删除“${item.title}”吗？删除后无法恢复。`)) return;
    setMessage("正在删除…");

    try {
      const response = await fetch(`/api/admin/templates?key=${encodeURIComponent(item.key)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败。");
      setTemplates((current) => current.filter((template) => template.key !== item.key));
      setMessage("模板已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <a className="admin-brand" href="/">匠心设计 <small>ARTISAN DESIGN</small></a>
          <p>模板管理后台</p>
        </div>
        <a className="admin-home-link" href="/#templates">查看网站</a>
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
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
            <small>支持 JPG、PNG、WebP，单张不超过 10MB</small>
          </label>
          <button className="admin-submit" type="submit" disabled={submitting}>
            {submitting ? "正在上传…" : "上传并发布到预览"}
          </button>
        </form>
        {message && <p className="admin-message" role="status">{message}</p>}
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
                <img src={`${item.url}&w=720`} alt={item.title} loading="lazy" decoding="async" />
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
