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
} from 'lucide-react';
import {
  TreasuryAccount,
  TreasuryTransaction,
  FinancialCategory,
  Cheque,
  ChequeStatus,
  ChequeStatusHistoryItem,
  Person,
  Invoice,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, getCurrentJalaliDate, formatCurrency } from '../../lib/formatters.ts';
import {
  validateInvoiceSettlement,
  checkForDuplicateTransaction,
  calculateAccountStatementAndReconciliation,
  validateChequeStatusTransition,
} from '../../lib/treasuryCalculations.ts';

type ActiveTab = 'overview' | 'transactions' | 'transfer' | 'categories' | 'turnover' | 'cheques';

export const TreasuryModule: React.FC = () => {
  const { formatMoney } = useSettings();

  // Primary Data
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Selected account for Turnover / Statement tab
  const [selectedStatementAccountId, setSelectedStatementAccountId] = useState<string>('');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isChequeModalOpen, setIsChequeModalOpen] = useState<boolean>(false);
  const [isChequeTransitionModalOpen, setIsChequeTransitionModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // New Account Form
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accTitle, setAccTitle] = useState('');
  const [accType, setAccType] = useState<'cash' | 'bank' | 'pos'>('cash');
  const [accNumber, setAccNumber] = useState('');
  const [accBankName, setAccBankName] = useState('بانک ملی ایران');
  const [accBranchName, setAccBranchName] = useState('');
  const [accSheba, setAccSheba] = useState('');
  const [accInitialBalance, setAccInitialBalance] = useState<string>('0');

  // New Transaction Form (Receive / Pay / Income / Expense)
  const [txType, setTxType] = useState<'receive' | 'pay' | 'income' | 'expense'>('receive');
  const [txAccountId, setTxAccountId] = useState<string>('');
  const [txPersonId, setTxPersonId] = useState<string>('');
  const [txInvoiceId, setTxInvoiceId] = useState<string>('');
  const [txCategoryId, setTxCategoryId] = useState<string>('');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txTrackingNumber, setTxTrackingNumber] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(getCurrentJalaliDate());
  const [txPaymentMethod, setTxPaymentMethod] = useState<'cash' | 'pos' | 'bank_transfer' | 'cheque'>('cash');
  const [txDesc, setTxDesc] = useState<string>('');
  const [txError, setTxError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Transfer Form
  const [trfSourceId, setTrfSourceId] = useState<string>('');
  const [trfDestId, setTrfDestId] = useState<string>('');
  const [trfAmount, setTrfAmount] = useState<string>('');
  const [trfDate, setTrfDate] = useState<string>(getCurrentJalaliDate());
  const [trfTracking, setTrfTracking] = useState<string>('');
  const [trfDesc, setTrfDesc] = useState<string>('');
  const [trfError, setTrfError] = useState<string>('');

  // New Financial Category Form
  const [catTitle, setCatTitle] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // New Cheque Form
  const [chequeType, setChequeType] = useState<'received' | 'issued'>('received');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [sayadNumber, setSayadNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('بانک ملی ایران');
  const [branchName, setBranchName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(getCurrentJalaliDate());
  const [dueDate, setDueDate] = useState<string>(getCurrentJalaliDate());
  const [chequeAmount, setChequeAmount] = useState<string>('');
  const [chequePersonId, setChequePersonId] = useState<string>('');
  const [chequeSourceAccountId, setChequeSourceAccountId] = useState<string>('');
  const [chequeNotes, setChequeNotes] = useState<string>('');

  // Cheque Transition Modal
  const [activeChequeForTransition, setActiveChequeForTransition] = useState<Cheque | null>(null);
  const [targetChequeStatus, setTargetChequeStatus] = useState<ChequeStatus>('collected');
  const [transitionBankAccountId, setTransitionBankAccountId] = useState<string>('');
  const [transitionPersonId, setTransitionPersonId] = useState<string>('');
  const [transitionBounceReason, setTransitionBounceReason] = useState<string>('کسری موجودی در حساب صادرکننده');
  const [transitionDesc, setTransitionDesc] = useState<string>('');
  const [transitionError, setTransitionError] = useState<string>('');

  // Cheque History View
  const [selectedChequeForHistory, setSelectedChequeForHistory] = useState<Cheque | null>(null);

  // Filters
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterType, setTxFilterType] = useState<string>('all');
  const [chqFilterType, setChqFilterType] = useState<'all' | 'received' | 'issued'>('all');
  const [chqFilterStatus, setChqFilterStatus] = useState<string>('all');

  // Reconciliation status banner
  const [reconcileReport, setReconcileReport] = useState<{ summary: string; isChecked: boolean } | null>(null);

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

      if (accs.length > 0 && !selectedStatementAccountId) {
        setSelectedStatementAccountId(accs[0].id);
      }
      if (accs.length > 0) {
        setTxAccountId(accs[0].id);
        setTrfSourceId(accs[0].id);
        if (accs.length > 1) setTrfDestId(accs[1].id);
        setTransitionBankAccountId(accs.find((a) => a.type === 'bank')?.id || accs[0].id);
        setChequeSourceAccountId(accs.find((a) => a.type === 'bank')?.id || accs[0].id);
      }
      if (pers.length > 0) {
        setTxPersonId(pers[0].id);
        setChequePersonId(pers[0].id);
        setTransitionPersonId(pers[0].id);
      }
      if (cats.length > 0) {
        setTxCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error('Failed to load financial treasury data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCash = accounts
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const totalBank = accounts
      .filter((a) => a.type === 'bank')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const totalPos = accounts
      .filter((a) => a.type === 'pos')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const grandTotal = totalCash + totalBank + totalPos;

    const inHandCheques = cheques
      .filter((c) => c.chequeType === 'received' && (c.status === 'registered' || c.status === 'in_process'))
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const depositedCheques = cheques
      .filter((c) => c.chequeType === 'received' && c.status === 'deposited')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const issuedCheques = cheques
      .filter((c) => c.chequeType === 'issued' && (c.status === 'registered' || c.status === 'in_process'))
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    return {
      totalCash,
      totalBank,
      totalPos,
      grandTotal,
      inHandCheques,
      depositedCheques,
      issuedCheques,
    };
  }, [accounts, cheques]);

  // Outstanding Unpaid Invoices for the selected person in Transaction Form
  const personOpenInvoices = useMemo(() => {
    if (!txPersonId) return [];
    return invoices.filter(
      (inv) =>
        inv.personId === txPersonId &&
        inv.status === 'approved' &&
        (inv.remainingAmount || 0) > 0 &&
        (txType === 'receive' ? inv.invoiceType === 'sale' : inv.invoiceType === 'purchase')
    );
  }, [invoices, txPersonId, txType]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((i) => i.id === txInvoiceId);
  }, [invoices, txInvoiceId]);

  // Quick fill settlement
  const handleSelectFullSettlement = (inv: Invoice) => {
    setTxInvoiceId(inv.id);
    setTxAmount(inv.remainingAmount.toString());
    setTxDesc(`تسویه کامل فاکتور شماره ${inv.invoiceNumber}`);
    setTxError('');
  };

  // Statement calculations for selected account
  const currentStatementAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedStatementAccountId) || accounts[0];
  }, [accounts, selectedStatementAccountId]);

  const accountStatementReport = useMemo(() => {
    if (!currentStatementAccount) return null;
    return calculateAccountStatementAndReconciliation(currentStatementAccount, transactions);
  }, [currentStatementAccount, transactions]);

  // Handle Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accTitle.trim()) {
      alert('لطفاً عنوان حساب یا صندوق را وارد نمایید.');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.saveTreasuryAccount({
        id: editingAccountId || undefined,
        title: accTitle.trim(),
        type: accType,
        accountNumber: accNumber.trim(),
        bankName: accBankName.trim(),
        branchName: accBranchName.trim(),
        shebaNumber: accSheba.trim(),
        initialBalance: parseFloat(accInitialBalance) || 0,
        balance: parseFloat(accInitialBalance) || 0,
        isActive: true,
      });

      alert(editingAccountId ? 'حساب با موفقیت ویرایش شد.' : 'حساب/صندوق جدید با موفقیت افتتاح شد.');
      setIsAccountModalOpen(false);
      setEditingAccountId(null);
      setAccTitle('');
      setAccNumber('');
      setAccBranchName('');
      setAccSheba('');
      setAccInitialBalance('0');
      loadData();
    } catch (err: any) {
      alert(`خطا در ثبت حساب: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reconcile All Accounts
  const handleRunReconciliation = async () => {
    try {
      setIsLoading(true);
      const res = await api.reconcileTreasuryAccounts();
      setReconcileReport({ summary: res.summary, isChecked: true });
      loadData();
    } catch (err: any) {
      alert(`خطا در تطبیق مانده حساب‌ها: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Save Transaction with Validations
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');
    const amt = parseFloat(txAmount) || 0;

    if (amt <= 0) {
      setTxError('مبلغ تراکنش باید بزرگتر از صفر باشد.');
      return;
    }

    // 1. Settlement validation if invoice selected
    if (selectedInvoice) {
      const val = validateInvoiceSettlement(selectedInvoice, amt);
      if (!val.isValid) {
        setTxError(val.errorMessage || 'مبلغ پرداختی نامعتبر است.');
        return;
      }
    }

    // 2. Duplicate check
    const dup = checkForDuplicateTransaction(transactions, {
      treasuryAccountId: txAccountId,
      personId: txPersonId,
      invoiceId: txInvoiceId,
      amount: amt,
      trackingNumber: txTrackingNumber,
      date: txDate,
      transactionType: txType,
    });

    if (dup.isDuplicate) {
      setTxError(dup.warning || 'این تراکنش قبلاً ثبت شده است.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.recordTreasuryTransaction({
        transactionType: txType,
        treasuryAccountId: txAccountId,
        sourceAccountId: txType === 'pay' || txType === 'expense' ? txAccountId : undefined,
        destinationAccountId: txType === 'receive' || txType === 'income' ? txAccountId : undefined,
        personId: txType === 'receive' || txType === 'pay' ? txPersonId : undefined,
        invoiceId: txInvoiceId || undefined,
        expenseCategoryId: txType === 'income' || txType === 'expense' ? txCategoryId : undefined,
        amount: amt,
        date: txDate,
        trackingNumber: txTrackingNumber.trim(),
        paymentMethod: txPaymentMethod,
        description:
          txDesc.trim() ||
          (txType === 'receive'
            ? 'دریافت وجه از طرف‌حساب'
            : txType === 'pay'
            ? 'پرداخت وجه به طرف‌حساب'
            : txType === 'income'
            ? 'درآمد متفرقه'
            : 'هزینه جاری'),
      });

      alert('تراکنش مالی با موفقیت ثبت شد و مانده حساب‌ها و دفاتر به‌روزرسانی گردید.');
      setIsTxModalOpen(false);
      setTxAmount('');
      setTxTrackingNumber('');
      setTxDesc('');
      setTxInvoiceId('');
      loadData();
    } catch (err: any) {
      setTxError(err.message || 'خطا در ثبت تراکنش خزانه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Fund Transfer between Accounts
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrfError('');
    const amt = parseFloat(trfAmount) || 0;

    if (amt <= 0) {
      setTrfError('مبلغ انتقال باید بزرگتر از صفر باشد.');
      return;
    }

    if (!trfSourceId || !trfDestId) {
      setTrfError('انتخاب حساب مبدأ و مقصد الزامی است.');
      return;
    }

    if (trfSourceId === trfDestId) {
      setTrfError('حساب مبدأ و مقصد نمی‌توانند یکسان باشند.');
      return;
    }

    const src = accounts.find((a) => a.id === trfSourceId);
    if (src && src.balance < amt) {
      setTrfError(`موجودی حساب مبدأ (${formatCurrency(src.balance)}) کافی نیست.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await api.recordTreasuryTransaction({
        transactionType: 'transfer',
        treasuryAccountId: trfSourceId,
        sourceAccountId: trfSourceId,
        destinationAccountId: trfDestId,
        amount: amt,
        date: trfDate,
        trackingNumber: trfTracking.trim(),
        paymentMethod: 'bank_transfer',
        description: trfDesc.trim() || 'انتقال وجه بین حساب‌ها',
      });

      alert('انتقال وجه با موفقیت انجام شد و سند دوبل حسابداری صادر گردید.');
      setIsTransferModalOpen(false);
      setTrfAmount('');
      setTrfTracking('');
      setTrfDesc('');
      loadData();
    } catch (err: any) {
      setTrfError(err.message || 'خطا در انتقال وجه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) {
      alert('عنوان دسته‌بندی را وارد کنید.');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.saveFinancialCategory({
        title: catTitle.trim(),
        type: catType,
        code: catCode.trim(),
        description: catDesc.trim(),
        isActive: true,
      });

      alert('دسته‌بندی مالی با موفقیت ثبت شد.');
      setIsCategoryModalOpen(false);
      setCatTitle('');
      setCatCode('');
      setCatDesc('');
      loadData();
    } catch (err: any) {
      alert(`خطا در ثبت دسته‌بندی: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Cheque
  const handleSaveCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(chequeAmount) || 0;
    if (!chequeNumber.trim() || amt <= 0) {
      alert('شماره سریال چک و مبلغ معتبر الزامی است.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.saveCheque({
        chequeType,
        chequeNumber: chequeNumber.trim(),
        sayadNumber: sayadNumber.trim(),
        bankName: bankName.trim(),
        branchName: branchName.trim(),
        accountNumber: accountNumber.trim(),
        issueDate,
        dueDate,
        amount: amt,
        personId: chequePersonId,
        sourceAccountId: chequeType === 'issued' ? chequeSourceAccountId : undefined,
        notes: chequeNotes.trim(),
      });

      alert('چک صیادی با موفقیت در کارتابل اسناد ثبت گردید.');
      setIsChequeModalOpen(false);
      setChequeNumber('');
      setSayadNumber('');
      setChequeAmount('');
      setChequeNotes('');
      loadData();
    } catch (err: any) {
      alert(`خطا در ثبت چک: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Transition Modal for a Cheque
  const handleOpenTransitionModal = (cheque: Cheque, targetStatus: ChequeStatus) => {
    setActiveChequeForTransition(cheque);
    setTargetChequeStatus(targetStatus);
    setTransitionError('');
    setTransitionBounceReason('کسری موجودی در حساب صادرکننده');
    setTransitionDesc('');
    setIsChequeTransitionModalOpen(true);
  };

  // Execute Cheque Status Transition
  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChequeForTransition) return;
    setTransitionError('');

    try {
      setIsSubmitting(true);
      await api.transitionChequeStatus(activeChequeForTransition.id, targetChequeStatus, {
        bankAccountId: transitionBankAccountId,
        bankAccountTitle: accounts.find((a) => a.id === transitionBankAccountId)?.title,
        transferredPersonId: transitionPersonId,
        transferredPersonName: persons.find((p) => p.id === transitionPersonId)?.name,
        bounceReason: transitionBounceReason,
        description: transitionDesc,
      });

      alert('وضعیت چک با موفقیت تغییر یافت، سابقه در تاریخچه ثبت شد و اسناد مالی به‌روزرسانی گردیدند.');
      setIsChequeTransitionModalOpen(false);
      setActiveChequeForTransition(null);
      loadData();
    } catch (err: any) {
      setTransitionError(err.message || 'خطا در تغییر وضعیت چک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch =
        (tx.description || '').toLowerCase().includes(txSearchTerm.toLowerCase()) ||
        (tx.personName || '').toLowerCase().includes(txSearchTerm.toLowerCase()) ||
        (tx.trackingNumber || '').includes(txSearchTerm) ||
        (tx.transactionNumber || '').includes(txSearchTerm);
      const matchType = txFilterType === 'all' || tx.transactionType === txFilterType;
      return matchSearch && matchType;
    });
  }, [transactions, txSearchTerm, txFilterType]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      const matchType = chqFilterType === 'all' || c.chequeType === chqFilterType;
      const matchStatus = chqFilterStatus === 'all' || c.status === chqFilterStatus;
      return matchType && matchStatus;
    });
  }, [cheques, chqFilterType, chqFilterStatus]);

  const getStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case 'registered':
      case 'in_process':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-bold">نزد صندوق</span>;
      case 'deposited':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-bold">واگذار شده به بانک</span>;
      case 'collected':
      case 'cleared':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold">وصول شده (پاس شده)</span>;
      case 'transferred':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-xs font-bold">خرج شده / واگذاری</span>;
      case 'bounced':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-xs font-bold">برگشت خورده</span>;
      case 'refunded':
      case 'returned':
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full text-xs font-bold">عودت داده شده</span>;
      case 'cancelled':
        return <span className="bg-gray-100 text-gray-500 line-through border border-gray-300 px-2 py-0.5 rounded-full text-xs font-bold">باطل شده</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800">عملیات مالی، خزانه‌داری و چک‌های صیادی</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
              تسویه‌ها، صندوق‌ها، بانک‌ها و گردش وجوه
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مدیریت یکپارچه دریافت و پرداخت، تسویه کامل/جزئی، انتقال وجه، هزینه‌ها، گردش حساب و چرخه چک‌های صیادی
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setTxType('receive');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            دریافت وجه (تسویه)
          </button>

          <button
            onClick={() => {
              setTxType('pay');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            پرداخت وجه
          </button>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            انتقال وجه بین‌حساب
          </button>

          <button
            onClick={() => setIsChequeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            ثبت چک صیادی
          </button>

          <button
            onClick={handleRunReconciliation}
            title="تطبیق خودکار مانده‌ها با تراکنش‌های واقعی"
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            تطبیق مانده‌ها
          </button>
        </div>
      </div>

      {/* Reconciliation Alert Banner (if audited) */}
      {reconcileReport && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900 font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reconcileReport.summary}</span>
          </div>
          <button onClick={() => setReconcileReport(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">موجودی صندوق‌ها</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base font-black text-slate-800">{formatMoney(metrics.totalCash)}</p>
          <span className="text-[10px] text-slate-400">نقدینگی در دخل و صندوق‌ها</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">موجودی بانک‌ها</span>
            <Building className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-base font-black text-slate-800">{formatMoney(metrics.totalBank)}</p>
          <span className="text-[10px] text-slate-400">حساب‌های جاری و سپرده</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">کارتخوان‌های POS</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-base font-black text-slate-800">{formatMoney(metrics.totalPos)}</p>
          <span className="text-[10px] text-slate-400">دستگاه‌های شاپرک</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">کل نقد و بانک</span>
            <Coins className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-base font-black text-indigo-900">{formatMoney(metrics.grandTotal)}</p>
          <span className="text-[10px] text-emerald-600 font-bold">تطبیق ۱۰۰٪ با دفاتر</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">چک‌های نزد صندوق</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-base font-black text-amber-700">{formatMoney(metrics.inHandCheques)}</p>
          <span className="text-[10px] text-slate-400">در انتظار وصول یا واگذاری</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">چک‌های صادره</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-base font-black text-rose-700">{formatMoney(metrics.issuedCheques)}</p>
          <span className="text-[10px] text-slate-400">اسناد پرداختنی به تأمین‌کننده</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-black">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl transition-colors shrink-0 ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          صندوق‌ها و حساب‌های بانکی ({toPersianDigits(accounts.length)})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl transition-colors shrink-0 ${
            activeTab === 'transactions'
              ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          دفتر دریافت و پرداخت و تسویه‌ها ({toPersianDigits(transactions.length)})
        </button>

        <button
          onClick={() => setActiveTab('turnover')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl transition-colors shrink-0 ${
            activeTab === 'turnover'
              ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          گردش صندوق و بانک و تطبیق مانده
        </button>

        <button
          onClick={() => setActiveTab('cheques')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl transition-colors shrink-0 ${
            activeTab === 'cheques'
              ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          کارتابل چک‌های صیادی ({toPersianDigits(cheques.length)})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl transition-colors shrink-0 ${
            activeTab === 'categories'
              ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          دسته‌بندی‌های هزینه و درآمد ({toPersianDigits(categories.length)})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACCOUNTS & CASH REGISTERS OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800">فهرست صندوق‌ها، حساب‌های بانکی و دستگاه‌های کارتخوان</h3>
            <button
              onClick={() => {
                setEditingAccountId(null);
                setAccTitle('');
                setAccNumber('');
                setAccBranchName('');
                setAccSheba('');
                setAccInitialBalance('0');
                setIsAccountModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              افتتاح حساب / صندوق جدید
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              return (
                <div
                  key={acc.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          acc.type === 'cash'
                            ? 'bg-emerald-100 text-emerald-700'
                            : acc.type === 'pos'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {acc.type === 'cash' ? (
                          <Wallet className="w-6 h-6" />
                        ) : acc.type === 'pos' ? (
                          <CreditCard className="w-6 h-6" />
                        ) : (
                          <Building className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm">{acc.title}</h4>
                        <span className="text-[11px] text-slate-400">
                          {acc.type === 'cash' ? 'صندوق نقدی' : acc.type === 'pos' ? 'دستگاه کارتخوان POS' : acc.bankName || 'حساب بانکی'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        acc.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {acc.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    {acc.accountNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">شماره حساب / کارت:</span>
                        <span className="font-mono text-slate-700">{acc.accountNumber}</span>
                      </div>
                    )}
                    {acc.shebaNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">شماره شبا (IBAN):</span>
                        <span className="font-mono text-slate-700 text-[11px]">{acc.shebaNumber}</span>
                      </div>
                    )}
                    {acc.branchName && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">شعبه:</span>
                        <span className="text-slate-700">{acc.branchName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-100">
                      <span className="font-bold text-slate-500">موجودی فعلی:</span>
                      <span className="text-base font-black text-slate-900">{formatMoney(acc.balance)}</span>
                    </div>
                  </div>

                  {/* Card quick actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <button
                      onClick={() => {
                        setSelectedStatementAccountId(acc.id);
                        setActiveTab('turnover');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      مشاهده گردش حساب
                    </button>
                    <button
                      onClick={() => {
                        setEditingAccountId(acc.id);
                        setAccTitle(acc.title);
                        setAccType(acc.type);
                        setAccNumber(acc.accountNumber || '');
                        setAccBankName(acc.bankName || 'بانک ملی ایران');
                        setAccBranchName(acc.branchName || '');
                        setAccSheba(acc.shebaNumber || '');
                        setAccInitialBalance(acc.initialBalance?.toString() || '0');
                        setIsAccountModalOpen(true);
                      }}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      ویرایش مشخصات
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIPTS, PAYMENTS & SETTLEMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجو در شرح، طرف حساب، شماره پیگیری..."
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={txFilterType}
                onChange={(e) => setTxFilterType(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="all">همه انواع عملیات</option>
                <option value="receive">دریافت وجه (تسویه)</option>
                <option value="pay">پرداخت وجه</option>
                <option value="transfer">انتقال وجه</option>
                <option value="income">درآمد متفرقه</option>
                <option value="expense">هزینه‌های جاری</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTxType('receive');
                  setIsTxModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                دریافت وجه
              </button>
              <button
                onClick={() => {
                  setTxType('pay');
                  setIsTxModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                پرداخت وجه
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">شماره سند</th>
                    <th className="p-3">نوع عملیات</th>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">طرف حساب / ذینفع</th>
                    <th className="p-3">حساب خزانه / صندوق</th>
                    <th className="p-3">فاکتور مرتبط</th>
                    <th className="p-3">شماره پیگیری</th>
                    <th className="p-3">شرح عملیات</th>
                    <th className="p-3 text-left">مبلغ (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        تراکنشی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isPositive = tx.transactionType === 'receive' || tx.transactionType === 'income';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-700">{tx.transactionNumber || tx.id}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                tx.transactionType === 'receive'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : tx.transactionType === 'pay'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : tx.transactionType === 'transfer'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : tx.transactionType === 'income'
                                  ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {tx.transactionType === 'receive'
                                ? 'دریافت وجه'
                                : tx.transactionType === 'pay'
                                ? 'پرداخت وجه'
                                : tx.transactionType === 'transfer'
                                ? 'انتقال وجه'
                                : tx.transactionType === 'income'
                                ? 'درآمد متفرقه'
                                : 'هزینه جاری'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-mono">{toPersianDigits(tx.date)}</td>
                          <td className="p-3 font-bold text-slate-800">{tx.personName || tx.expenseCategoryName || '-'}</td>
                          <td className="p-3 text-slate-700">
                            {tx.transactionType === 'transfer' ? (
                              <span>
                                {tx.sourceAccountTitle} &larr; {tx.destinationAccountTitle}
                              </span>
                            ) : (
                              tx.treasuryAccountTitle
                            )}
                          </td>
                          <td className="p-3 text-slate-600">
                            {tx.invoiceNumber ? (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                                فاکتور {tx.invoiceNumber}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{tx.trackingNumber || '-'}</td>
                          <td className="p-3 text-slate-600 max-w-xs truncate">{tx.description}</td>
                          <td
                            className={`p-3 text-left font-black text-sm font-mono ${
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositive ? '+' : '-'} {formatMoney(tx.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACCOUNT TURNOVER & RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === 'turnover' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">انتخاب حساب یا صندوق:</span>
              <select
                value={selectedStatementAccountId}
                onChange={(e) => setSelectedStatementAccountId(e.target.value)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({formatMoney(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                تطبیق دفاتر: {accountStatementReport?.isReconciled ? 'بدون مغایرت' : 'دارای اختلاف'}
              </span>
              <button
                onClick={handleRunReconciliation}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                تطبیق و بازمحاسبه
              </button>
            </div>
          </div>

          {/* Account Statement Summary Strip */}
          {accountStatementReport && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-400 font-bold">مانده افتتاحیه</span>
                <p className="text-sm font-black text-slate-700 mt-1">{formatMoney(accountStatementReport.initialBalance)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-emerald-600 font-bold">مجموع واریزها (بدهکار)</span>
                <p className="text-sm font-black text-emerald-700 mt-1">+{formatMoney(accountStatementReport.totalInflow)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-rose-600 font-bold">مجموع برداشت‌ها (بستانکار)</span>
                <p className="text-sm font-black text-rose-700 mt-1">-{formatMoney(accountStatementReport.totalOutflow)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-indigo-600 font-bold">مانده محاسباتی دفاتر</span>
                <p className="text-sm font-black text-indigo-800 mt-1">{formatMoney(accountStatementReport.calculatedBalance)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold">مانده ثبت‌شده / مغایرت</span>
                <p className="text-sm font-black text-slate-900 mt-1">
                  {formatMoney(accountStatementReport.recordedBalance)}
                  {accountStatementReport.variance !== 0 && (
                    <span className="text-rose-600 text-xs mr-1">({formatMoney(accountStatementReport.variance)})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Statement Chronological Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">شماره تراکنش</th>
                    <th className="p-3">نوع عملیات</th>
                    <th className="p-3">شرح عملیات و طرف حساب</th>
                    <th className="p-3">شماره پیگیری</th>
                    <th className="p-3 text-emerald-700">وارده / واریز (+)</th>
                    <th className="p-3 text-rose-700">صادره / برداشت (-)</th>
                    <th className="p-3 text-left font-black text-indigo-900">مانده لحظه‌ای (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!accountStatementReport || accountStatementReport.entries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        گردشی برای این حساب ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    accountStatementReport.entries.map((entry) => (
                      <tr key={entry.transactionId} className="hover:bg-slate-50/60">
                        <td className="p-3 font-mono text-slate-600">{toPersianDigits(entry.date)}</td>
                        <td className="p-3 font-mono text-slate-500">{entry.transactionNumber || entry.transactionId}</td>
                        <td className="p-3 font-bold text-slate-700">{entry.typeTitle}</td>
                        <td className="p-3 text-slate-800">
                          {entry.personName ? <span className="font-bold ml-1">{entry.personName}:</span> : null}
                          {entry.description}
                        </td>
                        <td className="p-3 font-mono text-slate-400">{entry.trackingNumber || '-'}</td>
                        <td className="p-3 text-emerald-700 font-bold font-mono">
                          {entry.inflow > 0 ? `+${formatMoney(entry.inflow)}` : '-'}
                        </td>
                        <td className="p-3 text-rose-700 font-bold font-mono">
                          {entry.outflow > 0 ? `-${formatMoney(entry.outflow)}` : '-'}
                        </td>
                        <td className="p-3 text-left font-black text-indigo-900 font-mono text-sm">
                          {formatMoney(entry.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CHEQUES LIFECYCLE MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'cheques' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
                <button
                  onClick={() => setChqFilterType('all')}
                  className={`px-3 py-1.5 ${chqFilterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  همه چک‌ها
                </button>
                <button
                  onClick={() => setChqFilterType('received')}
                  className={`px-3 py-1.5 ${chqFilterType === 'received' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  چک‌های دریافتی
                </button>
                <button
                  onClick={() => setChqFilterType('issued')}
                  className={`px-3 py-1.5 ${chqFilterType === 'issued' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  چک‌های پرداختی
                </button>
              </div>

              <select
                value={chqFilterStatus}
                onChange={(e) => setChqFilterStatus(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="registered">نزد صندوق (ثبت اولیه)</option>
                <option value="deposited">واگذار شده به بانک</option>
                <option value="collected">وصول شده (پاس شده)</option>
                <option value="transferred">خرج شده / واگذاری</option>
                <option value="bounced">برگشت خورده</option>
                <option value="refunded">عودت داده شده</option>
                <option value="cancelled">باطل شده</option>
              </select>
            </div>

            <button
              onClick={() => setIsChequeModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              ثبت چک جدید
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">نوع چک</th>
                    <th className="p-3">شماره سریال چک</th>
                    <th className="p-3">شناسه صیادی (۱۶ رقم)</th>
                    <th className="p-3">بانک و شعبه</th>
                    <th className="p-3">طرف حساب مرتبط</th>
                    <th className="p-3">سررسید</th>
                    <th className="p-3">مبلغ (ریال)</th>
                    <th className="p-3">وضعیت چرخه</th>
                    <th className="p-3 text-center">عملیات چرخه حیات</th>
                    <th className="p-3 text-center">تاریخچه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCheques.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        چکی در این بخش یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredCheques.map((c) => {
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.chequeType === 'received'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {c.chequeType === 'received' ? 'دریافتی' : 'پرداختی'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">{c.chequeNumber}</td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]">{c.sayadNumber || c.sayadId || '-'}</td>
                          <td className="p-3 text-slate-700">
                            {c.bankName} {c.branchName ? `(${c.branchName})` : ''}
                          </td>
                          <td className="p-3 font-bold text-slate-800">{c.personName}</td>
                          <td className="p-3 font-mono text-slate-600">{toPersianDigits(c.dueDate)}</td>
                          <td className="p-3 font-black text-slate-900 font-mono text-sm">{formatMoney(c.amount)}</td>
                          <td className="p-3">{getStatusBadge(c.status)}</td>
                          <td className="p-3 text-center">
                            {/* Contextual Action Buttons depending on cheque state */}
                            <div className="flex items-center justify-center gap-1">
                              {c.chequeType === 'received' && (c.status === 'registered' || c.status === 'in_process') && (
                                <>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'deposited')}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold"
                                    title="واگذاری به بانک جهت وصول"
                                  >
                                    واگذاری به بانک
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'collected')}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold"
                                    title="وصول مستقیم چک"
                                  >
                                    وصول
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'transferred')}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[11px] font-bold"
                                    title="خرج چک و واگذاری به شخص ثالث"
                                  >
                                    خرج چک
                                  </button>
                                </>
                              )}

                              {c.chequeType === 'received' && c.status === 'deposited' && (
                                <>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'collected')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                  >
                                    وصول قطعی
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'bounced')}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-bold"
                                  >
                                    برگشت
                                  </button>
                                </>
                              )}

                              {c.chequeType === 'issued' && (c.status === 'registered' || c.status === 'in_process') && (
                                <>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'collected')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                  >
                                    پاس شدن از بانک
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'bounced')}
                                    className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-bold"
                                  >
                                    برگشت
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransitionModal(c, 'cancelled')}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[11px] font-bold"
                                  >
                                    ابطال لاشه
                                  </button>
                                </>
                              )}

                              {(c.status === 'collected' || c.status === 'cleared') && (
                                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                                  <Check className="w-3.5 h-3.5" /> مختومه
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedChequeForHistory(c);
                                setIsHistoryModalOpen(true);
                              }}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                              title="مشاهده تاریخچه تغییرات وضعیت"
                            >
                              <History className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FINANCIAL CATEGORIES */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800">سرفصل‌ها و دسته‌بندی‌های هزینه و درآمد خرازی</h3>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              تعریف دسته‌بندی جدید
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      cat.type === 'expense' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {cat.type === 'expense' ? 'سرفصل هزینه' : 'سرفصل درآمد'}
                  </span>
                  <span className="font-mono text-xs text-slate-400 font-bold">{cat.code}</span>
                </div>
                <h4 className="font-black text-slate-800 text-sm mt-2">{cat.title}</h4>
                {cat.description && <p className="text-xs text-slate-500 mt-1">{cat.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OPEN / EDIT TREASURY ACCOUNT */}
      {/* ========================================================================= */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">
                {editingAccountId ? 'ویرایش مشخصات حساب / صندوق' : 'افتتاح حساب، صندوق یا کارتخوان جدید'}
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع منبع مالی</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccType('cash')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      accType === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    صندوق نقدی دخل
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccType('bank')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      accType === 'bank' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    حساب بانکی جاری
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccType('pos')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      accType === 'pos' ? 'bg-purple-50 text-purple-700 border-purple-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    دستگاه کارتخوان POS
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان حساب یا صندوق *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صندوق نقدی شماره ۲ انبار، بانک ملت شعبه بازار"
                  value={accTitle}
                  onChange={(e) => setAccTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {accType !== 'cash' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">نام بانک</label>
                      <input
                        type="text"
                        value={accBankName}
                        onChange={(e) => setAccBankName(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">نام شعبه</label>
                      <input
                        type="text"
                        placeholder="مثال: شعبه بازار تهران"
                        value={accBranchName}
                        onChange={(e) => setAccBranchName(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">شماره حساب یا پایانه کارتخوان</label>
                    <input
                      type="text"
                      placeholder="0105421980007"
                      value={accNumber}
                      onChange={(e) => setAccNumber(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">شماره شبا (IBAN)</label>
                    <input
                      type="text"
                      placeholder="IR..."
                      value={accSheba}
                      onChange={(e) => setAccSheba(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">موجودی افتتاحیه / اولیه (ریال)</label>
                <input
                  type="number"
                  min="0"
                  value={accInitialBalance}
                  onChange={(e) => setAccInitialBalance(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال ذخیره...' : 'ذخیره و فعال‌سازی حساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD TRANSACTION (RECEIVE / PAY / INCOME / EXPENSE) */}
      {/* ========================================================================= */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">
                {txType === 'receive'
                  ? 'ثبت دریافت وجه و تسویه حساب طرف‌حساب'
                  : txType === 'pay'
                  ? 'ثبت پرداخت وجه به طرف‌حساب'
                  : txType === 'income'
                  ? 'ثبت درآمد متفرقه'
                  : 'ثبت هزینه جاری فروشگاه'}
              </h3>
              <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {txError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{txError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTransaction} className="space-y-4 mt-4 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('receive');
                    setTxInvoiceId('');
                  }}
                  className={`py-2 rounded-xl font-bold border transition-colors ${
                    txType === 'receive' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  دریافت وجه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('pay');
                    setTxInvoiceId('');
                  }}
                  className={`py-2 rounded-xl font-bold border transition-colors ${
                    txType === 'pay' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  پرداخت وجه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('income');
                    setTxInvoiceId('');
                  }}
                  className={`py-2 rounded-xl font-bold border transition-colors ${
                    txType === 'income' ? 'bg-cyan-50 text-cyan-800 border-cyan-300' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  درآمد متفرقه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('expense');
                    setTxInvoiceId('');
                  }}
                  className={`py-2 rounded-xl font-bold border transition-colors ${
                    txType === 'expense' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  هزینه جاری
                </button>
              </div>

              {/* Person Selector for Receive & Pay */}
              {(txType === 'receive' || txType === 'pay') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طرف حساب *</label>
                  <select
                    value={txPersonId}
                    onChange={(e) => {
                      setTxPersonId(e.target.value);
                      setTxInvoiceId('');
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.personType === 'customer' ? 'مشتری' : 'تأمین‌کننده'}) - مانده دفتری:{' '}
                        {formatMoney(Math.abs(p.currentBalance))} {p.currentBalance > 0 ? '(بدهکار)' : p.currentBalance < 0 ? '(بستانکار)' : '(تسویه)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Open Invoices for Settlement (Full or Partial) */}
              {(txType === 'receive' || txType === 'pay') && personOpenInvoices.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-bold">فاکتورهای تسویه‌نشده دارای مانده بدهی:</span>
                    <span className="text-[11px] text-slate-500">{toPersianDigits(personOpenInvoices.length)} فاکتور</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {personOpenInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                          txInvoiceId === inv.id ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-slate-800">فاکتور {inv.invoiceNumber}</span>
                          <span className="text-slate-400 font-mono mr-2 text-[11px]">({toPersianDigits(inv.date)})</span>
                          <div className="text-[11px] text-slate-500">
                            مبلغ کل: {formatMoney(inv.finalAmount)} | مانده بدهی:{' '}
                            <span className="font-bold text-rose-600">{formatMoney(inv.remainingAmount)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectFullSettlement(inv)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                          >
                            تسویه کامل
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTxInvoiceId(inv.id);
                              setTxDesc(`تسویه جزئی فاکتور شماره ${inv.invoiceNumber}`);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                          >
                            انتخاب
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selector for Income & Expense */}
              {(txType === 'income' || txType === 'expense') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سرفصل دسته‌بندی مالی *</label>
                  <select
                    value={txCategoryId}
                    onChange={(e) => setTxCategoryId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {categories
                      .filter((c) => (txType === 'income' ? c.type === 'income' : c.type === 'expense'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} (کد: {c.code})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Account and Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {txType === 'receive' || txType === 'income' ? 'واریز به حساب / صندوق *' : 'برداشت از حساب / صندوق *'}
                  </label>
                  <select
                    value={txAccountId}
                    onChange={(e) => setTxAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({formatMoney(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">روش پرداخت / دریافت</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    <option value="cash">نقدی (وجه نقد)</option>
                    <option value="pos">کارتخوان بانکی (POS)</option>
                    <option value="bank_transfer">انتقال بانکی (پایا / ساتنا)</option>
                    <option value="cheque">چک صیادی</option>
                  </select>
                </div>
              </div>

              {/* Amount & Date & Tracking */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">مبلغ (ریال) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="مبلغ"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">شماره پیگیری / فیش</label>
                  <input
                    type="text"
                    placeholder="شماره پیگیری"
                    value={txTrackingNumber}
                    onChange={(e) => setTxTrackingNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">تاریخ تراکنش</label>
                  <input
                    type="text"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-center"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">شرح عملیات / بابت</label>
                <input
                  type="text"
                  placeholder="توضیحات و شرح ثبت در دفاتر حسابداری"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی تراکنش'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FUND TRANSFER BETWEEN ACCOUNTS */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">انتقال وجه بین حساب‌ها و صندوق‌ها</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {trfError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{trfError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTransfer} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">از حساب (مبدأ برداشت) *</label>
                  <select
                    value={trfSourceId}
                    onChange={(e) => setTrfSourceId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({formatMoney(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">به حساب (مقصد واریز) *</label>
                  <select
                    value={trfDestId}
                    onChange={(e) => setTrfDestId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({formatMoney(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مبلغ انتقال (ریال) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="مبلغ"
                    value={trfAmount}
                    onChange={(e) => setTrfAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شماره ارجاع / پیگیری</label>
                  <input
                    type="text"
                    placeholder="پیگیری"
                    value={trfTracking}
                    onChange={(e) => setTrfTracking(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">شرح انتقال</label>
                <input
                  type="text"
                  placeholder="مثال: برداشت نقدی از بانک جهت شارژ صندوق دخل فروشگاه"
                  value={trfDesc}
                  onChange={(e) => setTrfDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال انتقال...' : 'انتقال و صدور سند حسابداری'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER CHEQUE */}
      {/* ========================================================================= */}
      {isChequeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">ثبت چک صیادی جدید (دریافتی یا پرداختی)</h3>
              <button onClick={() => setIsChequeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCheque} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع چک</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChequeType('received')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      chequeType === 'received' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    چک دریافتی از مشتری
                  </button>
                  <button
                    type="button"
                    onClick={() => setChequeType('issued')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      chequeType === 'issued' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    چک پرداختی به تأمین‌کننده
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">شماره سریال چک *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 784512"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شناسه صیادی (۱۶ رقم)</label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="2105874512963341"
                    value={sayadNumber}
                    onChange={(e) => setSayadNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">بانک صادرکننده *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شعبه</label>
                  <input
                    type="text"
                    placeholder="مثال: شعبه بازار"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طرف حساب مرتبط *</label>
                  <select
                    value={chequePersonId}
                    onChange={(e) => setChequePersonId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">مبلغ چک (ریال) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="مبلغ چک"
                    value={chequeAmount}
                    onChange={(e) => setChequeAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاریخ صدور</label>
                  <input
                    type="text"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاریخ سررسید *</label>
                  <input
                    type="text"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-center"
                  />
                </div>
              </div>

              {chequeType === 'issued' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حساب بانکی صادرکننده چک *</label>
                  <select
                    value={chequeSourceAccountId}
                    onChange={(e) => setChequeSourceAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {accounts
                      .filter((a) => a.type === 'bank')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({formatMoney(a.balance)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">یادداشت / بابت</label>
                <input
                  type="text"
                  placeholder="بابت تسویه فاکتور خرید یا فروش"
                  value={chequeNotes}
                  onChange={(e) => setChequeNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChequeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت چک در کارتابل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHEQUE STATUS TRANSITION (وصول، واگذاری، انتقال، برگشت، ابطال) */}
      {/* ========================================================================= */}
      {isChequeTransitionModalOpen && activeChequeForTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">
                عملیات چرخه چک: {targetChequeStatus === 'deposited'
                  ? 'واگذاری به بانک (خواباندن به حساب)'
                  : targetChequeStatus === 'collected'
                  ? 'وصول چک و واریز به حساب'
                  : targetChequeStatus === 'transferred'
                  ? 'خرج و واگذاری چک به شخص ثالث'
                  : targetChequeStatus === 'bounced'
                  ? 'برگشت زدن چک'
                  : 'ابطال چک'}
              </h3>
              <button onClick={() => setIsChequeTransitionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">شماره چک:</span>
                <span className="font-mono font-bold text-slate-800">{activeChequeForTransition.chequeNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">مبلغ چک:</span>
                <span className="font-mono font-bold text-indigo-700">{formatMoney(activeChequeForTransition.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طرف حساب:</span>
                <span className="font-bold text-slate-800">{activeChequeForTransition.personName}</span>
              </div>
            </div>

            {transitionError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{transitionError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransition} className="space-y-4 mt-4 text-xs">
              {/* Account Selector for Deposited and Collected */}
              {(targetChequeStatus === 'deposited' || targetChequeStatus === 'collected') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حساب بانکی مقصد واریز وجه *</label>
                  <select
                    value={transitionBankAccountId}
                    onChange={(e) => setTransitionBankAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {accounts
                      .filter((a) => a.type === 'bank')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({formatMoney(a.balance)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Person Selector for Transferred (Endorsed) */}
              {targetChequeStatus === 'transferred' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طرف حساب دریافت‌کننده چک (تأمین‌کننده) *</label>
                  <select
                    value={transitionPersonId}
                    onChange={(e) => setTransitionPersonId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {persons
                      .filter((p) => p.personType === 'supplier' || p.currentBalance < 0)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - بستانکاری: {formatMoney(Math.abs(p.currentBalance))}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Bounce Reason */}
              {targetChequeStatus === 'bounced' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">علت برگشت خوردن چک *</label>
                  <select
                    value={transitionBounceReason}
                    onChange={(e) => setTransitionBounceReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    <option value="کسری موجودی در حساب صادرکننده">کسری موجودی در حساب صادرکننده</option>
                    <option value="عدم تطابق امضا با نمونه امضای بانک">عدم تطابق امضا با نمونه امضای بانک</option>
                    <option value="قلم‌خوردگی یا اختلاف در ارقام و حروف">قلم‌خوردگی یا اختلاف در ارقام و حروف</option>
                    <option value="مسدودی حساب صادرکننده">مسدودی حساب صادرکننده</option>
                    <option value="عدم ثبت در سامانه پیچک/صیاد">عدم ثبت در سامانه پیچک/صیاد</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات و شرح در تاریخچه</label>
                <input
                  type="text"
                  placeholder="شرح عملیات تغییر وضعیت"
                  value={transitionDesc}
                  onChange={(e) => setTransitionDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChequeTransitionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال اعمال...' : 'تأیید و اعمال تغییر وضعیت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHEQUE AUDIT TRAIL TIMELINE (تاریخچه تغییر وضعیت چک) */}
      {/* ========================================================================= */}
      {isHistoryModalOpen && selectedChequeForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-sm">
                  تاریخچه تغییر وضعیت چک شماره {selectedChequeForHistory.chequeNumber}
                </h3>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {(!selectedChequeForHistory.statusHistory || selectedChequeForHistory.statusHistory.length === 0) ? (
                <p className="text-slate-400 text-center py-6">سابقه‌ای برای این چک یافت نشد.</p>
              ) : (
                <div className="relative border-r-2 border-indigo-200 mr-3 pr-4 space-y-5">
                  {selectedChequeForHistory.statusHistory.map((item, index) => (
                    <div key={item.id || index} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -right-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-4 ring-white" />

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-indigo-950 text-xs">{item.actionTitle}</span>
                          <span className="text-[11px] font-mono text-slate-400">{item.date}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{item.description}</p>
                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span>ثبت‌کننده: {item.performedBy}</span>
                          {item.relatedAccountTitle && (
                            <span className="text-indigo-600 font-bold">حساب: {item.relatedAccountTitle}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 text-left">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW FINANCIAL CATEGORY */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-sm">تعریف دسته‌بندی جدید هزینه / درآمد</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع سرفصل</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCatType('expense')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      catType === 'expense' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    هزینه‌های جاری
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatType('income')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      catType === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    درآمدهای متفرقه
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان سرفصل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: هزینه نگهداری دکور، درآمد بازیافت کارتن"
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">کد سرفصل حسابداری</label>
                <input
                  type="text"
                  placeholder="مثال: 608"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات</label>
                <input
                  type="text"
                  placeholder="شرح موارد مصرف این سرفصل"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت سرفصل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
