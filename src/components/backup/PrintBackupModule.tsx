import React, { useState } from 'react';
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  FileText,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { formatCurrency } from '../../lib/formatters.ts';
import { InvoiceCustomizerModal } from '../invoices/InvoiceCustomizerModal.tsx';

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
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در ذخیره تنظیمات چاپ',
      });
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              قالب‌های چاپ فاکتور و فیش پرینتر
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900/50">
              چاپگر حرارتی و معمولی
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            پیکربندی چاپگر حرارتی ۸ سانتی‌متری (فیش پرینتر)، اندازه کاغذ A4/A5، بارکد، لوگو و تنظیمات متن پاورقی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-xs font-bold transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>طراحی پیشرفته ستون‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ نمونه آزمایشی</span>
          </button>
        </div>
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
        {/* تنظیمات چاپ */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-100">
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>تنظیمات قالب پیش‌فرض چاپ فاکتور و فیش پرینتر</span>
            </div>
            <button
              type="button"
              onClick={handleSavePrintConfig}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer"
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
                نمایش عنوان و نشان فروشگاه در سربرگ
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
          </div>
        </div>

        {/* پیش‌نمایش زنده */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-100">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>پیش‌نمایش خروجی فاکتور</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {printSize === 'thermal_80' ? 'Thermal 80mm' : printSize.toUpperCase()}
            </span>
          </div>

          <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
            <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2.5">
              {showLogo && (
                <span className="inline-block text-xs font-black text-indigo-700 dark:text-indigo-400">
                  ✦ {settings.storeName} ✦
                </span>
              )}
              <p className="text-[10px] text-slate-500 mt-0.5">
                فاکتور فروش کالا و خدمات
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>روبان ساتن ۲٫۵ سانت (۲ رول)</span>
                <span className="font-bold">{formatCurrency(760000)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>تخفیف</span>
                <span>۰ ریال</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>مبلغ قابل پرداخت</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(760000)}</span>
              </div>
            </div>

            <div className="text-center pt-2.5 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[10px] text-slate-500">{footerText}</p>
              {showBarcode && (
                <p className="font-mono text-[10px] tracking-widest text-slate-400 mt-1.5">
                  ||| |||| || ||||| ||| INV-1241
                </p>
              )}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>جهت پشتیبان‌گیری کامل از داده‌ها یا به‌روزرسانی سیستم، به بخش «پشتیبان‌گیری، بروزرسانی و نگهداری» مراجعه فرمایید.</span>
            </div>
          </div>
        </div>
      </div>

      <InvoiceCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        onSaved={() => {
          setStatusMessage({
            type: 'success',
            text: 'قالب پیشرفته فاکتور با موفقیت ذخیره شد.',
          });
        }}
      />
    </div>
  );
};
