import React, { useState } from 'react';
import {
  Sparkles,
  Store,
  Calendar,
  Wallet,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Layers,
  Building,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { api } from '../../lib/api.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const { settings, updateSettings } = useSettings();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Step 1: Store & Business info
  const [storeName, setStoreName] = useState<string>(settings.storeName || 'فروشگاه سپهر');
  const [storeOwner, setStoreOwner] = useState<string>(settings.storeOwner || 'مدیر سیستم');
  const [guildName, setGuildName] = useState<string>(settings.guildName || 'صنف بازرگانی و فروشگاهی');
  const [phone, setPhone] = useState<string>(settings.phone || '۰۲۱-');
  const [address, setAddress] = useState<string>(settings.address || 'تهران');
  const [economicCode, setEconomicCode] = useState<string>(settings.economicCode || '');

  // Step 2: Fiscal Year & Main Warehouse
  const [fiscalYear, setFiscalYear] = useState<string>('۱۴۰۴');
  const [warehouseName, setWarehouseName] = useState<string>('انبار مرکزی فروشگاه');

  // Step 3: Initial Cash & Bank Accounts
  const [cashTitle, setCashTitle] = useState<string>('صندوق اصلی فروشگاه');
  const [cashBalance, setCashBalance] = useState<string>('۰');
  const [bankTitle, setBankTitle] = useState<string>('بانک ملی - جاری');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankBalance, setBankBalance] = useState<string>('۰');

  if (!isOpen) return null;

  const handleFinish = async () => {
    try {
      setIsSaving(true);

      // ۱. ذخیره تنظیمات عمومی و علامت تکمیل ویزارد
      await updateSettings({
        storeName: storeName.trim() || 'فروشگاه سپهر',
        storeOwner: storeOwner.trim() || 'مدیر سیستم',
        guildName: guildName.trim() || 'صنف بازرگانی و فروشگاهی',
        phone: phone.trim(),
        address: address.trim(),
        economicCode: economicCode.trim(),
        currency: 'ریال',
        activeFiscalYear: fiscalYear.trim() || '۱۴۰۴',
        onboardingCompleted: true,
      });

      // ۲. ذخیره موجودی اولیه صندوق و بانک در صورت نیاز
      const cashNum = parseFloat(cashBalance.replace(/,/g, '')) || 0;
      if (cashNum > 0 || cashTitle.trim()) {
        try {
          await api.saveTreasuryAccount({
            title: cashTitle.trim() || 'صندوق اصلی',
            type: 'cash',
            balance: cashNum,
            isActive: true,
          });
        } catch (e) {
          console.warn('Treasury cash account already exists or saved:', e);
        }
      }

      const bankNum = parseFloat(bankBalance.replace(/,/g, '')) || 0;
      if (bankNum > 0 || bankAccountNumber.trim()) {
        try {
          await api.saveTreasuryAccount({
            title: bankTitle.trim() || 'بانک اصلی',
            type: 'bank',
            accountNumber: bankAccountNumber.trim(),
            balance: bankNum,
            isActive: true,
          });
        } catch (e) {
          console.warn('Treasury bank account already exists or saved:', e);
        }
      }

      onCompleted();
    } catch (err: any) {
      alert(`خطا در ذخیره راه‌اندازی اولیه: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-6 bg-linear-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  راهنمای راه‌اندازی گام به گام نرم‌افزار حسابداری سپهر
                </h2>
                <p className="text-xs text-emerald-100 mt-0.5">
                  پیکربندی اولیه فروشگاه جهت آماده‌سازی صدور فاکتور و مدیریت مالی
                </p>
              </div>
            </div>
            <div className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full">
              گام {toPersianDigits(currentStep)} از ۳
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className={`h-1.5 rounded-full ${currentStep >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`h-1.5 rounded-full ${currentStep >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`h-1.5 rounded-full ${currentStep >= 3 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: مشخصات فروشگاه و کسب‌وکار */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <span>گام اول: مشخصات عمومی فروشگاه و واحد صنفی</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نام فروشگاه / شرکت *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="مثال: بازرگانی و فروشگاه سپهر"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نام و نام خانوادگی مدیر
                  </label>
                  <input
                    type="text"
                    value={storeOwner}
                    onChange={(e) => setStoreOwner(e.target.value)}
                    placeholder="نام مسئول فروشگاه"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    صنف و حوزه فعالیت
                  </label>
                  <input
                    type="text"
                    value={guildName}
                    onChange={(e) => setGuildName(e.target.value)}
                    placeholder="صنف بازرگانی، فروشگاهی..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    تلفن تماس
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="۰۲۱-۵۵۰۰۰۰۰۰"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نشانی فروشگاه (جهت درج در سربرگ فاکتور)
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="آدرس دقیق واحد صنفی..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: سال مالی و انبار */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>گام دوم: سال مالی و انبار مرکزی</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    سال مالی جاری *
                  </label>
                  <input
                    type="text"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    placeholder="۱۴۰۴"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    کلیه اسناد و دفاتر دوبل در این دوره مالی ثبت می‌شوند.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نام انبار اصلی
                  </label>
                  <input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="انبار مرکزی فروشگاه"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    انبار پیش‌فرض برای صدور فاکتور و کاردکس کالا
                  </span>
                </div>

                <div className="sm:col-span-2 p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 font-bold">
                  واحد پول رسمی سامانه بر روی «ریال» تنظیم گردیده است و کلیه گزارش‌ها و فاکتورها به ریال محاسبه خواهند شد.
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: حساب‌های اولیه خزانه‌داری */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                <Wallet className="w-5 h-5 text-teal-600" />
                <span>گام سوم: افتتاح صندوق و حساب بانکی اولیه</span>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white">۱. صندوق نقدی</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        عنوان صندوق:
                      </label>
                      <input
                        type="text"
                        value={cashTitle}
                        onChange={(e) => setCashTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        موجودی اول دوره (ریال):
                      </label>
                      <input
                        type="text"
                        value={cashBalance}
                        onChange={(e) => setCashBalance(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white">۲. حساب بانکی / کارتخوان</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        عنوان حساب / بانک:
                      </label>
                      <input
                        type="text"
                        value={bankTitle}
                        onChange={(e) => setBankTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        شماره حساب / شبا:
                      </label>
                      <input
                        type="text"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="اختیاری..."
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        موجودی اول دوره (ریال):
                      </label>
                      <input
                        type="text"
                        value={bankBalance}
                        onChange={(e) => setBankBalance(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>گام قبلی</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>گام بعدی</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinish}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'تکمیل راه‌اندازی و ورود به نرم‌افزار'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
