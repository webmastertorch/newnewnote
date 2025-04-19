# AI会议记录系统

基于Lark和OpenAI的实时会议记录系统，可实现多人说话内容识别、自动生成会议纪要文档。

## 主要功能

- Lark快速登录（无需扫码）
- 实时语音转文字
- 多说话人识别
- 自动生成会议纪要
- 文档直接保存到Lark云文档
- 历史记录查看

## 技术栈

- 前端: React + TypeScript + Vite + Zustand + Antd Mobile
- 后端: Node.js + Fastify
- API: Lark开放平台 API + OpenAI API

## 开发指南

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务

```bash
npm start
```

## 部署指南

### Railway部署

1. 在Railway上创建新项目
2. 连接GitHub仓库
3. 设置环境变量:
   - `LARK_APP_ID` - Lark App ID
   - `LARK_APP_SECRET` - Lark App Secret
   - `OPENAI_API_KEY` - OpenAI API密钥
   - `ROOT_FOLDER_TOKEN` - 根文件夹Token（可选）
4. 配置自定义域名

### Lark开放平台配置

1. 创建企业自建应用
2. 配置应用权限:
   - 获取用户基本信息: `contact:user.base`
   - 云文档权限: `drive:file`, `drive:file.create`, `drive:file.update`, `drive:file.read`
3. 应用发布 > 版本管理与发布 > 创建版本并申请发布
4. 在安全设置中添加重定向URL: `https://您的域名/login`

## 许可证

MIT 