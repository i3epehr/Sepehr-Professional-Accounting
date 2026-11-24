import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  GitBranch,
  Trash2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  Play,
  Hash,
  Server,
  HardDrive,
  Activity,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { formatCurrency, toPersianDigits } from '../../lib/formatters.ts';
import { StandardModal } from '../common/StandardModal.tsx';
import { OnboardingWizardModal } from '../common/OnboardingWizardModal.tsx';
import { APP_VERSION } from '../../version.ts';

export const SystemMaintenanceModule: React.FC = () => {
  // Update state
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdates: boolean;
    behindCount: number;
    commits: string[];
    branch?: string;
  } | null>(null);

  // Backup & Restore state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isTestingCycle, setIsTestingCycle] = useState<boolean>(false);
  const [lastBackupMeta, setLastBackupMeta] = useState<any>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [cycleTestResult, setCycleTestResult] = useState<any>(null);
  const [backupStatusMessage, setBackupStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Factory Reset & Onboarding state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Online Update Handlers
  const handleCheckUpdates = async () => {
    try {
      setIsUpdating(true);
      setUpdateMsg('در حال اتصال به مخزن گیت‌هاب و بررسی نسخه‌های جدید...');
      const res = await api.checkUpdates();
      if (!res.success) {
        setUpdateMsg(res.message || 'خطا در بررسی به‌روزرسانی.');
        setUpdateInfo(null);
      } else if (res.hasUpdates) {
        setUpdateInfo({
          hasUpdates: true,
          behindCount: res.behindCount,
          commits: res.commits,
          branch: res.branch,
        });
        setUpdateMsg(`تعداد ${toPersianDigits(res.behindCount)} نسخه/کامیت جدید در گیت‌هاب یافت شد. جهت اعمال، دکمه «نصب به‌روزرسانی آنلاین» را بزنید.`);
      } else {
        setUpdateInfo({
          hasUpdates: false,
          behindCount: 0,
          commits: [],
          branch: res.branch,
        });
        setUpdateMsg(res.message || 'نرم‌افزار شما کاملاً به‌روز است و با آخرین نسخه مخزن همگام می‌باشد.');
      }
    } catch (e: any) {
      setUpdateMsg(`خطا در بررسی به‌روزرسانی: ${e.message}`);
      setUpdateInfo(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTriggerOnlineUpdate = async () => {
    try {
      setIsUpdating(true);
      setUpdateMsg('در حال تهیه نسخه پشتیبان اضطراری از دیتابیس، دریافت تغییرات از گیت‌هاب و بیلد برنامه... لطفاً شکیبا باشید.');
      const res = await api.triggerUpdate();
      if (res.success) {
        let count = 5;
        setUpdateMsg(`✅ ${res.message} صفحه تا ${toPersianDigits(count)} ثانیه دیگر به‌روزرسانی می‌شود...`);
        const timer = setInterval(() => {
          count -= 1;
          if (count > 0) {
            setUpdateMsg(`✅ به‌روزرسانی با موفقیت انجام شد و پایگاه داده حفظ گردید. صفحه تا ${toPersianDigits(count)} ثانیه دیگر رفرش می‌شود...`);
          } else {
            clearInterval(timer);
            window.location.reload();
          }
        }, 1000);
      } else {
        setUpdateMsg(`خطا: ${res.message}`);
        setIsUpdating(false);
      }
    } catch (e: any) {
      setUpdateMsg(`خطا در فرآیند به‌روزرسانی: ${e.message}`);
      setIsUpdating(false);
    }
  };

  // 2. Real Database Backup & Restore Handlers
  const handleDownloadRealBackup = async () => {
    try {
      setIsExporting(true);
      setBackupStatusMessage(null);
      const backupBundle = await api.exportDatabaseBackup();
      setLastBackupMeta({
        exportedAtShamsi: backupBundle.exportedAtShamsi,
        checksum: backupBundle.checksum,
        sizeBytes: backupBundle.sizeBytes,
        stats: backupBundle.stats,
      });

      const blob = new Blob([JSON.stringify(backupBundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sepehr_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStatusMessage({
        type: 'success',
        text: `پشتیبان کامل پایگاه داده با امضای دیجیتال SHA-256 (${backupBundle.checksum.slice(0, 12)}...) با موفقیت دانلود شد.`,
      });
    } catch (err: any) {
      setBackupStatusMessage({
        type: 'error',
        text: err.message || 'خطا در تهیه نسخه پشتیبان پایگاه داده',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      setBackupStatusMessage(null);
      const rawText = await file.text();
      const parsedBundle = JSON.parse(rawText);
      const res = await api.restoreDatabaseBackup(parsedBundle);
      setRestoreResult(res);
      setBackupStatusMessage({
        type: 'success',
        text: `بازیابی پایگاه داده با موفقیت انجام شد (${toPersianDigits(res.stats.vouchersCount)} سند حسابداری و ${toPersianDigits(res.stats.productsCount)} کالا بازنشانی شدند).`,
      });
    } catch (err: any) {
      setBackupStatusMessage({
        type: 'error',
        text: err.message || 'خطا در بازیابی فایل پشتیبان؛ ساختار یا امضای SHA-256 نامعتبر است.',
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRunBackupRestoreTest = async () => {
    try {
      setIsTestingCycle(true);
      setBackupStatusMessage(null);
      const res = await api.testBackupAndRestoreCycle();
      setCycleTestResult(res);
      setBackupStatusMessage({
        type: res.passed ? 'success' : 'error',
        text: res.passed
          ? 'آزمون ۴ مرحله‌ای پشتیبان‌گیری، تغییر داده، بازیابی اتمیک و کنترل SHA-256 با موفقیت ۱۰۰٪ انجام شد.'
          : 'در آزمون پشتیبان‌گیری و بازیابی خطایی مشاهده شد.',
      });
    } catch (err: any) {
      setBackupStatusMessage({
        type: 'error',
        text: err.message || 'خطا در اجرای آزمون پشتیبان‌گیری و بازیابی',
      });
    } finally {
      setIsTestingCycle(false);
    }
  };

  // 3. Factory Reset Handler
  const handleExecuteFactoryReset = async () => {
    try {
      setIsResetting(true);
      await api.factoryReset();
      setIsResetConfirmOpen(false);
      setIsOnboardingOpen(true);
      alert('نرم‌افزار با موفقیت صفر شد. اکنون می‌توانید اطلاعات مشتری را گام به گام وارد فرمایید.');
    } catch (err: any) {
      alert(`خطا در پاکسازی برنامه: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              پشتیبان‌گیری، بروزرسانی و نگهداری سیستم
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900/50">
              مدیریت داده‌ها و نگهداری
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            دانلود فایل پشتیبان کامل، بازیابی اطلاعات، بررسی و نصب به‌روزرسانی آنلاین و صفر کردن برنامه جهت تحویل به مشتری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>راه‌اندازی گام به گام (ویزارد)</span>
          </button>
        </div>
      </div>

      {/* 2. بخش اول: به‌روزرسانی آنلاین نرم‌افزار */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            <span>به‌روزرسانی آنلاین نرم‌افزار از گیت‌هاب (Online Auto-Update)</span>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
            v{APP_VERSION}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          با کلیک بر روی دکمه به‌روزرسانی، ابتدا نسخه پشتیبان اضطراری از پایگاه داده به صورت خودکار تهیه شده، سپس آخرین تغییرات و امکانات از گیت‌هاب دریافت و برنامه بازسازی می‌شود و سرور به صورت خودکار و بدون نیاز به بستن دستی (End Task) مجدداً بارگذاری می‌گردد.
        </p>

        {updateMsg && (
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div>{updateMsg}</div>
            {updateInfo && updateInfo.commits && updateInfo.commits.length > 0 && (
              <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">لیست تغییرات آماده نصب:</div>
                <ul className="space-y-1 font-mono text-[10.5px]">
                  {updateInfo.commits.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                      <GitBranch className="w-3 h-3 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleCheckUpdates}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>بررسی تغییرات جدید در گیت‌هاب</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={handleTriggerOnlineUpdate}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>نصب به‌روزرسانی آنلاین و راه‌اندازی مجدد</span>
          </button>
        </div>
      </div>

      {/* 3. بخش دوم: پشتیبان‌گیری و بازیابی پایگاه داده */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <Database className="w-5 h-5 text-emerald-600" />
            <span>پشتیبان‌گیری، دانلود فایل پشتیبان و بازیابی اطلاعات (Backup & Restore)</span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md font-bold">
            امضای دیجیتال SHA-256
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          تمامی اطلاعات نرم‌افزار شامل کالاها، انبارها، کاردکس، اشخاص، فاکتورها، اسناد دوبل حسابداری، دریافت/پرداخت‌ها، چک‌ها و لاگ‌ها به صورت یکپارچه در فایل JSON استخراج شده و در تراکنش اتمیک قابل بازیابی است.
        </p>

        {backupStatusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              backupStatusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            {backupStatusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{backupStatusMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadRealBackup}
            disabled={isExporting}
            className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'در حال استخراج...' : 'دانلود فایل پشتیبان (بکاپ کامل JSON)'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreFromFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            className="py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{isRestoring ? 'در حال بازیابی...' : 'بارگذاری و بازیابی فایل پشتیبان'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunBackupRestoreTest}
            disabled={isTestingCycle}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTestingCycle ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 text-emerald-400" />
            )}
            <span>
              {isTestingCycle ? 'در حال اجرای آزمون...' : 'آزمون خودکار چرخه پشتیبان‌گیری'}
            </span>
          </button>
        </div>

        {/* مشخصات آخرین بکاپ استخراج‌شده */}
        {lastBackupMeta && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 text-xs">
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                مشخصات فایل پشتیبان دریافت شده
              </span>
              <span className="text-[11px] text-slate-500">{lastBackupMeta.exportedAtShamsi}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
              <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>امضای دیجیتال: {lastBackupMeta.checksum}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block text-[11px]">کالاها</span>
                <strong className="text-slate-800 dark:text-slate-100 font-bold">
                  {toPersianDigits(lastBackupMeta.stats?.productsCount || 0)}
                </strong>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block text-[11px]">اسناد دوبل</span>
                <strong className="text-slate-800 dark:text-slate-100 font-bold">
                  {toPersianDigits(lastBackupMeta.stats?.vouchersCount || 0)}
                </strong>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block text-[11px]">فاکتورها</span>
                <strong className="text-slate-800 dark:text-slate-100 font-bold">
                  {toPersianDigits(lastBackupMeta.stats?.invoicesCount || 0)}
                </strong>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block text-[11px]">کاردکس</span>
                <strong className="text-slate-800 dark:text-slate-100 font-bold">
                  {toPersianDigits(lastBackupMeta.stats?.kardexEntriesCount || 0)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* نتیجه بازیابی */}
        {restoreResult && (
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-1">
            <div className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>نتیجه بازیابی پایگاه داده ({restoreResult.restoredAt})</span>
            </div>
            <p className="text-[11.5px] text-indigo-800 dark:text-indigo-300">
              اعتبارسنجی امضا: {restoreResult.checksumVerified ? 'تأیید شد (SHA-256 Verified)' : 'بدون امضا'} | وضعیت تراز حسابداری پس از بازیابی:{' '}
              {restoreResult.reconciliation?.allReconciled ? '۱۰۰٪ منطبق و متوازن' : 'نیازمند بررسی'}
            </p>
          </div>
        )}

        {/* نتیجه آزمون چرخه */}
        {cycleTestResult && (
          <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200 text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                گزارش آزمون چرخه کامل پشتیبان‌گیری و بازیابی
              </span>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {cycleTestResult.passed ? 'موفق (PASSED)' : 'ناموفق'}
              </span>
            </div>
            <div className="space-y-1.5">
              {cycleTestResult.steps?.map((st: any) => (
                <div
                  key={st.step}
                  className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-slate-800 text-[11px]"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      مرحله {toPersianDigits(st.step)}: {st.title}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5 pr-5">{st.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. بخش سوم: صفر کردن برنامه جهت تحویل به مشتری */}
      <div className="bg-rose-50/50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm border-b border-rose-200 dark:border-rose-900/60 pb-3">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>صفر کردن برنامه جهت تحویل به مشتری (Factory Reset)</span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          این گزینه کلیه فاکتورهای آزمایشی، اسناد دوبل حسابداری، دریافت/پرداخت‌ها، گردش کاردکس کالاها، چک‌ها و مانده طرف‌حساب‌ها را کاملاً صفر نموده و سامانه را به وضعیت خام و آماده تحویل جهت ورود اطلاعات فروشگاه مشتری بازمی‌گرداند.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>صفر کردن کامل برنامه و شروع ویزارد</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>شروع ویزارد راه‌اندازی گام به گام</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompleted={() => {
          setIsOnboardingOpen(false);
          alert('اطلاعات فروشگاه با موفقیت ثبت و سیستم آماده بهره‌برداری شد.');
        }}
      />

      {isResetConfirmOpen && (
        <StandardModal
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          title="هشدار: صفر کردن کامل پایگاه داده و تحویل به مشتری"
          subtitle="کلیه فاکتورها، کاردکس‌ها، چک‌ها و اسناد دوبل حسابداری جاری حذف خواهند شد."
          icon={AlertTriangle}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleExecuteFactoryReset}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'در حال پاکسازی...' : 'تایید و صفر کردن قطعی برنامه'}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3 p-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              آیا از صفر کردن کامل نرم‌افزار اطمینان دارید؟ با تایید این عملیات، تمامی تراکنش‌های تستی پاک شده و پنجره راهنمای گام به گام جهت دریافت اطلاعات مشتری باز خواهد شد.
            </p>
          </div>
        </StandardModal>
      )}
    </div>
  );
};
