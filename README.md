# PersonalOS V2

PersonalOS 是一个本地优先的个人执行与 AI 协作工作台。V2 保留 V1
的 React、TypeScript、Vite 和视觉体系，并新增课程表、首页执行、成果文件、
统一信息库、周期复盘导出和真实 AI 服务代理。

## 本地运行

```powershell
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:4173/#/dashboard`。

## 数据与文件

- 结构化数据保存在浏览器 `localStorage`，存储键仍为
  `personal-os-data-v1`，由 V2 自动迁移；迁移前会创建
  `personal-os-data-v1-backup-<timestamp>` 备份。
- 图片与文件保存在浏览器 `IndexedDB` 的 `personal-os-files` 数据库，
  可本地预览和下载。
- 设置中的“导出 JSON”包含结构化数据，不包含 IndexedDB 文件二进制。
- 数据不会自动跨浏览器或跨设备同步。

### 云端文件存储方案

当前 GitHub Pages 版本不假装提供云端上传。若后续需要跨设备文件，
建议复用现有 `Evidence` 元数据，并接入 Supabase Storage：

- Storage bucket 使用私有权限。
- 每次上传使用用户身份和服务端签发的路径前缀。
- `Evidence.fileId` 替换为对象存储路径，保留 MIME、大小和校验值。
- 通过 RLS 限制用户只能访问自己的文件。
- 预览和下载使用短期签名 URL。

该云端方案尚未配置，因此当前状态是“本地文件已实现、云端同步待配置”。

## 真实 AI 配置

GitHub Pages 只能托管静态前端，不能在浏览器中安全保存模型 API Key。
项目包含一个可部署到 Vercel 的服务端代理：`api/ai.ts`。

1. 在 Vercel 导入本仓库。
2. 配置服务端环境变量：

```text
OPENAI_API_KEY=你的服务端密钥
OPENAI_MODEL=gpt-4.1-mini
ALLOWED_ORIGINS=http://127.0.0.1:4173,https://zy420018-spec.github.io
```

3. 部署后获得类似 `https://your-project.vercel.app/api/ai` 的地址。
4. 在 PersonalOS 的“个人设置”中填写该代理地址。
5. 明确开启“授权发送工作台上下文”。

没有服务端地址或密钥时，AI 对话保持禁用并明确显示“真实 AI 尚未配置”。
本地关键词检索仍可使用，但会标记为“非 AI”。

## 安全边界

- API Key 只读取服务端环境变量，前端代码和 GitHub 仓库中没有密钥。
- 仅允许 `ALLOWED_ORIGINS` 中的来源调用代理。
- AI 返回的写入操作只作为建议展示，用户确认后才创建对象。
- 当前只会执行“创建任务”这一项 AI 写操作；修改目标、项目、截止日期、
  优先级或大规模调整日程仍由用户手动操作。

## 部署

- 交互式前端：GitHub Pages，由 `.github/workflows/deploy-pages.yml` 构建。
- 真实 AI 代理：Vercel Serverless Function，配置方式和环境变量见上。

## 验证

```powershell
pnpm typecheck
pnpm build
```
