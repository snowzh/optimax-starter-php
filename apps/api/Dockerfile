# syntax=docker/dockerfile:1
# --------------------------------------------------------------------------
# apps/api 多阶段镜像（Laravel + php-fpm + nginx）
# 契约：基础镜像锁版本禁 latest；镜像内禁止 .env / 冗余 dev 依赖
# 环境变量全部经 compose environment/env_file 注入（密钥不入库不入镜像）
# --------------------------------------------------------------------------

# ---------- 构建期：composer 依赖解析（独立层，最大化缓存命中） ----------
FROM composer:2.8 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --no-interaction \
    --prefer-dist

# ---------- 运行时：php-fpm + nginx（supervisord 单容器托管） ----------
FROM php:8.4-fpm-alpine AS app

# 运行依赖：nginx、supervisor、postgresql 客户端工具（pg_isready 健康检查）
# postgresql-dev 提供 libpq 头文件供 docker-php-ext-install pdo_pgsql 编译
RUN apk add --no-cache \
        nginx \
        supervisor \
        postgresql-client \
        postgresql-dev \
        icu-data-full \
    && docker-php-ext-install pdo_pgsql opcache \
    && apk del --no-cache postgresql-dev \
    && rm -rf /tmp/*

# 应用代码 + 已装好的 prod vendor
WORKDIR /var/www
COPY --from=vendor /usr/bin/composer /usr/local/bin/composer
COPY --from=vendor /app/vendor ./vendor
COPY . .
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# 优化自动加载（不含 dev；entrypoint 运行时完成权限与迁移）
RUN composer dump-autoload --optimize --no-dev \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p storage/framework/{cache/data,sessions,views,testing} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chown -R www-data:www-data /var/www/vendor

EXPOSE 8080

ENTRYPOINT ["entrypoint.sh"]
