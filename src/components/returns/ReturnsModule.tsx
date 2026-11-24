import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  Plus,
  Scale,
  Package,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  User,
  Building,
  Printer,
  Eye,
  ArrowRight,
  ShieldAlert,
  Coins,
  Check,
  CreditCard,
  Ban,
  Clock,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { Invoice, Product, Person, Warehouse } from '../../types/index.ts';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import {
  calculateReturnableItems,
  validateReturnQuantities,
  calculateRefundAllocation,
  ReturnableItemInfo,
} from '../../lib/returnsCalculations.ts';
import { HolooInvoicePrint } from '../invoices/HolooInvoicePrint.tsx';

export const ReturnsModule: React.FC = () => {
  const { formatMoney, settings } = useSettings();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returnInvoices, setReturnInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale_return' | 'purchase_return'>('all');

  // Modal State
  const [isNewReturnOpen, setIsNewReturnOpen] = useState(false);
  const [returnType, setReturnType] = useState<'sale_return' | 'purchase_return'>('sale_return');
  const [selectedOriginalInvoiceId, setSelectedOriginalInvoiceId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [returnDate, setReturnDate] = useState(getCurrentJalaliDate());
  const [overallReturnReason, setOverallReturnReason] = useState('نقص فنی یا عدم تطابق رنگ');
  const [refundAction, setRefundAction] = useState<'credit_balance' | 'cash_refund' | 'pos_refund'>('credit_balance');

  // Return items with quantities and validation
  const [returnableList, setReturnableList] = useState<ReturnableItemInfo[]>([]);
  const [requestedQuantities, setRequestedQuantities] = useState<Record<string, number>>({});
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print & View Modals
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allInvs, prods, pers, whs] = await Promise.all([
        api.getInvoices().catch(() => []),
        api.getProducts().catch(() => []),
        api.getPersons().catch(() => []),
        api.getWarehouses().catch(() => []),
      ]);
      setInvoices(allInvs);
      setProducts(prods);
      setPersons(pers);
      setWarehouses(whs);

      const returns = allInvs.filter(
        (i) => i.invoiceType === 'sale_return' || i.invoiceType === 'purchase_return'
      );
      setReturnInvoices(returns);

      if (whs.length > 0) {
        setSelectedWarehouseId(whs.find((w) => w.id === 'wh-shop')?.id || whs[0].id);
      }
    } catch (err) {
      console.error('Failed to load returns data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When original invoice is selected, calculate remaining returnable items
  const handleSelectOriginalInvoice = async (invId: string) => {
    setSelectedOriginalInvoiceId(invId);
    setValidationError('');
    setRequestedQuantities({});
    setItemReasons({});

    if (!invId) {
      setReturnableList([]);
      return;
    }

    try {
      const data = await api.getReturnableInvoiceItems(invId);
      setReturnableList(data.returnableItems);

      // Pre-populate reasons
      const initialReasons: Record<string, string> = {};
      data.returnableItems.forEach((it) => {
        initialReasons[it.productId] = 'مرجوعی به دلیل عدم تطابق یا انصراف';
      });
      setItemReasons(initialReasons);

      // Set default refund action based on whether original invoice had remaining balance
      if (data.originalInvoice.remainingAmount > 0) {
        setRefundAction('credit_balance');
      } else {
        setRefundAction('cash_refund');
      }
    } catch (err: any) {
      setValidationError(err.message || 'خطا در بارگذاری اقلام فاکتور مرجع');
    }
  };

  // Quantity Change Handler with Real-time Validation
  const handleQuantityChange = (productId: string, val: number) => {
    const item = returnableList.find((r) => r.productId === productId);
    if (!item) return;

    const requested = Math.max(0, Number(val) || 0);
    const updated = { ...requestedQuantities, [productId]: requested };
    setRequestedQuantities(updated);

    // Validate
    if (requested > item.remainingReturnableQuantity) {
      setValidationError(
        `برگشت کالای «${item.productName}» به مقدار ${requested} غیرمجاز است. حداکثر سقف مجاز باقی‌مانده ${item.remainingReturnableQuantity} ${item.unitName} می‌باشد.`
      );
    } else {
      // Check if any other item exceeds
      let hasError = false;
      for (const it of returnableList) {
        const q = updated[it.productId] || 0;
        if (q > it.remainingReturnableQuantity) {
          setValidationError(
            `برگشت کالای «${it.productName}» به مقدار ${q} غیرمجاز است. حداکثر سقف مجاز باقی‌مانده ${it.remainingReturnableQuantity} ${it.unitName} است.`
          );
          hasError = true;
          break;
        }
      }
      if (!hasError) setValidationError('');
    }
  };

  // Fill 100% of single item
  const handleFillMaxItem = (productId: string) => {
    const item = returnableList.find((r) => r.productId === productId);
    if (!item) return;
    handleQuantityChange(productId, item.remainingReturnableQuantity);
  };

  // Fill 100% of all returnable items (Full Return)
  const handleFillMaxAll = () => {
    const full: Record<string, number> = {};
    returnableList.forEach((it) => {
      full[it.productId] = it.remainingReturnableQuantity;
    });
    setRequestedQuantities(full);
    setValidationError('');
  };

  // Selected original invoice object
  const selectedOriginalInvoice = invoices.find((i) => i.id === selectedOriginalInvoiceId);

  // Filter selectable original invoices based on returnType
  const selectableInvoices = invoices.filter((inv) => {
    if (inv.status !== 'approved') return false;
    if (returnType === 'sale_return') return inv.invoiceType === 'sale';
    if (returnType === 'purchase_return') return inv.invoiceType === 'purchase';
    return false;
  });

  // Calculate return totals
  const totalReturnSubtotal = returnableList.reduce((sum, item) => {
    const qty = requestedQuantities[item.productId] || 0;
    return sum + qty * item.originalUnitPrice;
  }, 0);

  // Financial allocation (debt offset vs cash refund)
  const refundAllocation = calculateRefundAllocation(
    totalReturnSubtotal,
    selectedOriginalInvoice?.remainingAmount || 0
  );

  // Submit Return Invoice
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOriginalInvoice) {
      setValidationError('لطفاً فاکتور اصلی مرجع را انتخاب کنید.');
      return;
    }

    const itemsToReturn = returnableList
      .filter((it) => (requestedQuantities[it.productId] || 0) > 0)
      .map((it) => {
        const qty = requestedQuantities[it.productId];
        const baseQty = qty * it.conversionFactor;
        return {
          id: 'ret-item-' + Math.random().toString(36).substring(2, 9),
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          unitId: it.unitId,
          unitName: it.unitName,
          conversionFactor: it.conversionFactor,
          quantity: qty,
          baseQuantity: baseQty,
          unitPrice: it.originalUnitPrice,
          discount: 0,
          tax: 0,
          totalPrice: qty * it.originalUnitPrice,
          returnReason: itemReasons[it.productId] || overallReturnReason,
        };
      });

    if (itemsToReturn.length === 0) {
      setValidationError('حداقل یک قلم کالا با مقدار بزرگتر از صفر باید برای مرجوعی انتخاب شود.');
      return;
    }

    // Double check with validation engine
    const valResult = validateReturnQuantities(
      selectedOriginalInvoice,
      invoices,
      itemsToReturn.map((i) => ({ productId: i.productId, quantity: i.quantity }))
    );

    if (!valResult.isValid) {
      setValidationError(valResult.errorMessage || 'سقف مقدار مجاز برگشت نقض شده است.');
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationError('');

      const newReturn = await api.createInvoice({
        invoiceType: returnType,
        originalInvoiceId: selectedOriginalInvoice.id,
        originalInvoiceNumber: selectedOriginalInvoice.invoiceNumber,
        personId: selectedOriginalInvoice.personId,
        personName: selectedOriginalInvoice.personName,
        warehouseId: selectedWarehouseId,
        date: returnDate,
        status: 'approved',
        items: itemsToReturn,
        subtotal: totalReturnSubtotal,
        totalDiscount: 0,
        taxAmount: 0,
        finalAmount: totalReturnSubtotal,
        paidAmount: totalReturnSubtotal,
        remainingAmount: 0,
        returnReason: overallReturnReason,
        refundAction,
      });

      alert(
        `سند مرجوعی شماره ${newReturn.invoiceNumber} با موفقیت ثبت شد. اقلام به کاردکس و موجودی انبار منتقل شدند.`
      );
      setIsNewReturnOpen(false);
      setSelectedOriginalInvoiceId('');
      setRequestedQuantities({});
      setReturnableList([]);
      loadData();
    } catch (err: any) {
      setValidationError(err.message || 'خطا در ثبت سند مرجوعی');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReturns = returnInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.includes(searchTerm) ||
      inv.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.originalInvoiceNumber && inv.originalInvoiceNumber.includes(searchTerm)) ||
      inv.date.includes(searchTerm);
    const matchesType = filterType === 'all' || inv.invoiceType === filterType;
    return matchesSearch && matchesType;
  });

  const totalSaleReturnsAmount = returnInvoices
    .filter((i) => i.invoiceType === 'sale_return' && i.status !== 'cancelled')
    .reduce((s, i) => s + i.finalAmount, 0);

  const totalPurchaseReturnsAmount = returnInvoices
    .filter((i) => i.invoiceType === 'purchase_return' && i.status !== 'cancelled')
    .reduce((s, i) => s + i.finalAmount, 0);

  return (
    <div className="space-y-5 font-['Vazirmatn',Tahoma,sans-serif]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              مدیریت برگشت از فروش و برگشت از خرید (مرجوعی‌ها)
            </h2>
            <span className="text-xs bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-bold border border-rose-200 dark:border-rose-800">
              {toPersianDigits(filteredReturns.length)} سند ثبت‌شده
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            پیوند مستقیم سند مرجوعی به فاکتور اصلی، کنترل سقف قابل برگشت، اصلاح خودکار کاردکس انبار و صدور سند متوازن دوبل
          </p>
        </div>

        <button
          onClick={() => {
            setIsNewReturnOpen(true);
            setValidationError('');
            setSelectedOriginalInvoiceId('');
            setRequestedQuantities({});
          }}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت سند مرجوعی جدید</span>
        </button>
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              مجموع برگشت از فروش (ورود مجدد به انبار)
            </span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400">
              {formatMoney(totalSaleReturnsAmount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              مجموع برگشت از خرید (خروج به تامین‌کننده)
            </span>
            <span className="text-base font-black text-blue-600 dark:text-blue-400">
              {formatMoney(totalPurchaseReturnsAmount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              کنترل سقف و قوانین حسابداری
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              برگشت مازاد ممنوع • سند دوبل متوازن
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی شماره سند، شماره فاکتور اصلی، نام طرف حساب یا تاریخ..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-rose-500 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'همه مرجوعی‌ها' },
            { id: 'sale_return', label: 'برگشت از فروش' },
            { id: 'purchase_return', label: 'برگشت از خرید' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === tab.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Returns List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-3 font-bold w-16">شماره</th>
                <th className="py-3 px-3 font-bold w-28">نوع مرجوعی</th>
                <th className="py-3 px-3 font-bold">فاکتور اصلی مرجع</th>
                <th className="py-3 px-3 font-bold">طرف حساب</th>
                <th className="py-3 px-3 font-bold w-24">تاریخ</th>
                <th className="py-3 px-3 font-bold text-center w-20">اقلام</th>
                <th className="py-3 px-3 font-bold text-left w-32">مبلغ مرجوعی</th>
                <th className="py-3 px-3 font-bold text-center w-28">نحوه تسویه</th>
                <th className="py-3 px-3 font-bold text-center w-24">سند دوبل</th>
                <th className="py-3 px-3 font-bold text-center w-28">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    هیچ سند مرجوعی ثبت‌نشده یا با مشخصات جستجو مطابقت ندارد.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr
                    key={ret.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {toPersianDigits(ret.invoiceNumber)}
                    </td>

                    {/* Return Type */}
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                          ret.invoiceType === 'sale_return'
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                        }`}
                      >
                        {ret.invoiceType === 'sale_return' ? 'برگشت از فروش' : 'برگشت از خرید'}
                      </span>
                    </td>

                    {/* Original Invoice Link */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 px-2 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                        <FileText className="w-3 h-3" />
                        <span>فاکتور {toPersianDigits(ret.originalInvoiceNumber || '—')}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {ret.personName}
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {toPersianDigits(ret.date)}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-600 dark:text-slate-300">
                      {toPersianDigits(ret.items.length)} ردیف
                    </td>

                    <td className="py-3 px-3 text-left font-black text-rose-600 dark:text-rose-400">
                      {formatMoney(ret.finalAmount)}
                    </td>

                    {/* Refund Action */}
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                        {ret.refundAction === 'cash_refund' || ret.refundAction === 'pos_refund'
                          ? 'استرداد نقدی'
                          : 'بستانکاری دفتری'}
                      </span>
                    </td>

                    {/* Double-entry voucher */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                        <Scale className="w-3 h-3" />
                        <span>متوازن</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPrintInvoice(ret)}
                          title="چاپ سند مرجوعی هلو"
                          className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewInvoice(ret)}
                          title="مشاهده جزئیات مرجوعی"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create Return Document Modal */}
      {isNewReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    ثبت سند مرجوعی (برگشت از فروش / برگشت از خرید)
                  </h3>
                  <p className="text-xs text-slate-500">
                    پیوند الزامی به فاکتور اصلی، کنترل سقف قابل برگشت و تنظیم خودکار کاردکس و دفاتر مالی
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewReturnOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              {/* Type, Original Invoice, Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نوع مرجوعی
                  </label>
                  <select
                    value={returnType}
                    onChange={(e) => {
                      setReturnType(e.target.value as any);
                      setSelectedOriginalInvoiceId('');
                      setReturnableList([]);
                      setRequestedQuantities({});
                    }}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    <option value="sale_return">برگشت از فروش (ورود به انبار)</option>
                    <option value="purchase_return">برگشت از خرید (خروج از انبار)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    فاکتور اصلی مرجع <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedOriginalInvoiceId}
                    onChange={(e) => handleSelectOriginalInvoice(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                    required
                  >
                    <option value="">-- انتخاب فاکتور قطعی مرجع --</option>
                    {selectableInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        فاکتور {inv.invoiceNumber} - {inv.personName} ({toPersianDigits(inv.date)}) - {formatMoney(inv.finalAmount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    انبار مقصد / مبدا
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Invoice Details Strip */}
              {selectedOriginalInvoice && (
                <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <div>
                    <span className="text-slate-500">طرف حساب: </span>
                    <strong className="text-slate-900 dark:text-white font-black">{selectedOriginalInvoice.personName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">مبلغ کل فاکتور: </span>
                    <strong className="text-teal-900 dark:text-teal-200 font-black">{formatMoney(selectedOriginalInvoice.finalAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">پرداخت‌شده: </span>
                    <strong className="text-emerald-700 font-bold">{formatMoney(selectedOriginalInvoice.paidAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">مانده بدهی نسیه: </span>
                    <strong className="text-amber-700 font-bold">{formatMoney(selectedOriginalInvoice.remainingAmount)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillMaxAll}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                  >
                    برگشت کامل کل فاکتور (۱۰۰٪)
                  </button>
                </div>
              )}

              {/* Returnable Items Grid with Invariant Enforcement */}
              {returnableList.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">شرح کالا</th>
                        <th className="py-2.5 px-2 text-center w-14">واحد</th>
                        <th className="py-2.5 px-2 text-left w-24">قیمت واحد</th>
                        <th className="py-2.5 px-2 text-center w-20">مقدار اولیه</th>
                        <th className="py-2.5 px-2 text-center w-20">قبلاً برگشتی</th>
                        <th className="py-2.5 px-2 text-center w-28 bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300">
                          سقف مجاز فعلی
                        </th>
                        <th className="py-2.5 px-3 text-center w-36">مقدار درخواستی برگشت</th>
                        <th className="py-2.5 px-3 text-left w-28">مبلغ مرجوعی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {returnableList.map((item) => {
                        const requested = requestedQuantities[item.productId] || 0;
                        const isExceeded = requested > item.remainingReturnableQuantity;
                        const rowReturnAmount = requested * item.originalUnitPrice;

                        return (
                          <tr
                            key={item.productId}
                            className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                              isExceeded ? 'bg-rose-50 dark:bg-rose-950/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.productName}
                              </div>
                              <div className="text-[10.5px] font-mono text-slate-400">
                                {toPersianDigits(item.productCode)}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">
                              {item.unitName}
                            </td>

                            <td className="py-2.5 px-2 text-left font-mono">
                              {toPersianDigits(item.originalUnitPrice.toLocaleString('fa-IR'))}
                            </td>

                            <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300 font-bold">
                              {toPersianDigits(item.originalQuantity)}
                            </td>

                            <td className="py-2.5 px-2 text-center text-slate-500 font-bold">
                              {toPersianDigits(item.cumulativeReturnedQuantity)}
                            </td>

                            {/* Max Returnable Remaining */}
                            <td className="py-2.5 px-2 text-center font-black bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                              {item.remainingReturnableQuantity === 0 ? (
                                <span className="text-[10px] text-slate-400">تکمیل شده</span>
                              ) : (
                                <span>{toPersianDigits(item.remainingReturnableQuantity)}</span>
                              )}
                            </td>

                            {/* Requested Return Quantity Input */}
                            <td className="py-2.5 px-3 text-center">
                              {item.remainingReturnableQuantity > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.remainingReturnableQuantity}
                                    step="0.1"
                                    value={requested === 0 ? '' : requested}
                                    onChange={(e) =>
                                      handleQuantityChange(item.productId, Number(e.target.value) || 0)
                                    }
                                    placeholder="۰"
                                    className={`w-18 py-1 px-2 border rounded-lg text-center font-bold text-xs ${
                                      isExceeded
                                        ? 'border-rose-600 text-rose-600 bg-rose-100'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleFillMaxItem(item.productId)}
                                    title="برگشت کامل این ردیف"
                                    className="px-1.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded font-bold cursor-pointer"
                                  >
                                    حداکثر
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  فاقد مقدار قابل برگشت
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                              {toPersianDigits(rowReturnAmount.toLocaleString('fa-IR'))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : selectedOriginalInvoiceId ? (
                <div className="p-4 text-center text-slate-400">در حال محاسبه اقلام قابل برگشت...</div>
              ) : null}

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-3 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 rounded-xl border border-rose-300 dark:border-rose-800 font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Settlement & Refund Action Config */}
              {totalReturnSubtotal > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-teal-600" />
                    <span>نحوه تسویه و استرداد مبلغ مرجوعی ({formatMoney(totalReturnSubtotal)}):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">
                        روش استرداد وجه / تسویه
                      </label>
                      <select
                        value={refundAction}
                        onChange={(e) => setRefundAction(e.target.value as any)}
                        className="w-full py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                      >
                        <option value="credit_balance">
                          بستانکاری دفتری طرف حساب (کاهش بدهی / اعتبار برای خریدهای آتی)
                        </option>
                        <option value="cash_refund">استرداد نقدی از صندوق فروشگاه</option>
                        <option value="pos_refund">استرداد وجه از طریق دستگاه پوز / کارت</option>
                      </select>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">تهاتر و کسر از بدهی معوقه:</span>
                        <strong className="text-amber-700">
                          {formatMoney(refundAllocation.offsetDebtAmount)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">استرداد مستقیم وجه یا بستانکاری دفتری:</span>
                        <strong className="text-emerald-700">
                          {formatMoney(refundAllocation.directRefundOrCreditAmount)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500">مجموع ارزش مرجوعی: </span>
                  <strong className="text-base font-black text-rose-600 dark:text-rose-400">
                    {formatMoney(totalReturnSubtotal)}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewReturnOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || totalReturnSubtotal <= 0 || Boolean(validationError)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition cursor-pointer shadow-md shadow-rose-200 dark:shadow-none flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی سند مرجوعی'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Holoo Print Modal for Returns */}
      {printInvoice && (
        <HolooInvoicePrint
          invoice={printInvoice}
          settings={settings}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {/* 7. View Details Drawer */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    جزئیات سند مرجوعی شماره {toPersianDigits(viewInvoice.invoiceNumber)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    عطف به فاکتور اصلی: {toPersianDigits(viewInvoice.originalInvoiceNumber || '—')} | طرف حساب: {viewInvoice.personName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2">شرح کالا</th>
                      <th className="p-2 text-center">مقدار برگشتی</th>
                      <th className="p-2 text-center">واحد</th>
                      <th className="p-2 text-left">قیمت</th>
                      <th className="p-2 text-left">مبلغ کل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewInvoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold">{it.productName}</td>
                        <td className="p-2 text-center font-bold text-rose-600">{toPersianDigits(it.quantity)}</td>
                        <td className="p-2 text-center text-slate-500">{it.unitName}</td>
                        <td className="p-2 text-left">{formatMoney(it.unitPrice)}</td>
                        <td className="p-2 text-left font-black">{formatMoney(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-center">
                <span>مبلغ کل برگشت:</span>
                <span className="text-base font-black text-rose-600">{formatMoney(viewInvoice.finalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
