import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  X,
  Check,
  FileText,
  Calendar,
  User,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';
import { Invoice, InvoiceItem } from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';

interface InvoiceReferencePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  personId?: string;
  isSaleReturn?: boolean;
  onSelectReferenceInvoice: (invoice: Invoice, returnItems: InvoiceItem[]) => void;
}

export const InvoiceReferencePickerModal: React.FC<InvoiceReferencePickerModalProps> = ({
  isOpen,
  onClose,
  invoices,
  personId,
  isSaleReturn = true,
  onSelectReferenceInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Record<string, number>>({});

  const targetType = isSaleReturn ? 'sale' : 'purchase';

  // Filter invoices matching target type (and optionally personId)
  const candidateInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return invoices
      .filter((inv) => inv.invoiceType === targetType && inv.status !== 'cancelled')
      .filter((inv) => {
        if (!personId) return true;
        return inv.personId === personId;
      })
      .filter((inv) => {
        if (!q) return true;
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.personName.toLowerCase().includes(q) ||
          inv.date.includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, targetType, personId, searchTerm]);

  // Current selected reference invoice
  const activeInvoice = useMemo(() => {
    return candidateInvoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [candidateInvoices, selectedInvoiceId]);

  // Handle invoice selection
  const handlePickInvoice = (inv: Invoice) => {
    setSelectedInvoiceId(inv.id);
    const initialQty: Record<string, number> = {};
    inv.items.forEach((it) => {
      // Default to returning 1 or full quantity
      initialQty[it.id] = it.quantity;
    });
    setSelectedItemQuantities(initialQty);
  };

  const handleConfirm = () => {
    if (!activeInvoice) return;

    // Filter items where return quantity > 0
    const returnItems: InvoiceItem[] = [];
    activeInvoice.items.forEach((it) => {
      const returnQty = selectedItemQuantities[it.id] || 0;
      if (returnQty > 0) {
        const factor = it.conversionFactor || 1;
        returnItems.push({
          ...it,
          id: `ret-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          quantity: returnQty,
          baseQuantity: returnQty * factor,
          totalPrice: returnQty * it.unitPrice,
          originalInvoiceItemId: it.id,
        });
      }
    });

    if (returnItems.length === 0) {
      alert('لطفاً حداقل یک قلم کالا با تعداد بیش از صفر جهت مرجوعی انتخاب فرمایید.');
      return;
    }

    onSelectReferenceInvoice(activeInvoice, returnItems);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                انتخاب فاکتور مرجع جهت ثبت برگشت از {isSaleReturn ? 'فروش' : 'خرید'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اقلام خریداری یا فروخته‌شده را مستقیماً از فاکتور اصلی انتخاب نمایید
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

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو با شماره فاکتور، نام مشتری یا تاریخ..."
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Content Split: Left/Right */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-100 dark:divide-slate-800">
          {/* Invoices List */}
          <div className="md:col-span-5 p-3 space-y-2 overflow-y-auto max-h-[50vh] md:max-h-none">
            <span className="text-[11px] font-bold text-slate-400 px-1 block">
              فاکتورهای واجد شرایط ({toPersianDigits(candidateInvoices.length)} مورد):
            </span>

            {candidateInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                فاکتور ثبت‌شده‌ای یافت نشد.
              </div>
            ) : (
              candidateInvoices.map((inv) => {
                const isSelected = inv.id === selectedInvoiceId;
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => handlePickInvoice(inv)}
                    className={`w-full text-right p-3 rounded-2xl border transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        #{inv.invoiceNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {toPersianDigits(inv.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100">
                      <span>{inv.personName}</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatCurrency(inv.finalAmount)} ت
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      تعداد اقلام: {toPersianDigits(inv.items.length)} ردیف
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Invoice Items Picker */}
          <div className="md:col-span-7 p-4 space-y-3 overflow-y-auto">
            {activeInvoice ? (
              <>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      فاکتور #{activeInvoice.invoiceNumber} — {activeInvoice.personName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      تاریخ صدور: {toPersianDigits(activeInvoice.date)} | مبلغ کل:{' '}
                      {formatCurrency(activeInvoice.finalAmount)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-lg">
                    فاکتور تایید شده
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                    تعیین تعداد مرجوعی هر قلم کالا:
                  </span>

                  <div className="space-y-2">
                    {activeInvoice.items.map((it) => {
                      const returnQty = selectedItemQuantities[it.id] ?? 0;
                      return (
                        <div
                          key={it.id}
                          className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <h5 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {it.productName}
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              کد: {it.productCode} | فی در فاکتور: {formatCurrency(it.unitPrice)} | مقدار فاکتور:{' '}
                              {toPersianDigits(it.quantity)} {it.unitName}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-bold text-slate-500">تعداد برگشتی:</span>
                            <input
                              type="number"
                              min="0"
                              max={it.quantity}
                              step="any"
                              value={returnQty}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(it.quantity, parseFloat(e.target.value) || 0)
                                );
                                setSelectedItemQuantities((prev) => ({
                                  ...prev,
                                  [it.id]: val,
                                }));
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-center"
                            />
                            <span className="text-[11px] text-slate-400">{it.unitName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs space-y-2">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                <p>جهت مشاهده اقلام، یک فاکتور را از ستون کناری انتخاب فرمایید.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={!activeInvoice}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-40 shadow-xs"
          >
            <PackageCheck className="w-4 h-4" />
            <span>تایید و انتقال اقلام به فاکتور مرجوعی</span>
          </button>
        </div>
      </div>
    </div>
  );
};
