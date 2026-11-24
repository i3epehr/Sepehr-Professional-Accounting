import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  X,
  Check,
  Tag,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Product, ProductCategory, Unit } from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories?: ProductCategory[];
  units?: Unit[];
  onSelectProduct: (product: Product) => void;
  isPurchaseDoc?: boolean;
}

export const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  isPurchaseDoc = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Extract unique categories from products
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.categoryId && p.categoryName) {
        map.set(p.categoryId, p.categoryName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products
      .filter((p) => p.isActive)
      .filter((p) => selectedCategoryId === 'all' || p.categoryId === selectedCategoryId)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
          (p.color && p.color.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.size && p.size.toLowerCase().includes(q))
        );
      });
  }, [products, searchTerm, selectedCategoryId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                کاتالوگ و انتخاب پیشرفته کالا
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فیلتر بر اساس دسته‌بندی و جستجوی آنی در ملزومات، روبان، زیپ، دکمه و نخ
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

        {/* Filters Bar: Search & Category Chips */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو بر اساس نام کالا، کد، رنگ، برند یا سایز..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                پاک کردن
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                selectedCategoryId === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              همه دسته‌ها ({toPersianDigits(products.length)})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id && p.isActive).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                    selectedCategoryId === cat.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat.name} ({toPersianDigits(count)})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              کالایی با مشخصات جستجو شده یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredProducts.map((prod) => {
                const price = isPurchaseDoc ? prod.purchasePrice : prod.retailPrice;
                const isOutOfStock = prod.currentStock <= 0;
                const isLowStock = prod.currentStock > 0 && prod.currentStock <= prod.minStockAlert;

                return (
                  <div
                    key={prod.id}
                    onDoubleClick={() => {
                      onSelectProduct(prod);
                      onClose();
                    }}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/20 dark:hover:bg-slate-800 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          {prod.code}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {prod.categoryName && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                            {prod.categoryName}
                          </span>
                        )}
                        {prod.color && <span>رنگ: {prod.color}</span>}
                        {prod.size && <span>سایز: {prod.size}</span>}
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          موجودی:{' '}
                          <span
                            className={`font-black ${
                              isOutOfStock
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {toPersianDigits(prod.currentStock)} {prod.baseUnitName}
                          </span>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {isPurchaseDoc ? 'خرید:' : 'فروش:'} {formatCurrency(price)} ت
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectProduct(prod);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      <span>انتخاب</span>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <span>
            نمایش {toPersianDigits(filteredProducts.length)} از {toPersianDigits(products.length)} کالا — دوبار کلیک جهت درج سریع
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 transition cursor-pointer"
          >
            انصراف (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
