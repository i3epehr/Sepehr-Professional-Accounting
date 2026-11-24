import React, { useState } from 'react';
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
  | 'database';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  lowStockCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface MainNavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  module: PermissionModule;
  badge?: string | number | null;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  lowStockCount = 0,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { hasPermission, currentUser, logoutSession } = useAuth();

  // The 8 Canonical Main Navigation Categories (Section 3 of User Prompt)
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
    },
    {
      id: 'inventory',
      label: 'کالا و انبار',
      icon: Package,
      module: 'inventory',
      badge: lowStockCount > 0 ? toPersianDigits(lowStockCount) : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'persons',
      label: 'اشخاص',
      icon: Users,
      module: 'base_info',
    },
    {
      id: 'finance',
      label: 'امور مالی',
      icon: Wallet,
      module: 'treasury',
    },
    {
      id: 'accounting',
      label: 'حسابداری',
      icon: Scale,
      module: 'accounting',
    },
    {
      id: 'reports',
      label: 'گزارش‌ها',
      icon: BarChart3,
      module: 'reports',
    },
    {
      id: 'settings',
      label: 'تنظیمات',
      icon: Settings,
      module: 'settings',
    },
  ];

  // Helper to test if a legacy or sub tab maps to one of the 8 canonical items
  const isNavActive = (itemId: NavigationTab): boolean => {
    if (activeTab === itemId) return true;
    if (itemId === 'sales-purchases' && (activeTab === 'invoices' || activeTab === 'returns')) return true;
    if (itemId === 'inventory' && (activeTab === 'products' || activeTab === 'units' || activeTab === 'warehouse' || activeTab === 'base-info')) return true;
    if (itemId === 'finance' && (activeTab === 'treasury' || activeTab === 'cheques' || activeTab === 'expenses')) return true;
    if (itemId === 'accounting' && (activeTab === 'financial-reports' || activeTab === 'fiscal-year')) return true;
    if (itemId === 'settings' && (activeTab === 'users' || activeTab === 'audit' || activeTab === 'print-backup' || activeTab === 'foundation' || activeTab === 'database')) return true;
    return false;
  };

  const visibleItems = navItems.filter((item) => hasPermission(item.module, 'view'));

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-3.75rem)] border-l border-slate-800 select-none transition-all duration-200 print:hidden`}
    >
      {/* Top Section: Collapse Toggle & Direct F2 Action */}
      <div className="p-2.5 border-b border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between gap-1">
          {!isCollapsed && (
            <span className="px-2 text-[11px] font-bold text-slate-400">
              ناوبری سامانه حسابداری
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

      {/* Main 8 Navigation Categories */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    item.badgeColor || 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User Info & Logout */}
      <div className="p-2.5 border-t border-slate-800/80">
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
