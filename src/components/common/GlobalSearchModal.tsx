import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Package,
  Users,
  ShoppingCart,
  Scale,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { Product, Person, Invoice, AccountingVoucher } from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import { NavigationTab } from '../layout/Sidebar.tsx';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab, metadata?: any) => void;
}

type SearchCategory = 'all' | 'products' | 'persons' | 'invoices' | 'accounting' | 'navigation';

interface SearchResultItem {
  id: string;
  category: 'products' | 'persons' | 'invoices' | 'accounting' | 'navigation';
  title: string;
  subtitle: string;
  extra?: string;
  tab: NavigationTab;
  metadata?: any;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      Promise.all([
        api.getProducts().catch(() => []),
        api.getPersons().catch(() => []),
        api.getInvoices().catch(() => []),
        api.getVouchers().catch(() => []),
      ]).then(([p, per, inv, v]) => {
        setProducts(p);
        setPersons(per);
        setInvoices(inv);
        setVouchers(v);
        setIsLoading(false);
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const navigationItems: SearchResultItem[] = [
    { id: 'nav-dash', category: 'navigation', title: 'داشبورد مدیریتی', subtitle: 'مشاهده آمار و شاخص‌های مالی فروشگاه', tab: 'dashboard' },
    { id: 'nav-pos', category: 'navigation', title: 'صدور سریع فاکتور فروش (POS)', subtitle: 'ثبت آنی فاکتور با بارکدخوان و چاپ', tab: 'invoices', metadata: { openNew: true } },
    { id: 'nav-prod', category: 'navigation', title: 'کاتالوگ و انبار کالاها', subtitle: 'تعریف دکمه، روبان، زیپ، کاموا و ملزومات', tab: 'products' },
    { id: 'nav-units', category: 'navigation', title: 'واحدها و ضرایب تبدیل', subtitle: 'تنظیم متراژ، رول، بسته، جین و قواره', tab: 'units' },
    { id: 'nav-warehouse', category: 'navigation', title: 'انبارداری و کاردکس کالا', subtitle: 'گردش مقداری و ریالی کالاها و انبارگردانی', tab: 'warehouse' },
    { id: 'nav-returns', category: 'navigation', title: 'برگشت از فروش و برگشت از خرید', subtitle: 'ثبت اسناد مرجوعی متصل به فاکتور', tab: 'returns' },
    { id: 'nav-persons', category: 'navigation', title: 'اشخاص و طرف‌های حساب', subtitle: 'مشتریان، خیاطان، تولیدی‌ها و بنکداران', tab: 'persons' },
    { id: 'nav-expenses', category: 'navigation', title: 'هزینه‌ها و درآمدهای جاری', subtitle: 'ثبت اجاره، حقوق، حمل و باربری', tab: 'expenses' },
    { id: 'nav-treasury', category: 'navigation', title: 'صندوق، بانک و پوز', subtitle: 'مانده وجوه نقد، واریز و برداشت', tab: 'treasury' },
    { id: 'nav-cheques', category: 'navigation', title: 'چک‌های صیادی دریافتی/پرداختی', subtitle: 'پیگیری سررسید، وصول و برگشت چک', tab: 'cheques' },
    { id: 'nav-acc', category: 'navigation', title: 'اسناد دوبل و دفاتر حسابداری', subtitle: 'دفتر روزنامه، کل و معین متوازن', tab: 'accounting' },
    { id: 'nav-fin-rep', category: 'navigation', title: 'گزارش سود و زیان و ترازنامه', subtitle: 'صورت‌های مالی اساسی فروشگاه', tab: 'financial-reports' },
    { id: 'nav-reports', category: 'navigation', title: 'گزارش‌های تحلیلی و پرفروش‌ها', subtitle: 'کالاهای راکد، صورتحساب اشخاص', tab: 'reports' },
    { id: 'nav-fiscal', category: 'navigation', title: 'سال مالی و افتتاحیه/اختتامیه', subtitle: 'بستن حساب‌های دوره مالی', tab: 'fiscal-year' },
    { id: 'nav-users', category: 'navigation', title: 'کاربران و سطوح دسترسی', subtitle: 'مدیریت پرسنل و مجوزها', tab: 'users' },
    { id: 'nav-backup', category: 'navigation', title: 'چاپ فاکتور و پشتیبان‌گیری', subtitle: 'طراحی قالب حرارتی و دیتابیس', tab: 'print-backup' },
    { id: 'nav-sett', category: 'navigation', title: 'تنظیمات عمومی فروشگاه', subtitle: 'ارز، مالیات، سربرگ فاکتور', tab: 'settings' },
  ];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    if (category === 'all' || category === 'navigation') {
      navigationItems.forEach((nav) => {
        if (!q || nav.title.toLowerCase().includes(q) || nav.subtitle.toLowerCase().includes(q)) {
          items.push(nav);
        }
      });
    }

    if (category === 'all' || category === 'products') {
      products.forEach((p) => {
        const matches =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.color && p.color.includes(q)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q));

        if (matches) {
          items.push({
            id: `prod-${p.id}`,
            category: 'products',
            title: p.name,
            subtitle: `کد: ${p.code} | موجودی: ${toPersianDigits(p.currentStock)} ${p.baseUnitName}`,
            extra: `${formatCurrency(p.retailPrice)}`,
            tab: 'products',
            metadata: { productId: p.id },
          });
        }
      });
    }

    if (category === 'all' || category === 'persons') {
      persons.forEach((per) => {
        const matches =
          !q ||
          per.name.toLowerCase().includes(q) ||
          (per.phone && per.phone.includes(q)) ||
          (per.code && per.code.toLowerCase().includes(q));

        if (matches) {
          items.push({
            id: `per-${per.id}`,
            category: 'persons',
            title: per.name,
            subtitle: `کد: ${per.code} | تلفن: ${toPersianDigits(per.phone)}`,
            extra: `مانده: ${formatCurrency(Math.abs(per.currentBalance))}`,
            tab: 'persons',
            metadata: { personId: per.id },
          });
        }
      });
    }

    if (category === 'all' || category === 'invoices') {
      invoices.forEach((inv) => {
        const matches =
          !q ||
          inv.invoiceNumber.includes(q) ||
          inv.personName.toLowerCase().includes(q);

        if (matches) {
          items.push({
            id: `inv-${inv.id}`,
            category: 'invoices',
            title: `فاکتور شماره ${toPersianDigits(inv.invoiceNumber)}`,
            subtitle: `طرف حساب: ${inv.personName} | تاریخ: ${toPersianDigits(inv.date)}`,
            extra: `${formatCurrency(inv.finalAmount)}`,
            tab: 'invoices',
            metadata: { invoiceId: inv.id },
          });
        }
      });
    }

    return items;
  }, [query, category, products, persons, invoices]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    onNavigate(item.tab, item.metadata);
    onClose();
  };

  if (!isOpen) return null;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'products':
        return <Package className="w-4 h-4 text-emerald-500" />;
      case 'persons':
        return <Users className="w-4 h-4 text-indigo-500" />;
      case 'invoices':
        return <ShoppingCart className="w-4 h-4 text-amber-500" />;
      case 'accounting':
        return <Scale className="w-4 h-4 text-rose-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="جستجوی سریع در کالاها، اشخاص، فاکتورها یا منوها..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            Esc
          </kbd>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'همه بخش‌ها' },
            { id: 'navigation', label: 'صفحات و منوها' },
            { id: 'products', label: 'کالاها و ملزومات' },
            { id: 'persons', label: 'اشخاص و مشتریان' },
            { id: 'invoices', label: 'فاکتورها' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setCategory(cat.id as SearchCategory);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                category === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">در حال بارگذاری داده‌های سیستم...</div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                موردی با عنوان «{query}» پیدا نشد.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
                        <span>{item.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pr-2">
                    {item.extra && (
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                        {toPersianDigits(item.extra)}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>{toPersianDigits(results.length)} مورد یافت شد</span>
          <span className="text-[10px]">کلیدهای میانبر: ↑↓ برای انتخاب، Enter برای انتقال</span>
        </div>
      </div>
    </div>
  );
};
