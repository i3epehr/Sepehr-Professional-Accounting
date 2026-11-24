import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  DollarSign,
  Building,
  User,
  Percent,
  FileText,
  Printer,
  ChevronDown,
  Layers,
  Coins,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Product,
  Person,
  Unit,
  Warehouse,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  PaymentMethod,
  StoreSettings,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, getCurrentJalaliDate } from '../../lib/formatters.ts';
import {
  calculateItemBaseQuantity,
  calculatePriceForSelectedUnit,
  validateQuantityDecimals,
  roundPrecision,
} from '../../lib/conversions.ts';
import {
  calculateRowFinancials,
  calculateInvoiceFinancials,
  validateCustomerCredit,
} from '../../lib/salesCalculations.ts';

interface QuickSalesPOSModalProps {
  products: Product[];
  persons: Person[];
  units: Unit[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: (newInvoice: Invoice, shouldPrint: boolean) => void;
  initialProforma?: boolean;
}

export const QuickSalesPOSModal: React.FC<QuickSalesPOSModalProps> = ({
  products,
  persons,
  units,
  warehouses,
  onClose,
  onSuccess,
  initialProforma = false,
}) => {
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  // Mode: Sale vs Proforma
  const [isProforma, setIsProforma] = useState<boolean>(initialProforma);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    warehouses.find((w) => w.id === 'wh-shop')?.id || warehouses[0]?.id || 'wh-central'
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    persons.find((p) => p.code === '3001')?.id || persons[0]?.id || ''
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(getCurrentJalaliDate());

  // Search & Barcode
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Line Items
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Invoice-level discounts & Tax
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(false);
  const [taxRate, setTaxRate] = useState<number>(settings.defaultTaxPercent || 10);

  // Split Payments
  const [payments, setPayments] = useState<InvoicePayment[]>([
    {
      id: `pay-1`,
      method: 'pos',
      amount: 0,
      accountTitle: 'دستگاه کارتخوان به پرداخت ملت',
    },
  ]);

  // Cash change calculator helper
  const [cashTendered, setCashTendered] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Selected Person details
  const selectedPerson = persons.find((p) => p.id === selectedPersonId);

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Filtered products for quick drawer
  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false;
    const matchesCategory =
      selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
    const matchesSearch =
      !searchQuery ||
      p.name.includes(searchQuery) ||
      p.code.includes(searchQuery) ||
      p.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Unique categories for pills
  const categories = Array.from(
    new Map(
      products
        .filter((p) => p.categoryId && p.categoryName)
        .map((p) => [p.categoryId, { id: p.categoryId, name: p.categoryName || '' }])
    ).values()
  );

  // Handle adding product to cart
  const handleAddProduct = (prd: Product, overrideQuantity: number = 1) => {
    // Check if already in cart
    const existingIndex = items.findIndex((it) => it.productId === prd.id);
    if (existingIndex !== -1) {
      // Increment quantity
      const updated = [...items];
      const targetItem = updated[existingIndex];
      const newQty = roundPrecision(targetItem.quantity + overrideQuantity, 3);
      const baseQty = calculateItemBaseQuantity(newQty, targetItem.unitId, units, prd);
      const financials = calculateRowFinancials({
        quantity: newQty,
        unitPrice: targetItem.unitPrice,
        discount: targetItem.discount,
        isTaxEnabled,
        taxRate,
      });

      updated[existingIndex] = {
        ...targetItem,
        quantity: newQty,
        baseQuantity: baseQty,
        tax: financials.taxAmount,
        totalPrice: financials.totalPrice,
      };
      setItems(updated);
      return;
    }

    // New item addition
    const baseUnit = units.find((u) => u.id === prd.baseUnitId);
    const unitName = baseUnit ? baseUnit.name : prd.baseUnitName || 'عدد';
    const unitPrice = prd.retailPrice || prd.wholesalePrice || prd.purchasePrice || 0;
    const baseQuantity = calculateItemBaseQuantity(overrideQuantity, prd.baseUnitId, units, prd);
    const financials = calculateRowFinancials({
      quantity: overrideQuantity,
      unitPrice,
      discount: 0,
      isTaxEnabled,
      taxRate,
    });

    const newItem: InvoiceItem = {
      id: `it-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: prd.id,
      productCode: prd.code,
      productName: prd.name,
      unitId: prd.baseUnitId,
      unitName,
      conversionFactor: 1,
      quantity: overrideQuantity,
      baseQuantity,
      unitPrice,
      discount: 0,
      tax: financials.taxAmount,
      totalPrice: financials.totalPrice,
      color: prd.color,
      size: prd.size,
    };

    setItems([...items, newItem]);
  };

  // Barcode enter handler
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeQuery.trim();
      if (!code) return;

      const found = products.find(
        (p) => p.barcode === code || p.code.toLowerCase() === code.toLowerCase()
      );
      if (found) {
        handleAddProduct(found, 1);
        setBarcodeQuery('');
      } else {
        alert(`کالایی با بارکد یا کد «${code}» یافت نشد.`);
      }
    }
  };

  // Update item row field
  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'unitId' | 'unitPrice' | 'discount',
    value: any
  ) => {
    const updated = [...items];
    const item = { ...updated[index] };
    const prd = products.find((p) => p.id === item.productId);
    if (!prd) return;

    if (field === 'quantity') {
      const q = Math.max(0.01, Number(value) || 0);
      const unit = units.find((u) => u.id === item.unitId);
      const decCheck = validateQuantityDecimals(q, unit);
      if (!decCheck.valid && !prd.allowDecimal) {
        alert(decCheck.error || 'مقدار اعشاری برای این واحد مجاز نیست.');
        return;
      }
      item.quantity = q;
      item.baseQuantity = calculateItemBaseQuantity(q, item.unitId, units, prd);
    } else if (field === 'unitId') {
      item.unitId = value;
      const selUnit = units.find((u) => u.id === value);
      item.unitName = selUnit ? selUnit.name : 'عدد';
      // Automatically recalculate unit price for the newly selected unit
      item.unitPrice = calculatePriceForSelectedUnit(prd, value, units, 'retailPrice');
      item.baseQuantity = calculateItemBaseQuantity(item.quantity, value, units, prd);
      item.conversionFactor = item.quantity > 0 ? roundPrecision(item.baseQuantity / item.quantity, 4) : 1;
    } else if (field === 'unitPrice') {
      item.unitPrice = Math.max(0, Number(value) || 0);
    } else if (field === 'discount') {
      item.discount = Math.max(0, Number(value) || 0);
    }

    const financials = calculateRowFinancials({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      isTaxEnabled,
      taxRate,
    });

    item.tax = financials.taxAmount;
    item.totalPrice = financials.totalPrice;
    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Re-calculate financial totals whenever items, discount, tax, or payments change
  const financialSummary = calculateInvoiceFinancials({
    items,
    totalDiscount: invoiceDiscount,
    isTaxEnabled,
    taxRate,
    payments,
  });

  // Quick single-click settlement actions
  const handleQuickPayFull = (method: PaymentMethod) => {
    const fullAmount = financialSummary.finalAmount;
    if (method === 'credit') {
      setPayments([]);
    } else {
      setPayments([
        {
          id: `pay-${Date.now()}`,
          method,
          amount: fullAmount,
          accountTitle:
            method === 'cash'
              ? 'صندوق اصلی فروشگاه'
              : method === 'pos'
              ? 'دستگاه کارتخوان به پرداخت ملت'
              : 'بانک ملی - جاری ۵۴۲۱',
        },
      ]);
    }
  };

  // Add split payment row
  const handleAddPaymentRow = () => {
    const remaining = financialSummary.remainingAmount;
    setPayments([
      ...payments,
      {
        id: `pay-${Date.now()}`,
        method: 'cash',
        amount: remaining > 0 ? remaining : 0,
        accountTitle: 'صندوق نقدی شماره ۱',
      },
    ]);
  };

  const handleRemovePaymentRow = (idx: number) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const handleUpdatePayment = (idx: number, field: keyof InvoicePayment, val: any) => {
    const updated = [...payments];
    updated[idx] = { ...updated[idx], [field]: val };
    setPayments(updated);
  };

  // Check customer credit limit
  const creditStatus = validateCustomerCredit(selectedPerson, financialSummary.remainingAmount);

  // Submit invoice
  const handleSubmit = async (shouldPrint: boolean) => {
    if (items.length === 0) {
      setErrorMessage('فاکتور باید حداقل شامل یک قلم کالا باشد.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const invoicePayload: Partial<Invoice> = {
        invoiceType: isProforma ? 'proforma' : 'sale',
        status: isProforma ? 'draft' : 'approved',
        personId: selectedPersonId,
        personName: selectedPerson?.name || 'مشتری عمومی',
        warehouseId: selectedWarehouseId,
        date: invoiceDate,
        items,
        subtotal: financialSummary.subtotal,
        totalDiscount: financialSummary.totalDiscount,
        taxAmount: financialSummary.taxAmount,
        isTaxEnabled,
        taxRate,
        finalAmount: financialSummary.finalAmount,
        paidAmount: financialSummary.paidAmount,
        remainingAmount: financialSummary.remainingAmount,
        payments: isProforma ? [] : payments.filter((p) => p.amount > 0),
      };

      const newInv = await api.createInvoice(invoicePayload);
      onSuccess(newInv, shouldPrint);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ثبت فاکتور');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 font-['Vazirmatn',Tahoma,sans-serif]">
        {/* 1. Modal Top Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`p-2 rounded-xl text-white ${
                isProforma ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black">
                  {isProforma ? 'صدور پیش‌فاکتور فروش' : 'صندوق و فاکتور فروش سریع (POS فروشگاهی)'}
                </h2>
                <div className="flex items-center bg-white dark:bg-slate-700 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsProforma(false)}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      !isProforma
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    فاکتور فروش قطعی
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProforma(true)}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      isProforma
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    پیش‌فاکتور (استعلام)
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isProforma
                  ? 'ثبت برگه پیش‌فاکتور با امکان استعلام قیمت و چاپ بدون کسر موجودی انبار'
                  : 'پشتیبانی از اسکنر بارکد، تبدیل واحدهای متری و طاقه‌ای، تسویه ترکیبی و کسر خودکار از کاردکس'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Warehouse Selector */}
            <div className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
              <Building className="w-4 h-4 text-teal-600" />
              <span className="text-slate-500">انبار:</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-transparent font-bold outline-hidden cursor-pointer"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} {wh.isDefault ? '(پیش‌فرض)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
              <span className="text-slate-500">تاریخ:</span>
              <input
                type="text"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-20 font-bold bg-transparent outline-hidden text-center"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Customer & Barcode Quick Search Strip */}
        <div className="p-3 bg-white dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Customer Selection */}
          <div className="md:col-span-4 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-600 shrink-0" />
            <div className="flex-1">
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-hidden focus:border-teal-500"
              >
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.groupName || (p.personType === 'customer' ? 'مشتری' : 'طرف حساب')})
                  </option>
                ))}
              </select>
            </div>
            {selectedPerson && selectedPerson.creditLimit > 0 && (
              <span className="text-[10.5px] px-2 py-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 rounded-lg shrink-0">
                سقف اعتبار: {toPersianDigits((selectedPerson.creditLimit / 1000).toLocaleString('fa-IR'))} هـ.ت
              </span>
            )}
          </div>

          {/* Barcode Scanner Input */}
          <div className="md:col-span-5 relative">
            <div className="relative">
              <span className="absolute right-3 top-2.5 text-teal-600">
                <Barcode className="w-4 h-4" />
              </span>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="اسکن بارکد با بارکدخوان یا ورود کد کالا + اینتر..."
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                onKeyDown={handleBarcodeSubmit}
                className="w-full pr-9 pl-4 py-2 text-xs font-mono bg-teal-50/50 dark:bg-slate-800 border-2 border-teal-500/50 focus:border-teal-600 rounded-xl outline-hidden text-slate-800 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Search Input for Quick Drawer */}
          <div className="md:col-span-3 relative">
            <span className="absolute right-3 top-2.5 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="جستجوی نام یا متریال کالا..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:border-teal-500"
            />
          </div>
        </div>

        {/* 3. Main Workspace: Line Items Grid (Left/Center) + Quick Add Drawer (Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Main Items Table (68% width on desktop) */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 border-l border-slate-200 dark:border-slate-800">
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <ShoppingCart className="w-16 h-16 stroke-1 text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300">
                  فاکتور در انتظار ثبت اقلام
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  بارکد کالا را اسکن کنید، کد آن را وارد کنید یا از ستون کناری روی کالاهای پرمصرف کلیک کنید.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3 text-center w-8">#</th>
                      <th className="py-2.5 px-3">شرح کالا و ملزومات</th>
                      <th className="py-2.5 px-3 text-center w-28">مقدار</th>
                      <th className="py-2.5 px-3 text-center w-28">واحد فروش</th>
                      <th className="py-2.5 px-3 text-left w-32">قیمت واحد (ریال)</th>
                      <th className="py-2.5 px-3 text-left w-24">تخفیف</th>
                      {isTaxEnabled && (
                        <th className="py-2.5 px-3 text-left w-20">مالیات</th>
                      )}
                      <th className="py-2.5 px-3 text-left w-32">مبلغ کل (ریال)</th>
                      <th className="py-2.5 px-2 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item, idx) => {
                      const prd = products.find((p) => p.id === item.productId);
                      const isPriceBelowMin =
                        prd && prd.minAllowedPrice > 0 && item.unitPrice < prd.minAllowedPrice;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="py-2 px-3 text-center font-bold text-slate-400">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.productName}
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5">
                              <span className="font-mono">{toPersianDigits(item.productCode)}</span>
                              {[item.color, item.size].filter(Boolean).length > 0 && (
                                <span>• {[item.color, item.size].filter(Boolean).join(' - ')}</span>
                              )}
                              {prd && (
                                <span className="text-teal-600 dark:text-teal-400">
                                  (موجودی کل: {toPersianDigits(prd.currentStock)} {prd.baseUnitName})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateItem(idx, 'quantity', Math.max(1, item.quantity - 1))
                                }
                                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step={prd?.allowDecimal ? '0.25' : '1'}
                                min="0.01"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                className="w-14 text-center font-bold py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(idx, 'quantity', item.quantity + 1)}
                                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Unit Selector */}
                          <td className="py-2 px-3 text-center">
                            <select
                              value={item.unitId}
                              onChange={(e) => handleUpdateItem(idx, 'unitId', e.target.value)}
                              className="w-full text-xs py-1 px-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-bold"
                            >
                              <option value={prd?.baseUnitId}>{prd?.baseUnitName || 'واحد پایه'}</option>
                              {prd?.unitConversions?.map((uc) => (
                                <option key={uc.unitId} value={uc.unitId}>
                                  {uc.unitName} (×{toPersianDigits(uc.conversionFactor)})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Unit Price */}
                          <td className="py-2 px-3 text-left">
                            <div className="flex flex-col items-end">
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                                className={`w-28 text-left font-bold py-1 px-2 border rounded-lg bg-white dark:bg-slate-900 ${
                                  isPriceBelowMin
                                    ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                              />
                              {isPriceBelowMin && (
                                <span className="text-[9.5px] text-rose-600 font-bold mt-0.5">
                                  زیر کف قیمت ({toPersianDigits(prd?.minAllowedPrice || 0)})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Row Discount */}
                          <td className="py-2 px-3 text-left">
                            <input
                              type="number"
                              value={item.discount}
                              onChange={(e) => handleUpdateItem(idx, 'discount', e.target.value)}
                              className="w-20 text-left font-bold py-1 px-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-rose-600"
                            />
                          </td>

                          {/* Row Tax (if enabled) */}
                          {isTaxEnabled && (
                            <td className="py-2 px-3 text-left font-mono text-slate-700 dark:text-slate-300">
                              {toPersianDigits(item.tax.toLocaleString('fa-IR'))}
                            </td>
                          )}

                          {/* Row Total */}
                          <td className="py-2 px-3 text-left font-black text-slate-900 dark:text-white">
                            {toPersianDigits(Math.round(item.totalPrice).toLocaleString('fa-IR'))}
                          </td>

                          {/* Delete Item */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Product Selector Drawer (32% width on desktop) */}
          <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-900/40 p-3 flex flex-col border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>کالاهای پرفروش و منتخب</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                {toPersianDigits(filteredProducts.length)} کالا
              </span>
            </div>

            {/* Category Pills */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-2 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold shrink-0 transition cursor-pointer ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                همه
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold shrink-0 transition cursor-pointer ${
                    selectedCategoryFilter === c.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleAddProduct(p, 1)}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition flex items-center justify-between group shadow-2xs"
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="font-bold text-xs truncate group-hover:text-teal-700 dark:group-hover:text-teal-300">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>کد: {toPersianDigits(p.code)}</span>
                      <span>• موجودی: {toPersianDigits(p.currentStock)} {p.baseUnitName}</span>
                    </div>
                  </div>
                  <div className="text-left pl-1">
                    <span className="font-black text-xs text-slate-900 dark:text-white">
                      {toPersianDigits(p.retailPrice.toLocaleString('fa-IR'))}
                    </span>
                    <span className="text-[10px] text-slate-500 block">ریال</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Bottom Controls: Totals, Split Payment, and Approval Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Quick Pay / Split Payments Config (7 Cols) */}
          <div className="lg:col-span-7 space-y-2">
            {!isProforma ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                      <span>تسویه و پرداخت:</span>
                    </span>
                    {/* Quick Settlement Buttons */}
                    <button
                      type="button"
                      onClick={() => handleQuickPayFull('cash')}
                      className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10.5px] rounded-md font-bold transition cursor-pointer"
                    >
                      تسویه نقدی
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPayFull('pos')}
                      className="px-2 py-0.5 bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10.5px] rounded-md font-bold transition cursor-pointer"
                    >
                      تسویه کارتخوان (POS)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPayFull('credit')}
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10.5px] rounded-md font-bold transition cursor-pointer"
                    >
                      تمام نسیه (دفتری)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن روش پرداخت ترکیبی</span>
                  </button>
                </div>

                {/* Payments Table */}
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {payments.map((p, pIdx) => (
                    <div
                      key={p.id || pIdx}
                      className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <select
                        value={p.method}
                        onChange={(e) => handleUpdatePayment(pIdx, 'method', e.target.value as PaymentMethod)}
                        className="py-1 px-2 font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        <option value="pos">کارتخوان (POS)</option>
                        <option value="cash">نقدی (صندوق)</option>
                        <option value="bank_transfer">حواله / فیش بانکی</option>
                        <option value="cheque">چک صیادی</option>
                      </select>

                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-[11px] text-slate-400">مبلغ:</span>
                        <input
                          type="number"
                          value={p.amount}
                          onChange={(e) =>
                            handleUpdatePayment(pIdx, 'amount', Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-28 font-bold py-1 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-left"
                        />
                        <span className="text-[10px] text-slate-400">ریال</span>
                      </div>

                      {p.method === 'cheque' && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="شماره چک / صیاد"
                            value={p.chequeNumber || ''}
                            onChange={(e) => handleUpdatePayment(pIdx, 'chequeNumber', e.target.value)}
                            className="w-24 text-[10px] py-1 px-1.5 border border-slate-200 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="سررسید"
                            value={p.dueDate || invoiceDate}
                            onChange={(e) => handleUpdatePayment(pIdx, 'dueDate', e.target.value)}
                            className="w-20 text-[10px] py-1 px-1.5 border border-slate-200 rounded-lg text-center"
                          />
                        </div>
                      )}

                      {p.method === 'pos' && (
                        <input
                          type="text"
                          placeholder="پیگیری"
                          value={p.referenceNumber || ''}
                          onChange={(e) => handleUpdatePayment(pIdx, 'referenceNumber', e.target.value)}
                          className="w-20 text-[10px] py-1 px-1.5 border border-slate-200 rounded-lg text-center"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(pIdx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Credit Limit Alert if remainingAmount exceeds limit */}
                {creditStatus.isExceeded && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      هشدار: مانده حساب مشتری ({toPersianDigits(creditStatus.newBalance.toLocaleString('fa-IR'))} ریال) از سقف اعتبار ({toPersianDigits(creditStatus.creditLimit.toLocaleString('fa-IR'))} ریال) فراتر می‌رود!
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">حالت پیش‌فاکتور فعال است: </span>
                <span>
                  هیچ کسر موجودی، تراکنش نقدی یا بدهی مالی در این مرحله ایجاد نمی‌شود. پس از موافقت مشتری می‌توانید در ۱ کلیک آن را به فاکتور فروش قطعی تبدیل کنید.
                </span>
              </div>
            )}
          </div>

          {/* Financial Totals & Action Buttons (5 Cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2 text-xs">
            {/* Discount & Tax switches */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">تخفیف کل:</span>
                <input
                  type="number"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 py-0.5 px-1 border border-slate-200 dark:border-slate-700 rounded text-left font-bold text-rose-600"
                />
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTaxEnabled}
                  onChange={(e) => setIsTaxEnabled(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span className="text-slate-600 dark:text-slate-300">ارزش افزوده (۱۰٪)</span>
              </label>
            </div>

            {/* Totals Summary */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">مبلغ کل قابل پرداخت:</span>
              <span className="text-base font-black text-teal-700 dark:text-teal-400">
                {toPersianDigits(financialSummary.finalAmount.toLocaleString('fa-IR'))} ریال
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>
                پرداخت‌شده: <strong className="text-emerald-700 font-bold">{toPersianDigits(financialSummary.paidAmount.toLocaleString('fa-IR'))}</strong>
              </span>
              <span>
                مانده نسیه: <strong className="text-amber-700 font-bold">{toPersianDigits(financialSummary.remainingAmount.toLocaleString('fa-IR'))} ریال</strong>
              </span>
            </div>

            {errorMessage && (
              <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                {errorMessage}
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={() => handleSubmit(false)}
                className={`py-2 px-3 rounded-xl font-bold text-xs text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
                  isProforma
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProforma ? 'ثبت پیش‌فاکتور' : 'ثبت نهایی فاکتور'}</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={() => handleSubmit(true)}
                className="py-2 px-3 rounded-xl font-bold text-xs text-white bg-teal-700 hover:bg-teal-800 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-teal-200"
              >
                <Printer className="w-4 h-4" />
                <span>ثبت و چاپ هلو (A4)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
