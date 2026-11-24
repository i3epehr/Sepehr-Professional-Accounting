import React, { useState } from 'react';
import {
  Settings,
  Store,
  DollarSign,
  Printer,
  Calendar,
  CheckCircle2,
  Save,
  Building,
  Sliders,
  ShieldCheck,
  FileText,
  Hash,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Sparkles,
  Terminal,
  Download,
  GitBranch,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { StoreSettings } from '../../types/index.ts';
import { InvoiceCustomizerModal } from '../invoices/InvoiceCustomizerModal.tsx';
import { toPersianDigits } from '../../lib/formatters.ts';
import { api } from '../../lib/api.ts';
import { StandardModal } from '../common/StandardModal.tsx';
import { OnboardingWizardModal } from '../common/OnboardingWizardModal.tsx';

export const SettingsModule: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    guildName: settings.guildName || 'صنف بازرگانی و فروشگاهی',
    economicCode: settings.economicCode || '۴۱۱۵۶۷۸۹۲۳۴۱',
    nationalId: settings.nationalId || '۱۰۱۰۲۸۳۴۷۵۶',
    postalCode: settings.postalCode || '۱۱۶۳۸۴۷۲۹۱',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdates: boolean;
    behindCount: number;
    commits: string[];
    branch?: string;
  } | null>(null);

  const handleExecuteFactoryReset = async () => {
    try {
      setIsResetting(true);
      await api.factoryReset();
      setIsResetConfirmOpen(false);
      setIsOnboardingOpen(true);
      setSavedSuccess(true);
      alert('نرم‌افزار با موفقیت صفر شد. اکنون می‌توانید اطلاعات مشتری را گام به گام وارد فرمایید.');
    } catch (err: any) {
      alert(`خطا در پاکسازی برنامه: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      setIsUpdating(true);
      setUpdateMsg('در حال اتصال به گیت‌هاب و بررسی نسخه‌های جدید...');
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
        setUpdateMsg(`تعداد ${toPersianDigits(res.behindCount)} کامیت جدید در گیت‌هاب یافت شد. جهت اعمال، دکمه «نصب به‌روزرسانی آنلاین» را بزنید.`);
      } else {
        setUpdateInfo({
          hasUpdates: false,
          behindCount: 0,
          commits: [],
          branch: res.branch,
        });
        setUpdateMsg(res.message || 'نرم‌افزار شما کاملاً به‌روز است و هیچ تغییری وجود ندارد.');
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
      setUpdateMsg('در حال تهیه نسخه پشتیبان از دیتابیس، دریافت تغییرات از گیت‌هاب و بیلد برنامه... لطفاً شکیبا باشید.');
      const res = await api.triggerUpdate();
      if (res.success) {
        let count = 5;
        setUpdateMsg(`✅ ${res.message} صفحه تا ${toPersianDigits(count)} ثانیه دیگر به‌روزرسانی می‌شود...`);
        const timer = setInterval(() => {
          count -= 1;
          if (count > 0) {
            setUpdateMsg(`✅ به‌روزرسانی با موفقیت انجام شد و دیتابیس حفظ گردید. صفحه تا ${toPersianDigits(count)} ثانیه دیگر رفرش می‌شود...`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateSettings(formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      alert(`خطا در ذخیره تنظیمات: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-800 dark:text-white">
              تنظیمات عمومی، مشخصات صنف و قواعد مالی
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-800">
              پیکربندی فروشگاه و صنف
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ویرایش نام صنف و رسته شغلی، کد اقتصادی، واحد پولی، قواعد انبار و تنظیمات چاپ فاکتور
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>تنظیمات با موفقیت ذخیره شد.</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>راه‌اندازی گام به گام</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>طراحی پیشرفته فاکتور</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ۱. مشخصات واحد صنفی و پروانه کسب */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
            <Store className="w-5 h-5 text-indigo-600" />
            <span>مشخصات واحد صنفی، پروانه کسب و شناسه‌ها</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام فروشگاه / تابلوی تجاری *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام صنف و رسته شغلی *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: صنف خرازی، خیاطی و ملزومات پوشاک"
                value={formData.guildName || ''}
                onChange={(e) => setFormData({ ...formData, guildName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                صاحب امتیاز / مدیر فروشگاه
              </label>
              <input
                type="text"
                value={formData.storeOwner}
                onChange={(e) => setFormData({ ...formData, storeOwner: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                کد اقتصادی (شماره اقتصادی ۱۲ رقمی)
              </label>
              <input
                type="text"
                value={formData.economicCode || ''}
                onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
                placeholder="مثال: ۴۱۱۵۶۷۸۹۲۳۴۱"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شناسه ملی / کد ملی صاحب کسب‌وکار
              </label>
              <input
                type="text"
                value={formData.nationalId || ''}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder="مثال: ۱۰۱۰۲۸۳۴۷۵۶"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                کد پستی ۱۰ رقمی
              </label>
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="مثال: ۱۱۶۳۸۴۷۲۹۱"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تلفن تماس فروشگاه
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سال مالی فعال سیستم
              </label>
              <input
                type="text"
                value={formData.activeFiscalYear}
                onChange={(e) => setFormData({ ...formData, activeFiscalYear: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                آدرس کامل واحد صنفی
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* ۲. تنظیمات واحد پولی، مالیاتی و انبارداری */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <span>تنظیمات واحد پولی، ارزش افزوده و انبارداری</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                واحد پول سیستم
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'تومان' | 'ریال' })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="ریال">ریال (واحد رسمی - پیش‌فرض سیستم)</option>
                <option value="تومان">تومان</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                درصد ارزش افزوده پیش‌فرض
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.defaultTaxPercent}
                onChange={(e) => setFormData({ ...formData, defaultTaxPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سیاست فروش با کسری موجودی
              </label>
              <select
                value={formData.allowNegativeStock ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="false">غیرمجاز (جلوگیری از صدور فاکتور در کمبود کالا)</option>
                <option value="true">مجاز (ثبت با هشدار کسری انبار)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                کنترل توازن بدهکار/بستانکار اسناد
              </label>
              <select
                value={formData.requireBalancedVouchers ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, requireBalancedVouchers: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="true">اجباری (جلوگیری از ثبت سند نامتوازن)</option>
                <option value="false">اختیاری (ثبت پیش‌نویس موقت)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ۳. متن‌ها و پیام‌های سربرگ و پاورقی فاکتور */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <Printer className="w-5 h-5 text-indigo-600" />
              <span>تنظیمات پیام‌های سربرگ و پاورقی چاپ</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>شخصی‌سازی پیشرفته اندازه فونت و ستون‌ها</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شعار یا عبارت بالای فاکتور (Header Note)
              </label>
              <input
                type="text"
                value={formData.printHeaderNote}
                onChange={(e) => setFormData({ ...formData, printHeaderNote: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شرایط تسویه و پیام تشکر پایین فاکتور (Footer Note)
              </label>
              <textarea
                rows={2}
                value={formData.printFooterNote}
                onChange={(e) => setFormData({ ...formData, printFooterNote: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره کلیه تنظیمات'}</span>
          </button>
        </div>
      </form>

      {/* ۴. به‌روزرسانی آنلاین از گیت‌هاب و اجرای خودکار در پس‌زمینه */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <Terminal className="w-5 h-5 text-indigo-600" />
            <span>به‌روزرسانی آنلاین از گیت‌هاب و راه‌اندازی پس‌زمینه (Online Auto-Update & Silent Launcher)</span>
          </div>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
            v1.1.0-sepehr
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          نرم‌افزار با اسکریپت <code>start_server.bat</code> دارای حلقه خودکار (Auto-Restart Loop) است و با <code>run_hidden.vbs</code> بدون نمایش پنجره سیاه ترمینال در پس‌زمینه اجرا می‌شود. با کلیک بر روی دکمه به‌روزرسانی، ابتدا نسخه پشتیبان اضطراری از داده‌ها در پوشه <code>backups/</code> ذخیره شده، سپس تغییرات جدید از گیت‌هاب دریافت و بیلد می‌شود و سرور به صورت خودکار بدون نیاز به بستن دستی (End Task) مجدداً اجرا می‌گردد.
        </p>

        {updateMsg && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 space-y-2">
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

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleCheckUpdates}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>بررسی تغییرات جدید در گیت‌هاب</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={handleTriggerOnlineUpdate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>نصب به‌روزرسانی آنلاین و راه‌اندازی مجدد</span>
          </button>
        </div>

        {/* راهنمای استارتاپ ویندوز */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>راهنمای اجرای خودکار و مخفی با روشن شدن ویندوز (Windows Startup):</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <li>کلیدهای <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">Win + R</kbd> را بفشارید و عبارت <code className="text-indigo-600 dark:text-indigo-400 font-bold">shell:startup</code> را تایپ و اینتر بزنید.</li>
            <li>از فایل <code className="text-indigo-600 dark:text-indigo-400 font-bold">run_hidden.vbs</code> در ریشه این پروژه یک میانبر (Shortcut) بسازید و آن را داخل پوشه بازشده قرار دهید.</li>
            <li>از این پس با روشن شدن کامپیوتر، سرور برنامه به صورت ۱۰۰٪ مخفی و در پس‌زمینه آماده به کار خواهد بود.</li>
          </ol>
        </div>
      </div>

      {/* ۵. صفر کردن و پاکسازی برنامه جهت تحویل به مشتری (Factory Reset) */}
      <div className="bg-rose-50/50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm border-b border-rose-200 dark:border-rose-900/60 pb-3">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>صفر کردن برنامه جهت تحویل به مشتری (Factory Reset)</span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          این گزینه کلیه فاکتورهای آزمایشی، اسناد دوبل حسابداری، دریافت/پرداخت‌ها، گردش کاردکس کالاها، چک‌ها و مانده طرف‌حساب‌ها را کاملاً صفر نموده و سامانه را به وضعیت راه‌اندازی اولیه جهت ورود مرحله به مرحله اطلاعات فروشگاه مشتری بازمی‌گرداند.
        </p>

        <div className="flex items-center justify-between pt-1">
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>راه‌اندازی گام به گام (ویزارد)</span>
          </button>
        </div>
      </div>

      {/* Invoice Customizer Modal */}
      <InvoiceCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        onSaved={() => {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        }}
      />

      {/* Onboarding Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompleted={() => {
          setIsOnboardingOpen(false);
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 4000);
        }}
      />

      {/* Reset Confirmation Modal */}
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
