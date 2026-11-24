import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Printer,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  X,
  CreditCard,
  User,
  RotateCcw,
  Ban,
  Clock,
  Eye,
  Package,
  Layers,
  Wallet,
  Lock,
  Sparkles,
  Check,
  Filter,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import {
  Invoice,
  InvoiceItem,
  InvoiceType,
  InvoicePayment,
  InvoiceTemplateStyle,
  PaymentMethod,
  Product,
  Person,
  Unit,
  Warehouse,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';
import {
  calculateItemBaseQuantity,
  calculatePriceForSelectedUnit,
  roundPrecision,
} from '../../lib/conversions.ts';
import {
  calculateRowFinancials,
  calculateInvoiceFinancials,
} from '../../lib/salesCalculations.ts';
import { HolooInvoicePrint } from './HolooInvoicePrint.tsx';
import { ProductSelectorModal } from './ProductSelectorModal.tsx';
import { PersonSelectorModal } from './PersonSelectorModal.tsx';
import { InvoiceReferencePickerModal } from './InvoiceReferencePickerModal.tsx';

interface InvoicesModuleProps {
  initialOpenCreate?: boolean;
  editingInvoice?: Invoice | null;
  onFinished?: () => void;
}

interface DocTypeConfig {
  id: InvoiceType;
  label: string;
  shortLabel: string;
  prefix: string;
  partyLabel: string;
  colorClass: string;
  activeTabClass: string;
  badgeClass: string;
  usesPurchasePrice: boolean;
  requiresSettlement: boolean;
}

const DOC_TYPES: DocTypeConfig[] = [
  {
    id: 'sale',
    label: 'فاکتور فروش',
    shortLabel: 'فروش قطعی',
    prefix: 'INV',
    partyLabel: 'مشتری / خریدار',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    activeTabClass: 'bg-emerald-600 text-white shadow-xs',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    usesPurchasePrice: false,
    requiresSettlement: true,
  },
  {
    id: 'purchase',
    label: 'فاکتور خرید',
    shortLabel: 'خرید کالا',
    prefix: 'PUR',
    partyLabel: 'تامین‌کننده / بنکدار',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    activeTabClass: 'bg-indigo-600 text-white shadow-xs',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    usesPurchasePrice: true,
    requiresSettlement: true,
  },
  {
    id: 'proforma',
    label: 'پیش‌فاکتور',
    shortLabel: 'پیش‌فاکتور',
    prefix: 'PRF',
    partyLabel: 'مشتری استعلام‌گیرنده',
    colorClass: 'text-amber-600 dark:text-amber-400',
    activeTabClass: 'bg-amber-500 text-white shadow-xs',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    usesPurchasePrice: false,
    requiresSettlement: false,
  },
  {
    id: 'consignment',
    label: 'کالای امانی',
    shortLabel: 'امانی',
    prefix: 'CNS',
    partyLabel: 'طرف حساب امانی',
    colorClass: 'text-purple-600 dark:text-purple-400',
    activeTabClass: 'bg-purple-600 text-white shadow-xs',
    badgeClass: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    usesPurchasePrice: false,
    requiresSettlement: false,
  },
  {
    id: 'sale_return',
    label: 'برگشت از فروش',
    shortLabel: 'مرجوعی فروش',
    prefix: 'SRT',
    partyLabel: 'مشتری مرجوع‌کننده',
    colorClass: 'text-rose-600 dark:text-rose-400',
    activeTabClass: 'bg-rose-600 text-white shadow-xs',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    usesPurchasePrice: false,
    requiresSettlement: true,
  },
  {
    id: 'purchase_return',
    label: 'برگشت از خرید',
    shortLabel: 'مرجوعی خرید',
    prefix: 'PRT',
    partyLabel: 'تامین‌کننده / بنکدار',
    colorClass: 'text-orange-600 dark:text-orange-400',
    activeTabClass: 'bg-orange-600 text-white shadow-xs',
    badgeClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    usesPurchasePrice: true,
    requiresSettlement: true,
  },
  {
    id: 'waste',
    label: 'ضایعات کالا',
    shortLabel: 'ضایعات انبار',
    prefix: 'WST',
    partyLabel: 'مسئول ثبت / انبار',
    colorClass: 'text-slate-700 dark:text-slate-300',
    activeTabClass: 'bg-slate-700 text-white shadow-xs',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    usesPurchasePrice: true,
    requiresSettlement: false,
  },
];

export const InvoicesModule: React.FC<InvoicesModuleProps> = ({
  initialOpenCreate = false,
  editingInvoice = null,
  onFinished,
}) => {
  const { formatMoney, settings } = useSettings();
  const { confidential } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Unified Document Type Tab
  const [activeDocType, setActiveDocType] = useState<InvoiceType>(editingInvoice?.invoiceType || 'sale');
  const currentDocConfig = DOC_TYPES.find((d) => d.id === activeDocType) || DOC_TYPES[0];

  // Printable Template Style Selector (3 templates: رسمی, کلاسیک هلو, فشرده/بازاری)
  const [selectedTemplateStyle, setSelectedTemplateStyle] = useState<InvoiceTemplateStyle>('holoo_classic');

  // Form State for Unified Invoice Creation
  const [selectedPersonId, setSelectedPersonId] = useState<string>(editingInvoice?.personId || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(editingInvoice?.warehouseId || 'wh-shop');
  const [invoiceDate, setInvoiceDate] = useState<string>(editingInvoice?.date || getCurrentJalaliDate());
  const [items, setItems] = useState<InvoiceItem[]>(editingInvoice?.items || []);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(editingInvoice?.totalDiscount || editingInvoice?.discountAmount || 0);
  const [shippingCost, setShippingCost] = useState<number>(editingInvoice?.shippingCost || 0);
  const [notes, setNotes] = useState<string>(editingInvoice?.notes || '');

  useEffect(() => {
    if (editingInvoice) {
      setActiveDocType(editingInvoice.invoiceType);
      setSelectedPersonId(editingInvoice.personId || '');
      setSelectedWarehouseId(editingInvoice.warehouseId || 'wh-shop');
      setInvoiceDate(editingInvoice.date || getCurrentJalaliDate());
      setItems(editingInvoice.items || []);
      setInvoiceDiscount(editingInvoice.totalDiscount || editingInvoice.discountAmount || 0);
      setShippingCost(editingInvoice.shippingCost || 0);
      setNotes(editingInvoice.notes || '');
      if (editingInvoice.payments && editingInvoice.payments.length > 0) {
        setPayments(editingInvoice.payments);
      }
    }
  }, [editingInvoice]);

  // Product Picker & Instant Search in Form
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemUnitId, setItemUnitId] = useState<string>('');
  const [itemUnitPrice, setItemUnitPrice] = useState<string>('');
  const [itemDiscount, setItemDiscount] = useState<string>('0');

  // Settlement Payments
  const [payments, setPayments] = useState<InvoicePayment[]>([
    {
      id: 'pay-1',
      method: 'pos',
      amount: 0,
      accountTitle: 'دستگاه کارتخوان فروشگاه',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Instant Search & Filters for Recorded Invoices Table
  const [tableSearchTerm, setTableSearchTerm] = useState<string>('');
  const [tableTypeFilter, setTableTypeFilter] = useState<'all' | InvoiceType | 'cancelled'>('all');

  // Modals
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [cancelTargetInvoice, setCancelTargetInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>('');
  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState<boolean>(false);
  const [isRefPickerOpen, setIsRefPickerOpen] = useState<boolean>(false);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState<boolean>(false);
  const [referenceInvoiceNumber, setReferenceInvoiceNumber] = useState<string>('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [invs, prds, pers, unts, whs] = await Promise.all([
        api.getInvoices(),
        api.getProducts(),
        api.getPersons(),
        api.getUnits(),
        api.getWarehouses(),
      ]);
      setInvoices(invs);
      setProducts(prds);
      setPersons(pers);
      setUnits(unts);
      setWarehouses(whs);

      if (pers.length > 0 && !selectedPersonId) {
        const defaultCustomer = pers.find((p) => p.personType === 'customer') || pers[0];
        setSelectedPersonId(defaultCustomer.id);
      }
      if (whs.length > 0) {
        const shopWh = whs.find((w) => w.id === 'wh-shop') || whs[0];
        setSelectedWarehouseId(shopWh.id);
      }
      if (prds.length > 0 && !selectedProductId) {
        const firstActive = prds.find((p) => p.isActive) || prds[0];
        setSelectedProductId(firstActive.id);
        setItemUnitId(firstActive.baseUnitId);
        setItemUnitPrice(String(firstActive.retailPrice));
      }
    } catch (err) {
      console.error('Failed to load invoices data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Automatically pick a suitable person & price mode when switching document type tabs
  useEffect(() => {
    setFormFeedback(null);
    if (persons.length > 0) {
      if (activeDocType === 'purchase' || activeDocType === 'purchase_return') {
        const supplier = persons.find((p) => p.personType === 'supplier' || p.personType === 'both') || persons[0];
        setSelectedPersonId(supplier.id);
      } else {
        const customer = persons.find((p) => p.personType === 'customer' || p.personType === 'both') || persons[0];
        setSelectedPersonId(customer.id);
      }
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      const basePrice = currentDocConfig.usesPurchasePrice ? prod.purchasePrice : prod.retailPrice;
      setItemUnitPrice(String(basePrice));
    }
  }, [activeDocType]);

  // Selected Counterparty & Real-time Balance Computation
  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId) || null,
    [persons, selectedPersonId]
  );

  // Selected Product in Line Builder
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  // Filtered Products for quick selector
  const matchingProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => p.isActive)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
          (p.color && p.color.toLowerCase().includes(q))
      );
  }, [products, productSearch]);

  // Available Units for Selected Product
  const availableUnitsForProduct = useMemo(() => {
    if (!selectedProduct) return units;
    const baseUnit = units.find((u) => u.id === selectedProduct.baseUnitId);
    const convUnitIds = (selectedProduct.unitConversions || []).map((c) => c.unitId);
    const list = units.filter((u) => u.id === selectedProduct.baseUnitId || convUnitIds.includes(u.id));
    return list.length > 0 ? list : baseUnit ? [baseUnit] : units;
  }, [selectedProduct, units]);

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setItemUnitId(prod.baseUnitId);
      const price = currentDocConfig.usesPurchasePrice ? prod.purchasePrice : prod.retailPrice;
      setItemUnitPrice(String(price));
    }
  };

  const handleSelectUnit = (unitId: string) => {
    setItemUnitId(unitId);
    if (!selectedProduct) return;
    if (currentDocConfig.usesPurchasePrice) {
      const conv = selectedProduct.unitConversions?.find((c) => c.unitId === unitId);
      const factor = conv ? conv.conversionFactor : 1;
      setItemUnitPrice(String(Math.round(selectedProduct.purchasePrice * factor)));
    } else {
      const computedPrice = calculatePriceForSelectedUnit(selectedProduct, unitId, units, 'retailPrice');
      setItemUnitPrice(String(computedPrice));
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(itemQuantity) || 0;
    const price = parseFloat(itemUnitPrice) || 0;
    const disc = parseFloat(itemDiscount) || 0;

    if (qty <= 0) {
      setFormFeedback({ type: 'error', message: 'مقدار کالا باید بزرگتر از صفر باشد.' });
      return;
    }

    const activeUnitId = itemUnitId || selectedProduct.baseUnitId;
    const baseQuantity = calculateItemBaseQuantity(qty, activeUnitId, units, selectedProduct);
    const specificConv = selectedProduct.unitConversions?.find((c) => c.unitId === activeUnitId);
    const conversionFactor = specificConv ? specificConv.conversionFactor : qty > 0 ? roundPrecision(baseQuantity / qty, 4) : 1;

    // Check stock for stock-reducing documents
    const reducesStock = activeDocType === 'sale' || activeDocType === 'purchase_return' || activeDocType === 'waste';
    if (reducesStock && !settings.allowNegativeStock && baseQuantity > selectedProduct.currentStock) {
      setFormFeedback({
        type: 'error',
        message: `موجودی کالای «${selectedProduct.name}» کافی نیست (موجودی فعلی: ${toPersianDigits(selectedProduct.currentStock)} ${selectedProduct.baseUnitName}).`,
      });
      return;
    }

    const unitObj = units.find((u) => u.id === activeUnitId);
    const { totalPrice } = calculateRowFinancials({
      quantity: qty,
      unitPrice: price,
      discount: disc,
      isTaxEnabled: false,
    });

    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      quantity: roundPrecision(qty),
      unitId: unitObj?.id || selectedProduct.baseUnitId,
      unitName: unitObj?.name || selectedProduct.baseUnitName || 'عدد',
      conversionFactor,
      baseQuantity: roundPrecision(baseQuantity),
      unitPrice: price,
      discount: disc,
      tax: 0,
      totalPrice,
    };

    setItems((prev) => [...prev, newItem]);
    setItemQuantity('1');
    setItemDiscount('0');
    setFormFeedback(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItemQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const prod = products.find((p) => p.id === it.productId);
        const factor = it.conversionFactor || 1;
        const baseQuantity = roundPrecision(newQty * factor);
        const { totalPrice } = calculateRowFinancials({
          quantity: newQty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          isTaxEnabled: false,
        });
        return {
          ...it,
          quantity: newQty,
          baseQuantity: prod ? baseQuantity : newQty,
          totalPrice,
        };
      })
    );
  };

  // Totals Calculation
  const financials = useMemo(() => {
    const calc = calculateInvoiceFinancials({
      items,
      totalDiscount: invoiceDiscount,
      isTaxEnabled: false,
      payments,
    });
    const finalWithShipping = Math.max(0, calc.finalAmount + (shippingCost || 0));
    const paid = currentDocConfig.requiresSettlement ? calc.paidAmount : 0;
    const remaining = currentDocConfig.requiresSettlement ? Math.max(0, finalWithShipping - paid) : finalWithShipping;
    return {
      ...calc,
      finalAmount: finalWithShipping,
      paidAmount: paid,
      remainingAmount: remaining,
    };
  }, [items, invoiceDiscount, shippingCost, payments, currentDocConfig.requiresSettlement]);

  // Keep single payment row synced with finalAmount if user hasn't added multiple split rows
  useEffect(() => {
    if (payments.length === 1 && currentDocConfig.requiresSettlement) {
      setPayments([{ ...payments[0], amount: financials.finalAmount }]);
    }
  }, [financials.finalAmount, currentDocConfig.requiresSettlement]);

  // Projected Customer/Supplier Balance after this document
  const projectedPersonBalance = useMemo(() => {
    if (!selectedPerson) return 0;
    const prev = selectedPerson.currentBalance || 0;
    if (activeDocType === 'proforma' || activeDocType === 'consignment' || activeDocType === 'waste') {
      return prev;
    }
    if (activeDocType === 'sale') {
      return prev + financials.remainingAmount;
    }
    if (activeDocType === 'sale_return') {
      return prev - financials.remainingAmount;
    }
    if (activeDocType === 'purchase') {
      return prev - financials.remainingAmount;
    }
    if (activeDocType === 'purchase_return') {
      return prev + financials.remainingAmount;
    }
    return prev;
  }, [selectedPerson, activeDocType, financials.remainingAmount]);

  // Estimated Invoice Profit (Visible ONLY if confidential.canViewProfitMargins is true)
  const estimatedInvoiceProfit = useMemo(() => {
    if (activeDocType !== 'sale') return 0;
    const totalCost = items.reduce((sum, it) => {
      const prod = products.find((p) => p.id === it.productId);
      return sum + (prod ? prod.purchasePrice * it.baseQuantity : 0);
    }, 0);
    return financials.finalAmount - totalCost;
  }, [items, products, activeDocType, financials.finalAmount]);

  // Last Sold Price to this specific customer/person for the selected product
  const lastSoldPriceToCustomer = useMemo(() => {
    if (!selectedPersonId || !selectedProductId) return null;
    const isSale = activeDocType === 'sale' || activeDocType === 'proforma' || activeDocType === 'consignment';
    const targetType = isSale ? 'sale' : 'purchase';
    const candidateInvoices = invoices
      .filter((inv) => inv.personId === selectedPersonId && inv.invoiceType === targetType && inv.status !== 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date));

    for (const inv of candidateInvoices) {
      const line = inv.items.find((it) => it.productId === selectedProductId);
      if (line && line.unitPrice > 0) return line.unitPrice;
    }
    return null;
  }, [invoices, selectedPersonId, selectedProductId, activeDocType]);

  // محاسبه دقیق آخرین فی خرید کالا از سوابق فاکتورهای خرید یا قیمت پایه
  const lastActualPurchasePrice = useMemo(() => {
    if (!selectedProductId) return null;
    const purchaseInvoices = invoices
      .filter((inv) => inv.invoiceType === 'purchase' && inv.status !== 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date));

    for (const inv of purchaseInvoices) {
      const line = inv.items.find((it) => it.productId === selectedProductId);
      if (line && line.unitPrice > 0) return line.unitPrice;
    }
    return selectedProduct?.purchasePrice || null;
  }, [invoices, selectedProductId, selectedProduct]);

  // Smart Credit Limit Alert
  const creditLimitAlert = useMemo(() => {
    if (!selectedPerson || selectedPerson.creditLimit <= 0 || activeDocType !== 'sale') {
      return null;
    }
    const currentDebt = Math.max(0, selectedPerson.currentBalance || 0);
    const projectedDebt = currentDebt + (financials.remainingAmount || 0);
    const limit = selectedPerson.creditLimit;
    const isExceeded = projectedDebt > limit;
    const percent = Math.round((projectedDebt / limit) * 100);

    return {
      isExceeded,
      isNear: percent >= 80 && !isExceeded,
      percent,
      limit,
      projectedDebt,
      overAmount: Math.max(0, projectedDebt - limit),
    };
  }, [selectedPerson, financials.remainingAmount, activeDocType]);

  const handleSaveDocument = async (shouldPrintAfter: boolean) => {
    if (items.length === 0) {
      setFormFeedback({ type: 'error', message: 'حداقل یک ردیف کالا باید به سند اضافه شود.' });
      return;
    }
    if (!selectedPerson && activeDocType !== 'waste') {
      setFormFeedback({ type: 'error', message: 'لطفاً طرف حساب سند را انتخاب نمایید.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFormFeedback(null);

      const wh = warehouses.find((w) => w.id === selectedWarehouseId);
      const nextNum = `${currentDocConfig.prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

      let savedInvoice: Invoice;
      if (editingInvoice) {
        savedInvoice = await api.updateInvoice(editingInvoice.id, {
          invoiceType: activeDocType,
          personId: selectedPerson?.id || 'internal-waste',
          personName: activeDocType === 'waste' ? 'حساب ضایعات و کسری انبار' : selectedPerson?.name || 'مشتری حضوری',
          warehouseId: selectedWarehouseId,
          warehouseName: wh?.name || 'انبار فروشگاه',
          date: invoiceDate,
          items,
          subtotal: financials.subtotal,
          totalDiscount: financials.totalDiscount,
          taxAmount: financials.taxAmount,
          finalAmount: financials.finalAmount,
          paidAmount: financials.paidAmount,
          remainingAmount: financials.remainingAmount,
          payments: currentDocConfig.requiresSettlement ? payments.filter((p) => p.amount > 0) : [],
          notes: notes.trim() || `${currentDocConfig.label} ویرایش‌شده در سامانه`,
        });
      } else {
        savedInvoice = await api.createInvoice({
          invoiceNumber: nextNum,
          invoiceType: activeDocType,
          personId: selectedPerson?.id || 'internal-waste',
          personName: activeDocType === 'waste' ? 'حساب ضایعات و کسری انبار' : selectedPerson?.name || 'مشتری حضوری',
          personPreviousBalance: selectedPerson?.currentBalance || 0,
          warehouseId: selectedWarehouseId,
          warehouseName: wh?.name || 'انبار فروشگاه',
          date: invoiceDate,
          items,
          subtotal: financials.subtotal,
          totalDiscount: financials.totalDiscount,
          taxAmount: financials.taxAmount,
          finalAmount: financials.finalAmount,
          paidAmount: financials.paidAmount,
          remainingAmount: financials.remainingAmount,
          payments: currentDocConfig.requiresSettlement ? payments.filter((p) => p.amount > 0) : [],
          status: activeDocType === 'proforma' || activeDocType === 'consignment' ? 'draft' : 'approved',
          printConfig: {
            templateStyle: selectedTemplateStyle,
          },
          notes: notes.trim() || `${currentDocConfig.label} ثبت‌شده در سامانه`,
        });
      }

      setItems([]);
      setInvoiceDiscount(0);
      setShippingCost(0);
      setNotes('');
      await loadData();

      if (onFinished && editingInvoice) {
        onFinished();
      }

      setFormFeedback({
        type: 'success',
        message: `${currentDocConfig.label} شماره ${toPersianDigits(savedInvoice.invoiceNumber)} با موفقیت ${editingInvoice ? 'ویرایش و ذخیره' : 'ثبت'} شد.`,
      });

      if (shouldPrintAfter) {
        setPrintInvoice(savedInvoice);
      }
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: err.message || 'خطا در ثبت سند',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Proforma to Sale
  const handleConvertToSale = async (inv: Invoice) => {
    try {
      const updated = await api.convertProformaToSaleInvoice(inv.id);
      await loadData();
      setFormFeedback({
        type: 'success',
        message: `پیش‌فاکتور با موفقیت به فاکتور فروش قطعی شماره ${toPersianDigits(updated.invoiceNumber)} تبدیل شد.`,
      });
    } catch (err: any) {
      setFormFeedback({ type: 'error', message: `خطا در تبدیل پیش‌فاکتور: ${err.message}` });
    }
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelTargetInvoice) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      setCancelError('لطفاً دلیل ابطال را به صورت واضح وارد کنید (حداقل ۳ کاراکتر).');
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError('');
      await api.cancelInvoice(cancelTargetInvoice.id, cancelReason);
      setCancelTargetInvoice(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'خطا در ابطال سند');
    } finally {
      setIsCancelling(false);
    }
  };

  // Filtered Invoices List
  const filteredInvoices = useMemo(() => {
    const term = tableSearchTerm.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch =
        !term ||
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.personName.toLowerCase().includes(term) ||
        inv.date.includes(term) ||
        (inv.notes && inv.notes.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (tableTypeFilter === 'all') return true;
      if (tableTypeFilter === 'cancelled') return inv.status === 'cancelled';
      return inv.invoiceType === tableTypeFilter && inv.status !== 'cancelled';
    });
  }, [invoices, tableSearchTerm, tableTypeFilter]);

  const getDocTypeBadge = (type: InvoiceType) => {
    const cfg = DOC_TYPES.find((d) => d.id === type) || DOC_TYPES[0];
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${cfg.badgeClass}`}>
        {cfg.shortLabel}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Unified 7-Tab Document Switcher & Print Template Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                صدور یکپارچه اسناد بازرگانی و انبار
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ثبت آنی فاکتور، نمایش زنده مانده حساب شخص در سربرگ و چاپ در ۳ قالب استاندارد
              </p>
            </div>
          </div>

          {/* 3 Printable Invoice Design Switcher & Customizer Button */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              قالب چاپی:
            </span>
            {(
              [
                { id: 'official', label: 'رسمی' },
                { id: 'holoo_classic', label: 'کلاسیک هلو' },
                { id: 'compact_bazaar', label: 'فشرده / بازاری' },
              ] as { id: InvoiceTemplateStyle; label: string }[]
            ).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedTemplateStyle(tpl.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedTemplateStyle === tpl.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* 7 Unified Sub-Tabs (No document count badge as requested) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {DOC_TYPES.map((doc) => {
            const isActive = activeDocType === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveDocType(doc.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer border ${
                  isActive
                    ? `${doc.activeTabClass} border-transparent`
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{doc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Unified Invoice Creation Workspace */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Invoice Header with REAL-TIME Customer/Counterparty Balance Display */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Counterparty Selector with Searchable Modal */}
            <div className="lg:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {currentDocConfig.partyLabel}
                </label>
              </div>
              {activeDocType === 'waste' ? (
                <div className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                  حساب ضایعات و کسری موجودی انبار (سند داخلی)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPersonPickerOpen(true)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between hover:border-indigo-400 dark:hover:border-indigo-600 transition cursor-pointer text-right group shadow-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">
                      {selectedPerson ? `${selectedPerson.name} (${selectedPerson.code})` : 'انتخاب طرف حساب...'}
                    </span>
                    {selectedPerson?.phone && (
                      <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                        {toPersianDigits(selectedPerson.phone)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
                    تغییر
                  </span>
                </button>
              )}
            </div>

            {/* REAL-TIME Customer / Counterparty Balance Banner inside Header */}
            <div className="lg:col-span-5 space-y-2">
              {selectedPerson && activeDocType !== 'waste' ? (
                <>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          selectedPerson.currentBalance > 0
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                            : selectedPerson.currentBalance < 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">مانده حساب فعلی شخص:</span>
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <span
                            className={
                              selectedPerson.currentBalance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : selectedPerson.currentBalance < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }
                          >
                            {formatMoney(Math.abs(selectedPerson.currentBalance))}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {selectedPerson.currentBalance > 0
                              ? 'بدهکار'
                              : selectedPerson.currentBalance < 0
                              ? 'بستانکار'
                              : 'بی‌حساب'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-r border-slate-200 dark:border-slate-700 pr-3 text-left">
                      <span className="text-[10px] text-slate-400 block">مانده پس از ثبت این سند:</span>
                      <span
                        className={`text-xs font-black ${
                          projectedPersonBalance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : projectedPersonBalance < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {formatMoney(Math.abs(projectedPersonBalance))}{' '}
                        {projectedPersonBalance > 0
                          ? '(بدهکار)'
                          : projectedPersonBalance < 0
                          ? '(بستانکار)'
                          : '(تسویه)'}
                      </span>
                    </div>
                  </div>

                  {/* Smart Credit Limit Alert Badge */}
                  {creditLimitAlert && (
                    <div
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 animate-in fade-in ${
                        creditLimitAlert.isExceeded
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                          : creditLimitAlert.isNear
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>
                          سقف اعتبار: {formatMoney(creditLimitAlert.limit)} ({toPersianDigits(creditLimitAlert.percent)}٪ مصرف شده)
                        </span>
                      </div>
                      {creditLimitAlert.isExceeded ? (
                        <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-black shadow-xs">
                          فراتر از سقف ({formatMoney(creditLimitAlert.overAmount)})
                        </span>
                      ) : creditLimitAlert.isNear ? (
                        <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-black shadow-xs">
                          نزدیک به سقف اعتبار
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black shadow-xs">
                          وضعیت مجاز
                        </span>
                      )}
                    </div>
                  )}

                  {/* Reference Invoice Picker Trigger for Return Documents */}
                  {(activeDocType === 'sale_return' || activeDocType === 'purchase_return') && (
                    <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-200">
                        <RotateCcw className="w-4 h-4 text-rose-600" />
                        <span>
                          {referenceInvoiceNumber
                            ? `فاکتور مبدأ: #${referenceInvoiceNumber}`
                            : 'انتخاب فاکتور اصلی جهت بارگذاری اقلام:'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRefPickerOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer transition shadow-xs"
                      >
                        {referenceInvoiceNumber ? 'تغییر فاکتور مرجع' : 'انتخاب فاکتور اصلی'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                  کسر مستقیم از موجودی انبار و ثبت در سرفصل ضایعات و کسری کالا
                </div>
              )}
            </div>

            {/* Warehouse & Date */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  انبار مرتبط
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  تاریخ سند
                </label>
                <input
                  type="text"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Item Entry Bar (No Barcode Clutter - Clean Instant Product Search & Unit Conversion) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
            {/* Product Selector with Direct Advanced Catalog Trigger */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                انتخاب کالا از کاتالوگ
              </label>
              <button
                type="button"
                onClick={() => setIsProductCatalogOpen(true)}
                className="w-full px-3 py-2 h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between transition cursor-pointer text-right group shadow-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {selectedProduct
                      ? `${selectedProduct.name} (${selectedProduct.code})`
                      : 'کلیک جهت انتخاب کالا از کاتالوگ...'}
                  </span>
                </div>
                {selectedProduct && (
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono shrink-0">
                    موجودی: {toPersianDigits(selectedProduct.currentStock)} {selectedProduct.baseUnitName}
                  </span>
                )}
              </button>
            </div>

            {/* Quantity */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                مقدار
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                className="w-full px-2 py-2 h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
              />
            </div>

            {/* Unit */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                واحد
              </label>
              <select
                value={itemUnitId}
                onChange={(e) => handleSelectUnit(e.target.value)}
                className="w-full px-2 py-2 h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {availableUnitsForProduct.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Price (aligned on the same row) */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                فی واحد (ریال)
              </label>
              {currentDocConfig.usesPurchasePrice && !confidential.canViewPurchasePrice ? (
                <div className="w-full px-2.5 py-2 h-[38px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>محرمانه</span>
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  className="w-full px-2.5 py-2 h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              )}
            </div>

            {/* Row Discount */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                تخفیف
              </label>
              <input
                type="number"
                min="0"
                value={itemDiscount}
                onChange={(e) => setItemDiscount(e.target.value)}
                className="w-full px-2 py-2 h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center"
              />
            </div>

            {/* Add Button */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold text-transparent mb-1.5 select-none pointer-events-none">
                عملیات
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2 px-3 h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن</span>
              </button>
            </div>
          </div>

          {/* Smart Pricing & Info Strip: آخرین فی خرید + آخرین نرخ مشتری */}
          {selectedProduct && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-mono">
                کد: <strong className="text-slate-700 dark:text-slate-200">{toPersianDigits(selectedProduct.code)}</strong>
              </span>

              {/* آخرین فی خرید واقعی کالا */}
              {confidential.canViewPurchasePrice && (
                <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>آخرین فی خرید:</span>
                  <strong className="font-mono font-bold">
                    {formatMoney(lastActualPurchasePrice || selectedProduct.purchasePrice)}
                  </strong>
                  {currentDocConfig.usesPurchasePrice && (
                    <button
                      type="button"
                      onClick={() => setItemUnitPrice(String(lastActualPurchasePrice || selectedProduct.purchasePrice))}
                      className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded cursor-pointer font-bold"
                    >
                      اعمال
                    </button>
                  )}
                </span>
              )}

              {/* آخرین نرخ فروش به این مشتری */}
              {lastSoldPriceToCustomer && (
                <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span>آخرین نرخ به این مشتری:</span>
                  <strong className="font-mono font-bold">{formatMoney(lastSoldPriceToCustomer)}</strong>
                  <button
                    type="button"
                    onClick={() => setItemUnitPrice(String(lastSoldPriceToCustomer))}
                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded cursor-pointer font-bold"
                  >
                    اعمال
                  </button>
                </span>
              )}

              <span>
                تک‌فروشی: <strong className="text-emerald-600 font-mono">{formatMoney(selectedProduct.retailPrice)}</strong>
              </span>
              <span>
                عمده: <strong className="text-indigo-600 font-mono">{formatMoney(selectedProduct.wholesalePrice)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Feedback Alert */}
        {formFeedback && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              formFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span>{formFeedback.message}</span>
            <button onClick={() => setFormFeedback(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Current Invoice Items Table */}
        <div className="p-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">شرح کالا</th>
                  <th className="py-2.5 px-3 text-center w-28">مقدار</th>
                  <th className="py-2.5 px-3 text-center w-24">واحد</th>
                  <th className="py-2.5 px-3 text-center w-28">معادل پایه</th>
                  <th className="py-2.5 px-3 text-left w-32">فی واحد</th>
                  <th className="py-2.5 px-3 text-left w-28">تخفیف</th>
                  <th className="py-2.5 px-3 text-left w-36">مبلغ خالص ردیف</th>
                  <th className="py-2.5 px-3 text-center w-14">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      هنوز کالایی به این {currentDocConfig.label} اضافه نشده است.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                        {it.productName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItemQuantity(it.id, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-bold">
                        {it.unitName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {toPersianDigits(it.baseQuantity)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-bold">
                        {formatMoney(it.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-left text-rose-600">
                        {it.discount > 0 ? formatMoney(it.discount) : '۰'}
                      </td>
                      <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                        {formatMoney(it.totalPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Settlement & Totals Footer */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left/Right: Payment Settlement & Notes */}
            <div className="lg:col-span-7 space-y-3">
              {currentDocConfig.requiresSettlement && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>نحوه تسویه و پرداخت (تسویه نقدی، کارتخوان، حواله یا نسیه)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPayments((prev) => [
                          ...prev,
                          {
                            id: `pay-${Date.now()}`,
                            method: 'cash',
                            amount: 0,
                            accountTitle: 'صندوق فروشگاه',
                          },
                        ])
                      }
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + افزودن ردیف پرداخت ترکیبی
                    </button>
                  </div>

                  <div className="space-y-2">
                    {payments.map((pay, idx) => (
                      <div key={pay.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <select
                            value={pay.method}
                            onChange={(e) => {
                              const method = e.target.value as PaymentMethod;
                              setPayments((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, method } : p))
                              );
                            }}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                          >
                            <option value="pos">کارتخوان (POS)</option>
                            <option value="cash">نقدی (صندوق)</option>
                            <option value="bank_transfer">کارت به کارت / حواله</option>
                          </select>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            min="0"
                            value={pay.amount}
                            onChange={(e) => {
                              const amount = parseFloat(e.target.value) || 0;
                              setPayments((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, amount } : p))
                              );
                            }}
                            placeholder="مبلغ پرداختی"
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div className="col-span-3">
                          <button
                            type="button"
                            onClick={() =>
                              setPayments((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, amount: 0 } : p))
                              )
                            }
                            className="w-full py-2 px-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            ثبت به صورت نسیه
                          </button>
                        </div>
                        <div className="col-span-1 text-center">
                          {payments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تخفیف کلی سند (ریال)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    هزینه حمل / باربری (ریال)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    توضیحات سند
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="توضیحات فاکتور..."
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Totals Summary Card & Action Buttons */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>جمع کل اقلام ({toPersianDigits(items.length)} ردیف):</span>
                <strong className="font-bold">{formatMoney(financials.subtotal)}</strong>
              </div>
              {financials.totalDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>مجموع تخفیفات:</span>
                  <strong className="font-bold">{formatMoney(financials.totalDiscount)}-</strong>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>هزینه حمل و باربری:</span>
                  <strong className="font-bold">{formatMoney(shippingCost)}</strong>
                </div>
              )}

              {/* RBAC Protected Estimated Profit (Hidden for Cashiers) */}
              {activeDocType === 'sale' && confidential.canViewProfitMargins && items.length > 0 && (
                <div className="flex justify-between text-indigo-600 dark:text-indigo-400 pt-1 border-t border-slate-200/70 dark:border-slate-700">
                  <span>سود خالص تخمینی این فاکتور:</span>
                  <strong className="font-black">{formatMoney(estimatedInvoiceProfit)}</strong>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-black text-slate-800 dark:text-white text-sm">مبلغ نهایی سند:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(financials.finalAmount)}
                </span>
              </div>

              {currentDocConfig.requiresSettlement && (
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    پرداخت‌شده: <strong>{formatMoney(financials.paidAmount)}</strong>
                  </span>
                  <span className="text-amber-700 dark:text-amber-400">
                    مانده نسیه: <strong>{formatMoney(financials.remainingAmount)}</strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting || items.length === 0}
                  onClick={() => handleSaveDocument(false)}
                  className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingInvoice ? 'ذخیره تغییرات فاکتور' : `ثبت نهایی ${currentDocConfig.shortLabel}`}</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || items.length === 0}
                  onClick={() => handleSaveDocument(true)}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>{editingInvoice ? 'ذخیره و چاپ فاکتور' : `ثبت و چاپ (${selectedTemplateStyle === 'official' ? 'رسمی' : selectedTemplateStyle === 'holoo_classic' ? 'هلو' : 'فشرده'})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* 4. Multi-Template Printable Invoice Modal */}
      {printInvoice && (
        <HolooInvoicePrint
          invoice={{
            ...printInvoice,
            printConfig: {
              ...printInvoice.printConfig,
              templateStyle: selectedTemplateStyle,
            },
          }}
          settings={settings}
          onClose={() => setPrintInvoice(null)}
        />
      )}



      {/* 6. View Invoice Details Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  سند شماره {toPersianDigits(viewInvoice.invoiceNumber)} ({viewInvoice.personName})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تاریخ: {toPersianDigits(viewInvoice.date)} | ثبت‌کننده: {viewInvoice.createdBy}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const inv = viewInvoice;
                    setViewInvoice(null);
                    setPrintInvoice(inv);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ</span>
                </button>
                <button onClick={() => setViewInvoice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2 text-center">#</th>
                      <th className="p-2">کالا</th>
                      <th className="p-2 text-center">مقدار</th>
                      <th className="p-2 text-center">واحد</th>
                      <th className="p-2 text-left">فی</th>
                      <th className="p-2 text-left">جمع کل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewInvoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2 text-center">{toPersianDigits(idx + 1)}</td>
                        <td className="p-2 font-bold">{it.productName}</td>
                        <td className="p-2 text-center font-bold">{toPersianDigits(it.quantity)}</td>
                        <td className="p-2 text-center">{it.unitName}</td>
                        <td className="p-2 text-left">{formatMoney(it.unitPrice)}</td>
                        <td className="p-2 text-left font-black">{formatMoney(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-500">مبلغ نهایی: </span>
                  <strong className="text-sm font-black text-slate-900 dark:text-white">
                    {formatMoney(viewInvoice.finalAmount)}
                  </strong>
                </div>
                <div className="flex gap-4">
                  <span>پرداخت‌شده: <strong className="text-emerald-600">{formatMoney(viewInvoice.paidAmount)}</strong></span>
                  <span>مانده: <strong className="text-amber-600">{formatMoney(viewInvoice.remainingAmount)}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Product Catalog Modal */}
      <ProductSelectorModal
        isOpen={isProductCatalogOpen}
        onClose={() => setIsProductCatalogOpen(false)}
        products={products}
        units={units}
        isPurchaseDoc={currentDocConfig.usesPurchasePrice}
        onSelectProduct={(p) => handleSelectProduct(p.id)}
      />

      {/* Return Reference Invoice Picker Modal */}
      <InvoiceReferencePickerModal
        isOpen={isRefPickerOpen}
        onClose={() => setIsRefPickerOpen(false)}
        invoices={invoices}
        personId={selectedPersonId}
        isSaleReturn={activeDocType === 'sale_return'}
        onSelectReferenceInvoice={(refInv, returnItems) => {
          setReferenceInvoiceNumber(refInv.invoiceNumber);
          if (refInv.personId) setSelectedPersonId(refInv.personId);
          setItems(returnItems);
          setFormFeedback({
            type: 'success',
            message: `اقلام فاکتور مرجع #${refInv.invoiceNumber} با موفقیت بارگذاری شد (${toPersianDigits(returnItems.length)} قلم).`,
          });
        }}
      />

      {/* Searchable Counterparty Selector Modal */}
      <PersonSelectorModal
        isOpen={isPersonPickerOpen}
        onClose={() => setIsPersonPickerOpen(false)}
        persons={persons}
        selectedPersonId={selectedPersonId}
        targetType={activeDocType === 'purchase' || activeDocType === 'purchase_return' ? 'supplier' : 'customer'}
        onSelectPerson={(p) => setSelectedPersonId(p.id)}
      />

      {/* Printable Invoice Modal */}
      {printInvoice && (
        <HolooInvoicePrint
          invoice={printInvoice}
          settings={settings}
          onClose={() => setPrintInvoice(null)}
          currentPersonBalance={selectedPerson?.currentBalance}
        />
      )}
    </div>
  );
};
