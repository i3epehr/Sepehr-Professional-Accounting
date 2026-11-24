@echo off
chcp 65001 > nul
echo ====================================================
echo     دریافت و نصب خودکار آپدیت جدید حسابداری سپهر
echo ====================================================

:: ۱. بک‌آپ اضطراری
if not exist "backups" mkdir backups
if exist "data\database.json" (
    echo [1/4] پشتیبان‌گیری از دیتابیس فعلی...
    copy /Y "data\database.json" "backups\db_backup_%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.bak" > nul
    echo دیتابیس فعلی با موفقیت ذخیره شد.
)
if exist "data\kharrazi_data.json" (
    echo [1/4] پشتیبان‌گیری از دیتابیس فعلی...
    copy /Y "data\kharrazi_data.json" "backups\db_backup_%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.bak" > nul
    echo دیتابیس فعلی با موفقیت ذخیره شد.
)

:: ۲. گیت پول
echo.
echo [2/4] دریافت تغییرات جدید از گیت‌هاب...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo خطا در اتصال یا دریافت از گیت‌هاب!
    pause
    exit /b %ERRORLEVEL%
)

:: ۳. نصب پکیج‌ها
echo.
echo [3/4] بررسی و نصب وابستگی‌ها...
call npm install --legacy-peer-deps --no-audit

:: ۴. بیلد مجدد
echo.
echo [4/4] بیلد برنامه...
call npm run build

echo.
echo ====================================================
echo    آپدیت با موفقیت نصب شد و دیتابیس حفظ گردید!
echo ====================================================
pause
