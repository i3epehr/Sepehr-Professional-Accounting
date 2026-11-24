import React, { useState, useRef } from 'react';
import {
  Printer,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  FileCheck2,
  Play,
  Hash,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { api } from '../../lib/api.ts';
import { formatCurrency, toPersianDigits } from '../../lib/formatters.ts';

export const PrintBackupModule: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [printSize, setPrintSize] = useState<'thermal_80' | 'a4' | 'a5'>(
    settings.defaultPrintLayout || 'thermal_80'
  );
  const [showLogo, setShowLogo] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [footerText, setFooterText] = useState(
    settings.printFooterNote || 'اجناس فروخته شده تا ۴۸ ساعت با ارائه فاکتور تعویض می‌گردند.'
  );

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isTestingCycle, setIsTestingCycle] = useState(false);

  const [lastBackupMeta, setLastBackupMeta] = useState<any>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [cycleTestResult, setCycleTestResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSavePrintConfig = async () => {
    try {
      await updateSettings({
        defaultPrintLayout: printSize,
        printFooterNote: footerText,
      });
      setStatusMessage({
        type: 'success',
        text: 'تنظیمات قالب چاپ فاکتور و فیش پرینتر با موفقیت در سرور ذخیره شد.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در ذخیره تنظیمات چاپ',
      });
    }
  };

  const handleDownloadRealBackup = async () => {
    try {
      setIsExporting(true);
      setStatusMessage(null);
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
      a.download = `kharrazi_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `پشتیبان کامل پایگاه داده با امضای دیجیتال SHA-256 (${backupBundle.checksum.slice(0, 12)}...) با موفقیت دانلود شد.`,
      });
    } catch (err: any) {
      setStatusMessage({
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
      setStatusMessage(null);
      const rawText = await file.text();
      const parsedBundle = JSON.parse(rawText);
      const res = await api.restoreDatabaseBackup(parsedBundle);
      setRestoreResult(res);
      setStatusMessage({
        type: 'success',
        text: `بازیابی پایگاه داده با موفقیت انجام شد (${toPersianDigits(res.stats.vouchersCount)} سند حسابداری و ${toPersianDigits(res.stats.productsCount)} کالا بازنشانی شدند).`,
      });
    } catch (err: any) {
      setStatusMessage({
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
      setStatusMessage(null);
      const res = await api.testBackupAndRestoreCycle();
      setCycleTestResult(res);
      setStatusMessage({
        type: res.passed ? 'success' : 'error',
        text: res.passed
          ? 'آزمون ۴ مرحله‌ای پشتیبان‌گیری، تغییر داده، بازیابی اتمیک و کنترل SHA-256 با موفقیت ۱۰۰٪ انجام شد.'
          : 'در آزمون پشتیبان‌گیری و بازیابی خطایی مشاهده شد.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در اجرای آزمون پشتیبان‌گیری و بازیابی',
      });
    } finally {
      setIsTestingCycle(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              قالب‌های چاپ فاکتور، بارکد و پشتیبان‌گیری و بازیابی واقعی پایگاه داده
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900/50">
              تضمین اصالت SHA-256
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            پیکربندی چاپگر حرارتی ۸ سانتی‌متری (فیش پرینتر) و سایز A4/A5، همراه با استخراج و بازیابی کامل دیتابیس در تراکنش اتمیک
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ نمونه آزمایشی</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Print Layout Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-100">
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>تنظیمات قالب پیش‌فرض چاپ فاکتور و فیش پرینتر</span>
            </div>
            <button
              type="button"
              onClick={handleSavePrintConfig}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
            >
              ذخیره تنظیمات چاپ
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                سایز پیش‌فرض چاپ فاکتور
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'thermal_80', label: 'حرارتی ۸۰ میلی‌متر' },
                  { id: 'a4', label: 'کاغذ A4 رسمی' },
                  { id: 'a5', label: 'کاغذ A5 فشرده' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPrintSize(s.id as any)}
                    className={`py-2 px-2 rounded-xl font-bold transition cursor-pointer text-center ${
                      printSize === s.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                نمایش بارکد فاکتور در پایین برگه
              </span>
              <input
                type="checkbox"
                checked={showBarcode}
                onChange={(e) => setShowBarcode(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                نمایش لوگو و نشان خرازی در سربرگ
              </span>
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                متن پاورقی فاکتور
              </label>
              <textarea
                rows={2}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {/* Live Preview Box */}
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3.5 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
              <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2">
                {showLogo && (
                  <span className="inline-block text-[11px] font-black text-indigo-700 dark:text-indigo-400">
                    ✦ {settings.storeName} ✦
                  </span>
                )}
                <p className="text-[10px] text-slate-500">
                  پیش‌نمایش قالب {printSize === 'thermal_80' ? 'فیش پرینتر حرارتی ۸ سانتی‌متری' : printSize.toUpperCase()}
                </p>
              </div>
              <div className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300">
                <span>روبان ساتن ۲٫۵ سانت قرمز (۲ رول = ۵۰ متر)</span>
                <span className="font-bold">{formatCurrency(76000)}</span>
              </div>
              <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500">{footerText}</p>
                {showBarcode && (
                  <p className="font-mono text-[10px] tracking-widest text-slate-400 mt-1">
                    ||| |||| || ||||| ||| INV-1241
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real Database Backup & Restore Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-100">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>پشتیبان‌گیری و بازیابی واقعی پایگاه داده (Full Snapshot & Restore)</span>
            </div>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
              تراکنش اتمیک
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              تمامی ۲۵ جدول عملیاتی سامانه (کالاها، انبارها، کاردکس، اشخاص، فاکتورها، اسناد حسابداری دوبل، خزانه، چک‌ها، سال‌های مالی و لاگ‌های امنیتی) با امضای دیجیتال SHA-256 استخراج و در صورت نیاز به صورت اتمیک بازیابی می‌شوند.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadRealBackup}
                disabled={isExporting}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'در حال استخراج...' : 'دانلود پشتیبان کامل (JSON)'}</span>
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
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isRestoring ? 'در حال بازیابی...' : 'بارگذاری و بازیابی فایل پشتیبان'}</span>
              </button>
            </div>

            {/* Automated Backup -> Mutate -> Restore Test Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleRunBackupRestoreTest}
                disabled={isTestingCycle}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTestingCycle ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  {isTestingCycle
                    ? 'در حال اجرای چرخه پشتیبان‌گیری و بازیابی...'
                    : 'اجرای خودکار آزمون واقعی پشتیبان‌گیری و بازیابی (Backup → Mutate → Restore)'}
                </span>
              </button>
            </div>

            {lastBackupMeta && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    مشخصات آخرین فایل پشتیبان تولید شده
                  </span>
                  <span className="text-[11px] text-slate-500">{lastBackupMeta.exportedAtShamsi}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                  <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>SHA-256: {lastBackupMeta.checksum}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[11px]">
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block">کالاها</span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {toPersianDigits(lastBackupMeta.stats?.productsCount || 0)}
                    </strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block">اسناد دوبل</span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {toPersianDigits(lastBackupMeta.stats?.vouchersCount || 0)}
                    </strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block">فاکتورها</span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {toPersianDigits(lastBackupMeta.stats?.invoicesCount || 0)}
                    </strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block">کاردکس</span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {toPersianDigits(lastBackupMeta.stats?.kardexEntriesCount || 0)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {restoreResult && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-1">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>نتیجه بازیابی فایل پشتیبان ({restoreResult.restoredAt})</span>
                </div>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  تأیید امضای دیجیتال: {restoreResult.checksumVerified ? 'معتبر (SHA-256 Verified)' : 'بدون امضا'} | وضعیت تراز ۵گانه پس از بازیابی:{' '}
                  {restoreResult.reconciliation?.allReconciled ? '۱۰۰٪ منطبق و بدون مغایرت' : 'نیازمند بررسی'}
                </p>
              </div>
            )}

            {cycleTestResult && (
              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
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
        </div>
      </div>
    </div>
  );
};
