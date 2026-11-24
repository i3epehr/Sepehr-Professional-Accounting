import React, { useState } from 'react';
import {
  Store,
  DollarSign,
  Printer,
  CheckCircle2,
  Save,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { StoreSettings } from '../../types/index.ts';
import { InvoiceCustomizerModal } from '../invoices/InvoiceCustomizerModal.tsx';
import { OnboardingWizardModal } from '../common/OnboardingWizardModal.tsx';

export const SettingsModule: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    currency: 'ریال',
    guildName: settings.guildName || 'صنف بازرگانی و فروشگاهی',
    economicCode: settings.economicCode || '۴۱۱۵۶۷۸۹۲۳۴۱',
    nationalId: settings.nationalId || '۱۰۱۰۲۸۳۴۷۵۶',
    postalCode: settings.postalCode || '۱۱۶۳۸۴۷۲۹۱',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateSettings({ ...formData, currency: 'ریال' });
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
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
              تنظیمات عمومی، مشخصات صنف و قواعد مالی
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-800">
              پیکربندی فروشگاه و صنف
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ویرایش نام صنف و رسته شغلی، کد اقتصادی، واحد پولی رسمی (ریال)، قواعد انبار و تنظیمات چاپ فاکتور
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                نام فروشگاه / تابلوی تجاری *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                نام صنف و رسته شغلی *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: صنف بازرگانی، فروشگاهی و ملزومات"
                value={formData.guildName || ''}
                onChange={(e) => setFormData({ ...formData, guildName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                صاحب امتیاز / مدیر فروشگاه
              </label>
              <input
                type="text"
                value={formData.storeOwner}
                onChange={(e) => setFormData({ ...formData, storeOwner: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                کد اقتصادی (شماره اقتصادی ۱۲ رقمی)
              </label>
              <input
                type="text"
                value={formData.economicCode || ''}
                onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
                placeholder="مثال: ۴۱۱۵۶۷۸۹۲۳۴۱"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                شناسه ملی / کد ملی صاحب کسب‌وکار
              </label>
              <input
                type="text"
                value={formData.nationalId || ''}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder="مثال: ۱۰۱۰۲۸۳۴۷۵۶"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                کد پستی ۱۰ رقمی
              </label>
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="مثال: ۱۱۶۳۸۴۷۲۹۱"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                تلفن تماس فروشگاه
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                سال مالی فعال سیستم
              </label>
              <input
                type="text"
                value={formData.activeFiscalYear}
                onChange={(e) => setFormData({ ...formData, activeFiscalYear: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                آدرس کامل واحد صنفی
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100"
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
            {/* واحد پول ثابت رسمی: ریال */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                واحد پول رسمی سیستم
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <span>ریال (واحد رسمی کشوری)</span>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md font-bold">
                  پیش‌فرض قطعی
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                درصد ارزش افزوده پیش‌فرض
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.defaultTaxPercent}
                onChange={(e) => setFormData({ ...formData, defaultTaxPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                سیاست فروش با کسری موجودی
              </label>
              <select
                value={formData.allowNegativeStock ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="false">غیرمجاز (جلوگیری از صدور فاکتور در کمبود کالا)</option>
                <option value="true">مجاز (ثبت با هشدار کسری انبار)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                کنترل توازن بدهکار/بستانکار اسناد
              </label>
              <select
                value={formData.requireBalancedVouchers ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, requireBalancedVouchers: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                شعار یا عبارت بالای فاکتور (Header Note)
              </label>
              <input
                type="text"
                value={formData.printHeaderNote}
                onChange={(e) => setFormData({ ...formData, printHeaderNote: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                شرایط تسویه و پیام تشکر پایین فاکتور (Footer Note)
              </label>
              <textarea
                rows={2}
                value={formData.printFooterNote}
                onChange={(e) => setFormData({ ...formData, printFooterNote: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
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
    </div>
  );
};
