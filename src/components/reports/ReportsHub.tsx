import React, { useState } from 'react';
import {
  BarChart3,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  FileSpreadsheet,
  Printer,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { ReportsModule, MainReportTab } from './ReportsModule.tsx';

type ReportCategory = 'sales_purchases' | 'inventory' | 'persons' | 'financial';

export const ReportsHub: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('sales_purchases');

  const pillItems: SectionPillItem<ReportCategory>[] = [
    {
      id: 'sales_purchases',
      label: 'گزارش‌های فروش و خرید',
      icon: ShoppingCart,
      activeColor: 'bg-emerald-600 text-white shadow-xs',
    },
    {
      id: 'inventory',
      label: 'گزارش‌های کالا و انبار',
      icon: Package,
      activeColor: 'bg-indigo-600 text-white shadow-xs',
    },
    {
      id: 'persons',
      label: 'گزارش‌های اشخاص و مطالبات',
      icon: Users,
      activeColor: 'bg-rose-600 text-white shadow-xs',
    },
    {
      id: 'financial',
      label: 'گزارش‌های مالی و تراز',
      icon: Wallet,
      activeColor: 'bg-amber-600 text-white shadow-xs',
    },
  ];

  const getInitialTabForCategory = (cat: ReportCategory): MainReportTab => {
    switch (cat) {
      case 'sales_purchases':
        return 'periodic_sales_purchases';
      case 'inventory':
        return 'inventory_turnover';
      case 'persons':
        return 'persons_aging';
      case 'financial':
        return 'income_balance_sheet';
      default:
        return 'profit_cogs';
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <PageHeader
        title="مرکز جامع گزارش‌های مدیریتی، تحلیلی و آماری"
        subtitle="بررسی شاخص‌های فروش، سودآوری، گردش انبار، تحلیل سنی مطالبات و ترازهای مالی با خروجی اکسل و چاپ رسمی"
        icon={BarChart3}
      />

      {/* 2. Main Report Categories Switcher */}
      <SectionPills items={pillItems} activeId={activeCategory} onChange={setActiveCategory} />

      {/* 3. Report Engine */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4">
        <ReportsModule key={activeCategory} initialTab={getInitialTabForCategory(activeCategory)} />
      </div>
    </div>
  );
};
