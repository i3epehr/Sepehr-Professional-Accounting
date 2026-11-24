import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  Power,
  ShieldAlert,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { Product, ProductCategory, Unit, Brand } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { toPersianDigits, formatQuantity } from '../../lib/formatters.ts';

interface ProductsModuleProps {
  initialOpenCreate?: boolean;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({ initialOpenCreate = false }) => {
  const { formatMoney } = useSettings();
  const { confidential } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(initialOpenCreate);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Financial delete protection modal
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<{
    product: Product;
    reason: string;
  } | null>(null);

  const [formTab, setFormTab] = useState<'general' | 'specs' | 'pricing' | 'units'>('general');

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [prds, cats, brnds, unts] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getBrands(),
        api.getUnits(),
      ]);
      setProducts(prds);
      setCategories(cats);
      setBrands(brnds);
      setUnits(unts);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در بارگذاری اطلاعات کالاها');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    const nextCode = `KH-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingProduct({
      code: nextCode,
      barcode: nextCode,
      name: '',
      categoryId: categories[0]?.id || '',
      baseUnitId: units.find((u) => u.name === 'متر')?.id || units[0]?.id || '',
      color: '',
      size: '',
      material: '',
      brand: brands[0]?.name || '',
      model: '',
      customSpecs: [],
      purchasePrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      colleaguePrice: 0,
      minAllowedPrice: 0,
      currentStock: 0,
      minStockAlert: 10,
      allowDecimal: false,
      unitConversions: [],
      isActive: true,
      notes: '',
    });
    setFormTab('general');
    setIsModalOpen(true);
  };

  const handleEdit = (prod: Product) => {
    setEditingProduct({
      ...prod,
      customSpecs: prod.customSpecs ? [...prod.customSpecs] : [],
      unitConversions: prod.unitConversions ? [...prod.unitConversions] : [],
    });
    setFormTab('general');
    setIsModalOpen(true);
  };

  const handleToggleActive = async (prod: Product) => {
    try {
      const updated = await api.toggleProductActive(prod.id);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      setErrorMsg(`خطا در تغییر وضعیت کالا: ${err.message}`);
    }
  };

  const handleDelete = async (prod: Product) => {
    try {
      await api.deleteProduct(prod.id);
      setProducts((prev) => prev.filter((p) => p.id !== prod.id));
    } catch (err: any) {
      setDeleteBlockedInfo({
        product: prod,
        reason: err.message,
      });
    }
  };

  const handleDeactivateInsteadOfDelete = async () => {
    if (!deleteBlockedInfo) return;
    try {
      const updated = await api.toggleProductActive(deleteBlockedInfo.product.id);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDeleteBlockedInfo(null);
    } catch (err: any) {
      setErrorMsg(`خطا: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name?.trim() || !editingProduct?.code?.trim() || !editingProduct?.baseUnitId) {
      return;
    }

    try {
      setIsSaving(true);
      const saved = await api.saveProduct({
        ...editingProduct,
        barcode: editingProduct.barcode || editingProduct.code,
      });
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      setErrorMsg(`خطا در ذخیره‌سازی کالا: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomSpec = () => {
    if (!editingProduct) return;
    const current = editingProduct.customSpecs || [];
    setEditingProduct({
      ...editingProduct,
      customSpecs: [...current, { key: '', value: '' }],
    });
  };

  const handleUpdateCustomSpec = (index: number, key: string, value: string) => {
    if (!editingProduct || !editingProduct.customSpecs) return;
    const updated = [...editingProduct.customSpecs];
    updated[index] = { key, value };
    setEditingProduct({ ...editingProduct, customSpecs: updated });
  };

  const handleRemoveCustomSpec = (index: number) => {
    if (!editingProduct || !editingProduct.customSpecs) return;
    const updated = editingProduct.customSpecs.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, customSpecs: updated });
  };

  const handleAddUnitConversion = () => {
    if (!editingProduct) return;
    const current = editingProduct.unitConversions || [];
    const availableUnit = units.find((u) => u.id !== editingProduct.baseUnitId) || units[0];
    setEditingProduct({
      ...editingProduct,
      unitConversions: [
        ...current,
        {
          unitId: availableUnit?.id || 'u-roll',
          unitName: availableUnit?.name || 'رول',
          conversionFactor: availableUnit?.conversionFactor || 25,
          price: editingProduct.retailPrice ? editingProduct.retailPrice * (availableUnit?.conversionFactor || 25) : 0,
        },
      ],
    });
  };

  const handleUpdateUnitConversion = (index: number, field: string, val: any) => {
    if (!editingProduct || !editingProduct.unitConversions) return;
    const updated = [...editingProduct.unitConversions];
    if (field === 'unitId') {
      const u = units.find((item) => item.id === val);
      updated[index] = {
        ...updated[index],
        unitId: val,
        unitName: u ? u.name : val,
        conversionFactor: u?.conversionFactor || updated[index].conversionFactor || 1,
      };
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setEditingProduct({ ...editingProduct, unitConversions: updated });
  };

  const handleRemoveUnitConversion = (index: number) => {
    if (!editingProduct || !editingProduct.unitConversions) return;
    const updated = editingProduct.unitConversions.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, unitConversions: updated });
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.color && p.color.toLowerCase().includes(q)) ||
      (p.size && p.size.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;
    const matchesActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' && p.isActive) ||
      (activeFilter === 'inactive' && !p.isActive);
    const matchesLowStock = !showLowStockOnly || p.currentStock <= p.minStockAlert;

    return matchesSearch && matchesCategory && matchesBrand && matchesActive && matchesLowStock;
  });

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              کاتالوگ کالاها و خدمات
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تعریف کالا با واحدهای دوگانه (متر، رول، بسته)، قیمت‌گذاری چندسطحی و کنترل نقطه سفارش
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>تعریف کالای جدید</span>
        </button>
      </div>

      {/* Instant Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجوی فوری نام کالا، کد کالا، رنگ، سایز، برند..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="all">همه برندها</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فقط فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              showLowStockOnly
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>فقط کالاهای کمتر از نقطه سفارش</span>
          </button>

          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-3">
            <span>
              کل کالاها: <strong>{toPersianDigits(products.length)}</strong>
            </span>
            <span>
              نتایج فیلتر: <strong>{toPersianDigits(filteredProducts.length)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Products Data Table (With RBAC Purchase Price Masking & No Barcode Clutter) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3">کد کالا</th>
                <th className="py-3 px-4">نام و مشخصات کالا</th>
                <th className="py-3 px-3">دسته‌بندی / برند</th>
                <th className="py-3 px-3">رنگ و سایز</th>
                <th className="py-3 px-3 text-center">موجودی فعلی</th>
                {confidential.canViewPurchasePrice && (
                  <th className="py-3 px-3 text-left">قیمت خرید</th>
                )}
                <th className="py-3 px-3 text-left">قیمت فروش تک</th>
                <th className="py-3 px-3 text-left">قیمت عمده</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    در حال بارگذاری اطلاعات کالاها...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    کالایی با مشخصات جستجو شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                        !p.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                          {toPersianDigits(p.code)}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100 max-w-[240px]">
                        <div className="truncate" title={p.name}>
                          {p.name}
                        </div>
                        {p.model && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            مدل: {p.model}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <div>{p.categoryName || '—'}</div>
                        {p.brand && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded">
                            {p.brand}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div className="space-y-0.5">
                          {p.color && (
                            <span className="inline-block ml-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                              {p.color}
                            </span>
                          )}
                          {p.size && (
                            <span className="inline-block bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                              {toPersianDigits(p.size)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            isLow
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {formatQuantity(p.currentStock)} {p.baseUnitName}
                        </span>
                      </td>

                      {confidential.canViewPurchasePrice && (
                        <td className="py-2.5 px-3 text-left text-slate-500 dark:text-slate-400 font-bold">
                          {formatMoney(p.purchasePrice)}
                        </td>
                      )}

                      <td className="py-2.5 px-3 text-left font-black text-slate-800 dark:text-slate-100">
                        {formatMoney(p.retailPrice)}
                      </td>

                      <td className="py-2.5 px-3 text-left text-indigo-700 dark:text-indigo-400 font-bold">
                        {formatMoney(p.wholesalePrice)}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer border ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {p.isActive ? 'فعال' : 'غیرفعال'}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingProduct(p)}
                            title="مشاهده جزئیات"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(p)}
                            title="ویرایش"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="حذف"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* View Product Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  مشخصات کالا: {viewingProduct.name}
                </h3>
              </div>
              <button onClick={() => setViewingProduct(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                <div>
                  کد کالا: <strong>{toPersianDigits(viewingProduct.code)}</strong>
                </div>
                <div>
                  دسته‌بندی: <strong>{viewingProduct.categoryName || '—'}</strong>
                </div>
                <div>
                  برند: <strong>{viewingProduct.brand || '—'}</strong>
                </div>
                <div>
                  واحد پایه: <strong>{viewingProduct.baseUnitName}</strong>
                </div>
                <div className="col-span-2">
                  موجودی فعلی:{' '}
                  <strong className="text-indigo-600">
                    {formatQuantity(viewingProduct.currentStock)} {viewingProduct.baseUnitName}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-300">سطوح قیمت‌گذاری:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">قیمت خرید</span>
                    {confidential.canViewPurchasePrice ? (
                      <span className="font-bold">{formatMoney(viewingProduct.purchasePrice)}</span>
                    ) : (
                      <span className="text-slate-400 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> محرمانه
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">فروش تک</span>
                    <span className="font-bold text-emerald-600">{formatMoney(viewingProduct.retailPrice)}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">فروش عمده</span>
                    <span className="font-bold text-indigo-600">{formatMoney(viewingProduct.wholesalePrice)}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">قیمت همکار</span>
                    <span className="font-bold text-purple-600">{formatMoney(viewingProduct.colleaguePrice || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Blocked Modal */}
      {deleteBlockedInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-amber-300 dark:border-amber-700 shadow-2xl overflow-hidden text-right">
            <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">ممنوعیت حذف کالا دارای گردش مالی</h3>
              </div>
              <button onClick={() => setDeleteBlockedInfo(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
                {deleteBlockedInfo.reason}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteBlockedInfo(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeactivateInsteadOfDelete}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Power className="w-4 h-4" />
                <span>غیرفعال‌کردن کالا</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingProduct.id ? `ویرایش کالا: ${editingProduct.name}` : 'تعریف کالای جدید'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 text-xs">
              {[
                { id: 'general', label: 'مشخصات پایه' },
                { id: 'specs', label: 'ویژگی‌ها و مشخصات فنی' },
                { id: 'pricing', label: 'قیمت‌گذاری' },
                { id: 'units', label: 'انبار و واحدها' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormTab(tab.id as any)}
                  className={`py-3 px-4 font-bold border-b-2 transition cursor-pointer ${
                    formTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {formTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        کد اختصاصی کالا *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingProduct.code || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        دسته‌بندی کالا *
                      </label>
                      <select
                        value={editingProduct.categoryId || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                      نام کامل کالا *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">برند</label>
                    <input
                      type="text"
                      value={editingProduct.brand || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {formTab === 'specs' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">رنگ</label>
                      <input
                        type="text"
                        value={editingProduct.color || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">سایز / نمره</label>
                      <input
                        type="text"
                        value={editingProduct.size || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, size: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">مدل</label>
                      <input
                        type="text"
                        value={editingProduct.model || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, model: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">جنس</label>
                      <input
                        type="text"
                        value={editingProduct.material || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, material: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">مشخصات سفارشی</span>
                      <button
                        type="button"
                        onClick={handleAddCustomSpec}
                        className="text-indigo-600 font-bold cursor-pointer"
                      >
                        + افزودن فیلد
                      </button>
                    </div>
                    {(editingProduct.customSpecs || []).map((spec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={spec.key}
                          onChange={(e) => handleUpdateCustomSpec(idx, e.target.value, spec.value)}
                          placeholder="عنوان"
                          className="w-1/2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                        <input
                          type="text"
                          value={spec.value}
                          onChange={(e) => handleUpdateCustomSpec(idx, spec.key, e.target.value)}
                          placeholder="مقدار"
                          className="w-1/2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSpec(idx)}
                          className="p-2 text-rose-500 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {confidential.canViewPurchasePrice ? (
                      <div>
                        <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                          قیمت خرید (ریال) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.purchasePrice ?? 0}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, purchasePrice: Number(e.target.value) })
                          }
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block font-medium text-slate-400 mb-1">قیمت خرید</label>
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> محرمانه (عدم دسترسی صندوق‌دار)
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        قیمت فروش تک (ریال) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingProduct.retailPrice ?? 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, retailPrice: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-emerald-600 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        قیمت فروش عمده
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingProduct.wholesalePrice ?? 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, wholesalePrice: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        قیمت همکار
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingProduct.colleaguePrice ?? 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, colleaguePrice: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        حداقل قیمت مجاز
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingProduct.minAllowedPrice ?? 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, minAllowedPrice: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>

                  {confidential.canViewProfitMargins &&
                    Number(editingProduct.purchasePrice) > 0 &&
                    Number(editingProduct.retailPrice) > 0 && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                          <TrendingUp className="w-4 h-4" />
                          <span>حاشیه سود تک‌فروشی:</span>
                        </div>
                        <div className="font-bold text-indigo-800 dark:text-indigo-200">
                          {formatMoney(Number(editingProduct.retailPrice) - Number(editingProduct.purchasePrice))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {formTab === 'units' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        واحد پایه سنجش *
                      </label>
                      <select
                        value={editingProduct.baseUnitId || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, baseUnitId: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        موجودی اولیه / فعلی
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editingProduct.currentStock ?? 0}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, currentStock: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                        نقطه سفارش
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editingProduct.minStockAlert ?? 10}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, minStockAlert: Number(e.target.value) })
                        }
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">واحدهای فرعی و ضرایب تبدیل</span>
                      <button
                        type="button"
                        onClick={handleAddUnitConversion}
                        className="text-indigo-600 font-bold cursor-pointer"
                      >
                        + افزودن واحد فرعی
                      </button>
                    </div>

                    {(editingProduct.unitConversions || []).map((conv, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                        <div className="col-span-4">
                          <select
                            value={conv.unitId}
                            onChange={(e) => handleUpdateUnitConversion(idx, 'unitId', e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                          >
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="any"
                            value={conv.conversionFactor}
                            onChange={(e) =>
                              handleUpdateUnitConversion(idx, 'conversionFactor', parseFloat(e.target.value) || 1)
                            }
                            placeholder="ضریب تبدیل"
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            value={conv.price || ''}
                            onChange={(e) =>
                              handleUpdateUnitConversion(idx, 'price', e.target.value ? parseInt(e.target.value, 10) : undefined)
                            }
                            placeholder="قیمت واحد فرعی"
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveUnitConversion(idx)}
                            className="text-rose-500 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره اطلاعات کالا'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
