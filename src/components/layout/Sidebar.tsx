import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Scale,
  BarChart3,
  Settings,
  PanelRightClose,
  PanelRightOpen,
  LogOut,
  Shield,
  PlusCircle,
  ChevronDown,
  ChevronLeft,
  FileText,
  RotateCcw,
  PackageSearch,
  Warehouse,
  Ruler,
  Tag,
  UserCheck,
  CreditCard,
  Receipt,
  BookOpen,
  TrendingUp,
  Calendar,
  PieChart,
  Store,
  Printer,
  Database,
  History,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { PermissionModule } from '../../types/index.ts';
import { toPersianDigits } from '../../lib/formatters.ts';

export type NavigationTab =
  | 'dashboard'
  | 'sales-purchases'
  | 'inventory'
  | 'persons'
  | 'finance'
  | 'accounting'
  | 'reports'
  | 'settings'
  | 'invoices'
  | 'products'
  | 'units'
  | 'warehouse'
  | 'returns'
  | 'treasury'
  | 'cheques'
  | 'expenses'
  | 'financial-reports'
  | 'fiscal-year'
  | 'users'
  | 'audit'
  | 'print-backup'
  | 'base-info'
  | 'foundation'
  | 'database'
  | 'system-maintenance';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  lowStockCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export interface SubNavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  badge?: string | number | null;
  badgeColor?: string;
}

export interface MainNavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  module: PermissionModule;
  badge?: string | number | null;
  badgeColor?: string;
  children?: SubNavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  lowStockCount = 0,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { hasPermission, currentUser, logoutSession } = useAuth();

  // Navigation Structure with Rich First-Class Submenus
  const navItems: MainNavItem[] = [
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: LayoutDashboard,
      module: 'reports',
    },
    {
      id: 'sales-purchases',
      label: 'خرید و فروش',
      icon: ShoppingCart,
      module: 'sales',
      children: [
        {
          id: 'invoices',
          label: 'صدور فاکتور (F2)',
          icon: PlusCircle,
        },
        {
          id: 'sales-purchases',
          label: 'فهرست فاکتورها و فروش',
          icon: FileText,
        },
        {
          id: 'returns',
          label: 'مرجوعی و برگشت از فروش',
          icon: RotateCcw,
        },
      ],
    },
    {
      id: 'inventory',
      label: 'کالا و انبار',
      icon: Package,
      module: 'inventory',
      badge: lowStockCount > 0 ? toPersianDigits(lowStockCount) : null,
      badgeColor: 'bg-amber-500 text-white',
      children: [
        {
          id: 'products',
          label: 'کاتالوگ کالاها و خدمات',
          icon: PackageSearch,
        },
        {
          id: 'warehouse',
          label: 'انبارداری و کاردکس',
          icon: Warehouse,
        },
        {
          id: 'units',
          label: 'واحدهای سنجش و تبدیل',
          icon: Ruler,
        },
        {
          id: 'base-info',
          label: 'اطلاعات پایه و گروه‌بندی',
          icon: Tag,
        },
      ],
    },
    {
      id: 'persons',
      label: 'اشخاص و طرف‌حساب',
      icon: Users,
      module: 'base_info',
      children: [
        {
          id: 'persons',
          label: 'مشتریان و تأمین‌کنندگان',
          icon: UserCheck,
        },
      ],
    },
    {
      id: 'finance',
      label: 'خزانه‌داری و امور مالی',
      icon: Wallet,
      module: 'treasury',
      children: [
        {
          id: 'treasury',
          label: 'دریافت، پرداخت و صندوق/بانک',
          icon: Coins,
        },
        {
          id: 'cheques',
          label: 'مدیریت چک‌های صیادی',
          icon: CreditCard,
        },
        {
          id: 'expenses',
          label: 'هزینه‌ها و سرفصل‌ها',
          icon: Receipt,
        },
      ],
    },
    {
      id: 'accounting',
      label: 'حسابداری و دفاتر مالی',
      icon: Scale,
      module: 'accounting',
      children: [
        {
          id: 'accounting',
          label: 'اسناد دوبل، دفتر کل و معین',
          icon: BookOpen,
        },
        {
          id: 'financial-reports',
          label: 'تراز آزمایشی و صورت‌های مالی',
          icon: TrendingUp,
        },
        {
          id: 'fiscal-year',
          label: 'بستن حساب‌ها و سال مالی',
          icon: Calendar,
        },
      ],
    },
    {
      id: 'reports',
      label: 'گزارش‌های جامع',
      icon: BarChart3,
      module: 'reports',
      children: [
        {
          id: 'reports',
          label: 'گزارش‌های تحلیلی و مدیریتی',
          icon: PieChart,
        },
      ],
    },
    {
      id: 'settings',
      label: 'تنظیمات و نگهداری سیستم',
      icon: Settings,
      module: 'settings',
      children: [
        {
          id: 'settings',
          label: 'مشخصات فروشگاه و قوانین مالی',
          icon: Store,
        },
        {
          id: 'print-backup',
          label: 'قالب‌های چاپ و فیش‌پرینتر',
          icon: Printer,
        },
        {
          id: 'system-maintenance',
          label: 'پشتیبان‌گیری، بروزرسانی و نگهداری',
          icon: Database,
        },
        {
          id: 'users',
          label: 'کاربران و سطوح دسترسی',
          icon: Shield,
        },
        {
          id: 'audit',
          label: 'رویدادنگار امنیتی سیستم',
          icon: History,
        },
        {
          id: 'foundation',
          label: 'سلامت و تراز فنی دیتابیس',
          icon: ShieldCheck,
        },
      ],
    },
  ];

  // Accordion state: open/closed state for parent groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'sales-purchases': true,
    inventory: false,
    finance: false,
    accounting: false,
    settings: false,
  });

  // Automatically keep parent group expanded if current activeTab belongs to it
  useEffect(() => {
    for (const item of navItems) {
      if (item.children) {
        const hasChild = item.children.some((c) => c.id === activeTab);
        if (hasChild || item.id === activeTab) {
          setOpenGroups((prev) => ({ ...prev, [item.id]: true }));
        }
      }
    }
  }, [activeTab]);

  const toggleGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleParentClick = (item: MainNavItem) => {
    if (item.children && item.children.length > 0) {
      // Toggle expansion
      setOpenGroups((prev) => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
      // If clicking parent directly, navigate to first child if not already inside this group
      const isAlreadyInGroup = item.children.some((c) => c.id === activeTab);
      if (!isAlreadyInGroup) {
        onSelectTab(item.children[0].id);
      }
    } else {
      onSelectTab(item.id);
    }
  };

  const visibleItems = navItems.filter((item) => hasPermission(item.module, 'view'));

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col h-full shrink-0 border-l border-slate-800 select-none transition-all duration-200 print:hidden overflow-hidden`}
    >
      {/* 1. Top Section: Collapse Toggle & F2 Quick Action (Pinned Top) */}
      <div className="shrink-0 p-2.5 border-b border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between gap-1">
          {!isCollapsed && (
            <span className="px-2 text-[11px] font-bold text-slate-400">
              ناوبری و منوی سیستم
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
              isCollapsed ? 'mx-auto' : ''
            }`}
          >
            {isCollapsed ? (
              <PanelRightOpen className="w-4 h-4" />
            ) : (
              <PanelRightClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* F2 Quick Invoice Action Button */}
        <button
          type="button"
          onClick={() => onSelectTab('invoices')}
          title="صدور فاکتور جدید (F2)"
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
          } py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'invoices'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/60'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">صدور فاکتور (F2)</span>}
          </div>
          {!isCollapsed && (
            <kbd className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
              F2
            </kbd>
          )}
        </button>
      </div>

      {/* 2. Middle Scrollable Navigation Area */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1 min-h-0 scrollbar-thin">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openGroups[item.id] ?? false;

          // Only the exact active leaf gets active highlight
          const isDirectlyActive = activeTab === item.id;
          const containsActiveChild = hasChildren && item.children!.some((c) => c.id === activeTab);

          return (
            <div key={item.id} className="space-y-0.5">
              {/* Category Parent Button */}
              <button
                type="button"
                onClick={() => handleParentClick(item)}
                title={item.label}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                } py-2 rounded-xl text-xs font-bold transition cursor-pointer group ${
                  isDirectlyActive && !hasChildren
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : containsActiveChild
                    ? 'text-indigo-300 bg-slate-800/50'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isDirectlyActive && !hasChildren
                        ? 'text-white'
                        : containsActiveChild
                        ? 'text-indigo-400'
                        : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          item.badgeColor || 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {hasChildren && (
                      <span
                        onClick={(e) => toggleGroup(item.id, e)}
                        className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronLeft className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Submenu Children List */}
              {!isCollapsed && hasChildren && isOpen && (
                <div className="mr-3 pr-2 border-r border-slate-800 space-y-0.5 py-1">
                  {item.children!.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeTab === sub.id;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectTab(sub.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          isSubActive
                            ? sub.id === 'invoices'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <SubIcon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSubActive
                                ? 'text-white'
                                : 'text-slate-500 group-hover:text-slate-300'
                            }`}
                          />
                          <span className="truncate">{sub.label}</span>
                        </div>

                        {sub.badge && (
                          <span className="text-[9.5px] px-1 py-0.2 rounded-full bg-slate-700 text-slate-300 font-bold">
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 3. Bottom Pinned Section: User Info & Logout (ALWAYS visible at viewport bottom) */}
      <div className="shrink-0 p-2.5 border-t border-slate-800/80 bg-slate-900 dark:bg-slate-950">
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } p-1.5 rounded-xl bg-slate-800/50`}
        >
          {!isCollapsed && (
            <div className="truncate px-1.5">
              <span className="block text-xs font-bold text-white truncate">
                {currentUser?.fullName || 'کاربر سیستم'}
              </span>
              <span className="block text-[10px] text-slate-400">
                {currentUser?.role === 'admin'
                  ? 'مدیر سیستم'
                  : currentUser?.role === 'accountant'
                  ? 'حسابدار'
                  : 'صندوق‌دار'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={logoutSession}
            title="خروج از حساب کاربری"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
