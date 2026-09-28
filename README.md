# 数智课堂

数智课堂是一个多智能体驱动的 3D 互动教学系统，支持 3D 教具展示、手势与语音控制、课堂测验和 AI 助教。

## 界面预览

### 产品首页

![数智课堂产品首页](docs/images/readme-landing.png)

### 3D 互动课堂

![数智课堂 3D 互动课堂](docs/images/readme-classroom.png)

## 环境要求

- Node.js 20 LTS 或 22+
- npm
- MySQL
- 最新版 Chrome 或 Edge（语音识别使用浏览器 Web Speech API）

## 快速开始

```bash
npm ci
cp .env.example .env.local
```

编辑 `.env.local`，配置 MySQL 连接、`JWT_SECRET`、初始管理员账号，以及按需启用的 DeepSeek、3D 生成等 AI 服务。

```bash
npm run dev
```

### Windows 本地一键部署

本仓库已集成教案、PPT、素材和 Blender/GLB 生成服务。在当前开发机上运行：

```powershell
& 'D:\jjr\.venv\Scripts\python.exe' 'D:\jjr\shuzhi-class\scripts\start_local.py'
```

启动器会在 `.local/mysql-data` 初始化隔离 MySQL，不修改系统已有数据库，并同时启动：

- Web：`http://127.0.0.1:3000`
- 主 API：`http://127.0.0.1:4000`
- 备课生成服务：`http://127.0.0.1:8765`
- 隔离 MySQL：`127.0.0.1:3307`

首次启动会创建本地管理员 `admin`，初始密码为 `admin123456`。登录后从 3D 课堂顶部进入“备课与课件”，可以生成中小学或本科生物医学教案、逐页 PPT 预览、PPTX、单图/五视角模型、GLB 和 Blender 工程。

启动后访问：

- Web：<http://localhost:3000>
- API：<http://localhost:4000>

首次启动时，服务端会自动创建数据库、数据表和初始管理员。请确保配置的 MySQL 用户具有建库权限。

## 常用命令

```bash
npm run dev            # 同时启动 Web 与 API
npm run build          # 构建前端
npm run preview        # 预览前端构建产物
npm run test:voice     # 语音与交互服务测试
npm run test:resource  # 资源库测试
npm run test:memory    # 学习记忆测试
```

语音识别直接使用浏览器 Web Speech API，无需下载本地模型。浏览器实现可能依赖厂商的在线识别服务，不保证离线可用。
