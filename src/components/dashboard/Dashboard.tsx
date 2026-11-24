import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Wallet,
  Users,
  ArrowDownLeft,
  Package,
  PlusCircle,
  FileText,
  BadgeAlert,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowRightLeft,
  Lock,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { NavigationTab } from '../layout/Sidebar.tsx';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import { api } from '../../lib/api.ts';
import { Cheque, ChequeStatus, Person, TreasuryAccount } from '../../types/index.ts';

interface DashboardProps {
  stats: any;
  onNavigate: (tab: NavigationTab) => void;
  onQuickAction: (action: string) => void;
  isLoading: boolean;
  onRefreshStats?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  onNavigate,
  onQuickAction,
  isLoading,
  onRefreshStats,
}) => {
  const { formatMoney } = useSettings();
  const { currentUser, confidential } = useAuth();

  // Quick Action Modal for Upcoming Cheques right on Dashboard
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [targetStatus, setTargetStatus] = useState<ChequeStatus>('collected');
  const [persons, setPersons] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [transferredPersonId, setTransferredPersonId] = useState<string>('');
  const [transitionDesc, setTransitionDesc] = useState<string>('');
  const [isProcessingCheque, setIsProcessingCheque] = useState<boolean>(false);
  const [chequeError, setChequeError] = useState<string>('');

  useEffect(() => {
    Promise.all([api.getPersons().catch(() => []), api.getTreasuryAccounts().catch(() => [])]).then(
      ([pList, aList]) => {
        setPersons(pList);
        setAccounts(aList);
        if (pList.length > 0) {
          const supplier = pList.find((p) => p.personType === 'supplier' || p.personType === 'both') || pList[0];
          setTransferredPersonId(supplier.id);
        }
        const firstBank = aList.find((a) => a.type === 'bank') || aList[0];
        if (firstBank) setBankAccountId(firstBank.id);
      }
    );
  }, []);

  const handleOpenChequeAction = (cheque: Cheque, status: ChequeStatus) => {
    setSelectedCheque(cheque);
    setTargetStatus(status);
    setChequeError('');
    setTransitionDesc('');
  };

  const handleExecuteChequeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;
    setChequeError('');
    try {
      setIsProcessingCheque(true);
      await api.transitionChequeStatus(selectedCheque.id, targetStatus, {
        bankAccountId,
        transferredPersonId,
        description: transitionDesc,
      });
      setSelectedCheque(null);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setChequeError(err.message || 'خطا در تغییر وضعیت چک');
    } finally {
      setIsProcessingCheque(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">در حال بارگذاری شاخص‌های مالی...</p>
        </div>
      </div>
    );
  }

  const upcomingCheques: Cheque[] = stats.upcomingCheques || [];

  return (
    <div className="space-y-5">
      {/* Top Banner & Quick Actions */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full font-bold">
              {currentUser?.department || 'کاربر سیستم'}
            </span>
            <span className="text-xs text-indigo-200">{currentUser?.fullName}</span>
          </div>
          <h2 className="text-lg lg:text-xl font-black">پیشخوان مدیریت مالی</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onQuickAction('new-sale-invoice')}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>صدور فاکتور</span>
          </button>
          <button
            onClick={() => onQuickAction('new-product')}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl font-bold text-xs border border-white/20 transition cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>کالای جدید</span>
          </button>
          <button
            onClick={() => onQuickAction('new-treasury')}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl font-bold text-xs border border-white/20 transition cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>دریافت و پرداخت</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales & Profit (Profit masked for Cashier) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">فروش خالص دوره</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {formatMoney(stats.totalSalesAmount)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>{toPersianDigits(stats.todaySalesCount)} فاکتور</span>
              {confidential.canViewProfitMargins ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  سود تخمینی: {formatMoney(stats.netProfitEstimate || 0, false)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Lock className="w-3 h-3" /> سود محرمانه
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Cash & Bank Total */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">موجودی نقد و بانک</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
              {formatMoney(stats.totalTreasury)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>صندوق: {formatMoney(stats.cashTotal, false)}</span>
              <span>بانک: {formatMoney(stats.bankTotal, false)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Debts */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مطالبات از مشتریان</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-lg font-black text-amber-700 dark:text-amber-400">
              {formatMoney(stats.customerDebts)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>چک‌های دریافتی: {formatMoney(stats.pendingReceivedCheques)}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Supplier Credits */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">بدهی به بنکداران</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-lg font-black text-rose-700 dark:text-rose-400">
              {formatMoney(stats.supplierCredits)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>چک‌های پرداختی: {formatMoney(stats.pendingIssuedCheques)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Upcoming & Maturing Cheques List (فهرست چک‌های نزدیک به سررسید) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              فهرست چک‌های نزدیک به سررسید (دریافتی و پرداختی)
            </h3>
            <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-200 dark:border-indigo-800">
              {toPersianDigits(upcomingCheques.length)} فقره در جریان
            </span>
          </div>
          <button
            onClick={() => onNavigate('cheques')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            مدیریت کامل چک‌ها و خرج چک ←
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-bold">نوع</th>
                <th className="py-2.5 px-3 font-bold">شماره چک</th>
                <th className="py-2.5 px-3 font-bold">طرف حساب</th>
                <th className="py-2.5 px-3 font-bold">بانک</th>
                <th className="py-2.5 px-3 font-bold">سررسید</th>
                <th className="py-2.5 px-3 font-bold text-left">مبلغ</th>
                <th className="py-2.5 px-3 font-bold text-center">وضعیت فعلی</th>
                <th className="py-2.5 px-3 font-bold text-center">اقدام سریع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingCheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    هیچ چک در جریان یا نزدیک به سررسیدی وجود ندارد.
                  </td>
                </tr>
              ) : (
                upcomingCheques.map((chq) => (
                  <tr key={chq.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      {chq.chequeType === 'received' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-[10.5px] border border-emerald-200 dark:border-emerald-800">
                          دریافتی
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold text-[10.5px] border border-amber-200 dark:border-amber-800">
                          پرداختی
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {toPersianDigits(chq.chequeNumber)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-200">
                      {chq.personName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{chq.bankName}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                      {toPersianDigits(chq.dueDate)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                      {formatMoney(chq.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10.5px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        {chq.status === 'deposited' ? 'واگذار به بانک' : 'نزد صندوق'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenChequeAction(chq, 'collected')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold cursor-pointer transition"
                        >
                          {chq.chequeType === 'received' ? 'وصول چک' : 'پاس شد'}
                        </button>
                        {chq.chequeType === 'received' && chq.status !== 'deposited' && (
                          <button
                            onClick={() => handleOpenChequeAction(chq, 'transferred')}
                            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>خرج چک</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: Low Stock Alert & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Low Stock Items */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
              <BadgeAlert className="w-5 h-5 text-amber-600" />
              <span>کسری موجودی و نقطه سفارش</span>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
              {toPersianDigits(stats.lowStockCount)} قلم
            </span>
          </div>

          <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-[290px]">
            {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              stats.lowStockProducts.map((p: any) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                    <span className="text-[10.5px] text-slate-500">کد: {toPersianDigits(p.code)}</span>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                      {toPersianDigits(p.currentStock)} {p.baseUnitName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      حداقل: {toPersianDigits(p.minStockAlert)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <span>موجودی تمام کالاها کافی است.</span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigate('products')}
              className="w-full text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              مدیریت کالاها ←
            </button>
          </div>
        </div>

        {/* Recent Invoices & RBAC Protected Summary */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>آخرین اسناد ثبت‌شده</span>
            </div>
            <button
              onClick={() => onNavigate('sales-purchases')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
            >
              مشاهده همه اسناد ←
            </button>
          </div>

          <div className="mt-3 overflow-x-auto flex-1">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 font-bold">شماره</th>
                  <th className="pb-2 font-bold">نوع</th>
                  <th className="pb-2 font-bold">طرف حساب</th>
                  <th className="pb-2 font-bold">تاریخ</th>
                  <th className="pb-2 font-bold text-left">مبلغ کل</th>
                  <th className="pb-2 font-bold text-left">مانده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.recentInvoices && stats.recentInvoices.length > 0 ? (
                  stats.recentInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100">
                        {toPersianDigits(inv.invoiceNumber)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.invoiceType === 'sale'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {inv.invoiceType === 'sale' ? 'فروش' : 'خرید'}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">{inv.personName}</td>
                      <td className="py-2.5 text-slate-500">{toPersianDigits(inv.date)}</td>
                      <td className="py-2.5 text-left font-black text-slate-900 dark:text-white">
                        {inv.invoiceType === 'purchase' && !confidential.canViewPurchasePrice
                          ? 'محرمانه'
                          : formatMoney(inv.finalAmount)}
                      </td>
                      <td className="py-2.5 text-left">
                        {inv.remainingAmount === 0 ? (
                          <span className="text-emerald-600 font-bold">تسویه</span>
                        ) : (
                          <span className="text-amber-600 font-bold">
                            {formatMoney(inv.remainingAmount, false)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      سندی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Bar with RBAC Masking */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">ارزش بهای خرید انبار</span>
              {confidential.canViewPurchasePrice ? (
                <strong className="text-slate-800 dark:text-white font-black mt-0.5 block">
                  {formatMoney(stats.totalInventoryValue)}
                </strong>
              ) : (
                <strong className="text-slate-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> محرمانه (ویژه مدیر)
                </strong>
              )}
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">تعداد کل کالاها</span>
              <strong className="text-slate-800 dark:text-white font-black mt-0.5 block">
                {toPersianDigits(stats.totalProductsCount)} قلم
              </strong>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">طرف‌حساب‌های فعال</span>
              <strong className="text-slate-800 dark:text-white font-black mt-0.5 block">
                {toPersianDigits(stats.totalPersonsCount)} شخص
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Modal for Upcoming Cheques (Collect / Endorse) */}
      {selectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-800 dark:text-white text-sm">
                {targetStatus === 'transferred'
                  ? `خرج چک و انتقال به شخص ثالث (چک ${toPersianDigits(selectedCheque.chequeNumber)})`
                  : `ثبت وصول چک شماره ${toPersianDigits(selectedCheque.chequeNumber)}`}
              </h3>
              <button onClick={() => setSelectedCheque(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {chequeError && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-bold">
                {chequeError}
              </div>
            )}

            <form onSubmit={handleExecuteChequeAction} className="mt-4 space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">واگذارکننده فعلی:</span>
                  <strong className="text-slate-800 dark:text-white">{selectedCheque.personName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ چک:</span>
                  <strong className="text-emerald-600 font-black">{formatMoney(selectedCheque.amount)}</strong>
                </div>
              </div>

              {targetStatus === 'collected' && (
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    حساب بانکی مقصد / مبدأ *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-bold"
                  >
                    {accounts
                      .filter((a) => a.type === 'bank')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({formatCurrency(a.balance)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {targetStatus === 'transferred' && (
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    گیرنده چک (تأمین‌کننده / شخص ثالث) جهت کسر بدهی *
                  </label>
                  <select
                    value={transferredPersonId}
                    onChange={(e) => setTransferredPersonId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-bold"
                  >
                    {persons
                      .filter((p) => p.id !== selectedCheque.personId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — (مانده فعلی: {formatCurrency(Math.abs(p.currentBalance))}{' '}
                          {p.currentBalance < 0 ? 'بستانکار' : p.currentBalance > 0 ? 'بدهکار' : 'تسویه'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">توضیحات سند</label>
                <input
                  type="text"
                  value={transitionDesc}
                  onChange={(e) => setTransitionDesc(e.target.value)}
                  placeholder="توضیحات ثبت در دفتر روزنامه..."
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCheque(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isProcessingCheque}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {isProcessingCheque ? 'در حال ثبت...' : 'تأیید و ثبت سند حسابداری'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
