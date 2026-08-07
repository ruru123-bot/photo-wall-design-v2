"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
type ViewMode = "single" | "grid";

type TemplateAsset = {
  key: string;
  title: string;
  uploadedAt: string;
  url: string;
  previewUrl?: string;
  thumbnailUrl?: string;
};

function isStyleKey(value: string | null): value is StyleKey {
  return Boolean(value && value in styles);
}

function isSizeKey(value: string | null): value is SizeKey {
  return Boolean(value && value in sizes);
}

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const styleParam = searchParams.get("style");
  const sizeParam = searchParams.get("size");
  const selection: { style: StyleKey; size: SizeKey } = {
    style: isStyleKey(styleParam) ? styleParam : "cute",
    size: isSizeKey(sizeParam) ? sizeParam : "compact",
  };
  const [templates, setTemplates] = useState<TemplateAsset[]>([]);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const mainSwipeStartX = useRef<number | null>(null);
  const lightboxSwipeStartX = useRef<number | null>(null);
  const suppressMainClick = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/templates?style=${selection.style}&size=${selection.size}&fresh=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { templates?: TemplateAsset[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "模板读取失败");
        setTemplates(payload.templates || []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTemplates([]);
        setTemplateError(error instanceof Error ? error.message : "模板读取失败，请稍后重试");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTemplates(false);
      });

    return () => controller.abort();
  }, [selection.size, selection.style]);

  const currentStyle = styles[selection.style];
  const currentSize = sizes[selection.size];
  const currentTemplate = templates[activeTemplate] || templates[0];
  const lightboxTemplate = lightboxIndex === null ? null : templates[lightboxIndex];

  useEffect(() => {
    if (templates.length < 2) return;

    const timer = window.setTimeout(() => {
      const nearbyIndexes = [
        (activeTemplate - 1 + templates.length) % templates.length,
        (activeTemplate + 1) % templates.length,
      ];
      nearbyIndexes.forEach((index) => {
        const template = templates[index];
        if (!template) return;
        const image = new Image();
        image.src = template.previewUrl || `${template.url}&w=960`;
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeTemplate, templates]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft" && templates.length > 1) {
        setZoom(1);
        setLightboxIndex((current) => current === null ? null : (current - 1 + templates.length) % templates.length);
      }
      if (event.key === "ArrowRight" && templates.length > 1) {
        setZoom(1);
        setLightboxIndex((current) => current === null ? null : (current + 1) % templates.length);
      }
      if (event.key === "+" || event.key === "=") setZoom((current) => Math.min(3, current + 0.5));
      if (event.key === "-") setZoom((current) => Math.max(1, current - 0.5));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxIndex, templates.length]);

  const preloadTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const image = new Image();
    image.src = template.previewUrl || `${template.url}&w=960`;
  };

  const selectTemplate = (index: number) => {
    if (!templates[index]) return;
    setMainImageLoaded(false);
    setActiveTemplate(index);
  };

  const moveTemplate = (direction: -1 | 1) => {
    if (templates.length < 2) return;
    selectTemplate((activeTemplate + direction + templates.length) % templates.length);
  };

  const openLightbox = (index: number) => {
    if (!templates[index]) return;
    setZoom(1);
    setLightboxIndex(index);
  };

  const moveLightbox = (direction: -1 | 1) => {
    if (lightboxIndex === null || templates.length < 2) return;
    setZoom(1);
    setLightboxIndex((lightboxIndex + direction + templates.length) % templates.length);
  };

  const finishMainSwipe = (clientX: number) => {
    const startX = mainSwipeStartX.current;
    mainSwipeStartX.current = null;
    if (startX === null) return;
    const distance = clientX - startX;
    if (Math.abs(distance) < 46) return;
    suppressMainClick.current = true;
    moveTemplate(distance < 0 ? 1 : -1);
    window.setTimeout(() => { suppressMainClick.current = false; }, 180);
  };

  const finishLightboxSwipe = (clientX: number) => {
    const startX = lightboxSwipeStartX.current;
    lightboxSwipeStartX.current = null;
    if (startX === null || zoom !== 1) return;
    const distance = clientX - startX;
    if (Math.abs(distance) < 52) return;
    moveLightbox(distance < 0 ? 1 : -1);
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
        <Link className="preview-brand" href="/#top">匠心设计 <small>ARTISAN DESIGN</small></Link>
      </header>

      <section className="preview-intro">
        <p>{currentStyle.english}</p>
        <h1>{currentStyle.title}</h1>
        <div className="preview-size-title"><span />{currentSize.label}<span /></div>
      </section>

      {templates.length > 0 && (
        <div className="preview-view-switch" role="group" aria-label="模板浏览方式">
          <button type="button" aria-pressed={viewMode === "single"} onClick={() => setViewMode("single")}>
            <span aria-hidden="true">↔</span> 左右滑看
          </button>
          <button type="button" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
            <span aria-hidden="true">▦</span> 多排查看 <small>{templates.length}</small>
          </button>
        </div>
      )}

      {viewMode === "grid" && templates.length > 0 ? (
        <section className="preview-grid-stage" aria-label={`${currentStyle.title}${currentSize.label}全部模板`}>
          <div className="preview-grid-heading">
            <div><small>ALL TEMPLATES</small><h2>全部模板</h2></div>
            <span>共 {templates.length} 张 · 点击可放大</span>
          </div>
          <div className="preview-template-grid">
            {templates.map((template, index) => (
              <button type="button" key={template.key} onClick={() => openLightbox(index)}>
                <span className="preview-grid-image">
                  <img
                    src={`${template.url}&w=720`}
                    alt={`${template.title}照片墙效果`}
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <i aria-hidden="true">＋</i>
                </span>
                <strong>{template.title}</strong>
                <small>{index + 1} / {templates.length}</small>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="preview-stage" aria-label={`${currentStyle.title}${currentSize.label}照片墙效果预览`}>
            <div className="preview-stage-meta">
              <span>{currentSize.ratio}</span>
              <span>{templates.length > 1 ? `${activeTemplate + 1} / ${templates.length}` : "比例效果预览"}</span>
            </div>
            {loadingTemplates && <p className="preview-loading-indicator">正在同步最新模板…</p>}
            {templateError && <p className="preview-loading-indicator preview-error-indicator">{templateError}</p>}
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
                  <button
                    className="uploaded-wall-open"
                    type="button"
                    aria-label={`放大查看${currentTemplate.title}`}
                    onPointerDown={(event) => { mainSwipeStartX.current = event.clientX; }}
                    onPointerUp={(event) => finishMainSwipe(event.clientX)}
                    onPointerCancel={() => { mainSwipeStartX.current = null; }}
                    onClick={() => {
                      if (!suppressMainClick.current) openLightbox(activeTemplate);
                    }}
                  >
                    <img
                      key={currentTemplate.key}
                      src={currentTemplate.previewUrl || `${currentTemplate.url}&w=960`}
                      alt={`${currentTemplate.title}照片墙效果`}
                      draggable={false}
                      decoding="async"
                      fetchPriority="high"
                      onLoad={() => setMainImageLoaded(true)}
                    />
                    <span className="preview-zoom-hint" aria-hidden="true">＋ 放大</span>
                  </button>
                  <figcaption>{currentTemplate.title}</figcaption>
                </figure>
              )}
              {templates.length > 1 && (
                <>
                  <button className="preview-carousel-arrow is-previous" type="button" onClick={() => moveTemplate(-1)} aria-label="上一张模板">‹</button>
                  <button className="preview-carousel-arrow is-next" type="button" onClick={() => moveTemplate(1)} aria-label="下一张模板">›</button>
                </>
              )}
            </div>
            {templates.length > 1 && <p className="preview-swipe-hint">左右滑动切换 · 点击图片放大</p>}
            <div className="preview-scale-line"><i /><span>{currentSize.label}</span><i /></div>
          </section>

          {templates.length > 1 && (
            <section className="uploaded-template-picker" aria-label="选择其他模板">
              <div className="uploaded-template-heading"><span>快速切换</span><small>{activeTemplate + 1} / {templates.length}</small></div>
              <div className="uploaded-template-list">
                {templates.map((template, index) => (
                  <button
                    type="button"
                    key={template.key}
                    aria-pressed={activeTemplate === index}
                    onPointerEnter={() => preloadTemplate(index)}
                    onPointerDown={() => preloadTemplate(index)}
                    onClick={() => selectTemplate(index)}
                  >
                    <img src={template.thumbnailUrl || `${template.url}&w=320`} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                    <span>{template.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="preview-footer">
        <p>当前为长度比例效果示意</p>
        <span>实际画面将根据现场高度、安装位置与照片数量进一步调整</span>
        <button className="preview-return-button" type="button" onClick={goBack}>返回选择其他尺寸</button>
      </footer>

      {lightboxTemplate && lightboxIndex !== null && (
        <div className="template-lightbox" role="dialog" aria-modal="true" aria-label={`${lightboxTemplate.title}大图预览`}>
          <header className="template-lightbox-header">
            <div><strong>{lightboxTemplate.title}</strong><small>{lightboxIndex + 1} / {templates.length}</small></div>
            <button type="button" onClick={() => setLightboxIndex(null)} aria-label="关闭大图">×</button>
          </header>
          <div className="template-lightbox-tools" role="group" aria-label="图片缩放">
            <button type="button" disabled={zoom <= 1} onClick={() => setZoom((current) => Math.max(1, current - 0.5))} aria-label="缩小图片">−</button>
            <button type="button" onClick={() => setZoom(1)} aria-label="恢复原始大小">{Math.round(zoom * 100)}%</button>
            <button type="button" disabled={zoom >= 3} onClick={() => setZoom((current) => Math.min(3, current + 0.5))} aria-label="放大图片">＋</button>
          </div>
          <div
            className="template-lightbox-viewport"
            onPointerDown={(event) => { if (zoom === 1) lightboxSwipeStartX.current = event.clientX; }}
            onPointerUp={(event) => finishLightboxSwipe(event.clientX)}
            onPointerCancel={() => { lightboxSwipeStartX.current = null; }}
          >
            <img
              src={`${lightboxTemplate.url}&w=2400`}
              alt={`${lightboxTemplate.title}大图`}
              draggable={false}
              style={{ width: `${zoom * 100}%` }}
              onDoubleClick={() => setZoom((current) => current > 1 ? 1 : 2)}
            />
          </div>
          {templates.length > 1 && (
            <>
              <button className="template-lightbox-arrow is-previous" type="button" onClick={() => moveLightbox(-1)} aria-label="上一张大图">‹</button>
              <button className="template-lightbox-arrow is-next" type="button" onClick={() => moveLightbox(1)} aria-label="下一张大图">›</button>
            </>
          )}
          <p className="template-lightbox-help">双击或使用按钮放大 · 100% 时可左右滑动</p>
        </div>
      )}
    </main>
  );
}
