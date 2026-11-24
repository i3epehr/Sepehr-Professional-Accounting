import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { Product, Cheque } from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import { NavigationTab } from '../layout/Sidebar.tsx';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [pendingCheques, setPendingCheques] = useState<Cheque[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      Promise.all([
        api.getProducts().catch(() => []),
        api.getCheques().catch(() => []),
      ]).then(([prods, cheques]) => {
        setLowStockProducts(prods.filter((p) => p.currentStock <= p.minStockAlert && p.isActive));
        setPendingCheques(cheques.filter((c) => c.status === 'in_process'));
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalAlerts = lowStockProducts.length + pendingCheques.length;

  return (
    <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">اعلان‌ها و هشدارهای سیستم</h4>
          {totalAlerts > 0 && (
            <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full">
              {toPersianDigits(totalAlerts)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">در حال دریافت هشدارها...</div>
        ) : totalAlerts === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">وضعیت فروشگاه کاملاً عادی است</p>
            <p className="text-[11px] text-slate-400">
              هیچ کمبود موجودی بحرانی یا چک سررسید شده‌ای وجود ندارد.
            </p>
          </div>
        ) : (
          <>
            {lowStockProducts.length > 0 && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>هشدار کسری موجودی کالا ({toPersianDigits(lowStockProducts.length)})</span>
                  </div>
                  <button
                    onClick={() => {
                      onNavigate('products');
                      onClose();
                    }}
                    className="text-[11px] text-amber-700 dark:text-amber-300 font-bold hover:underline cursor-pointer"
                  >
                    مشاهده کاتالوگ
                  </button>
                </div>

                <div className="space-y-1.5">
                  {lowStockProducts.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onNavigate('products');
                        onClose();
                      }}
                      className="p-2 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-[11px] flex items-center justify-between cursor-pointer hover:bg-amber-50/80 dark:hover:bg-slate-800 transition"
                    >
                      <div className="min-w-0 pr-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                          کد: {p.code} | حداقل: {toPersianDigits(p.minStockAlert)} {p.baseUnitName}
                        </p>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded-lg shrink-0">
                        {toPersianDigits(p.currentStock)} {p.baseUnitName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingCheques.length > 0 && (
              <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-400">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>چک‌های در جریان سررسید ({toPersianDigits(pendingCheques.length)})</span>
                  </div>
                  <button
                    onClick={() => {
                      onNavigate('cheques');
                      onClose();
                    }}
                    className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold hover:underline cursor-pointer"
                  >
                    مدیریت چک‌ها
                  </button>
                </div>

                <div className="space-y-1.5">
                  {pendingCheques.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onNavigate('cheques');
                        onClose();
                      }}
                      className="p-2 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-200/80 dark:border-indigo-800/40 text-[11px] flex items-center justify-between cursor-pointer hover:bg-indigo-50/80 dark:hover:bg-slate-800 transition"
                    >
                      <div className="min-w-0 pr-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {c.chequeType === 'received' ? 'دریافتی از' : 'پرداختی به'}: {c.personName}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                          سررسید: {toPersianDigits(c.dueDate)} | بانک {c.bankName}
                        </p>
                      </div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {formatCurrency(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
        <span>سامانه نظارت بر موجودی و اسناد</span>
        <button
          onClick={() => {
            onNavigate('dashboard');
            onClose();
          }}
          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
        >
          مشاهده داشبورد
        </button>
      </div>
    </div>
  );
};
