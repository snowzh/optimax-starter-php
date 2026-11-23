#!/bin/sh
# apps/api 容器入口：目录权限就绪 + 按需执行迁移，随后拉起 supervisord
set -e

cd /var/www

# 确保 Laravel 可写目录存在并归属 www-data
mkdir -p \
    storage/framework/cache/data \
    storage/framework/cache/locks \
    storage/framework/sessions \
    storage/framework/views \
    storage/framework/testing \
    storage/logs \
    storage/app/private \
    storage/app/public \
    bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

# 缓存清理由镜像构建预热；运行时按需迁移/播种（compose 注入开关）
# 说明：生产首启须手动执行一次 db:seed --force（幂等，种子含超管账号）；
# 日常重启不开 SEED_ON_START，避免重置线上角色矩阵
if [ "$MIGRATE_ON_START" = "true" ]; then
    echo "Running database migrations..."
    php artisan migrate --force
fi

if [ "$SEED_ON_START" = "true" ]; then
    echo "Seeding database..."
    php artisan db:seed --force
fi

exec supervisord -c /etc/supervisord.conf
