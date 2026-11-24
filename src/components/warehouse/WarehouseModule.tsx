import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Package,
  Search,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  History,
  FileText,
  Truck,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Eye,
  Layers,
  Sparkles,
  BarChart3,
  Calendar,
  Building,
  DollarSign,
  Tag,
  Clock,
  Filter,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import {
  Product,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  GoodsReceipt,
  PurchaseProforma,
  WarehouseTransfer,
  StocktakingSession,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryTurnoverReportRow,
  Person,
  Unit,
} from '../../types/index.ts';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

type WarehouseTab =
  | 'kardex'
  | 'purchases_receipts'
  | 'transfers'
  | 'stocktaking'
  | 'adjustments'
  | 'alerts_turnover';

export const WarehouseModule: React.FC = () => {
  const { formatMoney } = useSettings();
  const { currentUser } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<WarehouseTab>('kardex');
  const [purchasesSubTab, setPurchasesSubTab] = useState<'receipts' | 'proformas'>('receipts');

  // Core Data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);

  // Module Specific Data
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');
  const [kardexEntries, setKardexEntries] = useState<KardexEntry[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [purchaseProformas, setPurchaseProformas] = useState<PurchaseProforma[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [stocktakingSessions, setStocktakingSessions] = useState<StocktakingSession[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [turnoverReport, setTurnoverReport] = useState<InventoryTurnoverReportRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isProformaModalOpen, setIsProformaModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isStocktakingModalOpen, setIsStocktakingModalOpen] = useState<boolean>(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [viewAuditModalData, setViewAuditModalData] = useState<{ title: string; auditTrail: any[]; details?: any } | null>(null);

  // Form State: New Goods Receipt
  const [receiptForm, setReceiptForm] = useState({
    supplierId: '',
    warehouseId: '',
    date: getCurrentJalaliDate(),
    driverName: '',
    driverMobile: '',
    waybillNumber: '',
    notes: '',
    status: 'approved' as 'draft' | 'approved',
    items: [{ productId: '', quantity: 1, unitPrice: 0, notes: '' }],
  });

  // Form State: New Purchase Proforma
  const [proformaForm, setProformaForm] = useState({
    supplierId: '',
    targetWarehouseId: '',
    date: getCurrentJalaliDate(),
    validUntil: getCurrentJalaliDate(),
    notes: '',
    status: 'draft' as 'draft' | 'approved',
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  });

  // Form State: New Transfer
  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    date: getCurrentJalaliDate(),
    driverOrTransporter: '',
    reason: 'شارژ موجودی پیشخوان و فروشگاه',
    notes: '',
    status: 'approved' as 'draft' | 'approved',
    items: [{ productId: '', quantity: 1 }],
  });

  // Form State: New Stocktaking
  const [stocktakingForm, setStocktakingForm] = useState({
    warehouseId: '',
    title: '',
    countRound: 1 as 1 | 2 | 3,
    date: getCurrentJalaliDate(),
    notes: '',
    status: 'draft' as 'draft' | 'approved',
    items: [] as { productId: string; systemQuantity: number; countedQuantity: number }[],
  });

  // Form State: New Inventory Adjustment
  const [adjustmentForm, setAdjustmentForm] = useState({
    warehouseId: '',
    type: 'minus' as 'plus' | 'minus',
    reasonCode: 'damage' as InventoryAdjustmentReason,
    reasonDescription: '',
    date: getCurrentJalaliDate(),
    notes: '',
    status: 'approved' as 'draft' | 'approved',
    items: [{ productId: '', quantity: 1 }],
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [
        whs,
        prds,
        pers,
        unts,
        rcps,
        prfs,
        trfs,
        stks,
        adjs,
        turnovers,
        lowStocks,
        stocks,
      ] = await Promise.all([
        api.getWarehouses().catch(() => []),
        api.getProducts().catch(() => []),
        api.getPersons().catch(() => []),
        api.getUnits().catch(() => []),
        api.getGoodsReceipts().catch(() => []),
        api.getPurchaseProformas().catch(() => []),
        api.getWarehouseTransfers().catch(() => []),
        api.getStocktakingSessions().catch(() => []),
        api.getInventoryAdjustments().catch(() => []),
        api.getInventoryTurnoverReport().catch(() => []),
        api.getLowStockProducts().catch(() => []),
        api.getWarehouseStocks().catch(() => []),
      ]);

      setWarehouses(whs);
      setProducts(prds);
      setPersons(pers);
      setUnits(unts);
      setGoodsReceipts(rcps);
      setPurchaseProformas(prfs);
      setTransfers(trfs);
      setStocktakingSessions(stks);
      setAdjustments(adjs);
      setTurnoverReport(turnovers);
      setLowStockProducts(lowStocks);
      setWarehouseStocks(stocks);

      const firstProdId = prds[0]?.id || '';
      setSelectedProductId((prev) => prev || firstProdId);

      if (firstProdId) {
        const kx = await api.getKardex({
          productId: firstProdId,
          warehouseId: selectedWarehouseFilter,
        }).catch(() => []);
        setKardexEntries(kx);
      }
    } catch (err: any) {
      console.error('Failed to load warehouse data:', err);
      showNotification('خطا در بارگذاری اطلاعات انبار: ' + (err.message || ''), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch Kardex whenever selected product or warehouse filter changes
  useEffect(() => {
    if (selectedProductId) {
      api.getKardex({
        productId: selectedProductId,
        warehouseId: selectedWarehouseFilter,
      })
        .then((data) => setKardexEntries(data))
        .catch((err) => console.error('Kardex load error:', err));
    }
  }, [selectedProductId, selectedWarehouseFilter]);

  // Total Warehouse Financial Value
  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.currentStock > 0 ? p.currentStock * p.purchasePrice : 0),
    0
  );

  // Total Pending Draft Documents
  const pendingDraftsCount =
    goodsReceipts.filter((r) => r.status === 'draft').length +
    purchaseProformas.filter((p) => p.status === 'draft').length +
    transfers.filter((t) => t.status === 'draft').length +
    stocktakingSessions.filter((s) => s.status === 'draft').length +
    adjustments.filter((a) => a.status === 'draft').length;

  // Selected Product Information for Kardex
  const currentKardexProduct = products.find((p) => p.id === selectedProductId);

  // ==================== Actions: Goods Receipt ====================
  const handleApproveReceipt = async (id: string) => {
    try {
      await api.approveGoodsReceipt(id);
      showNotification('رسید انبار با موفقیت تایید قطعی شد و به کاردکس اضافه گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در تایید رسید انبار', 'error');
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    if (!confirm('آیا از حذف این پیش‌نویس اطمینان دارید؟')) return;
    try {
      await api.deleteGoodsReceipt(id);
      showNotification('پیش‌نویس رسید با موفقیت حذف شد.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در حذف رسید', 'error');
    }
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validItems = receiptForm.items.filter((it) => it.productId && it.quantity > 0);
      if (validItems.length === 0) {
        alert('حداقل یک قلم کالا با تعداد معتبر مشخص نمایید.');
        return;
      }
      await api.saveGoodsReceipt({
        ...receiptForm,
        warehouseId: receiptForm.warehouseId || warehouses[0]?.id,
        supplierId: receiptForm.supplierId || persons.find((p) => p.personType === 'supplier')?.id,
        items: validItems.map((it) => {
          const prd = products.find((p) => p.id === it.productId);
          return {
            id: '',
            productId: it.productId,
            productCode: prd?.code || '',
            productName: prd?.name || '',
            unitId: prd?.baseUnitId || 'u-item',
            unitName: prd?.baseUnitName || 'عدد',
            quantity: Number(it.quantity),
            conversionFactor: 1,
            baseQuantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice) || prd?.purchasePrice || 0,
            totalPrice: Number(it.quantity) * (Number(it.unitPrice) || prd?.purchasePrice || 0),
            notes: it.notes,
          };
        }),
      });
      setIsReceiptModalOpen(false);
      showNotification(
        receiptForm.status === 'approved'
          ? 'رسید انبار قطعی شد و موجودی به‌روزرسانی گردید.'
          : 'پیش‌نویس رسید انبار ذخیره شد.'
      );
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در ثبت رسید انبار', 'error');
    }
  };

  // ==================== Actions: Purchase Proforma ====================
  const handleConvertToInvoice = async (id: string) => {
    if (!confirm('آیا مایل به تبدیل این پیش‌فاکتور به فاکتور خرید رسمی و ورود قطعی اقلام به انبار هستید؟')) return;
    try {
      const inv = await api.convertProformaToInvoice(id);
      showNotification(`پیش‌فاکتور با موفقیت به فاکتور خرید رسمی شماره ${inv.invoiceNumber} تبدیل و موجودی شارژ شد.`);
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در تبدیل پیش‌فاکتور به فاکتور خرید', 'error');
    }
  };

  const handleDeleteProforma = async (id: string) => {
    if (!confirm('آیا از حذف این پیش‌فاکتور خرید اطمینان دارید؟')) return;
    try {
      await api.deletePurchaseProforma(id);
      showNotification('پیش‌فاکتور خرید حذف گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در حذف پیش‌فاکتور', 'error');
    }
  };

  const handleSaveProforma = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validItems = proformaForm.items.filter((it) => it.productId && it.quantity > 0);
      if (validItems.length === 0) {
        alert('حداقل یک ردیف کالا انتخاب کنید.');
        return;
      }
      await api.savePurchaseProforma({
        ...proformaForm,
        targetWarehouseId: proformaForm.targetWarehouseId || warehouses[0]?.id,
        supplierId: proformaForm.supplierId || persons.find((p) => p.personType === 'supplier')?.id,
        items: validItems.map((it, idx) => {
          const prd = products.find((p) => p.id === it.productId);
          return {
            id: `prf-it-${idx}`,
            productId: it.productId,
            productCode: prd?.code || '',
            productName: prd?.name || '',
            unitId: prd?.baseUnitId || 'u-item',
            unitName: prd?.baseUnitName || 'عدد',
            conversionFactor: 1,
            quantity: Number(it.quantity),
            baseQuantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice) || prd?.purchasePrice || 0,
            discount: 0,
            tax: 0,
            totalPrice: Number(it.quantity) * (Number(it.unitPrice) || prd?.purchasePrice || 0),
          };
        }),
      });
      setIsProformaModalOpen(false);
      showNotification('پیش‌فاکتور خرید جدید با موفقیت ثبت شد.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در ثبت پیش‌فاکتور', 'error');
    }
  };

  // Quick Action from Low Stock Alert to Purchase Proforma
  const handleQuickProformaForProduct = (prd: Product) => {
    const defaultSupplier = persons.find((p) => p.personType === 'supplier' || p.personType === 'both');
    const neededQty = Math.max(10, prd.minStockAlert * 2 - prd.currentStock);
    setProformaForm({
      supplierId: defaultSupplier?.id || '',
      targetWarehouseId: warehouses[0]?.id || '',
      date: getCurrentJalaliDate(),
      validUntil: getCurrentJalaliDate(),
      notes: `سفارش شارژ نقطه سفارش کالای «${prd.name}» (موجودی فعلی: ${prd.currentStock} ${prd.baseUnitName})`,
      status: 'draft',
      items: [{ productId: prd.id, quantity: neededQty, unitPrice: prd.purchasePrice }],
    });
    setIsProformaModalOpen(true);
  };

  // ==================== Actions: Transfers ====================
  const handleApproveTransfer = async (id: string) => {
    try {
      await api.approveWarehouseTransfer(id);
      showNotification('حواله انتقال با موفقیت تایید شد و موجودی انبارها جابه‌جا گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در تایید حواله انتقال', 'error');
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm('آیا از حذف این پیش‌نویس انتقال مطمئن هستید؟')) return;
    try {
      await api.deleteWarehouseTransfer(id);
      showNotification('پیش‌نویس انتقال حذف گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در حذف حواله انتقال', 'error');
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.sourceWarehouseId === transferForm.destinationWarehouseId) {
      alert('انبار مبدأ و مقصد نمی‌توانند یکسان باشند.');
      return;
    }
    try {
      const validItems = transferForm.items.filter((it) => it.productId && it.quantity > 0);
      if (validItems.length === 0) {
        alert('حداقل یک قلم کالا جهت انتقال تعیین کنید.');
        return;
      }

      await api.saveWarehouseTransfer({
        ...transferForm,
        sourceWarehouseId: transferForm.sourceWarehouseId || warehouses[0]?.id,
        destinationWarehouseId: transferForm.destinationWarehouseId || warehouses[1]?.id,
        items: validItems.map((it) => {
          const prd = products.find((p) => p.id === it.productId);
          return {
            id: '',
            productId: it.productId,
            productCode: prd?.code || '',
            productName: prd?.name || '',
            unitId: prd?.baseUnitId || 'u-item',
            unitName: prd?.baseUnitName || 'عدد',
            quantity: Number(it.quantity),
            conversionFactor: 1,
            baseQuantity: Number(it.quantity),
            unitCost: prd?.purchasePrice || 0,
            totalCost: Number(it.quantity) * (prd?.purchasePrice || 0),
          };
        }),
      });
      setIsTransferModalOpen(false);
      showNotification(
        transferForm.status === 'approved'
          ? 'حواله انتقال قطعی شد و گردش در کاردکس هر دو انبار ثبت شد.'
          : 'پیش‌نویس حواله انتقال ثبت شد.'
      );
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در ثبت حواله انتقال', 'error');
    }
  };

  // ==================== Actions: Stocktaking ====================
  const handleOpenStocktakingModal = () => {
    const selectedWh = warehouses[0]?.id || '';
    const initialItems = products.map((p) => ({
      productId: p.id,
      systemQuantity: p.currentStock,
      countedQuantity: p.currentStock,
    }));
    setStocktakingForm({
      warehouseId: selectedWh,
      title: `انبارگردانی دوره پاییز ۱۴۰۳ - ${warehouses[0]?.name || 'انبار مرکزی'}`,
      countRound: 1,
      date: getCurrentJalaliDate(),
      notes: 'شمارش پایان دوره با حضور نماینده حسابرسی',
      status: 'draft',
      items: initialItems,
    });
    setIsStocktakingModalOpen(true);
  };

  const handleApproveStocktaking = async (id: string) => {
    if (!confirm('آیا از تایید نهایی انبارگردانی و صدور خودکار سند تعدیل کسری و فزونی اطمینان دارید؟')) return;
    try {
      await api.approveStocktakingSession(id);
      showNotification('انبارگردانی با موفقیت تایید نهایی شد و مغایرت‌ها بر کاردکس و موجودی اعمال گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در تایید انبارگردانی', 'error');
    }
  };

  const handleDeleteStocktaking = async (id: string) => {
    if (!confirm('آیا از حذف پیش‌نویس این دوره انبارگردانی اطمینان دارید؟')) return;
    try {
      await api.deleteStocktakingSession(id);
      showNotification('پیش‌نویس دوره انبارگردانی حذف شد.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در حذف انبارگردانی', 'error');
    }
  };

  const handleSaveStocktaking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveStocktakingSession({
        ...stocktakingForm,
        items: stocktakingForm.items.map((it) => {
          const prd = products.find((p) => p.id === it.productId);
          return {
            id: '',
            productId: it.productId,
            productCode: prd?.code || '',
            productName: prd?.name || '',
            unitName: prd?.baseUnitName || 'عدد',
            systemQuantity: Number(it.systemQuantity),
            countedQuantity: Number(it.countedQuantity),
            varianceQuantity: Number(it.countedQuantity) - Number(it.systemQuantity),
            unitCost: prd?.purchasePrice || 0,
            varianceValue: (Number(it.countedQuantity) - Number(it.systemQuantity)) * (prd?.purchasePrice || 0),
            varianceStatus:
              Number(it.countedQuantity) > Number(it.systemQuantity)
                ? 'surplus'
                : Number(it.countedQuantity) < Number(it.systemQuantity)
                ? 'deficit'
                : 'matched',
          };
        }),
      });
      setIsStocktakingModalOpen(false);
      showNotification('دوره انبارگردانی با موفقیت ذخیره شد.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در ثبت انبارگردانی', 'error');
    }
  };

  // ==================== Actions: Inventory Adjustments ====================
  const handleApproveAdjustment = async (id: string) => {
    try {
      await api.approveInventoryAdjustment(id);
      showNotification('برگه تعدیل موجودی قطعی شد و کاردکس کالا به‌روز گردید.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در تایید تعدیل موجودی', 'error');
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('آیا از حذف این پیش‌نویس تعدیل اطمینان دارید؟')) return;
    try {
      await api.deleteInventoryAdjustment(id);
      showNotification('پیش‌نویس تعدیل حذف شد.');
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در حذف برگه تعدیل', 'error');
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentForm.reasonDescription.trim() || adjustmentForm.reasonDescription.length < 3) {
      alert('ثبت شرح کامل دلیل تعدیل موجودی انبار اجباری است.');
      return;
    }
    const validItems = adjustmentForm.items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      alert('حداقل یک قلم کالا با تعداد مشخص نمایید.');
      return;
    }
    try {
      await api.saveInventoryAdjustment({
        ...adjustmentForm,
        warehouseId: adjustmentForm.warehouseId || warehouses[0]?.id,
        items: validItems.map((it) => {
          const prd = products.find((p) => p.id === it.productId);
          return {
            id: '',
            productId: it.productId,
            productCode: prd?.code || '',
            productName: prd?.name || '',
            unitName: prd?.baseUnitName || 'عدد',
            quantity: Number(it.quantity),
            unitCost: prd?.purchasePrice || 0,
            totalCost: Number(it.quantity) * (prd?.purchasePrice || 0),
          };
        }),
      });
      setIsAdjustmentModalOpen(false);
      showNotification(
        adjustmentForm.status === 'approved'
          ? 'برگه تعدیل به صورت قطعی ثبت و موجودی انبار اصلاح گردید.'
          : 'پیش‌نویس برگه تعدیل با موفقیت ثبت شد.'
      );
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'خطا در ثبت تعدیل موجودی', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Notification Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl shadow-md border flex items-center justify-between transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-medium text-sm">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs underline hover:opacity-80"
          >
            بستن
          </button>
        </div>
      )}

      {/* Main Header & Overview KPI Cards */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-5 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                سیستم جامع خرید و انبارداری
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  اتصال به پایگاه داده دیسک و تراکنش‌های اتمیک
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                کاردکس تعدادی و ریالی، کنترل گردش مستند، تفکیک اسناد پیش‌نویس و قطعی، انتقال و انبارگردانی
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setReceiptForm({
                  supplierId: persons.find((p) => p.personType === 'supplier')?.id || '',
                  warehouseId: warehouses[0]?.id || '',
                  date: getCurrentJalaliDate(),
                  driverName: '',
                  driverMobile: '',
                  waybillNumber: '',
                  notes: '',
                  status: 'approved',
                  items: [{ productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.purchasePrice || 0, notes: '' }],
                });
                setIsReceiptModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              رسید ورود کالا
            </button>

            <button
              onClick={() => {
                setProformaForm({
                  supplierId: persons.find((p) => p.personType === 'supplier')?.id || '',
                  targetWarehouseId: warehouses[0]?.id || '',
                  date: getCurrentJalaliDate(),
                  validUntil: getCurrentJalaliDate(),
                  notes: '',
                  status: 'draft',
                  items: [{ productId: products[0]?.id || '', quantity: 10, unitPrice: products[0]?.purchasePrice || 0 }],
                });
                setIsProformaModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              پیش‌فاکتور خرید
            </button>

            <button
              onClick={() => {
                setTransferForm({
                  sourceWarehouseId: warehouses[0]?.id || '',
                  destinationWarehouseId: warehouses[1]?.id || '',
                  date: getCurrentJalaliDate(),
                  driverOrTransporter: '',
                  reason: 'شارژ قفسه پیشخوان فروشگاه',
                  notes: '',
                  status: 'approved',
                  items: [{ productId: products[0]?.id || '', quantity: 10 }],
                });
                setIsTransferModalOpen(true);
              }}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              انتقال بین انبارها
            </button>

            <button
              onClick={() => {
                setAdjustmentForm({
                  warehouseId: warehouses[0]?.id || '',
                  type: 'minus',
                  reasonCode: 'damage',
                  reasonDescription: '',
                  date: getCurrentJalaliDate(),
                  notes: '',
                  status: 'approved',
                  items: [{ productId: products[0]?.id || '', quantity: 1 }],
                });
                setIsAdjustmentModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              تعدیل با ثبت دلیل
            </button>

            <button
              onClick={handleOpenStocktakingModal}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ClipboardList className="w-4 h-4" />
              انبارگردانی جدید
            </button>
          </div>
        </div>

        {/* 4 Overview Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal">ارزش ریالی موجودی انبارها</span>
              <span className="text-base font-bold text-slate-800 dark:text-white mt-1 block">
                {formatMoney(totalStockValue)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('alerts_turnover')}
            className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between cursor-pointer hover:border-rose-400 transition-colors"
          >
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal">هشدار کسری / نقطه سفارش</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                  {toPersianDigits(lowStockProducts.length)} کالا
                </span>
                {lowStockProducts.length > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded font-medium animate-pulse">
                    اقدام فوری
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal">تعداد انبارهای فعال</span>
              <span className="text-base font-bold text-slate-800 dark:text-white mt-1 block">
                {toPersianDigits(warehouses.length)} انبار رسمی
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal">اسناد در انتظار تایید قطعی</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {toPersianDigits(pendingDraftsCount)} سند
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">(پیش‌نویس)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('kardex')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'kardex'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          کاردکس تعدادی و ریالی
        </button>

        <button
          onClick={() => setActiveTab('purchases_receipts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'purchases_receipts'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          ورود کالا و پیش‌فاکتور خرید
          {(goodsReceipts.filter((r) => r.status === 'draft').length > 0 ||
            purchaseProformas.filter((p) => p.status === 'draft').length > 0) && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'transfers'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          انتقال بین انبارها
          {transfers.filter((t) => t.status === 'draft').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('stocktaking')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'stocktaking'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          انبارگردانی و مغایرت‌گیری
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'adjustments'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          تعدیل موجودی با ثبت دلیل
        </button>

        <button
          onClick={() => setActiveTab('alerts_turnover')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'alerts_turnover'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          هشدار حداقل موجودی و گردش کالا
          {lowStockProducts.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
              {toPersianDigits(lowStockProducts.length)}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: کاردکس تعدادی و ریالی کالا */}
      {/* ========================================================================= */}
      {activeTab === 'kardex' && (
        <div className="space-y-5">
          {/* Filters & Product Selector Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                انتخاب کالا جهت مشاهده کاردکس:
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name} - موجودی: {toPersianDigits(p.currentStock)} {p.baseUnitName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                فیلتر انبار:
              </label>
              <select
                value={selectedWarehouseFilter}
                onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="all">همه انبارها (تجمیعی)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (selectedProductId) {
                    api.getKardex({ productId: selectedProductId, warehouseId: selectedWarehouseFilter })
                      .then((d) => setKardexEntries(d));
                  }
                }}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                title="تازه‌سازی کاردکس"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Selected Product Status Card */}
          {currentKardexProduct && (
            <div className="bg-gradient-to-r from-amber-50/80 via-white to-slate-50 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 p-4 rounded-xl border border-amber-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  {currentKardexProduct.code}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                    {currentKardexProduct.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>واحد مبنا: <strong className="text-slate-700 dark:text-slate-300">{currentKardexProduct.baseUnitName}</strong></span>
                    <span>فی خرید پایه: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(currentKardexProduct.purchasePrice)}</strong></span>
                    {currentKardexProduct.color && <span>رنگ: {currentKardexProduct.color}</span>}
                    {currentKardexProduct.size && <span>سایز: {currentKardexProduct.size}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="text-left">
                  <span className="text-xs text-slate-500 block">مانده موجودی قطعی:</span>
                  <span className="font-bold text-slate-800 dark:text-white text-base">
                    {toPersianDigits(currentKardexProduct.currentStock)} {currentKardexProduct.baseUnitName}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-500 block">ارزش ریالی مانده:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                    {formatMoney(currentKardexProduct.currentStock * currentKardexProduct.purchasePrice)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-500 block">نقطه سفارش:</span>
                  <span className={`font-bold text-sm ${currentKardexProduct.currentStock <= currentKardexProduct.minStockAlert ? 'text-rose-600' : 'text-slate-600'}`}>
                    {toPersianDigits(currentKardexProduct.minStockAlert)} {currentKardexProduct.baseUnitName}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Kardex Detailed Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                ریز اسناد و گردش‌های ثبت‌شده در کاردکس تعدادی و ریالی
              </span>
              <span className="text-xs text-slate-500">
                مجموع گردش‌ها: {toPersianDigits(kardexEntries.length)} سند
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">نوع سند / گردش</th>
                    <th className="py-3 px-3">شماره سند</th>
                    <th className="py-3 px-3">انبار</th>
                    <th className="py-3 px-3 text-emerald-700 dark:text-emerald-400">وارده (+)</th>
                    <th className="py-3 px-3 text-rose-700 dark:text-rose-400">صادره (-)</th>
                    <th className="py-3 px-3">فی ریالی</th>
                    <th className="py-3 px-3">مبلغ کل گردش</th>
                    <th className="py-3 px-3 bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-white font-bold">
                      مانده تعدادی
                    </th>
                    <th className="py-3 px-3 bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-white font-bold">
                      مانده ریالی
                    </th>
                    <th className="py-3 px-3">ثبت‌کننده / شرح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                  {kardexEntries.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        گردش موجودی ثبت‌شده‌ای برای این کالا یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    kardexEntries.map((row, idx) => {
                      const isIn = row.inQuantity > 0;
                      const isOut = row.outQuantity > 0;
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="py-3 px-3 text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{toPersianDigits(row.date)}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1 ${
                                row.referenceType === 'initial_stock'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : row.referenceType.includes('purchase')
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : row.referenceType.includes('sale')
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                                  : row.referenceType.includes('transfer')
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              }`}
                            >
                              {row.referenceTypeTitle}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{toPersianDigits(row.referenceNumber)}</td>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{row.warehouseName}</td>
                          <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {isIn ? `+${toPersianDigits(row.inQuantity)}` : '-'}
                          </td>
                          <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400 font-mono">
                            {isOut ? `-${toPersianDigits(row.outQuantity)}` : '-'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {formatMoney(row.unitPrice)}
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">
                            {formatMoney(row.totalValue)}
                          </td>
                          <td className="py-3 px-3 bg-amber-50/50 dark:bg-amber-950/20 font-bold text-slate-800 dark:text-white font-mono">
                            {toPersianDigits(row.balanceQuantity)} {row.unitName}
                          </td>
                          <td className="py-3 px-3 bg-amber-50/50 dark:bg-amber-950/20 font-mono font-bold text-slate-800 dark:text-white">
                            {formatMoney(row.balanceValue)}
                          </td>
                          <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={row.notes || ''}>
                            <span className="block text-[11px] text-slate-700 dark:text-slate-300">{row.userName || 'کاربر سیستم'}</span>
                            <span className="text-[10px] text-slate-400">{row.notes || '-'}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ورود کالا و پیش‌فاکتور خرید */}
      {/* ========================================================================= */}
      {activeTab === 'purchases_receipts' && (
        <div className="space-y-5">
          {/* Sub-Tabs switcher */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPurchasesSubTab('receipts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  purchasesSubTab === 'receipts'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                رسیدهای ورود کالا (Goods Receipts) ({toPersianDigits(goodsReceipts.length)})
              </button>

              <button
                onClick={() => setPurchasesSubTab('proformas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  purchasesSubTab === 'proformas'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                پیش‌فاکتورهای خرید (Proforma / Inquiry) ({toPersianDigits(purchaseProformas.length)})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="draft">فقط پیش‌نویس</option>
                <option value="approved">فقط قطعی / تاییدشده</option>
              </select>
            </div>
          </div>

          {/* SubTab 1: Goods Receipts Table */}
          {purchasesSubTab === 'receipts' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    رسیدهای ورود بار و محموله‌ها
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    اسناد با وضعیت پیش‌نویس بر موجودی اثر ندارند؛ پس از بازبینی و ثبت قطعی، گردش رسمی انبار و کاردکس ایجاد می‌شود.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReceiptForm({
                      supplierId: persons.find((p) => p.personType === 'supplier')?.id || '',
                      warehouseId: warehouses[0]?.id || '',
                      date: getCurrentJalaliDate(),
                      driverName: '',
                      driverMobile: '',
                      waybillNumber: '',
                      notes: '',
                      status: 'approved',
                      items: [{ productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.purchasePrice || 0, notes: '' }],
                    });
                    setIsReceiptModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ثبت رسید ورود جدید
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3">شماره رسید</th>
                      <th className="py-3 px-3">تاریخ</th>
                      <th className="py-3 px-3">تأمین‌کننده</th>
                      <th className="py-3 px-3">انبار مقصد</th>
                      <th className="py-3 px-3">اقلام محموله</th>
                      <th className="py-3 px-3">مبلغ کل</th>
                      <th className="py-3 px-3">بارنامه / راننده</th>
                      <th className="py-3 px-3">وضعیت سند</th>
                      <th className="py-3 px-3">سابقه عملیات</th>
                      <th className="py-3 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                    {goodsReceipts
                      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
                      .map((receipt) => {
                        const isApproved = receipt.status === 'approved';
                        return (
                          <tr key={receipt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                            <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">
                              {toPersianDigits(receipt.receiptNumber)}
                            </td>
                            <td className="py-3 px-3 font-medium whitespace-nowrap">{toPersianDigits(receipt.date)}</td>
                            <td className="py-3 px-3 font-medium">{receipt.supplierName}</td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{receipt.warehouseName}</td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {toPersianDigits(receipt.items.length)} قلم
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {receipt.items.map((it) => `${it.productName} (${toPersianDigits(it.quantity)} ${it.unitName})`).join('، ')}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {formatMoney(receipt.totalAmount)}
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {receipt.driverName ? `${receipt.driverName} (${receipt.waybillNumber || '-'})` : '-'}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                }`}
                              >
                                {isApproved ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    قطعی (اعمال در انبار)
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    پیش‌نویس ورود
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-500">
                              {isApproved ? (
                                <div>
                                  <span className="text-slate-700 dark:text-slate-300 block">{receipt.approvedBy}</span>
                                  <span className="text-[10px] text-slate-400">{receipt.approvedAt}</span>
                                </div>
                              ) : (
                                <span>ثبت اولیه: {receipt.createdBy}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {!isApproved ? (
                                  <>
                                    <button
                                      onClick={() => handleApproveReceipt(receipt.id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium"
                                      title="تایید قطعی و افزایش موجودی کاردکس"
                                    >
                                      تایید قطعی
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReceipt(receipt.id)}
                                      className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                      title="حذف پیش‌نویس"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setViewAuditModalData({
                                        title: `جزییات رسید قطعی ${receipt.receiptNumber}`,
                                        auditTrail: [
                                          { action: 'ثبت رسید', userName: receipt.createdBy, timestamp: receipt.createdAt },
                                          { action: 'تایید قطعی و گردش انبار', userName: receipt.approvedBy || '', timestamp: receipt.approvedAt || '' },
                                        ],
                                        details: receipt,
                                      })
                                    }
                                    className="p-1 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded"
                                    title="مشاهده سابقه عملیات و اقلام"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 2: Purchase Proformas Table */}
          {purchasesSubTab === 'proformas' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    استعلام‌ها و پیش‌فاکتورهای خرید از بنکداران و واردکنندگان
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    پیش‌فاکتور خرید هیچ‌گونه تغییری در موجودی ایجاد نمی‌کند؛ با تایید نهایی می‌توانید آن را با یک کلیک به فاکتور خرید رسمی و گردش قطعی انبار تبدیل نمایید.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setProformaForm({
                      supplierId: persons.find((p) => p.personType === 'supplier')?.id || '',
                      targetWarehouseId: warehouses[0]?.id || '',
                      date: getCurrentJalaliDate(),
                      validUntil: getCurrentJalaliDate(),
                      notes: '',
                      status: 'draft',
                      items: [{ productId: products[0]?.id || '', quantity: 10, unitPrice: products[0]?.purchasePrice || 0 }],
                    });
                    setIsProformaModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ثبت پیش‌فاکتور خرید جدید
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3">شماره استعلام</th>
                      <th className="py-3 px-3">تاریخ ثبت</th>
                      <th className="py-3 px-3">مهلت اعتبار</th>
                      <th className="py-3 px-3">تأمین‌کننده / فروشنده</th>
                      <th className="py-3 px-3">انبار مقصد</th>
                      <th className="py-3 px-3">اقلام استعلام</th>
                      <th className="py-3 px-3">مبلغ نهایی</th>
                      <th className="py-3 px-3">وضعیت</th>
                      <th className="py-3 px-3 text-center">اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                    {purchaseProformas.map((proforma) => {
                      const isConverted = proforma.status === 'converted_to_invoice';
                      return (
                        <tr key={proforma.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-mono font-bold">{toPersianDigits(proforma.proformaNumber)}</td>
                          <td className="py-3 px-3 whitespace-nowrap">{toPersianDigits(proforma.date)}</td>
                          <td className="py-3 px-3 whitespace-nowrap text-amber-600 font-medium">{toPersianDigits(proforma.validUntil)}</td>
                          <td className="py-3 px-3 font-semibold">{proforma.supplierName}</td>
                          <td className="py-3 px-3 text-slate-500">{proforma.targetWarehouseName}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold">{toPersianDigits(proforma.items.length)} قلم کالا</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">
                            {formatMoney(proforma.finalAmount)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                isConverted
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                  : proforma.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              }`}
                            >
                              {isConverted ? 'تبدیل به فاکتور خرید' : proforma.status === 'approved' ? 'تایید تأمین‌کننده' : 'پیش‌نویس استعلام'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {!isConverted ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleConvertToInvoice(proforma.id)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-medium flex items-center gap-1"
                                  title="تبدیل به فاکتور خرید قطعی و افزایش موجودی"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  تبدیل به فاکتور خرید
                                </button>
                                <button
                                  onClick={() => handleDeleteProforma(proforma.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-emerald-600 font-medium">فاکتور خرید صادر شده</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: انتقال بین انبارها */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-sky-600" />
                  حواله‌های انتقال بین انبارها (انبار مرکزی، پیشخوان فروشگاه، ضایعات)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  جابه‌جایی کالا بدون ایجاد فاکتور؛ کسر دقیق از انبار مبدأ و اضافه به انبار مقصد با ثبت دوگانه در کاردکس
                </p>
              </div>

              <button
                onClick={() => {
                  setTransferForm({
                    sourceWarehouseId: warehouses[0]?.id || '',
                    destinationWarehouseId: warehouses[1]?.id || '',
                    date: getCurrentJalaliDate(),
                    driverOrTransporter: '',
                    reason: 'شارژ قفسه پیشخوان فروشگاه',
                    notes: '',
                    status: 'approved',
                    items: [{ productId: products[0]?.id || '', quantity: 10 }],
                  });
                  setIsTransferModalOpen(true);
                }}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                ثبت حواله انتقال جدید
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">شماره حواله</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">انبار مبدأ</th>
                    <th className="py-3 px-3">انبار مقصد</th>
                    <th className="py-3 px-3">اقلام انتقالی</th>
                    <th className="py-3 px-3">ارزش برآوردی</th>
                    <th className="py-3 px-3">علت جابه‌جایی</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">سابقه عملیات</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        حواله انتقالی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((trf) => {
                      const isApproved = trf.status === 'approved';
                      return (
                        <tr key={trf.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">
                            {toPersianDigits(trf.transferNumber)}
                          </td>
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{toPersianDigits(trf.date)}</td>
                          <td className="py-3 px-3 font-semibold text-rose-600 dark:text-rose-400">
                            {trf.sourceWarehouseName}
                          </td>
                          <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                            {trf.destinationWarehouseName}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold">{toPersianDigits(trf.items.length)} قلم کالا</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                              {trf.items.map((it) => `${it.productName} (${toPersianDigits(it.quantity)} ${it.unitName})`).join('، ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold">{formatMoney(trf.totalCost)}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{trf.reason}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold inline-flex items-center gap-1 ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              }`}
                            >
                              {isApproved ? 'قطعی و جابه‌جا شده' : 'پیش‌نویس انتقال'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() =>
                                setViewAuditModalData({
                                  title: `سابقه عملیات حواله انتقال ${trf.transferNumber}`,
                                  auditTrail: trf.auditTrail || [],
                                  details: trf,
                                })
                              }
                              className="text-xs text-sky-600 hover:underline flex items-center gap-1"
                            >
                              <History className="w-3.5 h-3.5" />
                              مشاهده لاگ ({toPersianDigits(trf.auditTrail?.length || 1)})
                            </button>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {!isApproved ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleApproveTransfer(trf.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium"
                                  title="تایید خروج از مبدأ و ورود به مقصد"
                                >
                                  تایید قطعی
                                </button>
                                <button
                                  onClick={() => handleDeleteTransfer(trf.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">تکمیل شده</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: انبارگردانی و مغایرت‌گیری */}
      {/* ========================================================================= */}
      {activeTab === 'stocktaking' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-purple-600" />
                  دوره‌های انبارگردانی رسمی، شمارش عینی و مغایرت‌گیری (کسری و فزونی)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ثبت شمارش فیزیکی اقلام، مقایسه با موجودی سیستم، محاسبه خودکار کسری/فزونی و صدور سند تعدیل با تایید مدیر انبار
                </p>
              </div>

              <button
                onClick={handleOpenStocktakingModal}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                شروع دوره انبارگردانی جدید
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">کد دوره</th>
                    <th className="py-3 px-3">عنوان دوره انبارگردانی</th>
                    <th className="py-3 px-3">انبار مورد شمارش</th>
                    <th className="py-3 px-3">نوبت شمارش</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">تعداد اقلام</th>
                    <th className="py-3 px-3 text-rose-600">ارزش کسری</th>
                    <th className="py-3 px-3 text-emerald-600">ارزش فزونی</th>
                    <th className="py-3 px-3 font-bold">مغایرت خالص</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                  {stocktakingSessions.map((session) => {
                    const isApproved = session.status === 'approved';
                    return (
                      <tr key={session.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">
                          {session.code}
                        </td>
                        <td className="py-3 px-3 font-semibold">{session.title}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{session.warehouseName}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium text-[11px]">
                            نوبت {toPersianDigits(session.countRound)}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{toPersianDigits(session.date)}</td>
                        <td className="py-3 px-3 font-bold">{toPersianDigits(session.totalItemsCount)} قلم</td>
                        <td className="py-3 px-3 font-mono text-rose-600 font-semibold">
                          {formatMoney(session.totalDeficitValue)}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">
                          {formatMoney(session.totalSurplusValue)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          <span className={session.netVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {session.netVarianceValue > 0 ? '+' : ''}
                            {formatMoney(session.netVarianceValue)}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            }`}
                          >
                            {isApproved ? 'تایید نهایی و تعدیل شده' : 'پیش‌نویس شمارش'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isApproved ? (
                              <>
                                <button
                                  onClick={() => handleApproveStocktaking(session.id)}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium"
                                  title="تایید نهایی و ثبت خودکار تعدیلات کاردکس"
                                >
                                  تایید نهایی
                                </button>
                                <button
                                  onClick={() => handleDeleteStocktaking(session.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() =>
                                  setViewAuditModalData({
                                    title: `جزییات و صورت‌جلسه انبارگردانی ${session.code}`,
                                    auditTrail: session.auditTrail || [],
                                    details: session,
                                  })
                                }
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[11px] flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                صورت‌جلسه و اقلام
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: تعدیل موجودی با ثبت دلیل اجباری */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments' && (
        <div className="space-y-5">
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <strong className="block text-sm font-bold mb-1">الزام قانونی ثبت گردش مستند و ممنوعیت تغییر بدون دلیل:</strong>
              طبق استاندارد حسابداری، موجودی هیچ کالایی بدون سند گردش و ثبت دلیل مشخص (خرابی، پوسیدگی، خطای شمارش، سرقت، نمونه‌برداری، مغایرت انبارگردانی) تغییر نمی‌کند. اسناد قطعی دارای سابقه غیرقابل تغییر بوده و در کاردکس ثبت می‌شوند.
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  برگه‌های تعدیل موجودی کالا (کسری و فزونی با ثبت دلیل رسمی)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ثبت اصلاحات موجودی با دسته‌بندی دلایل و لاگ دقیق کاربر تاییدکننده
                </p>
              </div>

              <button
                onClick={() => {
                  setAdjustmentForm({
                    warehouseId: warehouses[0]?.id || '',
                    type: 'minus',
                    reasonCode: 'damage',
                    reasonDescription: '',
                    date: getCurrentJalaliDate(),
                    notes: '',
                    status: 'approved',
                    items: [{ productId: products[0]?.id || '', quantity: 1 }],
                  });
                  setIsAdjustmentModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                ثبت برگه تعدیل جدید
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">شماره برگه</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">انبار</th>
                    <th className="py-3 px-3">نوع تعدیل</th>
                    <th className="py-3 px-3">علت اصلی تعدیل</th>
                    <th className="py-3 px-3">شرح تفصیلی دلیل</th>
                    <th className="py-3 px-3">تعداد اقلام</th>
                    <th className="py-3 px-3">ارزش ریالی تعدیل</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">تاییدکننده</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">
                        برگه تعدیلی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => {
                      const isApproved = adj.status === 'approved';
                      const isPlus = adj.type === 'plus';
                      return (
                        <tr key={adj.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-white">
                            {toPersianDigits(adj.adjustmentNumber)}
                          </td>
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{toPersianDigits(adj.date)}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{adj.warehouseName}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isPlus
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {isPlus ? '+ فزونی (افزایش)' : '- کسری (کاهش)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{adj.reasonTitle}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={adj.reasonDescription}>
                            {adj.reasonDescription}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold">{toPersianDigits(adj.totalQuantity)} واحد</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                              {adj.items.map((it) => `${it.productName} (${toPersianDigits(it.quantity)} ${it.unitName})`).join('، ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold">
                            {formatMoney(adj.totalCost)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {isApproved ? 'قطعی و اعمال در انبار' : 'پیش‌نویس'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                            {adj.approvedBy ? (
                              <span>{adj.approvedBy} ({adj.approvedAt})</span>
                            ) : (
                              <span>ثبت: {adj.createdBy}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {!isApproved ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleApproveAdjustment(adj.id)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium"
                                  title="تایید قطعی و اثر بر موجودی کاردکس"
                                >
                                  تایید قطعی
                                </button>
                                <button
                                  onClick={() => handleDeleteAdjustment(adj.id)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  setViewAuditModalData({
                                    title: `سابقه برگه تعدیل ${adj.adjustmentNumber}`,
                                    auditTrail: adj.auditTrail || [],
                                    details: adj,
                                  })
                                }
                                className="p-1 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded"
                                title="مشاهده سابقه"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: هشدار حداقل موجودی و گزارش گردش کالا */}
      {/* ========================================================================= */}
      {activeTab === 'alerts_turnover' && (
        <div className="space-y-6">
          {/* Section 1: Low Stock Alerts */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-900/40 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    اقلام در آستانه اتمام و نقطه سفارش (حداقل موجودی)
                  </h3>
                  <p className="text-xs text-slate-500">
                    کالاهایی که موجودی آن‌ها به حداقل تعریف‌شده رسیده و باید سریعاً پیش‌فاکتور یا سفارش خرید صادر شود.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                {toPersianDigits(lowStockProducts.length)} کالا نیازمند سفارش
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-emerald-600 font-medium text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                تمامی اقلام دارای موجودی کافی بالاتر از نقطه سفارش هستند.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((p) => {
                  const isOutOfStock = p.currentStock <= 0;
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                            {p.code}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              isOutOfStock
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {isOutOfStock ? 'ناموجود' : 'کسری بحرانی'}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white mb-2 line-clamp-1">
                          {p.name}
                        </h4>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          <div className="flex justify-between">
                            <span>موجودی فعلی:</span>
                            <strong className={isOutOfStock ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>
                              {toPersianDigits(p.currentStock)} {p.baseUnitName}
                            </strong>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>حداقل نقطه سفارش:</span>
                            <span>{toPersianDigits(p.minStockAlert)} {p.baseUnitName}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickProformaForProduct(p)}
                        className="mt-3.5 w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        صدور پیش‌فاکتور خرید این کالا
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Inventory Movement & Turnover Report */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  گزارش گردش کالا و تحلیل تحلیلی انبار (Turnover Ratio & Velocity)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  محاسبه دقیق جریان ورود و خروج، نسبت گردش موجودی (خروجی به میانگین موجودی) و دوره گردش کالا به روز
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">کد کالا</th>
                    <th className="py-3 px-3">عنوان کالا</th>
                    <th className="py-3 px-3">گروه</th>
                    <th className="py-3 px-3">موجودی ابتدای دوره</th>
                    <th className="py-3 px-3 text-emerald-600">ورودی کل (+)</th>
                    <th className="py-3 px-3 text-rose-600">خروجی کل (-)</th>
                    <th className="py-3 px-3 font-bold bg-amber-50/50 dark:bg-amber-950/20">موجودی فعلی</th>
                    <th className="py-3 px-3">ارزش موجودی</th>
                    <th className="py-3 px-3 font-semibold text-center">نرخ گردش کالا</th>
                    <th className="py-3 px-3 text-center">دوره گردش (روز)</th>
                    <th className="py-3 px-3 text-center">وضعیت تحلیلی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                  {turnoverReport.map((row) => {
                    return (
                      <tr key={row.productId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-3 font-mono font-bold">{row.productCode}</td>
                        <td className="py-3 px-3 font-semibold">{row.productName}</td>
                        <td className="py-3 px-3 text-slate-500">{row.categoryName}</td>
                        <td className="py-3 px-3 font-mono">{toPersianDigits(row.initialStock)} {row.unitName}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-emerald-600">+{toPersianDigits(row.totalInflow)}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-rose-600">-{toPersianDigits(row.totalOutflow)}</td>
                        <td className="py-3 px-3 font-mono font-bold bg-amber-50/50 dark:bg-amber-950/20 text-slate-800 dark:text-white">
                          {toPersianDigits(row.currentStock)} {row.unitName}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold">{formatMoney(row.totalStockValue)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                            {toPersianDigits(row.turnoverRatio)} بار
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-center text-slate-600 dark:text-slate-300">
                          {toPersianDigits(row.turnoverDays)} روز
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              row.status === 'out_of_stock'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : row.status === 'low_stock'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : row.status === 'stagnant'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {row.status === 'out_of_stock'
                              ? 'اتمام موجودی'
                              : row.status === 'low_stock'
                              ? 'نقطه سفارش'
                              : row.status === 'stagnant'
                              ? 'راکد (گردش صفر)'
                              : 'گردش مطلوب'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ثبت رسید ورود کالا */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-700">
              <Truck className="w-5 h-5 text-emerald-600" />
              ثبت رسید ورود محموله کالا به انبار
            </h2>

            <form onSubmit={handleSaveReceipt} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">تأمین‌کننده طرف حساب:</label>
                  <select
                    value={receiptForm.supplierId}
                    onChange={(e) => setReceiptForm({ ...receiptForm, supplierId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">انبار مقصد ورود کالا:</label>
                  <select
                    value={receiptForm.warehouseId}
                    onChange={(e) => setReceiptForm({ ...receiptForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">نام راننده و شماره بارنامه:</label>
                  <input
                    type="text"
                    value={receiptForm.driverName}
                    onChange={(e) => setReceiptForm({ ...receiptForm, driverName: e.target.value })}
                    placeholder="مثال: علی رضایی - بارنامه WB-992"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">وضعیت ثبت سند:</label>
                  <select
                    value={receiptForm.status}
                    onChange={(e) => setReceiptForm({ ...receiptForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="approved">قطعی (اعمال فوری بر موجودی انبار و کاردکس)</option>
                    <option value="draft">پیش‌نویس (بدون اثر بر موجودی)</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">اقلام کالای وارده:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setReceiptForm({
                        ...receiptForm,
                        items: [...receiptForm.items, { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.purchasePrice || 0, notes: '' }],
                      })
                    }
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن ردیف کالا
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {receiptForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const newItems = [...receiptForm.items];
                          const prd = products.find((p) => p.id === e.target.value);
                          newItems[idx].productId = e.target.value;
                          newItems[idx].unitPrice = prd?.purchasePrice || 0;
                          setReceiptForm({ ...receiptForm, items: newItems });
                        }}
                        className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const newItems = [...receiptForm.items];
                          newItems[idx].quantity = Number(e.target.value);
                          setReceiptForm({ ...receiptForm, items: newItems });
                        }}
                        className="w-20 px-2 py-1 text-xs border rounded bg-slate-50 dark:bg-slate-900"
                        placeholder="تعداد"
                      />

                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const newItems = [...receiptForm.items];
                          newItems[idx].unitPrice = Number(e.target.value);
                          setReceiptForm({ ...receiptForm, items: newItems });
                        }}
                        className="w-28 px-2 py-1 text-xs border rounded bg-slate-50 dark:bg-slate-900"
                        placeholder="فی خرید"
                      />

                      {receiptForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = receiptForm.items.filter((_, i) => i !== idx);
                            setReceiptForm({ ...receiptForm, items: newItems });
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">توضیحات رسید انبار:</label>
                <input
                  type="text"
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  placeholder="ملاحظات بارگیری، کیفیت بسته‌بندی، ..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
                >
                  ثبت نهایی رسید ورود کالا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ثبت پیش‌فاکتور خرید */}
      {/* ========================================================================= */}
      {isProformaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-700">
              <FileText className="w-5 h-5 text-indigo-600" />
              ثبت پیش‌فاکتور خرید / استعلام کالا
            </h2>

            <form onSubmit={handleSaveProforma} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">تأمین‌کننده / بنکدار:</label>
                  <select
                    value={proformaForm.supplierId}
                    onChange={(e) => setProformaForm({ ...proformaForm, supplierId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">انبار هدف تحویل:</label>
                  <select
                    value={proformaForm.targetWarehouseId}
                    onChange={(e) => setProformaForm({ ...proformaForm, targetWarehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs font-bold block mb-2">اقلام سفارش پیش‌فاکتور:</span>
                <div className="space-y-2">
                  {proformaForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const newItems = [...proformaForm.items];
                          const prd = products.find((p) => p.id === e.target.value);
                          newItems[idx].productId = e.target.value;
                          newItems[idx].unitPrice = prd?.purchasePrice || 0;
                          setProformaForm({ ...proformaForm, items: newItems });
                        }}
                        className="flex-1 text-xs bg-transparent"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const newItems = [...proformaForm.items];
                          newItems[idx].quantity = Number(e.target.value);
                          setProformaForm({ ...proformaForm, items: newItems });
                        }}
                        className="w-20 px-2 py-1 text-xs border rounded"
                        placeholder="تعداد"
                      />
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const newItems = [...proformaForm.items];
                          newItems[idx].unitPrice = Number(e.target.value);
                          setProformaForm({ ...proformaForm, items: newItems });
                        }}
                        className="w-28 px-2 py-1 text-xs border rounded"
                        placeholder="قیمت پیشنهادی"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">شرح و شرایط تحویل استعلام:</label>
                <input
                  type="text"
                  value={proformaForm.notes}
                  onChange={(e) => setProformaForm({ ...proformaForm, notes: e.target.value })}
                  placeholder="شرایط پرداخت چکی یا تسویه یک‌ماهه"
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsProformaModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium"
                >
                  ثبت پیش‌فاکتور خرید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ثبت حواله انتقال بین انبارها */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-700">
              <ArrowRightLeft className="w-5 h-5 text-sky-600" />
              صدور حواله انتقال کالا بین انبارها
            </h2>

            <form onSubmit={handleSaveTransfer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-rose-600 dark:text-rose-400 block mb-1">انبار مبدأ (خروج کالا):</label>
                  <select
                    value={transferForm.sourceWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, sourceWarehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-semibold"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">انبار مقصد (ورود کالا):</label>
                  <select
                    value={transferForm.destinationWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, destinationWarehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-semibold"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs font-bold block mb-2">اقلام انتقالی:</span>
                <div className="space-y-2">
                  {transferForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const newItems = [...transferForm.items];
                          newItems[idx].productId = e.target.value;
                          setTransferForm({ ...transferForm, items: newItems });
                        }}
                        className="flex-1 text-xs bg-transparent"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (کل موجودی: {toPersianDigits(p.currentStock)} {p.baseUnitName})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const newItems = [...transferForm.items];
                          newItems[idx].quantity = Number(e.target.value);
                          setTransferForm({ ...transferForm, items: newItems });
                        }}
                        className="w-24 px-2 py-1 text-xs border rounded"
                        placeholder="مقدار انتقال"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">متصدی حمل / راننده:</label>
                  <input
                    type="text"
                    value={transferForm.driverOrTransporter}
                    onChange={(e) => setTransferForm({ ...transferForm, driverOrTransporter: e.target.value })}
                    placeholder="خانم احمدی / پیک فروشگاه"
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">علت جابه‌جایی:</label>
                  <input
                    type="text"
                    value={transferForm.reason}
                    onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium"
                >
                  ثبت قطعی حواله انتقال بین انبارها
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ثبت دوره انبارگردانی */}
      {/* ========================================================================= */}
      {isStocktakingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3 border-b pb-3 border-slate-100 dark:border-slate-700">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              فرم ثبت و شمارش فیزیکی انبارگردانی
            </h2>

            <form onSubmit={handleSaveStocktaking} className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">انبار مورد شمارش:</label>
                  <select
                    value={stocktakingForm.warehouseId}
                    onChange={(e) => setStocktakingForm({ ...stocktakingForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">عنوان دوره انبارگردانی:</label>
                  <input
                    type="text"
                    value={stocktakingForm.title}
                    onChange={(e) => setStocktakingForm({ ...stocktakingForm, title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">نوبت شمارش:</label>
                  <select
                    value={stocktakingForm.countRound}
                    onChange={(e) => setStocktakingForm({ ...stocktakingForm, countRound: Number(e.target.value) as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                  >
                    <option value={1}>نوبت اول (شمارش اولیه)</option>
                    <option value={2}>نوبت دوم (بازشماری مغایرت‌ها)</option>
                    <option value={3}>نوبت سوم (شمارش نهایی ممیزی)</option>
                  </select>
                </div>
              </div>

              {/* Items Count Entry Table */}
              <div className="flex-1 overflow-y-auto border rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                    <tr className="border-b">
                      <th className="py-2.5 px-3">نام کالا</th>
                      <th className="py-2.5 px-3">موجودی سیستم</th>
                      <th className="py-2.5 px-3 bg-purple-50/60 dark:bg-purple-950/40">شمارش عینی (فیزیکی)</th>
                      <th className="py-2.5 px-3">مغایرت محاسبه‌شده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {stocktakingForm.items.map((it, idx) => {
                      const prd = products.find((p) => p.id === it.productId);
                      const variance = it.countedQuantity - it.systemQuantity;
                      return (
                        <tr key={it.productId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-2 px-3 font-medium">
                            {prd?.name} ({prd?.code})
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {toPersianDigits(it.systemQuantity)} {prd?.baseUnitName}
                          </td>
                          <td className="py-2 px-3 bg-purple-50/60 dark:bg-purple-950/40">
                            <input
                              type="number"
                              value={it.countedQuantity}
                              onChange={(e) => {
                                const newItems = [...stocktakingForm.items];
                                newItems[idx].countedQuantity = Number(e.target.value);
                                setStocktakingForm({ ...stocktakingForm, items: newItems });
                              }}
                              className="w-28 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">
                            <span
                              className={
                                variance > 0
                                  ? 'text-emerald-600'
                                  : variance < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                              }
                            >
                              {variance > 0 ? `+${toPersianDigits(variance)} فزونی` : variance < 0 ? `${toPersianDigits(variance)} کسری` : 'منطبق (۰)'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-xs text-slate-500">
                  پس از ثبت، مغایرت‌ها محاسبه شده و برگه آماده تایید نهایی و صدور سند تعدیل می‌گردد.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsStocktakingModalOpen(false)}
                    className="px-4 py-2 border rounded-lg text-xs"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium"
                  >
                    ذخیره برگه انبارگردانی
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ثبت برگه تعدیل با دلیل الزامی */}
      {/* ========================================================================= */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-700">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              ثبت برگه تعدیل موجودی کالا (با ثبت دلیل مستند)
            </h2>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">انبار مربوطه:</label>
                  <select
                    value={adjustmentForm.warehouseId}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">نوع تعدیل موجودی:</label>
                  <select
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-bold"
                  >
                    <option value="minus">کسری انبار (کاهش موجودی)</option>
                    <option value="plus">فزونی انبار (افزایش موجودی)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1 text-amber-700 dark:text-amber-300">
                    علت اصلی تعدیل (دسته‌بندی الزامی):
                  </label>
                  <select
                    value={adjustmentForm.reasonCode}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reasonCode: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-semibold"
                    required
                  >
                    <option value="damage">خرابی، پارگی و ضایعات فیزیکی</option>
                    <option value="expiration">افت کیفیت، کهنگی و پوسیدگی</option>
                    <option value="counting_error">خطای شمارش و اشتباه ثبت حواله قبلی</option>
                    <option value="theft_loss">مفقودی یا سرقت در فروشگاه</option>
                    <option value="sample">نمونه‌برداری و ارائه کاتالوگ به مزون‌ها</option>
                    <option value="stocktaking_variance">مغایرت رسمی صورت‌جلسه انبارگردانی</option>
                    <option value="other">سایر موارد مستند با تایید مدیریت</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1 text-rose-600 dark:text-rose-400">
                    شرح کامل و تفصیلی دلیل تعدیل (الزامی):
                  </label>
                  <textarea
                    rows={2}
                    value={adjustmentForm.reasonDescription}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reasonDescription: e.target.value })}
                    placeholder="مثال: پارگی انتهای طاقه به متراژ ۲ متر حین باز کردن رول یا شکستگی زیپ..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs font-bold block mb-2">کالای مشمول تعدیل و مقدار:</span>
                <div className="space-y-2">
                  {adjustmentForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const newItems = [...adjustmentForm.items];
                          newItems[idx].productId = e.target.value;
                          setAdjustmentForm({ ...adjustmentForm, items: newItems });
                        }}
                        className="flex-1 text-xs bg-transparent"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (موجودی: {toPersianDigits(p.currentStock)} {p.baseUnitName})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const newItems = [...adjustmentForm.items];
                          newItems[idx].quantity = Number(e.target.value);
                          setAdjustmentForm({ ...adjustmentForm, items: newItems });
                        }}
                        className="w-24 px-2 py-1 text-xs border rounded"
                        placeholder="مقدار تعدیل"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium"
                >
                  ثبت قطعی برگه تعدیل در کاردکس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: مشاهده سابقه عملیات (Audit Trail Modal) */}
      {/* ========================================================================= */}
      {viewAuditModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-slate-700">
              <History className="w-5 h-5 text-amber-600" />
              {viewAuditModalData.title}
            </h2>

            <div className="space-y-3 my-4 max-h-72 overflow-y-auto">
              {viewAuditModalData.auditTrail.map((log, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{log.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    توسط: <strong className="text-slate-800 dark:text-white">{log.userName}</strong>
                  </div>
                  {log.notes && (
                    <div className="text-[11px] text-slate-500 mt-1 italic">
                      توضیحات: {log.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setViewAuditModalData(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
