import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import apiRouter from './src/server/api.ts';
import { errorHandler } from './src/server/middleware.ts';

const execAsync = util.promisify(exec);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Dev server must run on port 3000 as per AI Studio environment constraints
  let port = 3000;
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    port = parseInt(process.argv[portArgIdx + 1], 10);
  } else if (process.env.APP_PORT) {
    port = parseInt(process.env.APP_PORT, 10);
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    port = parseInt(process.env.PORT, 10);
  }

  // Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ۱. بررسی آنلاین به‌روزرسانی‌ها از مخزن گیت‌هاب
  app.post('/api/system/check-updates', async (_req, res) => {
    try {
      try {
        await execAsync('git rev-parse --is-inside-work-tree', { cwd: __dirname });
      } catch {
        return res.json({
          success: false,
          hasUpdates: false,
          behindCount: 0,
          commits: [],
          message: 'پروژه به مخزن گیت‌هاب متصل نیست یا پوشه .git یافت نشد.',
        });
      }

      let branch = 'main';
      try {
        await execAsync('git fetch origin main', { cwd: __dirname });
      } catch (err: any) {
        try {
          await execAsync('git fetch origin master', { cwd: __dirname });
          branch = 'master';
        } catch (fetchErr: any) {
          return res.status(500).json({
            success: false,
            hasUpdates: false,
            behindCount: 0,
            commits: [],
            message: `خطا در ارتباط با مخزن گیت‌هاب: ${fetchErr.message || err.message}`,
          });
        }
      }

      const { stdout: countOut } = await execAsync(`git rev-list --count HEAD..origin/${branch}`, { cwd: __dirname });
      const behindCount = parseInt(countOut.trim(), 10) || 0;

      let commits: string[] = [];
      if (behindCount > 0) {
        const { stdout: logOut } = await execAsync(`git log HEAD..origin/${branch} --oneline -n 15`, { cwd: __dirname });
        commits = logOut.trim().split('\n').filter(Boolean);
      }

      return res.json({
        success: true,
        hasUpdates: behindCount > 0,
        behindCount,
        commits,
        branch,
        message: behindCount > 0
          ? `${behindCount} به‌روزرسانی جدید در گیت‌هاب موجود است.`
          : 'سیستم شما کاملاً به‌روز است.',
      });
    } catch (error: any) {
      console.error('Error in check-updates:', error);
      res.status(500).json({
        success: false,
        hasUpdates: false,
        behindCount: 0,
        commits: [],
        message: `خطا در بررسی به‌روزرسانی: ${error.message}`,
      });
    }
  });

  // ۲. اجرای خودکار به‌روزرسانی، پشتیبان‌گیری، بیلد مجدد و راه‌اندازی سرور
  app.post('/api/system/trigger-update', async (_req, res) => {
    try {
      console.log('🔄 شروع فرآیند به‌روزرسانی آنلاین نرم‌افزار حسابداری سپهر...');

      // پشتیبان‌گیری اضطراری از فایل دیتابیس در پوشه backups
      const backupsDir = path.resolve(__dirname, 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      let backupCreated = false;
      const dbPaths = [
        path.resolve(__dirname, 'data', 'database.json'),
        path.resolve(__dirname, 'data', 'kharrazi_data.json'),
      ];

      for (const dbFile of dbPaths) {
        if (fs.existsSync(dbFile)) {
          const dest = path.resolve(backupsDir, `db_backup_${timestamp}_${path.basename(dbFile)}`);
          fs.copyFileSync(dbFile, dest);
          console.log(`📦 نسخه پشتیبان از دیتابیس در ${dest} ذخیره شد.`);
          backupCreated = true;
        }
      }

      // دریافت تغییرات از گیت‌هاب
      console.log('📥 دریافت تغییرات جدید از گیت‌هاب...');
      try {
        await execAsync('git pull origin main', { cwd: __dirname });
      } catch (pullErr: any) {
        console.warn('تلاش برای git fetch و git reset --hard origin/main...', pullErr.message);
        try {
          await execAsync('git fetch origin main && git reset --hard origin/main', { cwd: __dirname });
        } catch {
          try {
            await execAsync('git pull origin master', { cwd: __dirname });
          } catch {
            await execAsync('git fetch origin master && git reset --hard origin/master', { cwd: __dirname });
          }
        }
      }

      // بررسی و نصب وابستگی‌ها
      console.log('🔨 نصب وابستگی‌ها و پکیج‌های جدید...');
      await execAsync('npm install --legacy-peer-deps --no-audit', { cwd: __dirname });

      // بیلد مجدد برنامه
      console.log('🏗️ بیلد مجدد نرم‌افزار حسابداری سپهر...');
      await execAsync('npm run build', { cwd: __dirname });

      // ارسال پاسخ موفقیت به کلاینت
      res.json({
        success: true,
        backupCreated,
        message: 'به‌روزرسانی با موفقیت دریافت و بیلد شد. سرور در حال راه‌اندازی مجدد است...',
      });

      // خروج از پروسه با کد 0 بعد از ۲ ثانیه تا حلقه start_server.bat سرور را مجدداً بالا بیاورد
      console.log('🚀 راه‌اندازی مجدد خودکار سرور در ۲ ثانیه آینده...');
      setTimeout(() => {
        console.log('🛑 بستن پروسه با کد 0 جهت اجرای مجدد خودکار...');
        process.exit(0);
      }, 2000);
    } catch (error: any) {
      console.error('❌ خطا در فرآیند به‌روزرسانی آنلاین:', error);
      res.status(500).json({
        success: false,
        message: `خطا در اجرای به‌روزرسانی آنلاین: ${error.message}`,
      });
    }
  });

  // Mount API endpoints
  app.use('/api', apiRouter);
  app.use(errorHandler);

  // In development, hook up Vite dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ نرم‌افزار حسابداری سپهر بر روی پورت ${port} فعال شد: http://localhost:${port}`);
  });

  server.on('error', (err: any) => {
    console.error(`خطای سرور بر روی پورت ${port}:`, err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
