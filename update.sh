#!/bin/bash
set -e

echo "===================================================="
echo "🚀 شروع فرآیند به‌روزرسانی نرم‌افزار حسابداری سپهر"
echo "===================================================="

# ۱. تهیه نسخه پشتیبان اضطراری از داده‌های دیتابیس و اطلاعات مشتری
echo "📦 ۱. پشتیبان‌گیری خودکار از پایگاه داده و تنظیمات..."
mkdir -p data/backups
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f data/kharrazi_data.json ]; then
  cp data/kharrazi_data.json "data/backups/data_before_update_${BACKUP_TIMESTAMP}.json"
  echo "✅ نسخه پشتیبان با نام data_before_update_${BACKUP_TIMESTAMP}.json ذخیره شد."
fi

# ۲. دریافت آخرین تغییرات و کدهای جدید از گیت‌هاب بدون حذف داده‌های محلی
echo "📥 ۲. دریافت آخرین تغییرات از مخزن گیت‌هاب..."
git stash || true
git pull origin main || git pull origin master || true
git stash pop || true

# ۳. نصب وابستگی‌های جدید و بیلد پروداکشن
echo "🔨 ۳. بررسی وابستگی‌ها و بیلد نرم‌افزار..."
npm install --legacy-peer-deps
npm run build

# ۴. بارگذاری مجدد برنامه از طریق PM2 در پس‌زمینه بدون پنجره سیاه
echo "🔄 ۴. اعمال نسخه جدید در PM2 به صورت بی‌صدا..."
if command -v pm2 &> /dev/null; then
  pm2 reload ecosystem.config.cjs || pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
  echo "✅ نرم‌افزار در پس‌زمینه با موفقیت ری‌استارت شد."
elif [ -f node_modules/.bin/pm2 ]; then
  ./node_modules/.bin/pm2 reload ecosystem.config.cjs || ./node_modules/.bin/pm2 start ecosystem.config.cjs
  echo "✅ نرم‌افزار با PM2 محلی به‌روزرسانی شد."
else
  echo "ℹ️ PM2 نصب نیست. برنامه با موفقیت بیلد شد و آماده اجراست."
fi

echo "===================================================="
echo "🎉 به‌روزرسانی نرم‌افزار سپهر با موفقیت به پایان رسید!"
echo "===================================================="
