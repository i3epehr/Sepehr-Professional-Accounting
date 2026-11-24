import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Printer,
  FileText,
  RotateCcw,
  Eye,
  Edit2,
  CheckCircle2,
  Clock,
  Filter,
  Ban,
  ArrowRightLeft,
  X,
  CreditCard,
  User,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Invoice, InvoiceType, Person, Product, Warehouse } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { StatCardsGrid, StatCardItem } from '../common/StatCardsGrid.tsx';
import { StandardModal } from '../common/StandardModal.tsx';
import { HolooInvoicePrint } from '../invoices/HolooInvoicePrint.tsx';
import { Pagination } from '../common/Pagination.tsx';

interface SalesPurchasesHubProps {
  onOpenNewInvoice: (docType?: InvoiceType) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

type ViewFilter = 'sale' | 'purchase' | 'proforma' | 'returns' | 'unsettled' | 'all';

export const SalesPurchasesHub: React.FC<SalesPurchasesHubProps> = ({ onOpenNewInvoice, onEditInvoice }) => {
  const { formatMoney, settings } = useSettings();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active View Filter
  const [activeView, setActiveView] = useState<ViewFilter>('sale');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [cancelTargetInvoice, setCancelTargetInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [invs, pers, prds, whs] = await Promise.all([
        api.getInvoices(),
        api.getPersons(),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setInvoices(invs);
      setPersons(pers);
      setProducts(prds);
      setWarehouses(whs);
    } catch (err: any) {
      console.error('Failed to load sales/purchases data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return invoices.filter((inv) => {
      // View category match
      if (activeView === 'sale' && (inv.invoiceType !== 'sale' || inv.status === 'cancelled')) return false;
      if (activeView === 'purchase' && (inv.invoiceType !== 'purchase' || inv.status === 'cancelled')) return false;
      if (activeView === 'proforma' && (inv.invoiceType !== 'proforma' || inv.status === 'cancelled')) return false;
      if (
        activeView === 'returns' &&
        inv.invoiceType !== 'sale_return' &&
        inv.invoiceType !== 'purchase_return'
      )
        return false;
      if (activeView === 'unsettled' && ((inv.remainingAmount || 0) <= 0 || inv.status === 'cancelled')) return false;

      // Person match
      if (selectedPersonFilter !== 'all' && inv.personId !== selectedPersonFilter) return false;

      // Date match
      if (dateFilter && !inv.date.includes(dateFilter)) return false;

      // Text search match
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.personName.toLowerCase().includes(q) ||
        inv.date.includes(q) ||
        (inv.notes && inv.notes.toLowerCase().includes(q))
      );
    });
  }, [invoices, activeView, searchTerm, dateFilter, selectedPersonFilter]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    let salesTotal = 0;
    let salesCount = 0;
    let purchaseTotal = 0;
    let purchaseCount = 0;
    let unsettledTotal = 0;
    let proformaCount = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;
      if (inv.invoiceType === 'sale') {
        salesTotal += inv.finalAmount;
        salesCount++;
      } else if (inv.invoiceType === 'purchase') {
        purchaseTotal += inv.finalAmount;
        purchaseCount++;
      } else if (inv.invoiceType === 'proforma') {
        proformaCount++;
      }
      if ((inv.remainingAmount || 0) > 0) {
        unsettledTotal += inv.remainingAmount || 0;
      }
    });

    return {
      salesTotal,
      salesCount,
      purchaseTotal,
      purchaseCount,
      unsettledTotal,
      proformaCount,
    };
  }, [invoices]);

  const statCards: StatCardItem[] = [
    {
      title: 'فروش کل قطعی',
      value: formatMoney(stats.salesTotal),
      subtitle: <span>{toPersianDigits(stats.salesCount)} فاکتور ثبت‌شده</span>,
      icon: ShoppingCart,
      color: 'emerald',
    },
    {
      title: 'خرید کل از بنکداران',
      value: formatMoney(stats.purchaseTotal),
      subtitle: <span>{toPersianDigits(stats.purchaseCount)} فاکتور خرید</span>,
      icon: Package,
      color: 'indigo',
    },
    {
      title: 'مطالبات تسویه‌نشده (نسیه)',
      value: formatMoney(stats.unsettledTotal),
      subtitle: <span className="text-amber-600 font-bold">باقیمانده حساب‌ها</span>,
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'پیش‌فاکتورهای فعال',
      value: `${toPersianDigits(stats.proformaCount)} فقره`,
      subtitle: <span>آماده تبدیل به فروش قطعی</span>,
      icon: FileText,
      color: 'slate',
    },
  ];

  const pillItems: SectionPillItem<ViewFilter>[] = [
    {
      id: 'sale',
      label: 'فاکتورهای فروش',
      icon: ShoppingCart,
      activeColor: 'bg-emerald-600 text-white shadow-xs',
      badge: toPersianDigits(invoices.filter((i) => i.invoiceType === 'sale' && i.status !== 'cancelled').length),
    },
    {
      id: 'purchase',
      label: 'فاکتورهای خرید',
      icon: Package,
      activeColor: 'bg-indigo-600 text-white shadow-xs',
      badge: toPersianDigits(invoices.filter((i) => i.invoiceType === 'purchase' && i.status !== 'cancelled').length),
    },
    {
      id: 'proforma',
      label: 'پیش‌فاکتورها',
      icon: FileText,
      activeColor: 'bg-amber-500 text-white shadow-xs',
      badge: toPersianDigits(invoices.filter((i) => i.invoiceType === 'proforma' && i.status !== 'cancelled').length),
    },
    {
      id: 'returns',
      label: 'مرجوعی‌ها',
      icon: RotateCcw,
      activeColor: 'bg-rose-600 text-white shadow-xs',
      badge: toPersianDigits(
        invoices.filter(
          (i) => (i.invoiceType === 'sale_return' || i.invoiceType === 'purchase_return') && i.status !== 'cancelled'
        ).length
      ),
    },
    {
      id: 'unsettled',
      label: 'تسویه‌نشده و نسیه',
      icon: Clock,
      activeColor: 'bg-amber-600 text-white shadow-xs',
      badge: toPersianDigits(invoices.filter((i) => (i.remainingAmount || 0) > 0 && i.status !== 'cancelled').length),
    },
    {
      id: 'all',
      label: 'همه اسناد',
      icon: Layers,
      activeColor: 'bg-slate-800 text-white shadow-xs',
      badge: toPersianDigits(invoices.length),
    },
  ];

  const handleConvertToSale = async (inv: Invoice) => {
    try {
      const updated = await api.convertProformaToSaleInvoice(inv.id);
      await loadData();
      setToastMessage(`پیش‌فاکتور با موفقیت به فاکتور فروش شماره ${toPersianDigits(updated.invoiceNumber)} تبدیل شد.`);
    } catch (err: any) {
      alert(`خطا در تبدیل پیش‌فاکتور: ${err.message}`);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetInvoice) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      alert('لطفاً دلیل ابطال را وارد کنید (حداقل ۳ کاراکتر).');
      return;
    }

    try {
      setIsCancelling(true);
      await api.cancelInvoice(cancelTargetInvoice.id, cancelReason);
      setCancelTargetInvoice(null);
      setCancelReason('');
      await loadData();
      setToastMessage('سند با موفقیت ابطال شد و اثرات مالی و انبار آن برگشت داده شد.');
    } catch (err: any) {
      alert(`خطا در ابطال سند: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const getDocBadge = (type: InvoiceType, status?: string) => {
    if (status === 'cancelled') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          ابطال شده
        </span>
      );
    }
    switch (type) {
      case 'sale':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            فروش قطعی
          </span>
        );
      case 'purchase':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            خرید کالا
          </span>
        );
      case 'proforma':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            پیش‌فاکتور
          </span>
        );
      case 'sale_return':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            مرجوعی فروش
          </span>
        );
      case 'purchase_return':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            مرجوعی خرید
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-700">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with Primary Action Button */}
      <PageHeader
        title="مرکز مدیریت خرید و فروش و اسناد بازرگانی"
        subtitle="فهرست و سوابق کلیه فاکتورهای فروش، خرید، پیش‌فاکتورها، مرجوعی‌ها و پیگیری تسویه"
        icon={ShoppingCart}
        primaryAction={{
          label: 'صدور فاکتور جدید',
          icon: Plus,
          onClick: () => onOpenNewInvoice('sale'),
          color: 'emerald',
        }}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid cards={statCards} columns={4} />

      {/* 3. Segmented View Switcher */}
      <SectionPills items={pillItems} activeId={activeView} onChange={setActiveView} />

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو با شماره فاکتور، نام مشتری، تاریخ یا شرح..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedPersonFilter}
              onChange={(e) => setSelectedPersonFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              <option value="all">همه طرف‌های حساب...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <input
              type="text"
              placeholder="فیلتر تاریخ (مثلاً ۱۴۰۳/۰۸)"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
            />
          </div>
        </div>
      </div>

      {/* 5. Invoices Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
              فهرست اسناد ثبت‌شده
            </span>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-200 dark:border-indigo-800">
              {toPersianDigits(filteredInvoices.length)} سند
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            برای صدور فاکتور جدید کلید <kbd className="font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">F2</kbd> را فشار دهید
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3 text-center w-10">#</th>
                <th className="py-2.5 px-3 font-bold">شماره سند</th>
                <th className="py-2.5 px-3 font-bold text-center">نوع</th>
                <th className="py-2.5 px-3 font-bold">طرف حساب</th>
                <th className="py-2.5 px-3 font-bold text-center">تاریخ</th>
                <th className="py-2.5 px-3 font-bold text-left">مبلغ نهایی</th>
                <th className="py-2.5 px-3 font-bold text-left">پرداخت‌شده</th>
                <th className="py-2.5 px-3 font-bold text-left">مانده نسیه</th>
                <th className="py-2.5 px-3 font-bold text-center">وضعیت تسویه</th>
                <th className="py-2.5 px-3 font-bold text-center w-44">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    در حال بارگذاری اطلاعات فاکتورها...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    هیچ سندی با معیارهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const isSettled = (inv.remainingAmount || 0) <= 0;
                  const isCancelled = inv.status === 'cancelled';

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                        isCancelled ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                        {toPersianDigits((page - 1) * pageSize + idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {toPersianDigits(inv.invoiceNumber)}
                      </td>
                      <td className="py-2.5 px-3 text-center">{getDocBadge(inv.invoiceType, inv.status)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                        {inv.personName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                        {toPersianDigits(inv.date)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                        {formatMoney(inv.finalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-left text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatMoney(inv.paidAmount || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-bold">
                        {(inv.remainingAmount || 0) > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {formatMoney(inv.remainingAmount || 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">تسویه</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isCancelled ? (
                          <span className="text-[10px] text-slate-400 font-bold">ابطال شده</span>
                        ) : isSettled ? (
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                            تسویه کامل
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">
                            نسیه / بدهکار
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* مشاهده */}
                          <button
                            type="button"
                            onClick={() => setViewInvoice(inv)}
                            title="مشاهده جزئیات سند"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* ویرایش */}
                          {!isCancelled && onEditInvoice && (
                            <button
                              type="button"
                              onClick={() => onEditInvoice(inv)}
                              title="ویرایش فاکتور"
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* چاپ */}
                          <button
                            type="button"
                            onClick={() => setPrintInvoice(inv)}
                            title="چاپ فاکتور"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* تبدیل پیش‌فاکتور به فروش */}
                          {inv.invoiceType === 'proforma' && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleConvertToSale(inv)}
                              title="تبدیل به فاکتور فروش قطعی"
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer transition shadow-2xs"
                            >
                              تبدیل به فروش
                            </button>
                          )}

                          {/* ابطال */}
                          {!isCancelled && inv.invoiceType !== 'proforma' && (
                            <button
                              type="button"
                              onClick={() => setCancelTargetInvoice(inv)}
                              title="ابطال سند"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filteredInvoices.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* View Invoice Modal */}
      {viewInvoice && (
        <StandardModal
          isOpen={Boolean(viewInvoice)}
          onClose={() => setViewInvoice(null)}
          title={`جزئیات سند شماره ${toPersianDigits(viewInvoice.invoiceNumber)}`}
          subtitle={`طرف حساب: ${viewInvoice.personName} | تاریخ: ${toPersianDigits(viewInvoice.date)}`}
          icon={ShoppingCart}
          maxWidth="3xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500">
                ثبت‌کننده: <strong>{viewInvoice.createdBy || 'کاربر سیستم'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const i = viewInvoice;
                    setViewInvoice(null);
                    setPrintInvoice(i);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-indigo-700 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ سند</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 font-bold">شرح کالا</th>
                    <th className="p-2.5 text-center font-bold">مقدار</th>
                    <th className="p-2.5 text-center font-bold">واحد</th>
                    <th className="p-2.5 text-left font-bold">فی واحد</th>
                    <th className="p-2.5 text-left font-bold">تخفیف</th>
                    <th className="p-2.5 text-left font-bold">جمع کل ردیف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewInvoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="p-2.5 text-center font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                        {it.productName}
                      </td>
                      <td className="p-2.5 text-center font-bold font-mono">
                        {toPersianDigits(it.quantity)}
                      </td>
                      <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                        {it.unitName}
                      </td>
                      <td className="p-2.5 text-left font-bold">{formatMoney(it.unitPrice)}</td>
                      <td className="p-2.5 text-left text-rose-600 font-bold">
                        {it.discount > 0 ? formatMoney(it.discount) : '۰'}
                      </td>
                      <td className="p-2.5 text-left font-black text-slate-900 dark:text-white">
                        {formatMoney(it.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block">جمع کل ناخالص:</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {formatMoney(viewInvoice.subtotal)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مبلغ نهایی فاکتور:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(viewInvoice.finalAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مانده پس از تسویه:</span>
                <span
                  className={`font-black ${
                    (viewInvoice.remainingAmount || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {formatMoney(viewInvoice.remainingAmount || 0)}
                </span>
              </div>
            </div>

            {viewInvoice.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 text-xs">
                <strong>توضیحات:</strong> {viewInvoice.notes}
              </div>
            )}
          </div>
        </StandardModal>
      )}

      {/* Cancel Target Invoice Modal */}
      {cancelTargetInvoice && (
        <StandardModal
          isOpen={Boolean(cancelTargetInvoice)}
          onClose={() => setCancelTargetInvoice(null)}
          title={`ابطال سند شماره ${toPersianDigits(cancelTargetInvoice.invoiceNumber)}`}
          subtitle="برگشت موجودی کالا به انبار، اصلاح مانده حساب شخص و ابطال سند حسابداری مرتبط"
          icon={Ban}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setCancelTargetInvoice(null)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                {isCancelling ? 'در حال ابطال...' : 'تأیید ابطال سند'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-slate-700 dark:text-slate-300">
              آیا از ابطال سند شماره{' '}
              <strong className="text-rose-600">
                {toPersianDigits(cancelTargetInvoice.invoiceNumber)}
              </strong>{' '}
              مربوط به طرف حساب «{cancelTargetInvoice.personName}» اطمینان دارید؟
            </p>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                دلیل ابطال (الزامی برای رویدادنگار امنیتی و ممیزی):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="علت ابطال فاکتور را شرح دهید..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* Printable Invoice Modal */}
      {printInvoice && (
        <HolooInvoicePrint
          invoice={printInvoice}
          settings={settings}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
