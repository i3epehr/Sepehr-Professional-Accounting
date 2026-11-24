import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  Building,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  TrendingDown,
  TrendingUp,
  History,
  Search,
  Filter,
  RefreshCw,
  Coins,
  Receipt,
  Tag,
  Check,
  ShieldCheck,
  Ban,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Lock,
  Edit2,
} from 'lucide-react';
import {
  TreasuryAccount,
  TreasuryTransaction,
  FinancialCategory,
  Cheque,
  ChequeStatus,
  Person,
  Invoice,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, getCurrentJalaliDate, formatCurrency } from '../../lib/formatters.ts';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { Pagination } from '../common/Pagination.tsx';
import { SearchableSelect } from '../common/SearchableSelect.tsx';
import { StatCardsGrid, StatCardItem } from '../common/StatCardsGrid.tsx';
import { StandardModal } from '../common/StandardModal.tsx';

type FinanceView = 'transactions' | 'accounts' | 'cheques' | 'expenses_incomes';

export const FinanceHub: React.FC = () => {
  const { formatMoney } = useSettings();

  const [activeView, setActiveView] = useState<FinanceView>('transactions');
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for Transactions
  const [txSearchTerm, setTxSearchTerm] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [txAccountFilter, setTxAccountFilter] = useState<string>('all');

  // Filters for Cheques
  const [chequeSearchTerm, setChequeSearchTerm] = useState<string>('');
  const [chequeStatusFilter, setChequeStatusFilter] = useState<string>('all');
  const [chequeTypeFilter, setChequeTypeFilter] = useState<string>('all');

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isChequeModalOpen, setIsChequeModalOpen] = useState<boolean>(false);
  const [isChequeTransitionModalOpen, setIsChequeTransitionModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // New Transaction Form State
  const [txType, setTxType] = useState<'receive' | 'pay' | 'income' | 'expense'>('receive');
  const [txAccountId, setTxAccountId] = useState<string>('');
  const [txPersonId, setTxPersonId] = useState<string>('');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txTrackingNumber, setTxTrackingNumber] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(getCurrentJalaliDate());
  const [txPaymentMethod, setTxPaymentMethod] = useState<'cash' | 'pos' | 'bank_transfer' | 'cheque'>('pos');
  const [txDesc, setTxDesc] = useState<string>('');
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);

  // Transfer Form State
  const [trfSourceId, setTrfSourceId] = useState<string>('');
  const [trfDestId, setTrfDestId] = useState<string>('');
  const [trfAmount, setTrfAmount] = useState<string>('');
  const [trfDesc, setTrfDesc] = useState<string>('');

  // New Cheque Form State
  const [newChequeType, setNewChequeType] = useState<'received' | 'issued'>('received');
  const [newChequeNumber, setNewChequeNumber] = useState<string>('');
  const [newSayadNumber, setNewSayadNumber] = useState<string>('');
  const [newChequeBank, setNewChequeBank] = useState<string>('بانک ملی ایران');
  const [newChequeDueDate, setNewChequeDueDate] = useState<string>(getCurrentJalaliDate());
  const [newChequeAmount, setNewChequeAmount] = useState<string>('');
  const [newChequePersonId, setNewChequePersonId] = useState<string>('');

  // Cheque Transition State
  const [selectedChequeForAction, setSelectedChequeForAction] = useState<Cheque | null>(null);
  const [targetChequeStatus, setTargetChequeStatus] = useState<ChequeStatus>('collected');
  const [chequeBankId, setChequeBankId] = useState<string>('');
  const [chequeTransferredPersonId, setChequeTransferredPersonId] = useState<string>('');
  const [transitionDesc, setTransitionDesc] = useState<string>('');

  // New Account State
  const [newAccTitle, setNewAccTitle] = useState<string>('');
  const [newAccType, setNewAccType] = useState<'cash' | 'bank' | 'pos'>('bank');
  const [newAccBankName, setNewAccBankName] = useState<string>('بانک ملی ایران');
  const [newAccNumber, setNewAccNumber] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('0');

  // Category Edit State
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [catTitle, setCatTitle] = useState<string>('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catDesc, setCatDesc] = useState<string>('');

  // Pagination states
  const [txPage, setTxPage] = useState<number>(1);
  const [txPageSize, setTxPageSize] = useState<number>(15);
  const [chqPage, setChqPage] = useState<number>(1);
  const [chqPageSize, setChqPageSize] = useState<number>(15);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [accs, txs, chqs, pers, invs, cats] = await Promise.all([
        api.getTreasuryAccounts(),
        api.getTreasuryTransactions(),
        api.getCheques(),
        api.getPersons(),
        api.getInvoices(),
        api.getFinancialCategories(),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setCheques(chqs);
      setPersons(pers);
      setInvoices(invs);
      setCategories(cats);

      if (accs.length > 0) {
        if (!txAccountId) setTxAccountId(accs[0].id);
        if (!trfSourceId) setTrfSourceId(accs[0].id);
        if (!trfDestId && accs.length > 1) setTrfDestId(accs[1].id);
        const firstBank = accs.find((a) => a.type === 'bank') || accs[0];
        setChequeBankId(firstBank.id);
      }
      if (pers.length > 0 && !txPersonId) {
        setTxPersonId(pers[0].id);
        setNewChequePersonId(pers[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load treasury data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    let totalBalance = 0;
    accounts.forEach((a) => (totalBalance += a.balance || 0));

    let pendingReceivedAmount = 0;
    let pendingReceivedCount = 0;
    let pendingIssuedAmount = 0;
    let pendingIssuedCount = 0;

    cheques.forEach((chq) => {
      if (chq.status === 'registered' || chq.status === 'deposited') {
        if (chq.chequeType === 'received') {
          pendingReceivedAmount += chq.amount;
          pendingReceivedCount++;
        } else {
          pendingIssuedAmount += chq.amount;
          pendingIssuedCount++;
        }
      }
    });

    let totalExpenses = 0;
    transactions.forEach((tx) => {
      if (tx.transactionType === 'expense') {
        totalExpenses += tx.amount;
      }
    });

    return {
      totalBalance,
      pendingReceivedAmount,
      pendingReceivedCount,
      pendingIssuedAmount,
      pendingIssuedCount,
      totalExpenses,
    };
  }, [accounts, cheques, transactions]);

  const statCards: StatCardItem[] = [
    {
      title: 'کل موجودی نقد و بانک',
      value: formatMoney(stats.totalBalance),
      subtitle: <span>صندوق‌ها، حساب‌های بانکی و POS</span>,
      icon: Wallet,
      color: 'emerald',
    },
    {
      title: 'چک‌های دریافتی در جریان',
      value: formatMoney(stats.pendingReceivedAmount),
      subtitle: <span>{toPersianDigits(stats.pendingReceivedCount)} فقره نزد صندوق یا بانک</span>,
      icon: CreditCard,
      color: 'indigo',
    },
    {
      title: 'چک‌های پرداختی عهده ما',
      value: formatMoney(stats.pendingIssuedAmount),
      subtitle: <span>{toPersianDigits(stats.pendingIssuedCount)} فقره تعهد سررسید</span>,
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'هزینه‌های متفرقه دوره',
      value: formatMoney(stats.totalExpenses),
      subtitle: <span>کرایه، قبوض و ملزومات مصرفی</span>,
      icon: Coins,
      color: 'rose',
    },
  ];

  const pillItems: SectionPillItem<FinanceView>[] = [
    {
      id: 'transactions',
      label: 'دریافت و پرداخت‌ها',
      icon: Wallet,
      badge: toPersianDigits(transactions.length),
    },
    {
      id: 'accounts',
      label: 'صندوق و بانک',
      icon: Building,
      badge: toPersianDigits(accounts.length),
    },
    {
      id: 'cheques',
      label: 'اسناد تجاری و چک‌ها',
      icon: CreditCard,
      badge: toPersianDigits(cheques.length),
    },
    {
      id: 'expenses_incomes',
      label: 'هزینه‌ها و درآمدهای متفرقه',
      icon: Coins,
      badge: toPersianDigits(categories.length),
    },
  ];

  // Filtered Transactions
  const filteredTxs = useMemo(() => {
    const q = txSearchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txTypeFilter !== 'all' && tx.transactionType !== txTypeFilter) return false;
      if (txAccountFilter !== 'all' && tx.treasuryAccountId !== txAccountFilter) return false;

      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.personName && tx.personName.toLowerCase().includes(q)) ||
        (tx.trackingNumber && tx.trackingNumber.includes(q)) ||
        tx.date.includes(q)
      );
    });
  }, [transactions, txSearchTerm, txTypeFilter, txAccountFilter]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    const q = chequeSearchTerm.trim().toLowerCase();
    return cheques.filter((chq) => {
      if (chequeTypeFilter !== 'all' && chq.chequeType !== chequeTypeFilter) return false;
      if (chequeStatusFilter !== 'all' && chq.status !== chequeStatusFilter) return false;

      if (!q) return true;
      return (
        chq.chequeNumber.includes(q) ||
        (chq.sayadNumber && chq.sayadNumber.includes(q)) ||
        chq.personName.toLowerCase().includes(q) ||
        chq.bankName.toLowerCase().includes(q) ||
        chq.dueDate.includes(q)
      );
    });
  }, [cheques, chequeSearchTerm, chequeTypeFilter, chequeStatusFilter]);

  const paginatedTxs = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredTxs.slice(start, start + txPageSize);
  }, [filteredTxs, txPage, txPageSize]);

  const paginatedCheques = useMemo(() => {
    const start = (chqPage - 1) * chqPageSize;
    return filteredCheques.slice(start, start + chqPageSize);
  }, [filteredCheques, chqPage, chqPageSize]);

  // Actions
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(txAmount);
    if (!amountNum || amountNum <= 0) {
      alert('لطفاً مبلغ معتبر وارد کنید.');
      return;
    }
    if (!txAccountId) {
      alert('لطفاً حساب مورد نظر را مشخص کنید.');
      return;
    }

    try {
      setIsSubmittingTx(true);
      const acc = accounts.find((a) => a.id === txAccountId);
      const per = persons.find((p) => p.id === txPersonId);

      await api.recordTreasuryTransaction({
        transactionType: txType,
        treasuryAccountId: txAccountId,
        treasuryAccountTitle: acc?.title || 'حساب مالی',
        personId: txType === 'receive' || txType === 'pay' ? txPersonId : undefined,
        personName: txType === 'receive' || txType === 'pay' ? per?.name : undefined,
        amount: amountNum,
        paymentMethod: txPaymentMethod,
        date: txDate,
        trackingNumber: txTrackingNumber,
        description:
          txDesc.trim() ||
          `${txType === 'receive' ? 'دریافت از' : txType === 'pay' ? 'پرداخت به' : txType} ${per?.name || ''}`,
      });

      await loadData();
      setIsTxModalOpen(false);
      setTxAmount('');
      setTxDesc('');
      setTxTrackingNumber('');
      setToastMessage('تراکنش مالی با موفقیت ثبت و اثر آن در مانده حساب اعمال شد.');
    } catch (err: any) {
      alert(`خطا در ثبت تراکنش: ${err.message}`);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(trfAmount);
    if (!amountNum || amountNum <= 0) {
      alert('لطفاً مبلغ انتقال را وارد کنید.');
      return;
    }
    if (trfSourceId === trfDestId) {
      alert('حساب مبدأ و مقصد نمی‌توانند یکسان باشند.');
      return;
    }

    try {
      await api.recordTreasuryTransaction({
        transactionType: 'transfer',
        treasuryAccountId: trfSourceId,
        sourceAccountId: trfSourceId,
        destinationAccountId: trfDestId,
        amount: amountNum,
        date: getCurrentJalaliDate(),
        paymentMethod: 'bank_transfer',
        description: trfDesc.trim() || 'انتقال داخلی بین حساب‌ها',
      });
      await loadData();
      setIsTransferModalOpen(false);
      setTrfAmount('');
      setTrfDesc('');
      setToastMessage('انتقال وجه بین حساب‌ها با موفقیت انجام شد.');
    } catch (err: any) {
      alert(`خطا در انتقال: ${err.message}`);
    }
  };

  const handleSaveCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newChequeAmount);
    if (!newChequeNumber.trim() || !amountNum || amountNum <= 0) {
      alert('لطفاً شماره چک و مبلغ را وارد نمایید.');
      return;
    }

    try {
      const per = persons.find((p) => p.id === newChequePersonId);
      await api.saveCheque({
        chequeType: newChequeType,
        chequeNumber: newChequeNumber.trim(),
        sayadNumber: newSayadNumber.trim() || '1234567890123456',
        bankName: newChequeBank,
        branchName: 'مرکزی',
        amount: amountNum,
        issueDate: getCurrentJalaliDate(),
        dueDate: newChequeDueDate,
        personId: newChequePersonId,
        personName: per?.name || 'مشتری',
        status: 'registered',
        notes: 'ثبت چک صیادی در سیستم',
      });

      await loadData();
      setIsChequeModalOpen(false);
      setNewChequeNumber('');
      setNewSayadNumber('');
      setNewChequeAmount('');
      setToastMessage('چک جدید صیادی با موفقیت در سیستم ثبت گردید.');
    } catch (err: any) {
      alert(`خطا در ثبت چک: ${err.message}`);
    }
  };

  const handleOpenChequeTransition = (chq: Cheque, nextStatus: ChequeStatus) => {
    setSelectedChequeForAction(chq);
    setTargetChequeStatus(nextStatus);
    setTransitionDesc('');
    setIsChequeTransitionModalOpen(true);
  };

  const handleExecuteChequeTransition = async () => {
    if (!selectedChequeForAction) return;
    try {
      await api.transitionChequeStatus(selectedChequeForAction.id, targetChequeStatus, {
        bankAccountId: chequeBankId,
        transferredPersonId: chequeTransferredPersonId,
        description: transitionDesc.trim() || `تغییر وضعیت به ${targetChequeStatus}`,
      });
      await loadData();
      setIsChequeTransitionModalOpen(false);
      setSelectedChequeForAction(null);
      setToastMessage('وضعیت چک با موفقیت به‌روزرسانی شد و سند حسابداری صادر گردید.');
    } catch (err: any) {
      alert(`خطا در تغییر وضعیت چک: ${err.message}`);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccTitle.trim()) return;
    try {
      await api.saveTreasuryAccount({
        title: newAccTitle.trim(),
        type: newAccType,
        bankName: newAccType === 'cash' ? undefined : newAccBankName,
        accountNumber: newAccNumber.trim(),
        balance: parseFloat(newAccBalance) || 0,
        isActive: true,
      });
      await loadData();
      setIsAccountModalOpen(false);
      setNewAccTitle('');
      setNewAccNumber('');
      setNewAccBalance('0');
      setToastMessage('حساب مالی جدید با موفقیت افتتاح شد.');
    } catch (err: any) {
      alert(`خطا در ایجاد حساب: ${err.message}`);
    }
  };

  const handleOpenCategoryModal = (cat?: FinancialCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCatTitle(cat.title);
      setCatType(cat.type);
      setCatDesc(cat.description || '');
    } else {
      setEditingCategory(null);
      setCatTitle('');
      setCatType('expense');
      setCatDesc('');
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    try {
      const saved = await api.saveFinancialCategory({
        id: editingCategory?.id,
        title: catTitle.trim(),
        type: catType,
        description: catDesc.trim(),
        isActive: true,
      });
      if (editingCategory) {
        setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setToastMessage(`سرفصل مالی «${saved.title}» با موفقیت ویرایش شد.`);
      } else {
        setCategories((prev) => [...prev, saved]);
        setToastMessage(`سرفصل مالی «${saved.title}» با موفقیت اضافه شد.`);
      }
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      alert(`خطا در ذخیره سرفصل: ${err.message}`);
    }
  };

  const getChequeStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case 'registered':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            نزد صندوق
          </span>
        );
      case 'deposited':
      case 'in_process':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            در جریان وصول
          </span>
        );
      case 'collected':
      case 'cleared':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            وصول شده
          </span>
        );
      case 'transferred':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            خرج شده
          </span>
        );
      case 'bounced':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            برگشت خورده
          </span>
        );
      case 'cancelled':
      case 'refunded':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-500">
            باطل شده
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with Primary Action Button */}
      <PageHeader
        title="مرکز امور مالی، خزانه‌داری و چک‌ها"
        subtitle="ثبت دریافت و پرداخت‌های نقدی و پوز، مدیریت حساب‌های بانکی، چک‌های صیادی و سرفصل‌های هزینه"
        icon={Wallet}
        primaryAction={{
          label: 'ثبت دریافت / پرداخت',
          icon: Plus,
          onClick: () => setIsTxModalOpen(true),
          color: 'emerald',
        }}
        secondaryActions={[
          {
            label: 'چک صیادی جدید',
            icon: CreditCard,
            onClick: () => setIsChequeModalOpen(true),
            color: 'indigo',
          },
          {
            label: 'انتقال بین حساب‌ها',
            icon: ArrowLeftRight,
            onClick: () => setIsTransferModalOpen(true),
            color: 'amber',
          },
        ]}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid cards={statCards} columns={4} />

      {/* 3. Segmented View Switcher */}
      <SectionPills items={pillItems} activeId={activeView} onChange={setActiveView} />

      {/* VIEW 1: TRANSACTIONS (دریافت و پرداخت) */}
      {activeView === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو در شرح تراکنش، نام طرف حساب یا شماره پیگیری..."
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه انواع تراکنش...</option>
                  <option value="receive">دریافت از مشتری</option>
                  <option value="pay">پرداخت به تأمین‌کننده</option>
                  <option value="expense">هزینه‌های متفرقه</option>
                  <option value="income">درآمدهای متفرقه</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={txAccountFilter}
                  onChange={(e) => setTxAccountFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه صندوق‌ها و حساب‌ها...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                سوابق دریافت و پرداخت‌ها ({toPersianDigits(filteredTxs.length)} تراکنش)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold text-center">نوع</th>
                    <th className="py-2.5 px-3 font-bold text-center">تاریخ</th>
                    <th className="py-2.5 px-3 font-bold">طرف حساب / ذینفع</th>
                    <th className="py-2.5 px-3 font-bold">صندوق / حساب مقصد</th>
                    <th className="py-2.5 px-3 font-bold text-center">روش پرداخت</th>
                    <th className="py-2.5 px-3 font-bold text-left">مبلغ (ریال)</th>
                    <th className="py-2.5 px-3 font-bold">شرح و شماره پیگیری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTxs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        هیچ تراکنشی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedTxs.map((tx, idx) => {
                      const isIncoming = tx.transactionType === 'receive' || tx.transactionType === 'income';
                      return (
                        <tr key={tx.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {toPersianDigits((txPage - 1) * txPageSize + idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isIncoming ? (
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {tx.transactionType === 'receive' ? 'دریافت' : 'درآمد'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {tx.transactionType === 'pay' ? 'پرداخت' : 'هزینه'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                            {toPersianDigits(tx.date)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                            {tx.personName || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {tx.treasuryAccountTitle}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                            {tx.paymentMethod === 'pos'
                              ? 'کارتخوان'
                              : tx.paymentMethod === 'cash'
                              ? 'نقدی'
                              : tx.paymentMethod === 'bank_transfer'
                              ? 'حواله'
                              : 'چک'}
                          </td>
                          <td className="py-2.5 px-3 text-left font-black">
                            <span className={isIncoming ? 'text-emerald-600' : 'text-rose-600'}>
                              {formatMoney(tx.amount)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                            {tx.description}
                            {tx.trackingNumber && (
                              <span className="text-[10px] text-slate-400 font-mono mr-1">
                                (ردگیری: {tx.trackingNumber})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={txPage}
              totalItems={filteredTxs.length}
              pageSize={txPageSize}
              onPageChange={setTxPage}
              onPageSizeChange={setTxPageSize}
            />
          </div>
        </div>
      )}

      {/* VIEW 2: CASH & BANK ACCOUNTS */}
      {activeView === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
              حساب‌های فعال بانکی، صندوق‌ها و پایانه‌های فروش
            </span>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-700"
            >
              + افتتاح حساب / صندوق جدید
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                      {acc.type === 'cash' ? <Wallet className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">{acc.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {acc.accountNumber || acc.bankName || 'صندوق نقدی'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-600">
                    {acc.type === 'cash' ? 'صندوق' : acc.type === 'pos' ? 'کارتخوان' : 'بانک'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-500">موجودی فعلی:</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatMoney(acc.balance || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: CHEQUES (اسناد تجاری و چک‌ها) */}
      {activeView === 'cheques' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو در شماره چک، صیاد، نام طرف حساب یا نام بانک..."
                  value={chequeSearchTerm}
                  onChange={(e) => setChequeSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={chequeTypeFilter}
                  onChange={(e) => setChequeTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه چک‌ها (دریافتی و پرداختی)...</option>
                  <option value="received">فقط چک‌های دریافتی</option>
                  <option value="issued">فقط چک‌های پرداختی</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={chequeStatusFilter}
                  onChange={(e) => setChequeStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه وضعیت‌ها...</option>
                  <option value="registered">نزد صندوق</option>
                  <option value="in_clearance">در جریان وصول</option>
                  <option value="collected">وصول شده</option>
                  <option value="transferred">خرج شده</option>
                  <option value="bounced">برگشت خورده</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                فهرست اسناد تجاری و چک‌ها ({toPersianDigits(filteredCheques.length)} فقره)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold text-center">نوع</th>
                    <th className="py-2.5 px-3 font-bold">شماره چک</th>
                    <th className="py-2.5 px-3 font-bold">شناسه صیاد</th>
                    <th className="py-2.5 px-3 font-bold">طرف حساب</th>
                    <th className="py-2.5 px-3 font-bold">بانک</th>
                    <th className="py-2.5 px-3 font-bold text-center">سررسید</th>
                    <th className="py-2.5 px-3 font-bold text-left">مبلغ (ریال)</th>
                    <th className="py-2.5 px-3 font-bold text-center">وضعیت</th>
                    <th className="py-2.5 px-3 font-bold text-center w-36">اقدامات سریع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCheques.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        چکی با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedCheques.map((chq, idx) => (
                      <tr key={chq.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {toPersianDigits((chqPage - 1) * chqPageSize + idx + 1)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {chq.chequeType === 'received' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              دریافتی
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700">
                              پرداختی
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {toPersianDigits(chq.chequeNumber)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {toPersianDigits(chq.sayadNumber)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                          {chq.personName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{chq.bankName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {toPersianDigits(chq.dueDate)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-black text-slate-900 dark:text-white">
                          {formatMoney(chq.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">{getChequeStatusBadge(chq.status)}</td>
                        <td className="py-2.5 px-3 text-center">
                          {chq.status === 'registered' ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenChequeTransition(chq, 'deposited')}
                                title="خواباندن به حساب (در جریان وصول)"
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                به حساب
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenChequeTransition(chq, 'collected')}
                                title="وصول نقدی مستقیم"
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                وصول
                              </button>
                              {chq.chequeType === 'received' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenChequeTransition(chq, 'transferred')}
                                  title="خرج چک / واگذاری به طرف‌حساب"
                                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  خرج چک
                                </button>
                              )}
                            </div>
                          ) : chq.status === 'deposited' || chq.status === 'in_process' ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenChequeTransition(chq, 'collected')}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                وصول قطعی
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenChequeTransition(chq, 'bounced')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                برگشت
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={chqPage}
              totalItems={filteredCheques.length}
              pageSize={chqPageSize}
              onPageChange={setChqPage}
              onPageSizeChange={setChqPageSize}
            />
          </div>
        </div>
      )}

      {/* VIEW 4: EXPENSES & INCOMES */}
      {activeView === 'expenses_incomes' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                سرفصل‌های هزینه‌ها و درآمدهای عملیاتی و متفرقه ({toPersianDigits(categories.length)})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleOpenCategoryModal()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ سرفصل جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 hover:border-slate-300 dark:hover:border-slate-600 transition"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white">{c.title}</h4>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        c.type === 'expense' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {c.type === 'expense' ? 'هزینه' : 'درآمد'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenCategoryModal(c)}
                      title="ویرایش سرفصل"
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md cursor-pointer transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">{c.description || 'ثبت در دفاتر مالی'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {isTxModalOpen && (
        <StandardModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          title="ثبت دریافت / پرداخت وجه و هزینه"
          subtitle="ثبت آنی و اثرگذاری در موجودی صندوق، بانک و مانده حساب طرف حساب"
          icon={Wallet}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSubmittingTx}
                onClick={handleSaveTransaction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSubmittingTx ? 'در حال ثبت...' : 'ثبت قطعی تراکنش'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveTransaction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  نوع تراکنش مالی *
                </label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="receive">دریافت وجه از مشتری</option>
                  <option value="pay">پرداخت وجه به تأمین‌کننده / بنکدار</option>
                  <option value="expense">ثبت هزینه عملیاتی / جاری</option>
                  <option value="income">ثبت درآمد متفرقه</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  صندوق / حساب بانکی مرتبط *
                </label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} (موجودی: {formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {(txType === 'receive' || txType === 'pay') && (
                <div>
                  <SearchableSelect
                    label="طرف حساب ذینفع"
                    required
                    options={persons.map((p) => ({
                      value: p.id,
                      label: p.name,
                      subLabel: p.mobile ? `همراه: ${p.mobile}` : undefined,
                      badge: p.code,
                    }))}
                    value={txPersonId}
                    onChange={setTxPersonId}
                    placeholder="انتخاب یا جستجوی طرف‌حساب..."
                    searchPlaceholder="نام یا کد شخص..."
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  مبلغ تراکنش (ریال) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="مبلغ به ریال"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  روش پرداخت *
                </label>
                <select
                  value={txPaymentMethod}
                  onChange={(e) => setTxPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="pos">دستگاه کارتخوان (POS)</option>
                  <option value="cash">نقدی (صندوق)</option>
                  <option value="bank_transfer">کارت به کارت / حواله پایا و ساتنا</option>
                  <option value="cheque">چک</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  شماره پیگیری / ارجاع بانکی
                </label>
                <input
                  type="text"
                  value={txTrackingNumber}
                  onChange={(e) => setTxTrackingNumber(e.target.value)}
                  placeholder="مثلاً: ۹۲۸۳۷۴۶"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  شرح و توضیحات تراکنش
                </label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="توضیحات بابت فاکتور یا هزینه..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
          </form>
        </StandardModal>
      )}

      {/* Cheque Transition Modal */}
      {isChequeTransitionModalOpen && selectedChequeForAction && (
        <StandardModal
          isOpen={isChequeTransitionModalOpen}
          onClose={() => setIsChequeTransitionModalOpen(false)}
          title={`اقدام روی چک شماره ${toPersianDigits(selectedChequeForAction.chequeNumber)}`}
          subtitle={`مبلغ: ${formatMoney(selectedChequeForAction.amount)} | طرف حساب: ${selectedChequeForAction.personName}`}
          icon={CreditCard}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsChequeTransitionModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteChequeTransition}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                تأیید اقدام
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <span className="font-bold text-xs text-slate-700">اقدام انتخابی:</span>
              <div className="mt-1 p-2.5 bg-indigo-50 text-indigo-700 font-black rounded-xl text-xs">
                {targetChequeStatus === 'deposited'
                  ? 'خواباندن چک به حساب بانکی جهت وصول'
                  : targetChequeStatus === 'collected'
                  ? 'وصول قطعی و واریز به موجودی حساب'
                  : targetChequeStatus === 'bounced'
                  ? 'برگشت زدن چک و برگشت بدهکاری طرف حساب'
                  : 'خرج چک'}
              </div>
            </div>

            {targetChequeStatus === 'deposited' || targetChequeStatus === 'collected' ? (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  حساب بانکی مقصد وصول:
                </label>
                <select
                  value={chequeBankId}
                  onChange={(e) => setChequeBankId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-900"
                >
                  {accounts
                    .filter((a) => a.type === 'bank' || a.type === 'cash')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            {targetChequeStatus === 'transferred' ? (
              <div>
                <SearchableSelect
                  label="طرف‌حساب دریافت‌کننده چک (خرج چک به مشتری / تأمین‌کننده)"
                  required
                  options={persons.map((p) => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.groupName,
                    badge: p.code,
                  }))}
                  value={chequeTransferredPersonId}
                  onChange={setChequeTransferredPersonId}
                  placeholder="انتخاب یا جستجوی طرف‌حساب دریافت‌کننده..."
                  searchPlaceholder="نام یا کد شخص..."
                />
              </div>
            ) : null}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                توضیحات سند حسابداری:
              </label>
              <input
                type="text"
                value={transitionDesc}
                onChange={(e) => setTransitionDesc(e.target.value)}
                placeholder="توضیحات اختیاری..."
                className="w-full p-2 border rounded-xl text-xs"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* New Cheque Modal */}
      {isChequeModalOpen && (
        <StandardModal
          isOpen={isChequeModalOpen}
          onClose={() => setIsChequeModalOpen(false)}
          title="ثبت چک صیادی جدید"
          subtitle="ثبت اطلاعات برگ چک صیادی بنفش با استعلام و ثبت در اسناد دریافتنی/پرداختنی"
          icon={CreditCard}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsChequeModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveCheque}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                ثبت چک صیادی
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium mb-1">نوع چک *</label>
              <select
                value={newChequeType}
                onChange={(e) => setNewChequeType(e.target.value as any)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              >
                <option value="received">چک دریافتی از مشتری</option>
                <option value="issued">چک پرداختی به بنکدار / همکار</option>
              </select>
            </div>

            <div>
              <SearchableSelect
                label="طرف حساب *"
                required
                options={persons.map((p) => ({
                  value: p.id,
                  label: p.name,
                  subLabel: p.groupName,
                  badge: p.code,
                }))}
                value={newChequePersonId}
                onChange={setNewChequePersonId}
                placeholder="انتخاب یا جستجوی شخص..."
                searchPlaceholder="نام یا کد طرف‌حساب..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">شماره سریال چک *</label>
              <input
                type="text"
                required
                value={newChequeNumber}
                onChange={(e) => setNewChequeNumber(e.target.value)}
                placeholder="مثلاً: ۷۸۲۹۱۰"
                className="w-full p-2 border rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">شناسه ۱۶ رقمی صیادی *</label>
              <input
                type="text"
                value={newSayadNumber}
                onChange={(e) => setNewSayadNumber(e.target.value)}
                placeholder="۱۶ رقم شناسه صیادی"
                className="w-full p-2 border rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">نام بانک صادرکننده</label>
              <input
                type="text"
                value={newChequeBank}
                onChange={(e) => setNewChequeBank(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">تاریخ سررسید چک *</label>
              <input
                type="text"
                value={newChequeDueDate}
                onChange={(e) => setNewChequeDueDate(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-mono text-center"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium mb-1">مبلغ چک (ریال) *</label>
              <input
                type="number"
                min="0"
                required
                value={newChequeAmount}
                onChange={(e) => setNewChequeAmount(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <StandardModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          title="انتقال وجه بین حساب‌ها"
          subtitle="جابه‌جایی نقدینگی بین صندوق فروشگاه، حساب‌های بانکی و دستگاه‌های کارتخوان"
          icon={ArrowLeftRight}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveTransfer}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                تأیید و اجرای انتقال
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1">حساب مبدأ (کسر می‌شود) *</label>
              <select
                value={trfSourceId}
                onChange={(e) => setTrfSourceId(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (موجودی: {formatMoney(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">حساب مقصد (واریز می‌شود) *</label>
              <select
                value={trfDestId}
                onChange={(e) => setTrfDestId(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (موجودی: {formatMoney(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">مبلغ انتقال (ریال) *</label>
              <input
                type="number"
                min="0"
                value={trfAmount}
                onChange={(e) => setTrfAmount(e.target.value)}
                placeholder="مبلغ انتقال"
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">شرح انتقال</label>
              <input
                type="text"
                value={trfDesc}
                onChange={(e) => setTrfDesc(e.target.value)}
                placeholder="مثلاً: واریز نقدینگی صندوق به حساب بانک ملی"
                className="w-full p-2 border rounded-xl text-xs"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* New Account Modal */}
      {isAccountModalOpen && (
        <StandardModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          title="افتتاح حساب / صندوق جدید"
          icon={Building}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                افتتاح حساب
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1">عنوان حساب *</label>
              <input
                type="text"
                value={newAccTitle}
                onChange={(e) => setNewAccTitle(e.target.value)}
                placeholder="مثلاً: کارتخوان به پرداخت ملت"
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">نوع مرکز مالی</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as any)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              >
                <option value="bank">حساب بانکی</option>
                <option value="cash">صندوق نقدی</option>
                <option value="pos">دستگاه پوز / کارتخوان</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">نام بانک</label>
              <input
                type="text"
                value={newAccBankName}
                onChange={(e) => setNewAccBankName(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">شماره حساب / شبا</label>
              <input
                type="text"
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">موجودی اولیه (ریال)</label>
              <input
                type="number"
                min="0"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>
          </div>
        </StandardModal>
      )}

      {/* Category Modal (Create / Edit Expense & Income Heading) */}
      {isCategoryModalOpen && (
        <StandardModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title={editingCategory ? `ویرایش سرفصل «${editingCategory.title}»` : 'تعریف سرفصل جدید مالی'}
          subtitle="تعریف و اصلاح سرفصل‌های هزینه و درآمد جهت ثبت در دفاتر و گزارشات"
          icon={Coins}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                {editingCategory ? 'ذخیره تغییرات' : 'ثبت سرفصل'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                عنوان سرفصل *
              </label>
              <input
                type="text"
                required
                value={catTitle}
                onChange={(e) => setCatTitle(e.target.value)}
                placeholder="مثال: هزینه حمل و نقل، درآمد خدمات..."
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                نوع ماهیت حساب
              </label>
              <select
                value={catType}
                onChange={(e) => setCatType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              >
                <option value="expense">هزینه (عملیاتی / اداری / توزیع)</option>
                <option value="income">درآمد (متفرقه / کارمزد / خدمات)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                توضیحات تکمیلی
              </label>
              <textarea
                rows={2}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="شرح و کاربرد این سرفصل..."
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
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
