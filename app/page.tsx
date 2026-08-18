import HeroVideo from "./HeroVideo";

const templates = [
  {
    index: "01",
    title: "红底排版",
    description: "浓郁酒红与细腻金色相遇，喜庆大方，但不失现代质感。",
    className: "traditional",
  },
];

const sizeOptions = [
  { id: "compact", label: "3–5米长" },
  { id: "medium", label: "6–9米长" },
  { id: "large", label: "10–15米长" },
  { id: "panorama", label: "16–22米长" },
] as const;

const processSteps = [
  ["发送尺寸", "提供照片墙实际尺寸、安装位置与制作要求。"],
  ["选择风格", "选中喜欢的模板，也可发送你的参考方案。"],
  ["发送照片", "提交新人照片、姓名、婚期与想写下的话。"],
  ["设计定稿", "一对一完成排版，根据反馈修改并确认细节。"],
  ["交付打印", "交付高清文件，或根据需求安排成品打印。"],
];

export default function Home() {
  return (
    <main>
      <link
        rel="preload"
        as="image"
        href="/images/wedding-photo-wall-hero-optimized.webp"
        type="image/webp"
        fetchPriority="high"
      />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="匠心设计首页">
          <span className="brand-name">匠心设计 <small>ARTISAN DESIGN</small></span>
        </a>
        <div className="header-actions">
          <details className="mobile-menu">
            <summary aria-label="打开导航菜单"><span /><span /></summary>
            <nav aria-label="手机导航">
              <a href="#top"><small>01</small> 首页</a>
              <a href="#templates"><small>02</small> 模板分类</a>
              <a href="#process"><small>03</small> 设计流程</a>
              <a href="#contact"><small>04</small> 服务信息</a>
              <a href="/admin"><small>05</small> 模板管理</a>
            </nav>
          </details>
        </div>
      </header>

      <section className="hero" id="top">
        <HeroVideo />
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-content page-shell">
          <h1>匠心照片墙设计</h1>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="#templates">浏览照片墙模板 <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <section className="template-section" id="templates">
        <div className="page-shell">
          <div className="section-heading heading-row">
            <div>
              <div className="eyebrow eyebrow-dark"><span /> SELECT YOUR STYLE</div>
              <h2>照片墙模板分类</h2>
            </div>
            <p>选择喜欢的模板风格，<br />也可以根据婚礼主题色与新人照片专属调整。</p>
          </div>

          <div className="template-grid">
            {templates.map((template) => (
              <article className="template-card" key={template.title}>
                <header className="template-card-heading">
                  <span>STYLE {template.index}</span>
                  <h3>{template.title}</h3>
                  <p>{template.description}</p>
                </header>
                <div className={`template-preview preview-${template.className}`}>
                  <div className="poster-canvas">
                    <div className="poster-photo photo-main" />
                    <div className="poster-photo photo-small" />
                    <div className="poster-decor decor-one" />
                    <div className="poster-decor decor-two" />
                    <span className="poster-caption">我们的婚礼</span>
                  </div>
                  <div className="size-selector">
                    <span className="size-selector-label">选择照片墙长度</span>
                    <div className="size-options" aria-label={`${template.title}照片墙长度`}>
                      {sizeOptions.map((option) => (
                        <a
                          className="size-option"
                          href={`/preview?style=${template.className}&size=${option.id}`}
                          key={option.id}
                          aria-label={`预览${template.title}${option.label}效果`}
                        >
                          {option.label}<small>点击预览</small>
                        </a>
                      ))}
                    </div>
                  </div>
                  <span className="preview-label">CHOOSE SIZE TO PREVIEW</span>
                </div>
              </article>
            ))}
          </div>

          <div className="more-templates">
            <p><span aria-hidden="true">✶</span> 更多模板可根据婚礼主题色与尺寸进行专属调整。</p>
            <a className="text-link" href="#process">查看设计流程 <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="process-section" id="process">
        <div className="process-glow" aria-hidden="true" />
        <div className="page-shell">
          <div className="section-heading process-heading">
            <div className="eyebrow"><span /> SIMPLE FIVE STEPS</div>
            <h2>设计流程</h2>
            <p>简单五步，完成专属婚礼照片墙设计</p>
          </div>
          <div className="process-list">
            {processSteps.map(([title, copy], index) => (
              <article className="process-step" key={title}>
                <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                <div className={`step-icon step-icon-${index + 1}`} aria-hidden="true"><i /></div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer" id="contact">
        <div className="page-shell footer-inner">
          <a className="brand brand-footer" href="#top">
            <span className="brand-name">匠心设计 <small>ARTISAN DESIGN</small></span>
          </a>
          <p>婚礼照片墙设计与打印服务</p>
          <div className="footer-contact">
            <span>照片排版 · 高清出图 · 打印交付</span>
            <span>服务时间：09:00–22:00</span>
          </div>
          <a className="footer-admin-link" href="/admin">进入模板管理后台 →</a>
          <p className="copyright">© 2026 匠心设计</p>
          <a className="back-top" href="#top" aria-label="返回顶部">↑</a>
        </div>
      </footer>
    </main>
  );
}
