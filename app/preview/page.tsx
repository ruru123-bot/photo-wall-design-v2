"use client";

import { useEffect, useState } from "react";

const styles = {
  cute: { title: "卡通可爱风", english: "PLAYFUL WEDDING" },
  gradient: { title: "渐变小众风", english: "EDITORIAL GRADIENT" },
  korean: { title: "韩系抠图简约风", english: "KOREAN MINIMAL" },
  traditional: { title: "传统红底排版风", english: "CLASSIC WEDDING" },
} as const;

const sizes = {
  compact: { label: "3–5米长", ratio: "STANDARD" },
  medium: { label: "6–9米长", ratio: "WIDE" },
  large: { label: "10–15米长", ratio: "EXTRA WIDE" },
  panorama: { label: "16–22米长", ratio: "PANORAMA" },
} as const;

type StyleKey = keyof typeof styles;
type SizeKey = keyof typeof sizes;

type TemplateAsset = {
  key: string;
  title: string;
  uploadedAt: string;
  url: string;
};

const templateCacheTtl = 5 * 60 * 1000;

function templateCacheKey(style: StyleKey, size: SizeKey) {
  return `wedding-templates:${style}:${size}`;
}

function readTemplateCache(style: StyleKey, size: SizeKey): TemplateAsset[] | null {
  try {
    const value = sessionStorage.getItem(templateCacheKey(style, size));
    if (!value) return null;
    const cached = JSON.parse(value) as { savedAt: number; templates: TemplateAsset[] };
    return Date.now() - cached.savedAt < templateCacheTtl ? cached.templates : null;
  } catch {
    return null;
  }
}

function writeTemplateCache(style: StyleKey, size: SizeKey, templates: TemplateAsset[]) {
  try {
    sessionStorage.setItem(
      templateCacheKey(style, size),
      JSON.stringify({ savedAt: Date.now(), templates }),
    );
  } catch {
    // Storage can be unavailable in private browsing; the page still works without it.
  }
}

function isStyleKey(value: string | null): value is StyleKey {
  return Boolean(value && value in styles);
}

function isSizeKey(value: string | null): value is SizeKey {
  return Boolean(value && value in sizes);
}

export default function PreviewPage() {
  const [selection, setSelection] = useState<{ style: StyleKey; size: SizeKey }>({
    style: "cute",
    size: "compact",
  });
  const [ready, setReady] = useState(false);
  const [templates, setTemplates] = useState<TemplateAsset[]>([]);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const style = params.get("style");
    const size = params.get("size");

    setSelection({
      style: isStyleKey(style) ? style : "cute",
      size: isSizeKey(size) ? size : "compact",
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setActiveTemplate(0);
    setMainImageLoaded(false);

    const cachedTemplates = readTemplateCache(selection.style, selection.size);
    if (cachedTemplates) {
      setTemplates(cachedTemplates);
      setLoadingTemplates(false);
    } else {
      setTemplates([]);
      setLoadingTemplates(true);
    }

    fetch(`/api/templates?style=${selection.style}&size=${selection.size}`, {
      cache: "default",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { templates?: TemplateAsset[] };
        const nextTemplates = response.ok ? payload.templates || [] : [];
        setTemplates(nextTemplates);
        writeTemplateCache(selection.style, selection.size, nextTemplates);
      })
      .catch(() => {
        if (!cachedTemplates) setTemplates([]);
      })
      .finally(() => setLoadingTemplates(false));

    return () => controller.abort();
  }, [ready, selection.size, selection.style]);

  const currentStyle = styles[selection.style];
  const currentSize = sizes[selection.size];
  const currentTemplate = templates[activeTemplate];

  useEffect(() => {
    setMainImageLoaded(false);
    if (templates.length < 2) return;

    const timer = window.setTimeout(() => {
      const nearby = [activeTemplate - 1, activeTemplate + 1]
        .map((index) => templates[index])
        .filter((template): template is TemplateAsset => Boolean(template));
      nearby.forEach((template) => {
        const image = new Image();
        image.src = `${template.url}&w=960`;
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [activeTemplate, templates]);

  const preloadTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const image = new Image();
    image.src = `${template.url}&w=960`;
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/#templates";
  };

  return (
    <main className={`preview-page preview-page-${selection.style}`} data-size={selection.size}>
      <header className="preview-header">
        <button className="preview-back" type="button" onClick={goBack} aria-label="返回模板选择">
          <span aria-hidden="true">←</span> 返回选择
        </button>
        <a className="preview-brand" href="/#top">匠心设计 <small>ARTISAN DESIGN</small></a>
      </header>

      <section className="preview-intro">
        <p>{currentStyle.english}</p>
        <h1>{currentStyle.title}</h1>
        <div className="preview-size-title"><span />{currentSize.label}<span /></div>
      </section>

      <section className="preview-stage" aria-label={`${currentStyle.title}${currentSize.label}照片墙效果预览`}>
        <div className="preview-stage-meta">
          <span>{currentSize.ratio}</span>
          <span>比例效果预览</span>
        </div>
        {loadingTemplates && <p className="preview-loading-indicator">正在同步最新模板…</p>}
        <div className="preview-image-stack">
          <div
            className={`wall-preview wall-preview-${selection.style}`}
            role={currentTemplate ? undefined : "img"}
            aria-label={currentTemplate ? undefined : `${currentStyle.title}照片墙`}
            aria-hidden={currentTemplate ? "true" : undefined}
          >
            <div className="wall-ornament wall-ornament-one" />
            <div className="wall-ornament wall-ornament-two" />
            <div className="wall-photo wall-photo-one" />
            <div className="wall-photo wall-photo-two" />
            <div className="wall-photo wall-photo-three" />
            <div className="wall-photo wall-photo-four" />
            <div className="wall-copy"><small>OUR WEDDING DAY</small><strong>我们的婚礼</strong></div>
          </div>
          {currentTemplate && (
            <figure className={`uploaded-wall-preview${mainImageLoaded ? " is-loaded" : ""}`}>
              <img
                key={currentTemplate.key}
                src={`${currentTemplate.url}&w=960`}
                alt={`${currentTemplate.title}照片墙效果`}
                decoding="async"
                fetchPriority="high"
                onLoad={() => setMainImageLoaded(true)}
              />
              <figcaption>{currentTemplate.title}</figcaption>
            </figure>
          )}
        </div>
        <div className="preview-scale-line"><i /><span>{currentSize.label}</span><i /></div>
      </section>

      {templates.length > 1 && (
        <section className="uploaded-template-picker" aria-label="选择其他模板">
          <div className="uploaded-template-heading"><span>已上传模板</span><small>{activeTemplate + 1} / {templates.length}</small></div>
          <div className="uploaded-template-list">
            {templates.map((template, index) => (
              <button
                type="button"
                key={template.key}
                aria-pressed={activeTemplate === index}
                onPointerEnter={() => preloadTemplate(index)}
                onPointerDown={() => preloadTemplate(index)}
                onClick={() => {
                  setMainImageLoaded(false);
                  setActiveTemplate(index);
                }}
              >
                <img src={`${template.url}&w=320`} alt="" loading={index < 4 ? "eager" : "lazy"} decoding="async" />
                <span>{template.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="preview-footer">
        <p>当前为长度比例效果示意</p>
        <span>实际画面将根据现场高度、安装位置与照片数量进一步调整</span>
        <button className="preview-return-button" type="button" onClick={goBack}>返回选择其他尺寸</button>
      </footer>
    </main>
  );
}
