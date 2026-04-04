# 睡眠管理类小程序（Next.js）

基于 [Next.js](https://nextjs.org)（App Router）+ TypeScript + Tailwind CSS + ESLint 的前端工程。

## 环境要求

- Node.js 18.18+（建议使用当前 LTS）
- npm（本仓库以 npm 为包管理器）

## 安装依赖

```bash
npm install
```

## 启动方式

### 本地开发

```bash
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。修改 `src/app` 下文件会热更新。

### 生产构建与运行

```bash
npm run build
npm run start
```

`start` 会先完成构建产物后再启动（需先执行 `build`）。

### 代码检查

```bash
npm run lint
```

## 项目结构说明

应用源码位于 `src/`（含 `src/app` App Router）。静态资源在 `public/`。

更多 Next.js 文档见 [Next.js Documentation](https://nextjs.org/docs)。
