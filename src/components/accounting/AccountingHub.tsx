import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  ListTree,
  BookOpen,
  X,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Building2,
  Users,
  Layers,
  ArrowUpDown,
  Filter,
  Eye,
  Check,
  CalendarDays,
  Lock,
  PieChart,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  AccountingVoucher,
  AccountingAccount,
  VoucherLine,
  Person,
  FiscalYear,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, getCurrentJalaliDate, formatCurrency } from '../../lib/formatters.ts';
import {
  JournalLedgerEntry,
  LedgerAccountSummary,
  TrialBalanceReport,
  validateDoubleEntryVoucher,
} from '../../lib/accountingCalculations.ts';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { StatCardsGrid, StatCardItem } from '../common/StatCardsGrid.tsx';
import { StandardModal } from '../common/StandardModal.tsx';
import { Pagination } from '../common/Pagination.tsx';
import { FiscalYearModule } from '../fiscal/FiscalYearModule.tsx';

type AccountingView = 'vouchers' | 'ledgers' | 'trial_balance' | 'financial_statements' | 'fiscal_year';

export const AccountingHub: React.FC = () => {
  const { formatMoney, settings } = useSettings();

  const [activeView, setActiveView] = useState<AccountingView>('vouchers');
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [trialBalanceCols, setTrialBalanceCols] = useState<'4' | '6'>('4');
  const [ledgerSubView, setLedgerSubView] = useState<'general' | 'subsidiary'>('general');

  // Pagination for vouchers
  const [voucherPage, setVoucherPage] = useState<number>(1);
  const [voucherPageSize, setVoucherPageSize] = useState<number>(15);

  // Reports Data
  const [generalLedger, setGeneralLedger] = useState<LedgerAccountSummary[]>([]);
  const [subsidiaryLedger, setSubsidiaryLedger] = useState<LedgerAccountSummary[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewVoucher, setViewVoucher] = useState<AccountingVoucher | null>(null);
  const [voucherToReverse, setVoucherToReverse] = useState<AccountingVoucher | null>(null);
  const [reverseReason, setReverseReason] = useState<string>('');

  // New Voucher State
  const [voucherDate, setVoucherDate] = useState<string>(getCurrentJalaliDate());
  const [voucherDesc, setVoucherDesc] = useState<string>('');
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([
    { id: '1', accountCode: '10101', accountTitle: 'صندوق اصلی فروشگاه', debit: 0, credit: 0, description: '' },
    { id: '2', accountCode: '401', accountTitle: 'درآمد حاصل از فروش کالا', debit: 0, credit: 0, description: '' },
  ]);
  const [isSavingVoucher, setIsSavingVoucher] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [vchs, accs, pers] = await Promise.all([
        api.getVouchers(),
        api.getAccounts(),
        api.getPersons(),
      ]);
      setVouchers(vchs);
      setAccounts(accs);
      setPersons(pers);

      // Fetch ledgers and trial balance
      const [genLedger, subLedger, tb] = await Promise.all([
        api.getGeneralLedger().catch(() => []),
        api.getSubsidiaryLedger().catch(() => []),
        api.getTrialBalance().catch(() => null),
      ]);
      setGeneralLedger(genLedger);
      setSubsidiaryLedger(subLedger);
      setTrialBalance(tb);
    } catch (err: any) {
      console.error('Failed to load accounting data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (selectedStatusFilter !== 'all' && v.status !== selectedStatusFilter) return false;
      if (!q) return true;
      return (
        v.voucherNumber.toLowerCase().includes(q) ||
        v.date.includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    });
  }, [vouchers, searchTerm, selectedStatusFilter]);

  const paginatedVouchers = useMemo(() => {
    const start = (voucherPage - 1) * voucherPageSize;
    return filteredVouchers.slice(start, start + voucherPageSize);
  }, [filteredVouchers, voucherPage, voucherPageSize]);

  useEffect(() => {
    setVoucherPage(1);
  }, [searchTerm, selectedStatusFilter]);

  // Statistics
  const stats = useMemo(() => {
    let totalDebit = 0;
    let permanentCount = 0;
    vouchers.forEach((v) => {
      totalDebit += v.totalDebit;
      if (v.status === 'permanent') permanentCount++;
    });

    return {
      vouchersCount: vouchers.length,
      totalDebit,
      permanentCount,
      isFullyBalanced: vouchers.every((v) => v.isBalanced),
    };
  }, [vouchers]);

  const statCards: StatCardItem[] = [
    {
      title: 'کل اسناد حسابداری',
      value: `${toPersianDigits(stats.vouchersCount)} سند`,
      subtitle: <span>{toPersianDigits(stats.permanentCount)} سند قطعی‌شده</span>,
      icon: Scale,
      color: 'indigo',
    },
    {
      title: 'گردش کل بدهکار و بستانکار',
      value: formatMoney(stats.totalDebit),
      subtitle: <span>تراز کامل ریالی</span>,
      icon: BookOpen,
      color: 'emerald',
    },
    {
      title: 'وضعیت توازن دوبل اسناد',
      value: stats.isFullyBalanced ? '۱۰۰٪ متوازن' : 'دارای مغایرت',
      subtitle: <span className="text-emerald-600 font-bold">بدون انحراف بدهکار/بستانکار</span>,
      icon: ShieldCheck,
      color: stats.isFullyBalanced ? 'emerald' : 'rose',
    },
    {
      title: 'سال مالی فعال',
      value: `سال مالی ${toPersianDigits(settings.activeFiscalYear || '۱۴۰۳')}`,
      subtitle: <span>وضعیت: جاری و معتبر</span>,
      icon: CalendarDays,
      color: 'slate',
    },
  ];

  const pillItems: SectionPillItem<AccountingView>[] = [
    {
      id: 'vouchers',
      label: 'اسناد حسابداری',
      icon: Scale,
      badge: toPersianDigits(vouchers.length),
    },
    {
      id: 'ledgers',
      label: 'دفتر کل و معین',
      icon: BookOpen,
    },
    {
      id: 'trial_balance',
      label: 'تراز آزمایشی (۴ و ۶ ستونی)',
      icon: ListTree,
    },
    {
      id: 'financial_statements',
      label: 'سود و زیان و ترازنامه',
      icon: PieChart,
    },
    {
      id: 'fiscal_year',
      label: 'مدیریت سال مالی و اختتامیه',
      icon: CalendarDays,
    },
  ];

  // Voucher Calculations
  const voucherTotals = useMemo(() => {
    const debit = voucherLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
    const credit = voucherLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
    return { debit, credit, isBalanced: debit === credit && debit > 0 };
  }, [voucherLines]);

  const handleAddVoucherLine = () => {
    setVoucherLines((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        accountCode: accounts[0]?.code || '10101',
        accountTitle: accounts[0]?.title || 'حساب',
        debit: 0,
        credit: 0,
        description: '',
      },
    ]);
  };

  const handleRemoveVoucherLine = (id: string) => {
    if (voucherLines.length <= 2) {
      alert('یک سند دوبل حداقل باید دارای دو سطر باشد.');
      return;
    }
    setVoucherLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSaveVoucher = async () => {
    if (!voucherTotals.isBalanced) {
      alert('سند متوازن نیست! جمع بدهکار باید با جمع بستانکار برابر باشد.');
      return;
    }

    try {
      setIsSavingVoucher(true);
      const nextNum = `VCH-${Math.floor(1000 + Math.random() * 9000)}`;

      await api.createVoucher({
        voucherNumber: nextNum,
        date: voucherDate,
        description: voucherDesc.trim() || 'ثبت سند حسابداری دستی',
        status: 'permanent',
        lines: voucherLines.map((l, idx) => ({ ...l, rowNumber: idx + 1 })),
      });

      await loadData();
      setIsAddModalOpen(false);
      setVoucherDesc('');
      setToastMessage(`سند حسابداری شماره ${toPersianDigits(nextNum)} با موفقیت ثبت گردید.`);
    } catch (err: any) {
      alert(`خطا در ثبت سند: ${err.message}`);
    } finally {
      setIsSavingVoucher(false);
    }
  };

  const handleConfirmReverse = async () => {
    if (!voucherToReverse) return;
    if (!reverseReason.trim()) {
      alert('لطفاً دلیل صدور سند برگشتی / معکوس را وارد کنید.');
      return;
    }

    try {
      await api.reverseVoucher(voucherToReverse.id, reverseReason.trim());
      await loadData();
      setVoucherToReverse(null);
      setReverseReason('');
      setToastMessage('سند اصلاحی معکوس با موفقیت صادر و تراز گردید.');
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with Primary Action Button */}
      <PageHeader
        title="مرکز حسابداری دوبل و دفاتر مالی"
        subtitle="مدیریت اسناد حسابداری، دفاتر کل و معین، تراز آزمایشی، صورت‌های مالی اساسی و عملیات سال مالی"
        icon={Scale}
        primaryAction={{
          label: 'سند حسابداری جدید',
          icon: Plus,
          onClick: () => setIsAddModalOpen(true),
          color: 'indigo',
        }}
        secondaryActions={[
          {
            label: 'تراز آزمایشی',
            icon: ListTree,
            onClick: () => setActiveView('trial_balance'),
            color: 'slate',
          },
        ]}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid cards={statCards} columns={4} />

      {/* 3. Segmented View Switcher */}
      <SectionPills items={pillItems} activeId={activeView} onChange={setActiveView} />

      {/* VIEW 1: VOUCHERS LIST */}
      {activeView === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-8 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو در شماره سند، تاریخ یا شرح سند حسابداری..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه وضعیت‌ها (قطعی / پیش‌نویس)...</option>
                  <option value="permanent">فقط اسناد قطعی</option>
                  <option value="draft">فقط پیش‌نویس‌ها</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                فهرست اسناد حسابداری ({toPersianDigits(filteredVouchers.length)} سند)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold">شماره سند</th>
                    <th className="py-2.5 px-3 font-bold text-center">تاریخ سند</th>
                    <th className="py-2.5 px-3 font-bold">شرح سند</th>
                    <th className="py-2.5 px-3 font-bold text-left">مجموع بدهکار</th>
                    <th className="py-2.5 px-3 font-bold text-left">مجموع بستانکار</th>
                    <th className="py-2.5 px-3 font-bold text-center">تراز</th>
                    <th className="py-2.5 px-3 font-bold text-center">وضعیت</th>
                    <th className="py-2.5 px-3 font-bold text-center w-28">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        سندی با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedVouchers.map((v, idx) => (
                      <tr key={v.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {toPersianDigits((voucherPage - 1) * voucherPageSize + idx + 1)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {toPersianDigits(v.voucherNumber)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                          {toPersianDigits(v.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                          {v.description}
                        </td>
                        <td className="py-2.5 px-3 text-left font-bold text-slate-900 dark:text-white">
                          {formatMoney(v.totalDebit)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-bold text-slate-900 dark:text-white">
                          {formatMoney(v.totalCredit)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {v.isBalanced ? (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                              تراز
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md">
                              نامتوازن
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                              v.status === 'permanent'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {v.status === 'permanent' ? 'قطعی' : 'پیش‌نویس'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewVoucher(v)}
                              title="مشاهده آرتیکل‌های سند"
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoucherToReverse(v)}
                              title="صدور سند اصلاحی / معکوس"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <Pagination
                currentPage={voucherPage}
                totalItems={filteredVouchers.length}
                pageSize={voucherPageSize}
                onPageChange={setVoucherPage}
                onPageSizeChange={setVoucherPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GENERAL & SUBSIDIARY LEDGERS */}
      {activeView === 'ledgers' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setLedgerSubView('general')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                ledgerSubView === 'general'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              دفتر کل ({toPersianDigits(generalLedger.length)} حساب)
            </button>
            <button
              type="button"
              onClick={() => setLedgerSubView('subsidiary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                ledgerSubView === 'subsidiary'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              دفتر معین ({toPersianDigits(subsidiaryLedger.length)} حساب)
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-12">کد</th>
                    <th className="p-2.5 font-bold">عنوان حساب</th>
                    <th className="p-2.5 font-bold text-left">گردش بدهکار</th>
                    <th className="p-2.5 font-bold text-left">گردش بستانکار</th>
                    <th className="p-2.5 font-bold text-left">مانده نهایی</th>
                    <th className="p-2.5 font-bold text-center">ماهیت مانده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(ledgerSubView === 'general' ? generalLedger : subsidiaryLedger).map((acc) => (
                    <tr key={acc.accountCode} className="hover:bg-slate-50/70">
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-600">
                        {toPersianDigits(acc.accountCode)}
                      </td>
                      <td className="p-2.5 font-bold">{acc.accountTitle}</td>
                      <td className="p-2.5 text-left font-bold text-slate-700 dark:text-slate-200">
                        {formatMoney(acc.totalDebit)}
                      </td>
                      <td className="p-2.5 text-left font-bold text-slate-700 dark:text-slate-200">
                        {formatMoney(acc.totalCredit)}
                      </td>
                      <td className="p-2.5 text-left font-black text-slate-900 dark:text-white">
                        {formatMoney(acc.closingBalance)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            acc.balanceNature === 'debit'
                              ? 'bg-rose-50 text-rose-700'
                              : acc.balanceNature === 'credit'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {acc.balanceNature === 'debit'
                            ? 'بدهکار'
                            : acc.balanceNature === 'credit'
                            ? 'بستانکار'
                            : 'تسویه'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TRIAL BALANCE */}
      {activeView === 'trial_balance' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <span className="font-bold text-xs">تراز آزمایشی دفاتر مالی</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTrialBalanceCols('4')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  trialBalanceCols === '4' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                تراز ۴ ستونی
              </button>
              <button
                type="button"
                onClick={() => setTrialBalanceCols('6')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  trialBalanceCols === '6' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                تراز ۶ ستونی
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ تراز</span>
              </button>
            </div>
          </div>

          {trialBalance && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="p-2.5 text-center w-12">کد</th>
                    <th className="p-2.5 font-bold">عنوان حساب</th>
                    <th className="p-2.5 text-left font-bold">گردش بدهکار</th>
                    <th className="p-2.5 text-left font-bold">گردش بستانکار</th>
                    <th className="p-2.5 text-left font-bold text-rose-600">مانده بدهکار</th>
                    <th className="p-2.5 text-left font-bold text-emerald-600">مانده بستانکار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trialBalance.rows.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50/70">
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-600">
                        {toPersianDigits(row.code)}
                      </td>
                      <td className="p-2.5 font-bold">{row.title}</td>
                      <td className="p-2.5 text-left font-bold">{formatMoney(row.turnoverDebit)}</td>
                      <td className="p-2.5 text-left font-bold">{formatMoney(row.turnoverCredit)}</td>
                      <td className="p-2.5 text-left font-bold text-rose-600">
                        {row.closingDebit > 0 ? formatMoney(row.closingDebit) : '-'}
                      </td>
                      <td className="p-2.5 text-left font-bold text-emerald-600">
                        {row.closingCredit > 0 ? formatMoney(row.closingCredit) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-800/60 font-black">
                    <td colSpan={2} className="p-3 text-center">
                      مجموع کل تراز:
                    </td>
                    <td className="p-3 text-left">{formatMoney(trialBalance.totalTurnoverDebit)}</td>
                    <td className="p-3 text-left">{formatMoney(trialBalance.totalTurnoverCredit)}</td>
                    <td className="p-3 text-left text-rose-600">
                      {formatMoney(trialBalance.totalClosingDebit)}
                    </td>
                    <td className="p-3 text-left text-emerald-600">
                      {formatMoney(trialBalance.totalClosingCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: FINANCIAL STATEMENTS (سود و زیان و ترازنامه) */}
      {activeView === 'financial_statements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Income Statement */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                صورت سود و زیان دوره مالی
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span>درآمد حاصل از فروش کالا:</span>
                <strong className="text-emerald-600 font-bold">
                  {formatMoney(
                    vouchers
                      .flatMap((v) => v.lines)
                      .filter((l) => l.accountCode.startsWith('401'))
                      .reduce((acc, l) => acc + l.credit, 0)
                  )}
                </strong>
              </div>

              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span>بهای تمام‌شده کالای فروش‌رفته (COGS):</span>
                <strong className="text-rose-600 font-bold">
                  {formatMoney(
                    vouchers
                      .flatMap((v) => v.lines)
                      .filter((l) => l.accountCode.startsWith('501'))
                      .reduce((acc, l) => acc + l.debit, 0)
                  )}-
                </strong>
              </div>

              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span>هزینه‌های عملیاتی و جاری:</span>
                <strong className="text-rose-600 font-bold">
                  {formatMoney(
                    vouchers
                      .flatMap((v) => v.lines)
                      .filter((l) => l.accountCode.startsWith('601'))
                      .reduce((acc, l) => acc + l.debit, 0)
                  )}-
                </strong>
              </div>

              <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 font-black text-sm">
                <span>سود خالص عملکرد دوره:</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {formatMoney(
                    Math.max(
                      0,
                      vouchers
                        .flatMap((v) => v.lines)
                        .filter((l) => l.accountCode.startsWith('401'))
                        .reduce((acc, l) => acc + l.credit, 0) -
                        vouchers
                          .flatMap((v) => v.lines)
                          .filter((l) => l.accountCode.startsWith('501') || l.accountCode.startsWith('601'))
                          .reduce((acc, l) => acc + l.debit, 0)
                    )
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Summary */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">ترازنامه (وضعیت مالی)</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl space-y-2">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 block">
                  دارایی‌های جاری (نقد و بانک، مطالبات و موجودی انبار):
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white block">
                  {formatMoney(
                    accounts.reduce((acc, a) => acc + (a.balance || 0), 0) +
                      persons.filter((p) => p.currentBalance > 0).reduce((acc, p) => acc + p.currentBalance, 0)
                  )}
                </span>
              </div>

              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl space-y-2">
                <span className="font-bold text-amber-700 dark:text-amber-300 block">
                  بدهی‌های جاری (تعهدات به بنکداران و چک‌های عهده ما):
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white block">
                  {formatMoney(
                    persons
                      .filter((p) => p.currentBalance < 0)
                      .reduce((acc, p) => acc + Math.abs(p.currentBalance), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: FISCAL YEAR MANAGEMENT */}
      {activeView === 'fiscal_year' && <FiscalYearModule />}

      {/* New Voucher Modal */}
      {isAddModalOpen && (
        <StandardModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="ثبت سند دوبل حسابداری"
          subtitle="سند دوطرفه باید کاملاً متوازن باشد (جمع بدهکار = جمع بستانکار)."
          icon={Scale}
          maxWidth="3xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span>
                  جمع بدهکار: <strong className="text-indigo-600">{formatMoney(voucherTotals.debit)}</strong>
                </span>
                <span>
                  جمع بستانکار: <strong className="text-indigo-600">{formatMoney(voucherTotals.credit)}</strong>
                </span>
                {voucherTotals.isBalanced ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Check className="w-4 h-4" /> تراز
                  </span>
                ) : (
                  <span className="text-rose-600">
                    اختلاف: {formatMoney(Math.abs(voucherTotals.debit - voucherTotals.credit))}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={!voucherTotals.isBalanced || isSavingVoucher}
                  onClick={handleSaveVoucher}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isSavingVoucher ? 'در حال ثبت...' : 'ثبت قطعی سند'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1">تاریخ سند *</label>
                <input
                  type="text"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1">شرح کلی سند *</label>
                <input
                  type="text"
                  value={voucherDesc}
                  onChange={(e) => setVoucherDesc(e.target.value)}
                  placeholder="شرح سند حسابداری..."
                  className="w-full p-2 border rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="p-2 w-10 text-center">#</th>
                    <th className="p-2">کد و عنوان حساب</th>
                    <th className="p-2">شرح ردیف</th>
                    <th className="p-2 text-left w-28">بدهکار (ریال)</th>
                    <th className="p-2 text-left w-28">بستانکار (ریال)</th>
                    <th className="p-2 text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {voucherLines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="p-2 text-center text-slate-400 font-bold">{toPersianDigits(idx + 1)}</td>
                      <td className="p-2">
                        <select
                          value={line.accountCode}
                          onChange={(e) => {
                            const acc = accounts.find((a) => a.code === e.target.value);
                            setVoucherLines((prev) =>
                              prev.map((l) =>
                                l.id === line.id
                                  ? { ...l, accountCode: e.target.value, accountTitle: acc?.title || '' }
                                  : l
                              )
                            );
                          }}
                          className="w-full p-1.5 border rounded-lg text-xs font-bold"
                        >
                          {accounts.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} - {a.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={line.description || ''}
                          onChange={(e) =>
                            setVoucherLines((prev) =>
                              prev.map((l) => (l.id === line.id ? { ...l, description: e.target.value } : l))
                            )
                          }
                          placeholder="شرح آرتیکل..."
                          className="w-full p-1.5 border rounded-lg text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={line.debit || ''}
                          onChange={(e) => {
                            const d = parseFloat(e.target.value) || 0;
                            setVoucherLines((prev) =>
                              prev.map((l) => (l.id === line.id ? { ...l, debit: d, credit: d > 0 ? 0 : l.credit } : l))
                            );
                          }}
                          className="w-full p-1.5 border rounded-lg text-xs font-bold text-left"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={line.credit || ''}
                          onChange={(e) => {
                            const c = parseFloat(e.target.value) || 0;
                            setVoucherLines((prev) =>
                              prev.map((l) => (l.id === line.id ? { ...l, credit: c, debit: c > 0 ? 0 : l.debit } : l))
                            );
                          }}
                          className="w-full p-1.5 border rounded-lg text-xs font-bold text-left"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveVoucherLine(line.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddVoucherLine}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              + افزودن سطر جدید به سند
            </button>
          </div>
        </StandardModal>
      )}

      {/* View Voucher Details Modal */}
      {viewVoucher && (
        <StandardModal
          isOpen={Boolean(viewVoucher)}
          onClose={() => setViewVoucher(null)}
          title={`آرتیکل‌های سند حسابداری شماره ${toPersianDigits(viewVoucher.voucherNumber)}`}
          subtitle={`تاریخ: ${toPersianDigits(viewVoucher.date)} | شرح: ${viewVoucher.description}`}
          icon={Scale}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ سند حسابداری</span>
              </button>
              <button
                type="button"
                onClick={() => setViewVoucher(null)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          }
        >
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b">
                <tr>
                  <th className="p-2 text-center w-10">#</th>
                  <th className="p-2">کد و حساب</th>
                  <th className="p-2">شرح ردیف</th>
                  <th className="p-2 text-left">بدهکار</th>
                  <th className="p-2 text-left">بستانکار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {viewVoucher.lines.map((l, idx) => (
                  <tr key={l.id || idx}>
                    <td className="p-2 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                    <td className="p-2 font-bold">{l.accountCode} - {l.accountTitle}</td>
                    <td className="p-2 text-slate-600">{l.description || '-'}</td>
                    <td className="p-2 text-left font-bold">{l.debit > 0 ? formatMoney(l.debit) : '-'}</td>
                    <td className="p-2 text-left font-bold">{l.credit > 0 ? formatMoney(l.credit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StandardModal>
      )}

      {/* Reverse Voucher Modal */}
      {voucherToReverse && (
        <StandardModal
          isOpen={Boolean(voucherToReverse)}
          onClose={() => setVoucherToReverse(null)}
          title={`صدور سند اصلاحی / معکوس برای سند #${toPersianDigits(voucherToReverse.voucherNumber)}`}
          subtitle="اسناد قطعی حذف نمی‌شوند؛ اصلاح آنها از طریق صدور سند معکوس با عطف به سند مبدأ انجام می‌شود."
          icon={RotateCcw}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setVoucherToReverse(null)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmReverse}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                تأیید صدور سند معکوس
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              آیا از صدور سند معکوس برای سند شماره {toPersianDigits(voucherToReverse.voucherNumber)} به مبلغ{' '}
              {formatMoney(voucherToReverse.totalDebit)} اطمینان دارید؟
            </p>

            <div>
              <label className="block text-[11px] font-bold mb-1">دلیل اصلاح یا معکوس‌سازی *</label>
              <textarea
                rows={3}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="علت اصلاح سند را بنویسید..."
                className="w-full p-2 border rounded-xl text-xs"
              />
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
