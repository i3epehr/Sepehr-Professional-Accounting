import React, { useState } from 'react';
import {
  Sliders,
  Type,
  LayoutTemplate,
  Check,
  X,
  Eye,
  Save,
  RotateCcw,
  Sparkles,
  Building,
} from 'lucide-react';
import { InvoicePrintConfig, InvoiceTemplateStyle, HolooPrintTheme } from '../../types/index.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';

interface InvoiceCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const InvoiceCustomizerModal: React.FC<InvoiceCustomizerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { settings, updateSettings } = useSettings();

  const [config, setConfig] = useState<InvoicePrintConfig>({
    theme: settings.invoicePrintConfig?.theme || 'holoo-teal',
    templateStyle: settings.invoicePrintConfig?.templateStyle || 'holoo_classic',
    paperSize: settings.invoicePrintConfig?.paperSize || 'a4',
    orientation: settings.invoicePrintConfig?.orientation || 'portrait',
    fontSize: settings.invoicePrintConfig?.fontSize || 'sm',
    printScale: settings.invoicePrintConfig?.printScale || 100,
    showBarcode: settings.invoicePrintConfig?.showBarcode ?? true,
    showTax: settings.invoicePrintConfig?.showTax ?? true,
    showDiscount: settings.invoicePrintConfig?.showDiscount ?? true,
    showColorSize: settings.invoicePrintConfig?.showColorSize ?? true,
    showAmountInWords: settings.invoicePrintConfig?.showAmountInWords ?? true,
    showPaymentBreakdown: settings.invoicePrintConfig?.showPaymentBreakdown ?? true,
    showSignatures: settings.invoicePrintConfig?.showSignatures ?? true,
    showStoreLogo: settings.invoicePrintConfig?.showStoreLogo ?? true,
    showGuildName: settings.invoicePrintConfig?.showGuildName ?? true,
    showCustomerBalance: settings.invoicePrintConfig?.showCustomerBalance ?? true,
    showEconomicCode: settings.invoicePrintConfig?.showEconomicCode ?? true,
    customTitle: settings.invoicePrintConfig?.customTitle || 'فاکتور رسمی فروش کالا و خدمات',
    customSlogan: settings.invoicePrintConfig?.customSlogan || 'توزیع تخصصی روبان، دکمه، زیپ، نخ و ملزومات خیاطی',
    customFooterNote: settings.invoicePrintConfig?.customFooterNote || settings.printFooterNote || 'از خرید شما متشکریم.',
    customTerms: settings.invoicePrintConfig?.customTerms || 'شرایط: اجناس برش‌خورده (روبان، تور و کش) مرجوع نمی‌گردد. تعویض سایر اقلام تا ۴۸ ساعت با ارائه فاکتور امکان‌پذیر است.',
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateSettings({
        invoicePrintConfig: config,
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      alert(`خطا در ذخیره تنظیمات فاکتور: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fontSizeClass = {
    xs: 'text-[9.5px]',
    sm: 'text-[11px]',
    base: 'text-xs',
    lg: 'text-sm',
  }[config.fontSize || 'sm'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                طراحی و سفارشی‌سازی حرفه‌ای فاکتور
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنظیم اندازه قلم، نمایش یا پنهان‌سازی بخش‌ها و پیش‌نمایش زنده در لحظه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace: 2-Columns (Controls on Right, Live Preview on Left) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100 dark:divide-slate-800">
          {/* Controls Column */}
          <div className="lg:col-span-5 p-5 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Font Size Scaling */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100">
                <Type className="w-4 h-4 text-indigo-600" />
                <span>اندازه فونت و تراکم متن فاکتور:</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'xs', label: 'خیلی ریز' },
                    { id: 'sm', label: 'ریز (هلو)' },
                    { id: 'base', label: 'استاندارد' },
                    { id: 'lg', label: 'درشت' },
                  ] as { id: 'xs' | 'sm' | 'base' | 'lg'; label: string }[]
                ).map((fs) => (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => setConfig({ ...config, fontSize: fs.id })}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      config.fontSize === fs.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Style */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100">
                <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                <span>قالب گرافیکی فاکتور:</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'holoo_classic', label: 'کلاسیک هلو' },
                    { id: 'official', label: 'رسمی شرکتی' },
                    { id: 'compact_bazaar', label: 'فشرده بازاری' },
                  ] as { id: InvoiceTemplateStyle; label: string }[]
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setConfig({ ...config, templateStyle: tpl.id })}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      config.templateStyle === tpl.id
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Color */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                تم رنگی سربرگ و جداول:
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'holoo-teal', label: 'سبز کله‌غازی هلو', color: 'bg-teal-700' },
                    { id: 'holoo-blue', label: 'آبی تجاری', color: 'bg-blue-700' },
                    { id: 'classic-indigo', label: 'سرمه‌ای کلاسیک', color: 'bg-indigo-700' },
                    { id: 'emerald', label: 'زمردی بازاری', color: 'bg-emerald-700' },
                    { id: 'monochrome', label: 'سیاه و سفید اداری', color: 'bg-slate-800' },
                  ] as { id: HolooPrintTheme; label: string; color: string }[]
                ).map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setConfig({ ...config, theme: th.id })}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                      config.theme === th.id
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${th.color}`} />
                    <span>{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Visibility Switches */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                تغییر وضعیت نمایش بخش‌های فاکتور:
              </span>
              <div className="space-y-2 text-xs">
                {[
                  { key: 'showCustomerBalance', label: 'نمایش مانده قبلی و مانده جدید مشتری در سربرگ' },
                  { key: 'showGuildName', label: 'نمایش نام صنف و رسته شغلی در سربرگ' },
                  { key: 'showEconomicCode', label: 'نمایش کد اقتصادی و شناسه ملی' },
                  { key: 'showStoreLogo', label: 'نمایش لوگو و برند فروشگاه' },
                  { key: 'showColorSize', label: 'نمایش ستون ویژگی‌های ظاهری کالا (رنگ، سایز، جنس)' },
                  { key: 'showDiscount', label: 'نمایش ستون تخفیفات ردیف‌ها' },
                  { key: 'showTax', label: 'نمایش ستون ارزش افزوده / مالیات' },
                  { key: 'showPaymentBreakdown', label: 'نمایش تفکیک دریافت وجه (نقد، پوز، چک)' },
                  { key: 'showAmountInWords', label: 'نمایش مبلغ نهایی به حروف' },
                  { key: 'showSignatures', label: 'نمایش کادر مهر و امضای طرفین' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100/70"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean((config as any)[item.key])}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Alignments for Every Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                تراز متن و جهت‌گیری اجزای فاکتور (راست‌چین / وسط‌چین / چپ‌چین):
              </span>
              <div className="space-y-1.5">
                {[
                  {
                    key: 'headerAlignment',
                    label: 'سربرگ و عنوان فاکتور',
                    val: config.headerAlignment || 'center',
                  },
                  {
                    key: 'customerInfoAlignment',
                    label: 'مشخصات خریدار و طرف حساب',
                    val: config.customerInfoAlignment || 'right',
                  },
                  {
                    key: 'tableHeaderAlignment',
                    label: 'عناوین سرستون‌های جدول اقلام',
                    val: config.tableHeaderAlignment || 'right',
                  },
                  {
                    key: 'tableBodyAlignment',
                    label: 'شرح و مشخصات کالا در جدول',
                    val: config.tableBodyAlignment || 'right',
                  },
                  {
                    key: 'notesAlignment',
                    label: 'توضیحات و پیام تشکر ذیل فاکتور',
                    val: config.notesAlignment || 'right',
                  },
                  {
                    key: 'termsAlignment',
                    label: 'شرایط و قوانین تسویه و مرجوعی',
                    val: config.termsAlignment || 'right',
                  },
                  {
                    key: 'signaturesAlignment',
                    label: 'کادر مهر و امضای طرفین',
                    val: config.signaturesAlignment || 'center',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700"
                  >
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {(['right', 'center', 'left'] as const).map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setConfig({ ...config, [item.key]: dir })}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition ${
                            item.val === dir
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {dir === 'right' ? 'راست' : dir === 'center' ? 'وسط' : 'چپ'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                عنوان فاکتور
              </label>
              <input
                type="text"
                value={config.customTitle || ''}
                onChange={(e) => setConfig({ ...config, customTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />

              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 pt-2">
                پیام تشکر / پاورقی
              </label>
              <input
                type="text"
                value={config.customFooterNote || ''}
                onChange={(e) => setConfig({ ...config, customFooterNote: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />

              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 pt-2">
                شرایط و قوانین پایین فاکتور (تسویه و مرجوعی)
              </label>
              <textarea
                rows={2}
                value={config.customTerms || ''}
                onChange={(e) => setConfig({ ...config, customTerms: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-7 p-5 bg-slate-100/60 dark:bg-slate-950/60 overflow-y-auto max-h-[75vh]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>پیش‌نمایش زنده فاکتور (در اندازه و استایل تنظیمی):</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                فونت: {config.fontSize || 'sm'}
              </span>
            </div>

            {/* Simulated Live Invoice Container */}
            <div className={`bg-white text-slate-900 p-5 rounded-2xl shadow-xl border-2 border-slate-400 space-y-4 ${fontSizeClass} select-none`}>
              {/* Header Box */}
              <div
                className={`border border-slate-400 rounded-xl p-3 bg-slate-50 flex items-center justify-between ${
                  config.headerAlignment === 'center'
                    ? 'text-center'
                    : config.headerAlignment === 'left'
                    ? 'text-left'
                    : 'text-right'
                }`}
              >
                <div
                  className={`flex-1 ${
                    config.headerAlignment === 'center'
                      ? 'text-center'
                      : config.headerAlignment === 'left'
                      ? 'text-left'
                      : 'text-right'
                  }`}
                >
                  <h4 className="font-black text-slate-900 text-sm">
                    {settings.storeName}
                  </h4>
                  {config.showGuildName && (
                    <p className="text-[10px] text-teal-800 font-bold mt-0.5">
                      {settings.guildName || 'صنف خرازی، خیاطی و ملزومات پوشاک'}
                    </p>
                  )}
                  <p className="text-[10.5px] text-slate-600 font-bold mt-0.5">
                    {config.customTitle}
                  </p>
                </div>
                <div className="text-left text-[10.5px] space-y-0.5 font-mono shrink-0 pr-4">
                  <div>شماره: INV-۱۴۰۳</div>
                  <div>تاریخ: ۱۴۰۳/۰۷/۱۵</div>
                  {config.showEconomicCode && (
                    <div className="text-[10px] text-slate-500">
                      کد اقتصادی: {toPersianDigits(settings.economicCode || '۴۱۱۵۶۷۸۹۲۳۴۱')}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info Box */}
              <div
                className={`border border-slate-300 rounded-xl p-2.5 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 text-[10.5px] ${
                  config.customerInfoAlignment === 'center'
                    ? 'justify-center text-center'
                    : config.customerInfoAlignment === 'left'
                    ? 'justify-end text-left'
                    : 'text-right'
                }`}
              >
                <div>
                  خریدار: <strong>شرکت بازرگانی سپهر (جناب آقای رضایی)</strong>
                </div>
                <div>همراه: ۰۹۱۲۳۴۵۶۷۸۹</div>
                {config.showCustomerBalance && (
                  <div className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    مانده قبلی: {formatCurrency(4850000)} (بدهکار)
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400">
                  <thead className="bg-teal-700 text-white font-bold">
                    <tr>
                      <th className="p-1.5 border border-slate-400 text-center">ردیف</th>
                      {config.showBarcode && <th className="p-1.5 border border-slate-400">کد کالا</th>}
                      <th
                        className={`p-1.5 border border-slate-400 ${
                          config.tableHeaderAlignment === 'center'
                            ? 'text-center'
                            : config.tableHeaderAlignment === 'left'
                            ? 'text-left'
                            : 'text-right'
                        }`}
                      >
                        شرح کالا
                      </th>
                      {config.showColorSize && <th className="p-1.5 border border-slate-400">رنگ و سایز</th>}
                      <th className="p-1.5 border border-slate-400 text-center">مقدار</th>
                      <th className="p-1.5 border border-slate-400 text-center">فی واحد</th>
                      {config.showDiscount && <th className="p-1.5 border border-slate-400 text-center">تخفیف</th>}
                      <th className="p-1.5 border border-slate-400 text-center">مبلغ کل (ریال)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1.5 border border-slate-300 text-center">۱</td>
                      {config.showBarcode && <td className="p-1.5 border border-slate-300 font-mono">SP-1001</td>}
                      <td
                        className={`p-1.5 border border-slate-300 font-bold ${
                          config.tableBodyAlignment === 'center'
                            ? 'text-center'
                            : config.tableBodyAlignment === 'left'
                            ? 'text-left'
                            : 'text-right'
                        }`}
                      >
                        کالای نمونه مدل آلفا
                      </td>
                      {config.showColorSize && <td className="p-1.5 border border-slate-300">سرمه‌ای (بسته ۲۵ عددی)</td>}
                      <td className="p-1.5 border border-slate-300 text-center">۲ بسته</td>
                      <td className="p-1.5 border border-slate-300 text-center font-bold">۹۵۰,۰۰۰</td>
                      {config.showDiscount && <td className="p-1.5 border border-slate-300 text-center">۰</td>}
                      <td className="p-1.5 border border-slate-300 text-center font-black">۱,۹۰۰,۰۰۰</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-1.5 border border-slate-300 text-center">۲</td>
                      {config.showBarcode && <td className="p-1.5 border border-slate-300 font-mono">SP-2001</td>}
                      <td
                        className={`p-1.5 border border-slate-300 font-bold ${
                          config.tableBodyAlignment === 'center'
                            ? 'text-center'
                            : config.tableBodyAlignment === 'left'
                            ? 'text-left'
                            : 'text-right'
                        }`}
                      >
                        کالای بازرگانی سری بتا
                      </td>
                      {config.showColorSize && <td className="p-1.5 border border-slate-300">مشکی ۵۰ عددی</td>}
                      <td className="p-1.5 border border-slate-300 text-center">۵ عدد</td>
                      <td className="p-1.5 border border-slate-300 text-center font-bold">۶۵,۰۰۰</td>
                      {config.showDiscount && <td className="p-1.5 border border-slate-300 text-center">۲۵,۰۰۰</td>}
                      <td className="p-1.5 border border-slate-300 text-center font-black">۳۰۰,۰۰۰</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-2 font-bold">
                {config.showAmountInWords && (
                  <div className="text-[10px] text-slate-600">
                    مبلغ به حروف: دو میلیون و دویست هزار ریال
                  </div>
                )}
                <div className="text-left text-xs space-y-0.5">
                  <div>جمع فاکتور: ۲,۲۰۰,۰۰۰ ریال</div>
                  {config.showCustomerBalance && (
                    <div className="text-teal-800">
                      مانده نهایی طرف‌حساب: ۷,۰۵۰,۰۰۰ ریال
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Note */}
              {config.customFooterNote && (
                <div
                  className={`text-[10.5px] text-slate-700 italic ${
                    config.notesAlignment === 'center'
                      ? 'text-center'
                      : config.notesAlignment === 'left'
                      ? 'text-left'
                      : 'text-right'
                  }`}
                >
                  {config.customFooterNote}
                </div>
              )}

              {/* Terms */}
              {config.customTerms && (
                <div
                  className={`p-2 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600 ${
                    config.termsAlignment === 'center'
                      ? 'text-center'
                      : config.termsAlignment === 'left'
                      ? 'text-left'
                      : 'text-right'
                  }`}
                >
                  {config.customTerms}
                </div>
              )}

              {/* Signatures */}
              {config.showSignatures && (
                <div
                  className={`grid grid-cols-2 gap-4 pt-4 text-[10px] text-slate-500 border-t border-dashed border-slate-300 ${
                    config.signaturesAlignment === 'center'
                      ? 'text-center'
                      : config.signaturesAlignment === 'left'
                      ? 'text-left'
                      : 'text-right'
                  }`}
                >
                  <div>مهر و امضای فروشنده</div>
                  <div>مهر و امضای خریدار</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات چاپ فاکتور'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
