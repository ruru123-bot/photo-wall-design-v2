# Cloudflare Workers 部署说明

这个仓库的根目录就是需要提交到 GitHub 的完整项目。不要单独上传 `build`、`dist`、`public` 或 `node_modules`。

模板图片已经改为存放在 Cloudinary，不再需要开通 Cloudflare R2，也不需要绑定数据库。

## 第一次部署前

1. 注册 Cloudinary 免费账号，在控制台的 **Settings → API Keys** 中找到：
   - Cloud name
   - API key
   - API secret
2. 将 GitHub 仓库连接到 Cloudflare Workers，项目根目录保持为 `/`。
3. 构建命令填写：`npm run build`。
4. 部署命令填写：`npm run deploy:cloudflare`。
5. 在 Worker 的“设置 → 变量和机密”中添加以下五项：
   - `ADMIN_USERNAME`：模板后台账号。
   - `ADMIN_PASSWORD`：模板后台密码，选择“加密”。
   - `CLOUDINARY_CLOUD_NAME`：Cloudinary 的 Cloud name。
   - `CLOUDINARY_API_KEY`：Cloudinary 的 API key，选择“加密”。
   - `CLOUDINARY_API_SECRET`：Cloudinary 的 API secret，选择“加密”。
6. 保存变量后重新部署一次。

不要把真实密码、API key 或 API secret 写进 GitHub 文件。项目中的 `.env.example` 只列出变量名称，不保存任何真实值。

## 部署完成后的地址

- 网站首页：`/`
- 尺寸模板预览：`/preview`
- 模板管理后台：`/admin`

打开 `/admin` 时，浏览器会弹出管理员账号密码窗口。后台上传的图片保存在 Cloudinary 中，重新构建或重新部署网站不会丢失。
