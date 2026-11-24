import React, { useState } from 'react';
import {
  Printer,
  Sliders,
  X,
  Building,
  Hash,
  FileCheck,
  LayoutTemplate,
} from 'lucide-react';
import {
  Invoice,
  StoreSettings,
  HolooPrintTheme,
  InvoiceTemplateStyle,
} from '../../types/index.ts';
import { toPersianDigits, numberToPersianWords } from '../../lib/formatters.ts';

interface HolooInvoicePrintProps {
  invoice: Invoice;
  settings: StoreSettings;
  onClose: () => void;
  currentPersonBalance?: number;
}

export const HolooInvoicePrint: React.FC<HolooInvoicePrintProps> = ({
  invoice,
  settings,
  onClose,
  currentPersonBalance,
}) => {
  const [templateStyle, setTemplateStyle] = useState<InvoiceTemplateStyle>(
    invoice.printConfig?.templateStyle || 'holoo_classic'
  );
  const [theme, setTheme] = useState<HolooPrintTheme>(invoice.printConfig?.theme || 'holoo-teal');
  const [paperSize, setPaperSize] = useState<'a4' | 'a5' | 'thermal_80'>(
    invoice.printConfig?.paperSize || 'a4'
  );
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    invoice.printConfig?.orientation || 'portrait'
  );
  const [showProductCode, setShowProductCode] = useState<boolean>(
    invoice.printConfig?.showBarcode ?? true
  );
  const [showTax, setShowTax] = useState<boolean>(invoice.printConfig?.showTax ?? true);
  const [showDiscount, setShowDiscount] = useState<boolean>(
    invoice.printConfig?.showDiscount ?? true
  );
  const [showColorSize, setShowColorSize] = useState<boolean>(
    invoice.printConfig?.showColorSize ?? true
  );
  const [showAmountInWords, setShowAmountInWords] = useState<boolean>(
    invoice.printConfig?.showAmountInWords ?? true
  );
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState<boolean>(
    invoice.printConfig?.showPaymentBreakdown ?? true
  );
  const [showSignatures, setShowSignatures] = useState<boolean>(
    invoice.printConfig?.showSignatures ?? true
  );
  const [showStoreLogo, setShowStoreLogo] = useState<boolean>(
    invoice.printConfig?.showStoreLogo ?? true
  );

  const invoiceTypeTitles: Record<string, string> = {
    sale: 'فاکتور فروش کالا',
    purchase: 'فاکتور خرید کالا',
    proforma: 'پیش‌فاکتور فروش',
    consignment: 'برگه تحویل کالای امانی',
    sale_return: 'فاکتور برگشت از فروش',
    return_sale: 'فاکتور برگشت از فروش',
    purchase_return: 'فاکتور برگشت از خرید',
    return_purchase: 'فاکتور برگشت از خرید',
    waste: 'سند ضایعات و کسری انبار',
  };

  const defaultTitle = invoiceTypeTitles[invoice.invoiceType] || 'فاکتور فروش کالا';
  const [customTitle, setCustomTitle] = useState<string>(
    invoice.printConfig?.customTitle || defaultTitle
  );
  const [customSlogan, setCustomSlogan] = useState<string>(
    invoice.printConfig?.customSlogan || 'توزیع تخصصی روبان، دکمه، زیپ، نخ و ملزومات خیاطی'
  );
  const [customFooterNote, setCustomFooterNote] = useState<string>(
    invoice.printConfig?.customFooterNote ||
      settings.printFooterNote ||
      'از خرید و همکاری شما سپاسگزاریم.'
  );
  const [customTerms, setCustomTerms] = useState<string>(
    invoice.printConfig?.customTerms ||
      'شرایط: اجناس برش‌خورده (روبان، تور و کش) مرجوع نمی‌گردد. تعویض سایر اقلام تا ۴۸ ساعت با ارائه فاکتور امکان‌پذیر است.'
  );

  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);

  const themeStyles = {
    'holoo-teal': {
      primaryBg: 'bg-teal-700',
      primaryText: 'text-teal-800',
      borderColor: 'border-teal-700',
      subtleBg: 'bg-teal-50',
      headerBg: 'bg-teal-700 text-white',
    },
    'holoo-blue': {
      primaryBg: 'bg-sky-700',
      primaryText: 'text-sky-800',
      borderColor: 'border-sky-700',
      subtleBg: 'bg-sky-50',
      headerBg: 'bg-sky-700 text-white',
    },
    'classic-indigo': {
      primaryBg: 'bg-indigo-800',
      primaryText: 'text-indigo-900',
      borderColor: 'border-indigo-800',
      subtleBg: 'bg-indigo-50/70',
      headerBg: 'bg-indigo-800 text-white',
    },
    emerald: {
      primaryBg: 'bg-emerald-800',
      primaryText: 'text-emerald-900',
      borderColor: 'border-emerald-800',
      subtleBg: 'bg-emerald-50',
      headerBg: 'bg-emerald-800 text-white',
    },
    monochrome: {
      primaryBg: 'bg-neutral-800',
      primaryText: 'text-neutral-900',
      borderColor: 'border-neutral-800',
      subtleBg: 'bg-neutral-100',
      headerBg: 'bg-neutral-800 text-white',
    },
  }[theme];

  const handlePrint = () => {
    window.print();
  };

  const amountInWords = numberToPersianWords(invoice.finalAmount);
  const prevBalance =
    invoice.personPreviousBalance !== undefined
      ? invoice.personPreviousBalance
      : currentPersonBalance !== undefined
      ? currentPersonBalance - (invoice.invoiceType === 'sale' ? invoice.remainingAmount : 0)
      : 0;
  const newBalanceAfterInvoice =
    invoice.invoiceType === 'sale'
      ? prevBalance + invoice.remainingAmount
      : invoice.invoiceType === 'purchase'
      ? prevBalance - invoice.remainingAmount
      : invoice.invoiceType === 'sale_return' || invoice.invoiceType === 'return_sale'
      ? prevBalance - invoice.finalAmount
      : prevBalance;

  const isProforma = invoice.invoiceType === 'proforma';

  const activeFontSize = invoice.printConfig?.fontSize || settings.invoicePrintConfig?.fontSize || 'sm';
  const fontSizeClass = {
    xs: 'text-[9.5px]',
    sm: 'text-[11px]',
    base: 'text-xs',
    lg: 'text-sm',
  }[activeFontSize];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4 print:p-0 print:bg-white print:overflow-visible">
      {/* نوار ابزار بالای پیش‌نمایش چاپ (مخفی در زمان چاپ) */}
      <div className="w-full max-w-5xl mb-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold">پیش‌نمایش و چاپ فاکتور</h2>
              <p className="text-[11px] text-slate-300">
                شماره {toPersianDigits(invoice.invoiceNumber)} — {invoice.personName}
              </p>
            </div>
          </div>

          {/* انتخاب‌گر سریع ۳ قالب چاپی (رسمی، کلاسیک هلو، فشرده/بازاری) */}
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 gap-1">
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-400 mr-1" />
            {(
              [
                { id: 'official', label: 'قالب رسمی' },
                { id: 'holoo_classic', label: 'کلاسیک هلو' },
                { id: 'compact_bazaar', label: 'فشرده / بازاری' },
              ] as { id: InvoiceTemplateStyle; label: string }[]
            ).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplateStyle(tpl.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  templateStyle === tpl.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>تنظیمات چاپ</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ فاکتور</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* پنل تنظیمات چاپ */}
      {isCustomizeOpen && (
        <div className="w-full max-w-5xl mb-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl print:hidden text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* رنگ‌بندی */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1.5">
                تم رنگی چاپ
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'holoo-teal', name: 'سبز هلو', color: 'bg-teal-600' },
                  { id: 'holoo-blue', name: 'آبی کلاسیک', color: 'bg-sky-600' },
                  { id: 'classic-indigo', name: 'سرمه‌ای رسمی', color: 'bg-indigo-700' },
                  { id: 'emerald', name: 'زمردی', color: 'bg-emerald-600' },
                  { id: 'monochrome', name: 'سیاه‌وسفید لیزری', color: 'bg-neutral-800' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id as HolooPrintTheme)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-right transition cursor-pointer ${
                      theme === th.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 font-bold'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${th.color}`} />
                    <span className="text-[11px]">{th.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ابعاد کاغذ */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1.5">
                ابعاد و جهت کاغذ
              </label>
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  {[
                    { id: 'a4', label: 'A4' },
                    { id: 'a5', label: 'A5' },
                    { id: 'thermal_80', label: 'فیش ۸۰mm' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setPaperSize(sz.id as any)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-center text-[11px] transition cursor-pointer ${
                        paperSize === sz.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
                {paperSize !== 'thermal_80' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`flex-1 py-1 px-2 rounded-lg border text-center text-[11px] cursor-pointer ${
                        orientation === 'portrait'
                          ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-700'
                          : 'border-slate-200'
                      }`}
                    >
                      عمودی
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`flex-1 py-1 px-2 rounded-lg border text-center text-[11px] cursor-pointer ${
                        orientation === 'landscape'
                          ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-700'
                          : 'border-slate-200'
                      }`}
                    >
                      افقی
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ستون‌ها */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1.5">
                ستون‌های جدول
              </label>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductCode}
                    onChange={(e) => setShowProductCode(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>کد کالا</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDiscount}
                    onChange={(e) => setShowDiscount(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>تخفیف</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTax}
                    onChange={(e) => setShowTax(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>مالیات</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showColorSize}
                    onChange={(e) => setShowColorSize(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>رنگ و سایز</span>
                </label>
              </div>
            </div>

            {/* اجزای پاورقی */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1.5">
                اجزای فاکتور
              </label>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAmountInWords}
                    onChange={(e) => setShowAmountInWords(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>مبلغ به حروف</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPaymentBreakdown}
                    onChange={(e) => setShowPaymentBreakdown(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>مانده حساب شخص</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSignatures}
                    onChange={(e) => setShowSignatures(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>امضا و مهر</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreLogo}
                    onChange={(e) => setShowStoreLogo(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>نشان فروشگاه</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-500 text-[10px] mb-1 font-bold">عنوان سند</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] mb-1 font-bold">زیرعنوان فروشگاه</label>
              <input
                type="text"
                value={customSlogan}
                onChange={(e) => setCustomSlogan(e.target.value)}
                className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] mb-1 font-bold">توضیحات پاورقی</label>
              <input
                type="text"
                value={customFooterNote}
                onChange={(e) => setCustomFooterNote(e.target.value)}
                className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* بوم اصلی چاپ فاکتور */}
      <div
        id="holoo-printable-invoice"
        dir="rtl"
        className={`bg-white text-slate-900 shadow-2xl transition-all relative ${fontSizeClass} ${
          templateStyle === 'compact_bazaar' || paperSize === 'thermal_80'
            ? paperSize === 'thermal_80'
              ? 'w-[340px] p-3 leading-tight'
              : 'w-full max-w-[680px] p-4 sm:p-5'
            : paperSize === 'a5'
            ? 'w-full max-w-[740px] p-5'
            : orientation === 'landscape'
            ? 'w-full max-w-[1080px] p-6'
            : 'w-full max-w-[860px] p-6 sm:p-8'
        }`}
        style={{
          boxSizing: 'border-box',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        {/* واترمارک وضعیت */}
        {invoice.status === 'cancelled' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-15 rotate-[-30deg]">
            <span className="text-7xl sm:text-8xl font-black text-rose-600 border-8 border-rose-600 p-6 rounded-2xl">
              باطل شد
            </span>
          </div>
        )}
        {isProforma && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-10 rotate-[-25deg]">
            <span className="text-6xl sm:text-7xl font-black text-teal-700 border-8 border-teal-700 p-6 rounded-2xl">
              پیش‌فاکتور
            </span>
          </div>
        )}

        {/* =========================================================
            قالب ۱: رسمی مالیاتی (Official Tax / Corporate Template)
           ========================================================= */}
        {templateStyle === 'official' && (
          <div>
            <div className="border-2 border-slate-900 rounded-lg p-3 mb-3">
              <div className="grid grid-cols-3 items-center border-b-2 border-slate-900 pb-2.5 mb-2.5">
                <div className="text-right">
                  <div className="font-black text-base text-slate-900">{settings.storeName}</div>
                  <div className="text-[11px] text-slate-600">{customSlogan}</div>
                </div>
                <div className="text-center">
                  <span className="inline-block border-2 border-slate-900 bg-slate-100 text-slate-900 font-black px-5 py-1 rounded text-sm">
                    صورتحساب {customTitle} (رسمی)
                  </span>
                </div>
                <div className="text-left text-[11.5px] space-y-0.5">
                  <div>
                    شماره سریال: <strong className="font-black">{toPersianDigits(invoice.invoiceNumber)}</strong>
                  </div>
                  <div>
                    تاریخ صدور: <strong className="font-black">{toPersianDigits(invoice.date)}</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11.5px]">
                <div className="border border-slate-400 rounded p-2 bg-slate-50">
                  <div className="font-black text-slate-900 border-b border-slate-300 pb-1 mb-1">
                    مشخصات فروشنده: {settings.storeName} ({settings.storeOwner})
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>شماره اقتصادی: {toPersianDigits('411548721984')}</span>
                    <span>تلفن: {toPersianDigits(settings.phone)}</span>
                  </div>
                  <div className="text-slate-700 mt-0.5">نشانی: {settings.address}</div>
                </div>

                <div className="border border-slate-400 rounded p-2 bg-slate-50">
                  <div className="font-black text-slate-900 border-b border-slate-300 pb-1 mb-1">
                    مشخصات خریدار / طرف حساب: {invoice.personName}
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>کد طرف حساب: {toPersianDigits(invoice.personId.replace('per-', ''))}</span>
                    <span>انبار: {invoice.warehouseName || 'انبار مرکزی'}</span>
                  </div>
                  <div className="text-slate-700 mt-0.5">
                    وضعیت سند: {invoice.status === 'approved' ? 'قطعی' : 'پیش‌نویس'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            قالب ۲: کلاسیک هلو (Holoo Classic ERP Template)
           ========================================================= */}
        {templateStyle === 'holoo_classic' && (
          <div className={`border-2 ${themeStyles.borderColor} rounded-xl overflow-hidden mb-3`}>
            <div
              className={`${themeStyles.headerBg} px-4 py-2.5 flex items-center justify-between border-b ${themeStyles.borderColor}`}
            >
              <div className="flex items-center gap-3">
                {showStoreLogo && (
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-black text-base border border-white/30 text-white">
                    نگین
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black">{settings.storeName}</h1>
                  <p className="text-[10px] opacity-90">{customSlogan}</p>
                </div>
              </div>

              <div className="text-center">
                <span className="inline-block bg-white text-slate-900 font-black px-4 py-1 rounded-md text-xs shadow-xs">
                  {customTitle}
                </span>
              </div>

              <div className="text-left text-[11px] leading-relaxed">
                <div>
                  <span>شماره فاکتور: </span>
                  <span className="font-black">{toPersianDigits(invoice.invoiceNumber)}</span>
                </div>
                <div>
                  <span>تاریخ: </span>
                  <span className="font-black">{toPersianDigits(invoice.date)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 text-[11.5px] bg-slate-50">
              <div className="p-2.5 space-y-1">
                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-700" />
                  <span>فروشنده:</span>
                  <span className="text-slate-900 font-black">{settings.storeName}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  تلفن: <span className="font-bold text-slate-800">{toPersianDigits(settings.phone)}</span> | نشانی: {settings.address}
                </div>
              </div>

              <div className="p-2.5 space-y-1">
                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-teal-700" />
                  <span>طرف حساب:</span>
                  <span className="text-slate-900 font-black">{invoice.personName}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>انبار: {invoice.warehouseName || 'انبار مرکزی'}</span>
                  <span>
                    مانده قبلی:{' '}
                    <strong className="text-slate-900">
                      {toPersianDigits(Math.abs(prevBalance).toLocaleString('fa-IR'))}{' '}
                      {prevBalance > 0 ? 'بدهکار' : prevBalance < 0 ? 'بستانکار' : 'تسویه'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            قالب ۳: فشرده / بازاری (Compact Bazaar Receipt Template)
           ========================================================= */}
        {templateStyle === 'compact_bazaar' && (
          <div className="border-b-2 border-slate-900 pb-2 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black text-sm text-slate-900">{settings.storeName}</div>
                <div className="text-[10.5px] text-slate-600">تلفن: {toPersianDigits(settings.phone)}</div>
              </div>
              <div className="text-center border border-slate-900 px-3 py-0.5 rounded font-black text-xs">
                {customTitle}
              </div>
              <div className="text-left text-[11px]">
                <div>شماره: <strong>{toPersianDigits(invoice.invoiceNumber)}</strong></div>
                <div>تاریخ: <strong>{toPersianDigits(invoice.date)}</strong></div>
              </div>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-400 flex flex-wrap items-center justify-between text-[11px]">
              <div>
                طرف حساب: <strong className="font-black">{invoice.personName}</strong>
              </div>
              <div>
                حساب قبلی:{' '}
                <strong>
                  {toPersianDigits(Math.abs(prevBalance).toLocaleString('fa-IR'))}{' '}
                  {prevBalance > 0 ? 'بد' : prevBalance < 0 ? 'بس' : '۰'}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* جدول اقلام فاکتور */}
        <div
          className={`border-2 ${
            templateStyle === 'official' || templateStyle === 'compact_bazaar'
              ? 'border-slate-900 rounded-lg'
              : `${themeStyles.borderColor} rounded-xl`
          } overflow-hidden mb-3`}
        >
          <table className="w-full text-right border-collapse">
            <thead>
              <tr
                className={`${
                  templateStyle === 'official'
                    ? 'bg-slate-900 text-white'
                    : templateStyle === 'compact_bazaar'
                    ? 'bg-slate-200 text-slate-900 border-b-2 border-slate-900'
                    : themeStyles.headerBg
                } text-[11px] font-bold`}
              >
                <th className="py-1.5 px-2 text-center w-8 border-l border-slate-400/40">ردیف</th>
                {showProductCode && templateStyle !== 'compact_bazaar' && (
                  <th className="py-1.5 px-2 text-center w-20 border-l border-slate-400/40">کد کالا</th>
                )}
                <th className="py-1.5 px-2.5 border-l border-slate-400/40">شرح کالا</th>
                {showColorSize && templateStyle !== 'compact_bazaar' && (
                  <th className="py-1.5 px-2 text-center w-20 border-l border-slate-400/40">مشخصه</th>
                )}
                <th className="py-1.5 px-2 text-center w-14 border-l border-slate-400/40">تعداد/مقدار</th>
                <th className="py-1.5 px-2 text-center w-14 border-l border-slate-400/40">واحد</th>
                <th className="py-1.5 px-2 text-left w-24 border-l border-slate-400/40">فی (ریال)</th>
                {showDiscount && templateStyle !== 'compact_bazaar' && (
                  <th className="py-1.5 px-2 text-left w-20 border-l border-slate-400/40">تخفیف</th>
                )}
                {showTax && templateStyle === 'official' && (
                  <th className="py-1.5 px-2 text-left w-20 border-l border-slate-400/40">مالیات</th>
                )}
                <th className="py-1.5 px-2.5 text-left w-28">مبلغ کل (ریال)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 text-[11.5px]">
              {invoice.items.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                >
                  <td className="py-1.5 px-2 text-center font-bold text-slate-600 border-l border-slate-200">
                    {toPersianDigits(idx + 1)}
                  </td>
                  {showProductCode && templateStyle !== 'compact_bazaar' && (
                    <td className="py-1.5 px-2 text-center text-[10.5px] text-slate-600 border-l border-slate-200">
                      {toPersianDigits(item.productCode)}
                    </td>
                  )}
                  <td className="py-1.5 px-2.5 font-bold text-slate-900 border-l border-slate-200">
                    {item.productName}
                  </td>
                  {showColorSize && templateStyle !== 'compact_bazaar' && (
                    <td className="py-1.5 px-2 text-center text-slate-600 border-l border-slate-200">
                      {[item.color, item.size].filter(Boolean).join(' - ') || '—'}
                    </td>
                  )}
                  <td className="py-1.5 px-2 text-center font-black text-slate-900 border-l border-slate-200">
                    {toPersianDigits(item.quantity)}
                  </td>
                  <td className="py-1.5 px-2 text-center text-slate-700 border-l border-slate-200">
                    {item.unitName}
                  </td>
                  <td className="py-1.5 px-2 text-left font-bold text-slate-800 border-l border-slate-200">
                    {toPersianDigits(Math.round(item.unitPrice).toLocaleString('fa-IR'))}
                  </td>
                  {showDiscount && templateStyle !== 'compact_bazaar' && (
                    <td className="py-1.5 px-2 text-left text-rose-700 border-l border-slate-200">
                      {item.discount > 0 ? toPersianDigits(item.discount.toLocaleString('fa-IR')) : '۰'}
                    </td>
                  )}
                  {showTax && templateStyle === 'official' && (
                    <td className="py-1.5 px-2 text-left text-slate-700 border-l border-slate-200">
                      {item.tax > 0 ? toPersianDigits(item.tax.toLocaleString('fa-IR')) : '۰'}
                    </td>
                  )}
                  <td className="py-1.5 px-2.5 text-left font-black text-slate-900">
                    {toPersianDigits(Math.round(item.totalPrice).toLocaleString('fa-IR'))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* خلاصه مالی، تسویه و مانده حساب قبلی/جدید */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
          <div className="sm:col-span-7 flex flex-col justify-between space-y-2 border border-slate-300 rounded-lg p-3 bg-slate-50">
            {showAmountInWords && (
              <div className="text-[11.5px] border-b border-slate-200 pb-1.5">
                <span className="font-bold text-slate-700">مبلغ کل به حروف: </span>
                <span className="font-black text-slate-900">{amountInWords}</span>
              </div>
            )}

            {showPaymentBreakdown && (
              <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-500 block">مانده حساب قبلی:</span>
                  <strong className="font-black text-slate-800">
                    {toPersianDigits(Math.abs(prevBalance).toLocaleString('fa-IR'))}{' '}
                    {prevBalance > 0 ? 'بدهکار' : prevBalance < 0 ? 'بستانکار' : 'تسویه'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">دریافتی / پرداختی فعلی:</span>
                  <strong className="font-black text-emerald-700">
                    {toPersianDigits(invoice.paidAmount.toLocaleString('fa-IR'))} ریال
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">مانده نهایی حساب:</span>
                  <strong className="font-black text-indigo-900">
                    {toPersianDigits(Math.abs(newBalanceAfterInvoice).toLocaleString('fa-IR'))}{' '}
                    {newBalanceAfterInvoice > 0
                      ? 'بدهکار'
                      : newBalanceAfterInvoice < 0
                      ? 'بستانکار'
                      : 'تسویه'}
                  </strong>
                </div>
              </div>
            )}

            <div className="text-[10.5px] text-slate-600 leading-relaxed">{customTerms}</div>
          </div>

          <div className="sm:col-span-5 border-2 border-slate-800 rounded-lg overflow-hidden text-[11.5px]">
            <div className="bg-slate-100 px-3 py-1.5 flex justify-between border-b border-slate-300">
              <span className="text-slate-700">جمع کل اقلام:</span>
              <span className="font-bold text-slate-900">
                {toPersianDigits(invoice.subtotal.toLocaleString('fa-IR'))} ریال
              </span>
            </div>
            {invoice.totalDiscount > 0 && (
              <div className="bg-white px-3 py-1.5 flex justify-between border-b border-slate-300 text-rose-700">
                <span>تخفیف فاکتور:</span>
                <span className="font-bold">
                  {toPersianDigits(invoice.totalDiscount.toLocaleString('fa-IR'))}- ریال
                </span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className="bg-white px-3 py-1.5 flex justify-between border-b border-slate-300">
                <span className="text-slate-700">مالیات و عوارض:</span>
                <span className="font-bold text-slate-900">
                  {toPersianDigits(invoice.taxAmount.toLocaleString('fa-IR'))} ریال
                </span>
              </div>
            )}
            <div
              className={`${
                templateStyle === 'official' || templateStyle === 'compact_bazaar'
                  ? 'bg-slate-900 text-white'
                  : themeStyles.headerBg
              } px-3 py-2 flex justify-between items-center text-[13px] font-black`}
            >
              <span>مبلغ قابل پرداخت:</span>
              <span>{toPersianDigits(invoice.finalAmount.toLocaleString('fa-IR'))} ریال</span>
            </div>
          </div>
        </div>

        {/* کادرهای امضا */}
        {showSignatures && (
          <div className="mt-3 pt-2.5 border-t border-slate-300 grid grid-cols-3 gap-3 text-center text-[11px] text-slate-700">
            <div className="p-2 border border-dashed border-slate-400 rounded-lg h-20 flex flex-col justify-between">
              <span className="font-bold">امضای خریدار / تحویل‌گیرنده</span>
              <span className="text-[10px] text-slate-400">اجناس صحیح و سالم تحویل شد</span>
            </div>
            <div className="p-2 border border-dashed border-slate-400 rounded-lg h-20 flex flex-col justify-between">
              <span className="font-bold">امضای صادرکننده</span>
              <span className="text-[10px] text-slate-600 font-bold">{invoice.createdBy}</span>
            </div>
            <div className="p-2 border border-dashed border-slate-400 rounded-lg h-20 flex flex-col justify-between">
              <span className="font-bold">مهر و امضای فروشگاه</span>
              <span className="text-[10px] text-slate-500">{settings.storeName}</span>
            </div>
          </div>
        )}

        <div className="mt-2.5 text-center text-[11px] text-slate-600 font-bold">
          {customFooterNote}
        </div>
      </div>
    </div>
  );
};
