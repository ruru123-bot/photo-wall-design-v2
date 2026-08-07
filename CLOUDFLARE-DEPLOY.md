# Cloudflare Workers 部署说明

这个仓库的根目录就是需要提交到 GitHub 的完整项目。不要单独上传 `build`、`dist`、`public` 或 `node_modules`。

## 第一次部署前

1. 在 Cloudflare 的 R2 对象存储中创建存储桶：`photo-wall-design-media`。
2. 将 GitHub 仓库连接到 Workers，项目根目录保持为 `/`。
3. 构建命令填写：`npm run build`。
4. 部署命令填写：`npm run deploy:cloudflare`。
5. 在 Worker 的“变量和机密”中添加：
   - `ADMIN_USERNAME`：模板后台账号。
   - `ADMIN_PASSWORD`：模板后台密码，保存为加密机密。

部署完成后：

- 网站首页：`/`
- 尺寸模板预览：`/preview`
- 模板管理后台：`/admin`

打开 `/admin` 时，浏览器会弹出账号密码窗口。后台上传的图片保存在 R2 存储桶中，重新部署网站不会丢失。
