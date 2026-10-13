# 数智课堂项目交接

更新日期：2026-10-03

## 先读这里

- 仓库：`D:\jjr\shuzhi-class`，Windows / PowerShell。
- 当前分支：`main`，相对 `origin/main` ahead 2；`pre-anatomical-heart-20260930` 是此前创建的存档标签。
- **工作区有大量未提交及未跟踪文件。** 新会话开始时先运行 `git status --short --branch` 和 `git diff --stat`，阅读后再改动。不要 reset、checkout、clean，也不要覆盖或删除这些文件。
- 当前 `HEAD` 仍指向 `pre-anatomical-heart-20260930` 存档提交；本科七步教案、课堂工作区融合、本地千问及互动课件等后续代码主要还在工作区，不能只从最近提交判断项目进度。
- 不要把 `.env.local`、SF3D API Key、JWT secret、用户模型或上传图片复制进交接内容、提交或对话。配置变量名见 `.env.example`。

## 当前项目进度

### 已有实现入口

- 主课堂、备课工作区及课程应用：`Dashboard.tsx`、`prep/IntegratedPrepStudio.tsx`、`prep/PrepStudio.tsx`。
- 本科生物医学七步教案设计及校验：`teacher-studio-service/backend/lesson_design.py`、`prep/UndergraduateDesignWorkflow.tsx`。
- 本地 Ollama 文案增强默认模型为 `qwen3:4b`：`teacher-studio-service/backend/ollama_adapter.py`。模型不可用或结构化输出校验失败时会回退到内置模板；界面应保留实际生成来源提示。
- 课前五道预热题生成、单题重做和编辑：`teacher-studio-service/backend/server.py`、`prep/PrepStudio.tsx`、`services/quizData.ts`。
- SF3D 图生模型端点与工作区：`teacher-studio-service/backend/server.py`、`components/IntegratedModelingStudio.tsx`。前端应明确显示实际生成状态，不能用内置示例模型冒充上传图生成结果。
- 手势控制与测验：`components/HandController.tsx`、`components/QuizOverlay.tsx`、`Dashboard.tsx`。此前约定是左手缩放、右手旋转/拖动；切换到课堂答题复用摄像头。
- 互动课件数据类型、故事板、课堂运行时及导出：`types/courseware.ts`、`prep/CoursewareStoryboard.tsx`、`components/InteractiveCourseware.tsx`、`teacher-studio-service/backend/courseware.py`。

### 课件现状与下一步

- 当前心脏标杆课由 `courseware.py` 的确定性模板生成约 12 个场景；故事板提供场景编辑和布局选择，课堂端保留 Three.js 模型、分步血流等交互。
- 当前仍有视觉与内容质量问题：运行时不少非模型场景使用通用图形占位，场景叙事和视觉层次不足；PPTX 由独立绘制逻辑生成，尚未达到用户要求的精致程度。
- 已讨论的升级方向：固定场景组件库按教学意图布置；深色医学风；本课 GLB 渲染图配合结构化图表；本地千问按场景增强、内容以审核通过的教案为准；教师可编辑、换布局；互动留在 HTML，PPTX 同步视觉并逐页验收基础动画。
- **审美预览尚未生成。** 用户要求先看几组图再定方向。当前会话没有可调用的 Image 2.5 工具；不要声称图片已生成，也不要未经明确同意改用需要 `OPENAI_API_KEY` 的 CLI 生成方式。

## 本地启动

### 一键启动

在 PowerShell 执行：

```powershell
& 'D:\jjr\.venv\Scripts\python.exe' 'D:\jjr\shuzhi-class\scripts\start_local.py'
```

启动器按需准备本地隔离 MySQL（端口 `3307`），并启动 Node API、Vite；Node 服务按配置自动启动/连接备课服务。保持窗口运行，访问 `http://127.0.0.1:3000/`。端口：Web `3000`、Node API `4000`、备课服务 `8765`。

### 手动三窗口启动

窗口 1：备课 Python 服务（工作目录 `D:\jjr\shuzhi-class\teacher-studio-service\backend`）：

```powershell
Set-Location D:\jjr\shuzhi-class\teacher-studio-service\backend
& 'D:\jjr\.venv\Scripts\python.exe' server.py
```

窗口 2：Vite（工作目录 `D:\jjr\shuzhi-class`）：

```powershell
Set-Location D:\jjr\shuzhi-class
& 'C:\Program Files\nodejs\node.exe' node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000 --strictPort
```

窗口 3：Node API（工作目录 `D:\jjr\shuzhi-class`）：

```powershell
Set-Location D:\jjr\shuzhi-class
& 'C:\Program Files\nodejs\node.exe' server/index.js
```

用户此前提供的终端截图显示上述三个服务均成功监听。Node 服务也会探测/自动启动 `8765`；如果窗口 1 已运行，Node 日志连接已有服务是正常现象，不要再重复启动同一端口的 Python 服务。手动方式需要数据库已运行并且本地 `.env.local` 已配置。

检查地址：

```text
http://127.0.0.1:3000/
http://127.0.0.1:4000/api/health
http://127.0.0.1:8765/api/local-model/status
```

如需本地千问增强，确认 Ollama 服务运行且 `qwen3:4b` 已安装。页面显示“本地模板回退”时，表示模型调用不可用或模型结果没有通过结构校验，不代表千问成功生成。

## 主要接口与数据流

备课服务内部路由（由 Node API 代理到 `8765`）：

```text
POST /api/lesson-design/generate-draft
POST /api/lesson-design/generate-step
POST /api/lesson-design/edit-step
POST /api/lesson-design/sync-downstream
POST /api/lesson-design/validate
POST /api/warmup/generate
POST /api/warmup/regenerate-question
POST /api/courseware/generate
POST /api/courseware/regenerate-scene
POST /api/courseware/export-pptx
POST /api/courseware/export-zip
POST /api/3d/generate-image
POST /api/3d/generate-multiview-model
```

浏览器正常使用 Node 暴露的 `/api/prep/...` 与 `/api/courseware/:lessonId/...` 路由。典型数据流：教案及模型/题目生成 `CoursewareManifest` → 教师编辑故事板 → 导出 PPTX 或离线 ZIP → 应用到课堂时由 `Dashboard.applyLessonToClassroom` 接收教案、模型地址、预热题和互动课件。修改接口前同时检查前端调用、Node 代理和 Python 路由，保持三处字段一致。

## 验证清单

在当前工作树上重新运行；旧会话曾报告部分 Python、TypeScript 和生产构建通过，但这些记录**不等于当前快照已验证**。

```powershell
Set-Location D:\jjr\shuzhi-class
npx tsc --noEmit
npm run build
```

```powershell
Set-Location D:\jjr\shuzhi-class\teacher-studio-service\backend
& 'D:\jjr\.venv\Scripts\python.exe' -m unittest test_lesson_design.py
```

检查完毕后再次查看 `git status --short --branch`；不要为交接而提交或清理工作区。涉及 PPTX 时检查每页动画结果；涉及模型时确认返回模型 URL 是本次 SF3D 任务的产物，而非示例资产。
