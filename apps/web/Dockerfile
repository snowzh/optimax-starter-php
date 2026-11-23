# syntax=docker/dockerfile:1
# --------------------------------------------------------------------------
# apps/web 多阶段镜像（Ant Design Pro → 纯静态 + nginx）
# 契约：基础镜像锁版本禁 latest；产物镜像内禁止 node_modules / .env / 源码
# --------------------------------------------------------------------------

# ---------- 构建期：pnpm 安装 + UmiJS 生产构建 ----------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm 全局安装（与仓库 pnpm 工具链一致）
RUN npm install -g pnpm@12

# 依赖层（最大化缓存命中）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 源码 + 构建
COPY . .
RUN pnpm exec max setup \
    && pnpm build

# ---------- 运行时：nginx + 纯静态产物 ----------
FROM nginx:1.28-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
