import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Boxes,
  Layers,
  ArrowRightLeft,
  ClipboardList,
  FolderTree,
  Tag,
  AlertTriangle,
  Edit2,
  Trash2,
  Power,
  Eye,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  History,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Truck,
  Sparkles,
} from 'lucide-react';
import {
  Product,
  ProductCategory,
  Brand,
  Unit,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  GoodsReceipt,
  WarehouseTransfer,
  StocktakingSession,
  StocktakingItem,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { StatCardsGrid, StatCardItem } from '../common/StatCardsGrid.tsx';
import { StandardModal } from '../common/StandardModal.tsx';
import { Pagination } from '../common/Pagination.tsx';

type InventoryView = 'products' | 'kardex_stock' | 'categories_brands' | 'warehouse_ops';

export const InventoryHub: React.FC = () => {
  const { formatMoney } = useSettings();
  const { confidential } = useAuth();

  const [activeView, setActiveView] = useState<InventoryView>('products');

  // Core Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for Products
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);

  // Kardex View State
  const [selectedKardexProductId, setSelectedKardexProductId] = useState<string>('');
  const [kardexEntries, setKardexEntries] = useState<KardexEntry[]>([]);
  const [isKardexLoading, setIsKardexLoading] = useState<boolean>(false);

  // Warehouse Operations State
  const [opsSubView, setOpsSubView] = useState<'receipts' | 'transfers' | 'stocktaking'>('receipts');
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [stocktakingSessions, setStocktakingSessions] = useState<StocktakingSession[]>([]);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState<boolean>(false);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // Category & Brand Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatCode, setNewCatCode] = useState<string>('');

  const [isBrandModalOpen, setIsBrandModalOpen] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [newBrandName, setNewBrandName] = useState<string>('');

  // Pagination for products
  const [productPage, setProductPage] = useState<number>(1);
  const [productPageSize, setProductPageSize] = useState<number>(15);

  // Operations Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [receiptForm, setReceiptForm] = useState({
    supplierName: '',
    warehouseId: '',
    productId: '',
    quantity: 1,
    unitPrice: 0,
    notes: '',
  });

  const [isStocktakingModalOpen, setIsStocktakingModalOpen] = useState<boolean>(false);
  const [stocktakingWarehouseId, setStocktakingWarehouseId] = useState<string>('');
  const [stocktakingCounts, setStocktakingCounts] = useState<Record<string, number>>({});

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prds, cats, brnds, unts, whs, stocks] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getBrands(),
        api.getUnits(),
        api.getWarehouses(),
        api.getWarehouseStocks(),
      ]);
      setProducts(prds);
      setCategories(cats);
      setBrands(brnds);
      setUnits(unts);
      setWarehouses(whs);
      setWarehouseStocks(stocks);

      if (prds.length > 0 && !selectedKardexProductId) {
        setSelectedKardexProductId(prds[0].id);
      }
      if (whs.length > 0 && !receiptForm.warehouseId) {
        setReceiptForm((prev) => ({ ...prev, warehouseId: whs[0].id }));
        setStocktakingWarehouseId(whs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load Kardex when product changes
  useEffect(() => {
    if (!selectedKardexProductId) return;
    const fetchKardex = async () => {
      try {
        setIsKardexLoading(true);
        const data = await api.getKardex({ productId: selectedKardexProductId });
        setKardexEntries(data);
      } catch (err: any) {
        console.error('Failed to load kardex:', err);
      } finally {
        setIsKardexLoading(false);
      }
    };
    fetchKardex();
  }, [selectedKardexProductId]);

  // Load Operations data when tab opened
  useEffect(() => {
    if (activeView === 'warehouse_ops') {
      Promise.all([
        api.getGoodsReceipts().catch(() => []),
        api.getWarehouseTransfers().catch(() => []),
        api.getStocktakingSessions().catch(() => []),
      ]).then(([rcpts, trfs, stks]) => {
        setGoodsReceipts(rcpts);
        setTransfers(trfs);
        setStocktakingSessions(stks);
      });
    }
  }, [activeView]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (showLowStockOnly && p.currentStock > p.minStockAlert) return false;
      if (selectedCategoryFilter !== 'all' && p.categoryId !== selectedCategoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q))
      );
    });
  }, [products, searchTerm, selectedCategoryFilter, showLowStockOnly]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * productPageSize;
    return filteredProducts.slice(start, start + productPageSize);
  }, [filteredProducts, productPage, productPageSize]);

  useEffect(() => {
    setProductPage(1);
  }, [searchTerm, selectedCategoryFilter, showLowStockOnly]);

  // Summary Metrics
  const stats = useMemo(() => {
    let totalStockValue = 0;
    let lowStockCount = 0;
    products.forEach((p) => {
      totalStockValue += (p.currentStock || 0) * (p.purchasePrice || 0);
      if (p.currentStock <= p.minStockAlert) lowStockCount++;
    });

    return {
      totalProducts: products.length,
      totalStockValue,
      lowStockCount,
      warehousesCount: warehouses.length,
    };
  }, [products, warehouses]);

  const statCards: StatCardItem[] = [
    {
      title: 'کل عناوین کالا',
      value: `${toPersianDigits(stats.totalProducts)} قلم`,
      subtitle: <span>اقلام تعریف‌شده در انبار</span>,
      icon: Package,
      color: 'indigo',
    },
    {
      title: 'ارزش ریالی موجودی انبار',
      value: formatMoney(stats.totalStockValue),
      subtitle: <span>بر اساس بهای خرید پایه</span>,
      icon: Boxes,
      color: 'emerald',
    },
    {
      title: 'کالاهای دارای کسری و هشدار',
      value: `${toPersianDigits(stats.lowStockCount)} کالا`,
      subtitle: <span className="text-amber-600 font-bold">زیر نقطه سفارش</span>,
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'amber' : 'slate',
    },
    {
      title: 'تعداد انبارهای فعال',
      value: `${toPersianDigits(stats.warehousesCount)} مرکز`,
      subtitle: <span>انبار فروشگاه و انبار مرکزی</span>,
      icon: Truck,
      color: 'slate',
    },
  ];

  const pillItems: SectionPillItem<InventoryView>[] = [
    {
      id: 'products',
      label: 'فهرست کالاها و قیمت‌گذاری',
      icon: Package,
      badge: toPersianDigits(products.length),
    },
    {
      id: 'kardex_stock',
      label: 'موجودی و کاردکس لحظه‌ای',
      icon: History,
    },
    {
      id: 'categories_brands',
      label: 'گروه‌بندی کالاها، برندها و واحدها',
      icon: FolderTree,
      badge: toPersianDigits(categories.length),
    },
    {
      id: 'warehouse_ops',
      label: 'ورود، خروج و انبارگردانی',
      icon: Boxes,
    },
  ];

  // Actions
  const handleOpenNewProduct = () => {
    const nextCode = `KH-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingProduct({
      code: nextCode,
      barcode: nextCode,
      name: '',
      categoryId: categories[0]?.id || '',
      baseUnitId: units[0]?.id || '',
      purchasePrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      currentStock: 0,
      minStockAlert: 10,
      isActive: true,
      notes: '',
    });
    setShowAdvancedSpecs(false);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod });
    setShowAdvancedSpecs(Boolean(prod.color || prod.size || prod.material || prod.brand || prod.model));
    setIsProductModalOpen(true);
  };

  const handleToggleActive = async (prod: Product) => {
    try {
      const updated = await api.toggleProductActive(prod.id);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setToastMessage(`وضعیت کالا به «${updated.isActive ? 'فعال' : 'غیرفعال'}» تغییر یافت.`);
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!window.confirm(`آیا از حذف کالای «${prod.name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteProduct(prod.id);
      setProducts((prev) => prev.filter((p) => p.id !== prod.id));
      setToastMessage(`کالای «${prod.name}» با موفقیت حذف شد.`);
    } catch (err: any) {
      alert(`حذف کالا امکان‌پذیر نیست: ${err.message} (می‌توانید کالا را غیرفعال کنید)`);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name?.trim() || !editingProduct?.code?.trim() || !editingProduct?.baseUnitId) {
      alert('لطفاً نام، کد کالا و واحد پایه را وارد نمایید.');
      return;
    }

    try {
      setIsSavingProduct(true);
      const saved = await api.saveProduct({
        ...editingProduct,
        barcode: editingProduct.barcode || editingProduct.code,
      });

      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx !== -1) {
          const list = [...prev];
          list[idx] = saved;
          return list;
        }
        return [saved, ...prev];
      });

      setIsProductModalOpen(false);
      setEditingProduct(null);
      setToastMessage(`کالای «${saved.name}» با موفقیت ذخیره شد.`);
    } catch (err: any) {
      alert(`خطا در ذخیره کالا: ${err.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const saved = await api.saveCategory({
        id: editingCategory?.id,
        name: newCatName.trim(),
        code: newCatCode.trim() || (editingCategory ? editingCategory.code : `CAT-${categories.length + 1}`),
      });
      if (editingCategory) {
        setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setToastMessage(`گروه کالا «${saved.name}» با موفقیت ویرایش شد.`);
      } else {
        setCategories((prev) => [...prev, saved]);
        setToastMessage(`گروه‌بندی جدید «${saved.name}» با موفقیت اضافه شد.`);
      }
      setNewCatName('');
      setNewCatCode('');
      setEditingCategory(null);
      setIsCatModalOpen(false);
    } catch (err: any) {
      alert(`خطا در ذخیره گروه: ${err.message}`);
    }
  };

  const handleSaveBrand = async () => {
    if (!newBrandName.trim()) return;
    try {
      const saved = await api.saveBrand({
        id: editingBrand?.id,
        name: newBrandName.trim(),
      });
      if (editingBrand) {
        setBrands((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
        setToastMessage(`برند «${saved.name}» با موفقیت ویرایش شد.`);
      } else {
        setBrands((prev) => [...prev, saved]);
        setToastMessage(`برند جدید «${saved.name}» با موفقیت اضافه شد.`);
      }
      setNewBrandName('');
      setEditingBrand(null);
      setIsBrandModalOpen(false);
    } catch (err: any) {
      alert(`خطا در ذخیره برند: ${err.message}`);
    }
  };

  // Submit Goods Receipt
  const handleSaveGoodsReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.productId || receiptForm.quantity <= 0) {
      alert('لطفاً کالا و مقدار ورودی را مشخص کنید.');
      return;
    }

    try {
      const targetProd = products.find((p) => p.id === receiptForm.productId);
      const wh = warehouses.find((w) => w.id === receiptForm.warehouseId);

      await api.saveGoodsReceipt({
        receiptNumber: `REC-${Date.now().toString().slice(-5)}`,
        warehouseId: receiptForm.warehouseId || warehouses[0]?.id || 'wh-shop',
        warehouseName: wh?.name || 'انبار فروشگاه',
        supplierId: 'sup-direct',
        supplierName: receiptForm.supplierName || 'تأمین‌کننده مستقیم',
        date: getCurrentJalaliDate(),
        items: [
          {
            id: `item-${Date.now()}`,
            productId: receiptForm.productId,
            productCode: targetProd?.code || '',
            productName: targetProd?.name || 'کالا',
            unitId: targetProd?.baseUnitId || '',
            unitName: targetProd?.baseUnitName || 'عدد',
            quantity: receiptForm.quantity,
            conversionFactor: 1,
            baseQuantity: receiptForm.quantity,
            unitPrice: receiptForm.unitPrice || targetProd?.purchasePrice || 0,
            totalPrice: (receiptForm.unitPrice || targetProd?.purchasePrice || 0) * receiptForm.quantity,
          },
        ],
        totalQuantity: receiptForm.quantity,
        totalAmount: (receiptForm.unitPrice || targetProd?.purchasePrice || 0) * receiptForm.quantity,
        notes: receiptForm.notes,
        status: 'approved',
      });

      await loadData();
      setIsReceiptModalOpen(false);
      setToastMessage('رسید ورود به انبار با موفقیت ثبت شد و موجودی افزایش یافت.');
    } catch (err: any) {
      alert(`خطا در ثبت رسید ورود: ${err.message}`);
    }
  };

  // Submit Stocktaking
  const handleSaveStocktaking = async () => {
    try {
      const itemsToAdjust: StocktakingItem[] = Object.entries(stocktakingCounts).map(([prodId, countedQty]) => {
        const prod = products.find((p) => p.id === prodId);
        const currentQty = prod?.currentStock || 0;
        const diff = countedQty - currentQty;
        return {
          id: `stk-item-${prodId}`,
          productId: prodId,
          productCode: prod?.code || '',
          productName: prod?.name || '',
          unitName: prod?.baseUnitName || 'عدد',
          systemQuantity: currentQty,
          countedQuantity: countedQty,
          varianceQuantity: diff,
          unitCost: prod?.purchasePrice || 0,
          varianceValue: diff * (prod?.purchasePrice || 0),
          varianceStatus: diff === 0 ? 'matched' : diff > 0 ? 'surplus' : 'deficit',
          notes: 'انبارگردانی فیزیکی',
        };
      });

      if (itemsToAdjust.length === 0) {
        alert('لطفاً حداقل برای یک کالا مقدار شمارش‌شده را وارد کنید.');
        return;
      }

      const wh = warehouses.find((w) => w.id === stocktakingWarehouseId);

      await api.saveStocktakingSession({
        code: `STK-${Date.now().toString().slice(-5)}`,
        title: 'انبارگردانی تطبیق موجودی فیزیکی',
        warehouseId: stocktakingWarehouseId,
        warehouseName: wh?.name || 'انبار فروشگاه',
        countRound: 1,
        date: getCurrentJalaliDate(),
        items: itemsToAdjust,
        totalItemsCount: itemsToAdjust.length,
        totalDeficitValue: itemsToAdjust.filter((i) => i.varianceQuantity < 0).reduce((acc, i) => acc + Math.abs(i.varianceValue), 0),
        totalSurplusValue: itemsToAdjust.filter((i) => i.varianceQuantity > 0).reduce((acc, i) => acc + i.varianceValue, 0),
        netVarianceValue: itemsToAdjust.reduce((acc, i) => acc + i.varianceValue, 0),
        status: 'approved',
        notes: 'انبارگردانی و تطبیق موجودی فیزیکی',
        auditTrail: [],
      });

      await loadData();
      setIsStocktakingModalOpen(false);
      setStocktakingCounts({});
      setToastMessage('انبارگردانی با موفقیت ثبت شد و مغایرت‌ها در کاردکس اعمال گردید.');
    } catch (err: any) {
      alert(`خطا در ثبت انبارگردانی: ${err.message}`);
    }
  };

  const selectedKardexProduct = products.find((p) => p.id === selectedKardexProductId);

  return (
    <div className="space-y-5">
      {/* 1. Header with Primary Action Button */}
      <PageHeader
        title="مرکز مدیریت کالا، انبار و کاردکس"
        subtitle="تعریف و قیمت‌گذاری کالا، گروه‌بندی، کنترل کاردکس و موجودی، ورود و خروج و انبارگردانی"
        icon={Package}
        primaryAction={{
          label: 'تعریف کالای جدید',
          icon: Plus,
          onClick: handleOpenNewProduct,
          color: 'indigo',
        }}
        secondaryActions={[
          {
            label: 'رسید ورود کالا',
            icon: Plus,
            onClick: () => setIsReceiptModalOpen(true),
            color: 'emerald',
          },
          {
            label: 'انبارگردانی',
            icon: ClipboardList,
            onClick: () => setIsStocktakingModalOpen(true),
            color: 'amber',
          },
        ]}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid cards={statCards} columns={4} />

      {/* 3. Segmented View Switcher */}
      <SectionPills items={pillItems} activeId={activeView} onChange={setActiveView} />

      {/* VIEW 1: PRODUCTS LIST & PRICING */}
      {activeView === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجوی نام کالا، کد، رنگ، سایز یا برند..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه دسته‌بندی‌های کالا...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowLowStockOnly((prev) => !prev)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                    showLowStockOnly
                      ? 'bg-amber-500 text-white border-transparent shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>فقط موجودی کم ({toPersianDigits(stats.lowStockCount)})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                فهرست کالاها ({toPersianDigits(filteredProducts.length)} مورد)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold">کد کالا</th>
                    <th className="py-2.5 px-3 font-bold">نام و مشخصات کالا</th>
                    <th className="py-2.5 px-3 font-bold">دسته‌بندی</th>
                    <th className="py-2.5 px-3 font-bold text-center">موجودی فعلی</th>
                    <th className="py-2.5 px-3 font-bold text-center">واحد پایه</th>
                    {confidential.canViewPurchasePrice && (
                      <th className="py-2.5 px-3 font-bold text-left">قیمت خرید</th>
                    )}
                    <th className="py-2.5 px-3 font-bold text-left">قیمت تک‌فروشی</th>
                    <th className="py-2.5 px-3 font-bold text-left">قیمت عمده</th>
                    <th className="py-2.5 px-3 font-bold text-center w-28">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        کالایی با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p, idx) => {
                      const isLowStock = p.currentStock <= p.minStockAlert;
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                            !p.isActive ? 'opacity-50 bg-slate-50/50 dark:bg-slate-900/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {toPersianDigits((productPage - 1) * productPageSize + idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {toPersianDigits(p.code)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.color && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                  {p.color}
                                </span>
                              )}
                              {p.size && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                                  {p.size}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {p.categoryName || 'عمومی'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                isLowStock
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {toPersianDigits(p.currentStock)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                            {p.baseUnitName || 'عدد'}
                          </td>
                          {confidential.canViewPurchasePrice && (
                            <td className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                              {formatMoney(p.purchasePrice)}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-left font-black text-emerald-600 dark:text-emerald-400">
                            {formatMoney(p.retailPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-bold text-indigo-600 dark:text-indigo-400">
                            {formatMoney(p.wholesalePrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditProduct(p)}
                                title="ویرایش کالا"
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedKardexProductId(p.id);
                                  setActiveView('kardex_stock');
                                }}
                                title="مشاهده کاردکس"
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleActive(p)}
                                title={p.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                className={`p-1.5 rounded-lg cursor-pointer transition ${
                                  p.isActive
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p)}
                                title="حذف کالا"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <Pagination
                currentPage={productPage}
                totalItems={filteredProducts.length}
                pageSize={productPageSize}
                onPageChange={setProductPage}
                onPageSizeChange={setProductPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KARDEX & RUNNING STOCK */}
      {activeView === 'kardex_stock' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                انتخاب کالا جهت مشاهده گردش کاردکس:
              </label>
              <select
                value={selectedKardexProductId}
                onChange={(e) => setSelectedKardexProductId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) - موجودی: {toPersianDigits(p.currentStock)} {p.baseUnitName}
                  </option>
                ))}
              </select>
            </div>

            {selectedKardexProduct && (
              <div className="flex items-center gap-4 text-xs font-bold p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">موجودی لحظه‌ای:</span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                    {toPersianDigits(selectedKardexProduct.currentStock)} {selectedKardexProduct.baseUnitName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">نقطه سفارش:</span>
                  <span>{toPersianDigits(selectedKardexProduct.minStockAlert)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Kardex Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                جدول گردش کاردکس کالا ({toPersianDigits(kardexEntries.length)} رویداد)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold text-center">تاریخ</th>
                    <th className="py-2.5 px-3 font-bold">نوع رویداد</th>
                    <th className="py-2.5 px-3 font-bold">شماره سند / مرجع</th>
                    <th className="py-2.5 px-3 font-bold text-center text-emerald-600">وارده (ورود)</th>
                    <th className="py-2.5 px-3 font-bold text-center text-rose-600">صادره (خروج)</th>
                    <th className="py-2.5 px-3 font-bold text-center font-black">مانده لحظه‌ای</th>
                    <th className="py-2.5 px-3 font-bold text-left">فی واحد</th>
                    <th className="py-2.5 px-3 font-bold text-left">ارزش مانده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isKardexLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        در حال بارگذاری کاردکس کالا...
                      </td>
                    </tr>
                  ) : kardexEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        هیچ رویداد ورود و خروجی برای این کالا ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    kardexEntries.map((k, idx) => (
                      <tr key={k.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                          {toPersianDigits(k.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                          {k.referenceTypeTitle || 'گردش کالا'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-600">
                          {toPersianDigits(k.referenceNumber || '-')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-600">
                          {k.inQuantity > 0 ? `+${toPersianDigits(k.inQuantity)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-rose-600">
                          {k.outQuantity > 0 ? `-${toPersianDigits(k.outQuantity)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black font-mono bg-slate-50 dark:bg-slate-800/50">
                          {toPersianDigits(k.balanceQuantity)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-bold">{formatMoney(k.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                          {formatMoney(k.balanceValue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: CATEGORIES, BRANDS & UNITS */}
      {activeView === 'categories_brands' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Categories Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs text-slate-800 dark:text-white">
                  دسته‌بندی‌های کالا ({toPersianDigits(categories.length)})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setNewCatName('');
                  setNewCatCode(`CAT-${categories.length + 1}`);
                  setIsCatModalOpen(true);
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
              >
                + گروه جدید
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100">{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({c.code})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(c);
                      setNewCatName(c.name);
                      setNewCatCode(c.code);
                      setIsCatModalOpen(true);
                    }}
                    title="ویرایش گروه کالا"
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Brands Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-slate-800 dark:text-white">
                  برندها و تولیدکنندگان ({toPersianDigits(brands.length)})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingBrand(null);
                  setNewBrandName('');
                  setIsBrandModalOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
              >
                + برند جدید
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-100">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBrand(b);
                      setNewBrandName(b.name);
                      setIsBrandModalOpen(true);
                    }}
                    title="ویرایش برند"
                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Units Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-xs text-slate-800 dark:text-white">
                  واحدهای سنجش و ضرایب ({toPersianDigits(units.length)})
                </h3>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {units.map((u) => (
                <div
                  key={u.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-100">{u.name}</span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {u.isDecimalAllowed ? 'اعشاری مجاز' : 'صحیح'} | ضریب: {toPersianDigits(u.conversionFactor || 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: WAREHOUSE OPERATIONS & STOCKTAKING */}
      {activeView === 'warehouse_ops' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setOpsSubView('receipts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                opsSubView === 'receipts'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              رسیدهای ورود کالا ({toPersianDigits(goodsReceipts.length)})
            </button>
            <button
              type="button"
              onClick={() => setOpsSubView('transfers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                opsSubView === 'transfers'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              انتقال بین انبارها ({toPersianDigits(transfers.length)})
            </button>
            <button
              type="button"
              onClick={() => setOpsSubView('stocktaking')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                opsSubView === 'stocktaking'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              جلسات انبارگردانی ({toPersianDigits(stocktakingSessions.length)})
            </button>
          </div>

          {opsSubView === 'receipts' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 font-bold">شماره رسید</th>
                    <th className="p-2.5 font-bold">تأمین‌کننده</th>
                    <th className="p-2.5 font-bold text-center">تاریخ</th>
                    <th className="p-2.5 font-bold">انبار مقصد</th>
                    <th className="p-2.5 font-bold text-center">تعداد اقلام</th>
                    <th className="p-2.5 font-bold text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {goodsReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        هنوز رسید ورود کالایی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    goodsReceipts.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600">
                          {toPersianDigits(r.receiptNumber)}
                        </td>
                        <td className="p-2.5 font-bold">{r.supplierName}</td>
                        <td className="p-2.5 text-center font-mono">{toPersianDigits(r.date)}</td>
                        <td className="p-2.5">{r.warehouseName}</td>
                        <td className="p-2.5 text-center font-bold font-mono">
                          {toPersianDigits(r.items.length)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                            تأییدشده
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {opsSubView === 'transfers' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 font-bold">شماره حواله</th>
                    <th className="p-2.5 font-bold">انبار مبدأ</th>
                    <th className="p-2.5 font-bold">انبار مقصد</th>
                    <th className="p-2.5 font-bold text-center">تاریخ</th>
                    <th className="p-2.5 font-bold text-center">تعداد اقلام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        هیچ حواله انتقالی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600">
                          {toPersianDigits(t.transferNumber)}
                        </td>
                        <td className="p-2.5">{t.sourceWarehouseName}</td>
                        <td className="p-2.5">{t.destinationWarehouseName}</td>
                        <td className="p-2.5 text-center font-mono">{toPersianDigits(t.date)}</td>
                        <td className="p-2.5 text-center font-bold font-mono">
                          {toPersianDigits(t.items.length)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {opsSubView === 'stocktaking' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 font-bold">شماره صورتجلسه</th>
                    <th className="p-2.5 font-bold">انبار</th>
                    <th className="p-2.5 font-bold text-center">تاریخ</th>
                    <th className="p-2.5 font-bold text-center">تعداد اقلام شمارش‌شده</th>
                    <th className="p-2.5 font-bold text-center">وضعیت اعمال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stocktakingSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        هیچ جلسه انبارگردانی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    stocktakingSessions.map((s, idx) => (
                      <tr key={s.id || idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600">
                          {toPersianDigits(s.code)}
                        </td>
                        <td className="p-2.5">انبار فروشگاه</td>
                        <td className="p-2.5 text-center font-mono">{toPersianDigits(s.date)}</td>
                        <td className="p-2.5 text-center font-bold font-mono">
                          {toPersianDigits(s.items.length)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                            اعمال شده
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product Definition & Edit Modal (Matching Section 5 Standard Form pattern) */}
      {isProductModalOpen && editingProduct && (
        <StandardModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          title={editingProduct.id ? `ویرایش کالای «${editingProduct.name}»` : 'تعریف کالای جدید'}
          subtitle="اطلاعات اصلی کالا را وارد کنید؛ مشخصات تکمیلی در بخش جمع‌شونده قرار دارد."
          icon={Package}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSavingProduct}
                onClick={handleSaveProduct}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSavingProduct ? 'در حال ذخیره...' : 'ذخیره کالا'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveProduct} className="space-y-4">
            {/* Essential Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نام کامل کالا *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="مثلاً: روبان ساتن ۲۵ میل نگین"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  کد کالا *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.code || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  دسته‌بندی کالا *
                </label>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={(e) => {
                    const cat = categories.find((c) => c.id === e.target.value);
                    setEditingProduct({
                      ...editingProduct,
                      categoryId: e.target.value,
                      categoryName: cat?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  واحد پایه سنجش *
                </label>
                <select
                  value={editingProduct.baseUnitId || ''}
                  onChange={(e) => {
                    const u = units.find((item) => item.id === e.target.value);
                    setEditingProduct({
                      ...editingProduct,
                      baseUnitId: e.target.value,
                      baseUnitName: u?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} (ضریب پایه: {toPersianDigits(u.conversionFactor || 1)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  قیمت خرید پایه (ریال)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingProduct.purchasePrice || 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, purchasePrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  قیمت تک‌فروشی مصرف‌کننده (ریال) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingProduct.retailPrice || 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, retailPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  قیمت عمده‌فروشی (ریال)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingProduct.wholesalePrice || 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, wholesalePrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  حداقل موجودی هشدار (نقطه سفارش)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingProduct.minStockAlert || 10}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, minStockAlert: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                />
              </div>
            </div>

            {/* Collapsible Supplementary Fields (Section 5) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => setShowAdvancedSpecs((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <span>اطلاعات تکمیلی و مشخصات فیزیکی (رنگ، سایز، برند، بارکد)</span>
                {showAdvancedSpecs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvancedSpecs && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">رنگ کالا</label>
                    <input
                      type="text"
                      value={editingProduct.color || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })}
                      placeholder="سرمه‌ای، زرشکی، سفید..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">سایز / اندازه</label>
                    <input
                      type="text"
                      value={editingProduct.size || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, size: e.target.value })}
                      placeholder="۲۵ میل، سایز ۱۸..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">جنس / متریال</label>
                    <input
                      type="text"
                      value={editingProduct.material || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, material: e.target.value })}
                      placeholder="پلی‌استر، ساتن، نخ..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">برند کالا</label>
                    <input
                      type="text"
                      value={editingProduct.brand || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                      placeholder="نگین، اویا، زرین..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">بارکد کالا</label>
                    <input
                      type="text"
                      value={editingProduct.barcode || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">توضیحات</label>
                    <input
                      type="text"
                      value={editingProduct.notes || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, notes: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </StandardModal>
      )}

      {/* Category Modal */}
      {isCatModalOpen && (
        <StandardModal
          isOpen={isCatModalOpen}
          onClose={() => setIsCatModalOpen(false)}
          title={editingCategory ? 'ویرایش گروه کالا' : 'تعریف دسته‌بندی جدید کالا'}
          icon={FolderTree}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                {editingCategory ? 'ذخیره تغییرات' : 'ثبت گروه'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold mb-1">نام دسته‌بندی *</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="مثلاً: کالاهای مصرفی، ابزارآلات..."
                className="w-full p-2 border rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">کد دسته‌بندی</label>
              <input
                type="text"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value)}
                placeholder="CAT-05"
                className="w-full p-2 border rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* Brand Modal */}
      {isBrandModalOpen && (
        <StandardModal
          isOpen={isBrandModalOpen}
          onClose={() => setIsBrandModalOpen(false)}
          title={editingBrand ? 'ویرایش برند' : 'تعریف برند جدید'}
          icon={Tag}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsBrandModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveBrand}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                {editingBrand ? 'ذخیره تغییرات' : 'ثبت برند'}
              </button>
            </div>
          }
        >
          <div>
            <label className="block text-[11px] font-bold mb-1">نام برند یا تولیدکننده *</label>
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="مثلاً: سپهر، سامسونگ..."
              className="w-full p-2 border rounded-xl text-xs"
            />
          </div>
        </StandardModal>
      )}

      {/* New Goods Receipt Modal */}
      {isReceiptModalOpen && (
        <StandardModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          title="ثبت رسید ورود کالا به انبار"
          subtitle="ثبت بار خریداری‌شده یا امانی و افزایش مستقیم موجودی کالا در انبار"
          icon={Truck}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveGoodsReceipt}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                ثبت رسید ورود
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نام تأمین‌کننده / فروشنده
                </label>
                <input
                  type="text"
                  value={receiptForm.supplierName}
                  onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })}
                  placeholder="مثلاً: شرکت بازرگانی سپهر"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  انبار مقصد *
                </label>
                <select
                  value={receiptForm.warehouseId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
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
                  انتخاب کالای وارده *
                </label>
                <select
                  value={receiptForm.productId}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setReceiptForm({
                      ...receiptForm,
                      productId: e.target.value,
                      unitPrice: prod?.purchasePrice || 0,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="">انتخاب کالا...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  مقدار وارده *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={receiptForm.quantity}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  قیمت خرید هر واحد (ریال)
                </label>
                <input
                  type="number"
                  min="0"
                  value={receiptForm.unitPrice}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, unitPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  توضیحات بارنامه یا رسید
                </label>
                <input
                  type="text"
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  placeholder="شماره بارنامه، راننده..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Stocktaking Modal */}
      {isStocktakingModalOpen && (
        <StandardModal
          isOpen={isStocktakingModalOpen}
          onClose={() => setIsStocktakingModalOpen(false)}
          title="ثبت جلسه انبارگردانی و تطبیق موجودی"
          subtitle="شمارش عینی اقلام انبار و ثبت خودکار سند مغایرت کسری یا فزونی"
          icon={ClipboardList}
          maxWidth="3xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsStocktakingModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveStocktaking}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                ثبت و اعمال انبارگردانی
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xs">انبار مورد شمارش:</span>
              <select
                value={stocktakingWarehouseId}
                onChange={(e) => setStocktakingWarehouseId(e.target.value)}
                className="px-3 py-1.5 border rounded-xl text-xs font-bold"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="p-2.5">نام کالا</th>
                    <th className="p-2.5 text-center">موجودی در سیستم</th>
                    <th className="p-2.5 text-center w-36">مقدار شمارش‌شده فیزیکی</th>
                    <th className="p-2.5 text-center">مغایرت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.map((p) => {
                    const counted = stocktakingCounts[p.id] ?? p.currentStock;
                    const diff = counted - p.currentStock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold">
                          {p.name} ({p.code})
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {toPersianDigits(p.currentStock)} {p.baseUnitName}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            step="any"
                            value={counted}
                            onChange={(e) =>
                              setStocktakingCounts({
                                ...stocktakingCounts,
                                [p.id]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-24 p-1 text-center font-bold border rounded-lg bg-slate-50 dark:bg-slate-800"
                          />
                        </td>
                        <td className="p-2.5 text-center font-bold font-mono">
                          {diff > 0 ? (
                            <span className="text-emerald-600">+{toPersianDigits(diff)} (فزونی)</span>
                          ) : diff < 0 ? (
                            <span className="text-rose-600">{toPersianDigits(diff)} (کسری)</span>
                          ) : (
                            <span className="text-slate-400">تطبیق</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </StandardModal>
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
