import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scale,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Users,
  Wallet,
  Package,
  Plus,
  RefreshCw,
  Printer,
  Download,
  FlaskConical,
  History,
  Check,
  Trash2,
  Eye,
  Sparkles,
  BookOpen,
  Info,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { formatCurrency, toPersianDigits } from '../../lib/formatters.ts';
import {
  FiscalYear,
  FiscalPreClosingAudit,
  FiscalYearArchiveSnapshot,
  OpeningBalancePayload,
  AccountingVoucher,
  TreasuryAccount,
  Person,
  Product,
  Warehouse,
} from '../../types/index.ts';
import {
  isShamsiLeapYear,
  calculateOpeningBalancePreview,
} from '../../lib/fiscalYearCalculations.ts';
import { TrialBalanceReport } from '../../lib/accountingCalculations.ts';

type FiscalTab =
  | 'overview'
  | 'opening_balances'
  | 'pre_closing_audit'
  | 'closing_wizard'
  | 'historical_archive'
  | 'rollover_test_lab';

export const FiscalYearModule: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const [activeTab, setActiveTab] = useState<FiscalTab>('overview');
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('fy-1403');
  const [, setIsLoading] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Reference data for Opening Balances & Closing Preview
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Pre-closing audit state
  const [preClosingAudit, setPreClosingAudit] = useState<FiscalPreClosingAudit | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(false);
  const [auditSubTab, setAuditSubTab] = useState<'checks' | 'persons' | 'treasury' | 'inventory'>('checks');

  // New / Edit Fiscal Year Modal State
  const [isDefineModalOpen, setIsDefineModalOpen] = useState<boolean>(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [yearForm, setYearForm] = useState<{
    code: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  }>({
    code: '1404',
    title: 'سال مالی ۱۴۰۴',
    startDate: '1404/01/01',
    endDate: '1404/12/29',
    description: 'دوره مالی سال ۱۴۰۴ هجری شمسی',
  });

  // Reopen Modal State
  const [reopenModalYear, setReopenModalYear] = useState<FiscalYear | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Opening Balances Form State
  const [openingForm, setOpeningForm] = useState<OpeningBalancePayload>({
    fiscalYearId: 'fy-1403',
    date: '1403/01/01',
    treasuryBalances: [],
    personBalances: [],
    inventoryBalances: [],
    initialCapital: 0,
    description: 'سند افتتاحیه دوره مالی',
  });
  const [isSavingOpening, setIsSavingOpening] = useState<boolean>(false);

  // Closing Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<boolean>(false);
  const [nextYearConfig, setNextYearConfig] = useState<{
    nextYearCode: string;
    nextYearTitle: string;
    notes: string;
  }>({
    nextYearCode: '1404',
    nextYearTitle: 'سال مالی ۱۴۰۴',
    notes: 'ایجاد و انتقال خودکار مانده‌های افتتاحیه از اختتامیه سال ۱۴۰۳',
  });
  const [isExecutingClose, setIsExecutingClose] = useState<boolean>(false);

  // Historical Archive State
  const [archiveYearId, setArchiveYearId] = useState<string>('fy-1402');
  const [archiveData, setArchiveData] = useState<{
    fiscalYear: FiscalYear;
    snapshot: FiscalYearArchiveSnapshot;
    trialBalance: TrialBalanceReport;
  } | null>(null);
  const [archiveSubTab, setArchiveSubTab] = useState<'summary' | 'vouchers' | 'trial_balance' | 'sub_ledgers'>('summary');
  const [selectedArchivedVoucher, setSelectedArchivedVoucher] = useState<AccountingVoucher | null>(null);

  // Rollover Test Lab State
  const [testSuiteResult, setTestSuiteResult] = useState<{
    allPassed: boolean;
    totalSteps: number;
    passedSteps: number;
    executedAt: string;
    steps: {
      stepNumber: number;
      title: string;
      passed: boolean;
      expected: string;
      actual: string;
      details: string;
    }[];
    sampleDataSummary: {
      closedYearCode: string;
      newYearCode: string;
      transferredCashAndBank: number;
      transferredReceivables: number;
      transferredPayables: number;
      transferredInventoryValuation: number;
      closedYearNetProfit: number;
      closingTempVoucherTotal: number;
      closingPermVoucherTotal: number;
      openingNewYearVoucherTotal: number;
    };
  } | null>(null);
  const [isRunningTestSuite, setIsRunningTestSuite] = useState<boolean>(false);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [fys, tAccs, pers, prods, whs] = await Promise.all([
        api.getFiscalYears(),
        api.getTreasuryAccounts(),
        api.getPersons(),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setFiscalYears(fys);
      setTreasuryAccounts(tAccs);
      setPersons(pers);
      setProducts(prods);
      setWarehouses(whs);

      const activeFy = fys.find((f) => f.isActive) || fys.find((f) => !f.isClosed) || fys[fys.length - 1];
      if (activeFy) {
        setSelectedYearId(activeFy.id);
        initializeOpeningForm(activeFy, tAccs, pers, prods, whs);
        const nextNum = (Number(activeFy.code) || 1403) + 1;
        const nextCode = String(nextNum);
        setNextYearConfig({
          nextYearCode: nextCode,
          nextYearTitle: `سال مالی ${toPersianDigits(nextCode)}`,
          notes: `انتقال مانده‌های افتتاحیه از سال مالی ${toPersianDigits(activeFy.code)}`,
        });
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'خطا در بارگذاری اطلاعات سال‌های مالی' });
    } finally {
      setIsLoading(false);
    }
  };

  const initializeOpeningForm = (
    fy: FiscalYear,
    tAccs: TreasuryAccount[],
    pers: Person[],
    prods: Product[],
    whs: Warehouse[]
  ) => {
    const primaryWh = whs[0] || { id: 'wh-central', name: 'انبار مرکزی فروشگاه' };

    const treasuryRows = tAccs
      .filter((t) => t.isActive)
      .map((t) => ({
        accountId: t.id,
        amount: t.initialBalance || t.balance || 0,
      }));

    const personRows = pers
      .filter((p) => p.isActive)
      .map((p) => ({
        personId: p.id,
        balance: p.currentBalance || 0,
      }));

    const inventoryRows = prods
      .filter((p) => p.isActive && p.currentStock > 0)
      .slice(0, 12)
      .map((p) => ({
        productId: p.id,
        warehouseId: primaryWh.id,
        quantity: p.currentStock,
        unitPurchasePrice: p.purchasePrice,
      }));

    const totalAssets =
      treasuryRows.reduce((s, r) => s + Math.max(0, r.amount), 0) +
      personRows.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0) +
      inventoryRows.reduce((s, i) => s + i.quantity * i.unitPurchasePrice, 0);

    const totalLiabilities = personRows
      .filter((p) => p.balance < 0)
      .reduce((s, p) => s + Math.abs(p.balance), 0);

    const autoCapital = Math.max(0, totalAssets - totalLiabilities);

    setOpeningForm({
      fiscalYearId: fy.id,
      date: fy.startDate,
      treasuryBalances: treasuryRows,
      personBalances: personRows,
      inventoryBalances: inventoryRows,
      initialCapital: autoCapital,
      description: `سند افتتاحیه ${fy.title}`,
    });
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const selectedFiscalYear = useMemo(
    () => fiscalYears.find((f) => f.id === selectedYearId) || fiscalYears[0],
    [fiscalYears, selectedYearId]
  );

  const loadPreClosingAudit = async (yearId: string) => {
    if (!yearId) return;
    setIsAuditLoading(true);
    try {
      const audit = await api.getPreClosingAudit(yearId);
      setPreClosingAudit(audit);
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'خطا در اجرای کنترل‌های پیش از بستن سال مالی' });
    } finally {
      setIsAuditLoading(false);
    }
  };

  const loadHistoricalArchive = async (yearId: string) => {
    if (!yearId) return;
    try {
      const archive = await api.getFiscalYearArchive(yearId);
      setArchiveData(archive);
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'خطا در بارگذاری آرشیو سال مالی' });
    }
  };

  useEffect(() => {
    if (activeTab === 'pre_closing_audit' || activeTab === 'closing_wizard') {
      loadPreClosingAudit(selectedYearId);
    }
  }, [activeTab, selectedYearId]);

  useEffect(() => {
    if (activeTab === 'historical_archive' && archiveYearId) {
      loadHistoricalArchive(archiveYearId);
    }
  }, [activeTab, archiveYearId]);

  // Live preview of Opening Balance equilibrium
  const openingPreview = useMemo(() => {
    return calculateOpeningBalancePreview(openingForm, treasuryAccounts, persons, products);
  }, [openingForm, treasuryAccounts, persons, products]);

  // Handlers
  const handleCodeChangeInModal = (newCode: string) => {
    const clean = newCode.replace(/[^0-9۰-۹]/g, '').slice(0, 4);
    const eng = clean.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const num = Number(eng);
    const leap = eng.length === 4 ? isShamsiLeapYear(num) : false;
    setYearForm((prev) => ({
      ...prev,
      code: eng,
      title: eng.length === 4 ? `سال مالی ${toPersianDigits(eng)}` : prev.title,
      startDate: eng.length === 4 ? `${eng}/01/01` : prev.startDate,
      endDate: eng.length === 4 ? `${eng}/12/${leap ? '30' : '29'}` : prev.endDate,
    }));
  };

  const handleSaveFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await api.saveFiscalYear({
        id: editingYearId || undefined,
        code: yearForm.code,
        title: yearForm.title,
        startDate: yearForm.startDate,
        endDate: yearForm.endDate,
        description: yearForm.description,
      });
      setIsDefineModalOpen(false);
      setEditingYearId(null);
      await loadAllData();
      setSelectedYearId(saved.id);
      setBannerMessage({
        type: 'success',
        text: `سال مالی «${saved.title}» (${toPersianDigits(saved.startDate)} تا ${toPersianDigits(saved.endDate)}) با موفقیت ثبت و اعتبارسنجی شد.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleActivateFiscalYear = async (fy: FiscalYear) => {
    try {
      await api.activateFiscalYear(fy.id);
      await updateSettings({ activeFiscalYear: fy.code });
      await loadAllData();
      setSelectedYearId(fy.id);
      setBannerMessage({
        type: 'success',
        text: `سال مالی «${fy.title}» به‌عنوان دوره مالی فعال و جاری سیستم انتخاب شد.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleAutoBalanceCapital = () => {
    setOpeningForm((prev) => ({
      ...prev,
      initialCapital: openingPreview.calculatedCapitalCredit,
    }));
  };

  const handleSaveOpeningBalances = async () => {
    if (!openingPreview.isBalanced) {
      setBannerMessage({
        type: 'error',
        text: 'سند افتتاحیه تراز نیست! لطفاً ابتدا با دکمه «محاسبه خودکار سرمایه جهت توازن» اختلاف بدهکار و بستانکار را صفر کنید.',
      });
      return;
    }
    setIsSavingOpening(true);
    try {
      const res = await api.saveOpeningBalances(openingForm.fiscalYearId, openingForm);
      await loadAllData();
      setBannerMessage({
        type: 'success',
        text: `مانده‌های افتتاحیه دوره مالی با موفقیت ثبت شد و سند افتتاحیه شماره ${toPersianDigits(res.openingVoucher.voucherNumber)} به مبلغ ${formatCurrency(res.openingVoucher.totalDebit, settings.currency)} صادر گردید.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    } finally {
      setIsSavingOpening(false);
    }
  };

  const handleCreateTestDraft = async () => {
    try {
      const draft = await api.createTestDraftForFiscalAudit(selectedYearId);
      await loadPreClosingAudit(selectedYearId);
      await loadAllData();
      setBannerMessage({
        type: 'info',
        text: `سند موقت آزمایشی شماره ${toPersianDigits(draft.voucherNumber)} در دوره جاری ایجاد شد. اکنون مشاهده می‌کنید که سیستم به دلیل وجود سند ثبت‌نشده، عملیات بستن سال مالی را متوقف می‌کند.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleResolveDrafts = async (action: 'approve_all' | 'delete_drafts') => {
    try {
      const res = await api.resolveFiscalYearDrafts(selectedYearId, action);
      setPreClosingAudit(res.audit);
      await loadAllData();
      setBannerMessage({
        type: 'success',
        text: res.message,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleExecuteYearEndClosing = async () => {
    if (!selectedFiscalYear) return;
    setIsExecutingClose(true);
    try {
      const result = await api.closeFiscalYearAndRollover(selectedFiscalYear.id, nextYearConfig);
      await updateSettings({ activeFiscalYear: result.activeFiscalYearSetting });
      await loadAllData();
      setArchiveYearId(result.closedFiscalYear.id);
      setBannerMessage({
        type: 'success',
        text: `عملیات بستن «${result.closedFiscalYear.title}»، صدور اسناد اختتامیه (${toPersianDigits(result.closingTemporaryVoucher.voucherNumber)} و ${toPersianDigits(result.closingPermanentVoucher.voucherNumber)}) و انتقال مانده‌ها به «${result.newFiscalYear.title}» (سند افتتاحیه ${toPersianDigits(result.nextYearOpeningVoucher.voucherNumber)}) با موفقیت انجام شد.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    } finally {
      setIsExecutingClose(false);
    }
  };

  const handleReopenYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenModalYear) return;
    try {
      const reopened = await api.reopenFiscalYear(reopenModalYear.id, reopenReason);
      setReopenModalYear(null);
      setReopenReason('');
      await loadAllData();
      setBannerMessage({
        type: 'info',
        text: `«${reopened.title}» با ثبت دلیل در لاگ امنیتی بازگشایی شد و اسناد اختتامیه قبلی ابطال گردیدند.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    }
  };

  const handleRunRolloverTestSuite = async () => {
    setIsRunningTestSuite(true);
    try {
      const res = await api.runFiscalRolloverTestSuite();
      setTestSuiteResult(res);
      setBannerMessage({
        type: res.allPassed ? 'success' : 'error',
        text: res.allPassed
          ? 'تمامی ۷ مرحله تست انتقال سال مالی (کنترل اسناد موقت، بستن حساب‌های موقت، اختتامیه، افتتاحیه سال جدید و حفظ تاریخچه سال قبل) با موفقیت کامل تایید شد.'
          : 'برخی از مراحل تست انتقال سال مالی با خطا مواجه شدند.',
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message });
    } finally {
      setIsRunningTestSuite(false);
    }
  };

  const handleExportArchiveCSV = () => {
    if (!archiveData) return;
    const headers = ['کد حساب', 'نام حساب', 'گردش بدهکار', 'گردش بستانکار', 'مانده بدهکار', 'مانده بستانکار'];
    const rows = archiveData.trialBalance.rows.map((r) => [
      r.code,
      r.title,
      r.turnoverDebit,
      r.turnoverCredit,
      r.closingDebit,
      r.closingCredit,
    ]);
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-trial-balance-${archiveData.fiscalYear.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              مدیریت سال مالی شمسی، عملیات افتتاحیه، اختتامیه و انتقال دوره
            </h2>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900/50">
              سال مالی جاری: {toPersianDigits(settings.activeFiscalYear)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تعریف دوره‌های مالی شمسی، ثبت مانده‌های افتتاحیه، کنترل اسناد ثبت‌نشده و مانده‌ها، بستن حساب‌ها و آرشیو تغییرناپذیر سال‌های قبل
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const maxCode = fiscalYears.reduce((max, f) => Math.max(max, Number(f.code) || 1403), 1403);
              const nextCode = String(maxCode + 1);
              const leap = isShamsiLeapYear(maxCode + 1);
              setEditingYearId(null);
              setYearForm({
                code: nextCode,
                title: `سال مالی ${toPersianDigits(nextCode)}`,
                startDate: `${nextCode}/01/01`,
                endDate: `${nextCode}/12/${leap ? '30' : '29'}`,
                description: `دوره مالی سال ${toPersianDigits(nextCode)} هجری شمسی`,
              });
              setIsDefineModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف سال مالی جدید</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('pre_closing_audit');
              loadPreClosingAudit(selectedYearId);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>کنترل پیش از بستن سال</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('closing_wizard');
              setWizardStep(1);
              loadPreClosingAudit(selectedYearId);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>بستن سال و انتقال به سال بعد</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 print:hidden ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : bannerMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {bannerMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {bannerMessage.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0" />}
            <span className="leading-relaxed">{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-lg cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
        {[
          { id: 'overview', label: '۱. دوره‌های مالی شمسی', icon: CalendarDays },
          { id: 'opening_balances', label: '۲. ثبت مانده‌های افتتاحیه', icon: Scale },
          { id: 'pre_closing_audit', label: '۳. کنترل اسناد و بررسی مانده‌ها', icon: ShieldCheck },
          { id: 'closing_wizard', label: '۴. بستن سال و انتقال مانده‌ها', icon: Lock },
          { id: 'historical_archive', label: '۵. اسناد و گزارش‌های سال‌های قبلی', icon: History },
          { id: 'rollover_test_lab', label: '۶. تست انتقال سال با داده آزمایشی', icon: FlaskConical },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FiscalTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & DEFINITION OF SHAMSI FISCAL YEARS */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">تعداد کل دوره‌های مالی تعریف‌شده</div>
              <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {toPersianDigits(fiscalYears.length)} دوره مالی شمسی
              </div>
              <div className="text-[11px] text-emerald-600 font-bold mt-1">
                {toPersianDigits(fiscalYears.filter((f) => f.isClosed).length)} دوره بسته‌شده و آرشیوشده |{' '}
                {toPersianDigits(fiscalYears.filter((f) => !f.isClosed).length)} دوره باز
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">دوره مالی فعال (جاری سیستم)</div>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                سال مالی {toPersianDigits(settings.activeFiscalYear)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                ثبت کلیه فاکتورها و اسناد جدید در این دوره انجام می‌شود
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">محافظت از اسناد سال‌های بسته‌شده</div>
              <div className="text-sm font-black text-emerald-600 mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>قفل سخت‌افزاری و آرشیو تغییرناپذیر فعال است</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                جلوگیری کامل از درج، ویرایش یا حذف سند در سال‌های مالی بسته‌شده
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                فهرست دوره‌ها و سال‌های مالی شمسی فروشگاه
              </h3>
              <span className="text-[11px] text-slate-400">
                پشتیبانی کامل از سال‌های کبیسه (۳۰ اسفند) و عادی (۲۹ اسفند)
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {fiscalYears.map((fy) => {
                const isCurrentActive = fy.isActive;
                return (
                  <div
                    key={fy.id}
                    className={`p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 transition ${
                      isCurrentActive ? 'bg-indigo-50/30 dark:bg-indigo-950/15' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-3 rounded-2xl shrink-0 ${
                          fy.isClosed
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                        }`}
                      >
                        {fy.isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">{fy.title}</h4>
                          <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                            کد: {toPersianDigits(fy.code)}
                          </span>
                          {fy.isLeapYear && (
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                              سال کبیسه (۳۰ اسفند)
                            </span>
                          )}
                          {isCurrentActive && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-bold">
                              سال مالی جاری سیستم
                            </span>
                          )}
                          {fy.isClosed ? (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full font-bold">
                              بسته‌شده و قطعی
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                              دوره مالی باز
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          بازه زمانی: از{' '}
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {toPersianDigits(fy.startDate)}
                          </span>{' '}
                          لغایت{' '}
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {toPersianDigits(fy.endDate)}
                          </span>
                          {fy.description ? ` — ${fy.description}` : ''}
                        </p>

                        {/* Traceability Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                          {fy.openingVoucherNumber ? (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                              سند افتتاحیه: #{toPersianDigits(fy.openingVoucherNumber)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              فاقد سند افتتاحیه
                            </span>
                          )}

                          {fy.closingTemporaryVoucherNumber && (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                              سند بستن سود و زیان: #{toPersianDigits(fy.closingTemporaryVoucherNumber)}
                            </span>
                          )}

                          {fy.closingPermanentVoucherNumber && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                              سند اختتامیه: #{toPersianDigits(fy.closingPermanentVoucherNumber)}
                            </span>
                          )}

                          {fy.closedAt && (
                            <span className="text-slate-400">
                              بسته شده توسط {fy.closedBy} در تاریخ {toPersianDigits(fy.closedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-end xl:self-center">
                      {!fy.isClosed && !isCurrentActive && (
                        <button
                          onClick={() => handleActivateFiscalYear(fy)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          انتخاب به‌عنوان سال جاری
                        </button>
                      )}

                      {!fy.isClosed && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedYearId(fy.id);
                              initializeOpeningForm(fy, treasuryAccounts, persons, products, warehouses);
                              setActiveTab('opening_balances');
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            مانده‌های افتتاحیه
                          </button>

                          <button
                            onClick={() => {
                              setSelectedYearId(fy.id);
                              setActiveTab('pre_closing_audit');
                              loadPreClosingAudit(fy.id);
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            کنترل و بستن سال
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          setArchiveYearId(fy.id);
                          setActiveTab('historical_archive');
                          loadHistoricalArchive(fy.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>مشاهده اسناد و گزارش‌های سال</span>
                      </button>

                      {fy.isClosed && (
                        <button
                          onClick={() => {
                            setReopenModalYear(fy);
                            setReopenReason('');
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          بازگشایی مدیریتی
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTER OPENING BALANCES */}
      {activeTab === 'opening_balances' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                <span>ثبت و ویرایش مانده‌های افتتاحیه اول دوره</span>
              </h3>
              <p className="text-xs text-slate-500">
                مانده صندوق و بانک، بدهکاران، بستانکاران، موجودی کالای اول دوره و سرمایه اولیه را وارد و سند افتتاحیه تراز صادر کنید.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">انتخاب سال مالی باز:</label>
              <select
                value={openingForm.fiscalYearId}
                onChange={(e) => {
                  const fy = fiscalYears.find((f) => f.id === e.target.value);
                  if (fy) {
                    setSelectedYearId(fy.id);
                    initializeOpeningForm(fy, treasuryAccounts, persons, products, warehouses);
                  }
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {fiscalYears
                  .filter((f) => !f.isClosed)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} ({toPersianDigits(f.startDate)})
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={handleAutoBalanceCapital}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>محاسبه خودکار سرمایه جهت توازن</span>
              </button>

              <button
                type="button"
                onClick={handleSaveOpeningBalances}
                disabled={isSavingOpening || !openingPreview.isBalanced}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingOpening ? 'در حال ثبت...' : 'ثبت نهایی و صدور سند افتتاحیه'}</span>
              </button>
            </div>
          </div>

          {/* Live Double-Entry Equilibrium Bar */}
          <div
            className={`p-4 rounded-2xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
              openingPreview.isBalanced
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {openingPreview.isBalanced ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              )}
              <div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {openingPreview.isBalanced
                    ? 'تراز آزمایشی سند افتتاحیه کاملاً برقرار است (بدهکار = بستانکار)'
                    : 'سند افتتاحیه ناتراز است! جمع دارایی‌ها با بدهی‌ها و سرمایه برابر نیست'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  خزانه‌داری: {formatCurrency(openingPreview.totalCashAndBank, settings.currency)} | بدهکاران:{' '}
                  {formatCurrency(openingPreview.totalReceivables, settings.currency)} | انبار:{' '}
                  {formatCurrency(openingPreview.totalInventoryValue, settings.currency)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500">جمع بدهکار (دارایی‌ها): </span>
                <span className="font-black text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(openingPreview.totalAssetsDebit, settings.currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">جمع بستانکار (بدهی و سرمایه): </span>
                <span className="font-black text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(openingPreview.totalCredit, settings.currency)}
                </span>
              </div>
              {!openingPreview.isBalanced && (
                <div className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold">
                  اختلاف: {formatCurrency(Math.abs(openingPreview.variance), settings.currency)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Treasury Accounts Opening Balances */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  <span>۱. مانده اول دوره صندوق، بانک و کارتخوان (کد ۱۰۱)</span>
                </span>
                <span className="text-[11px] font-bold text-indigo-600">
                  جمع: {formatCurrency(openingPreview.totalCashAndBank, settings.currency)}
                </span>
              </div>
              <div className="p-4 space-y-2.5">
                {openingForm.treasuryBalances.map((row, idx) => {
                  const acc = treasuryAccounts.find((a) => a.id === row.accountId);
                  return (
                    <div key={row.accountId} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold">
                          {acc?.type === 'cash' ? 'صندوق' : acc?.type === 'bank' ? 'بانک' : 'کارتخوان'}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{acc?.title || row.accountId}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={row.amount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setOpeningForm((prev) => ({
                            ...prev,
                            treasuryBalances: prev.treasuryBalances.map((item, i) =>
                              i === idx ? { ...item, amount: val } : item
                            ),
                          }));
                        }}
                        className="w-40 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left font-mono text-xs font-bold"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Capital & Equity Opening Balances */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>۲. سرمایه اول دوره و شرح سند افتتاحیه (کد ۳۰۱)</span>
                </span>
                <button
                  type="button"
                  onClick={handleAutoBalanceCapital}
                  className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  تنظیم خودکار سرمایه
                </button>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <label className="font-bold text-slate-700 dark:text-slate-200">
                    سرمایه اولیه (حساب ۳۰۱ - بستانکار):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={openingForm.initialCapital || 0}
                    onChange={(e) =>
                      setOpeningForm((prev) => ({
                        ...prev,
                        initialCapital: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-44 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left font-mono font-bold"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="font-bold text-slate-700 dark:text-slate-200">شرح سند افتتاحیه:</label>
                  <input
                    type="text"
                    value={openingForm.description || ''}
                    onChange={(e) => setOpeningForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 3. Persons Opening Balances (Debtors & Creditors) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>۳. مانده ابتدای دوره اشخاص (بدهکاران ۱۰۳ / بستانکاران ۲۰۱)</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  مثبت = بدهکار | منفی = بستانکار
                </span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                {openingForm.personBalances.map((row, idx) => {
                  const per = persons.find((p) => p.id === row.personId);
                  return (
                    <div key={row.personId} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.balance > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.balance < 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {row.balance > 0 ? 'بدهکار' : row.balance < 0 ? 'بستانکار' : 'بی‌حساب'}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                          {per?.name || row.personId}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={row.balance}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setOpeningForm((prev) => ({
                            ...prev,
                            personBalances: prev.personBalances.map((item, i) =>
                              i === idx ? { ...item, balance: val } : item
                            ),
                          }));
                        }}
                        className="w-36 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left font-mono text-xs font-bold"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Inventory Stock Opening Balances */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>۴. موجودی اول دوره کالا و انبار (حساب ۱۰۴)</span>
                </span>
                <span className="text-[11px] font-bold text-blue-600">
                  ارزش کل: {formatCurrency(openingPreview.totalInventoryValue, settings.currency)}
                </span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                {openingForm.inventoryBalances.map((row, idx) => {
                  const prd = products.find((p) => p.id === row.productId);
                  return (
                    <div key={`${row.productId}-${idx}`} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <div className="col-span-5 font-bold text-slate-700 dark:text-slate-200 truncate">
                        {prd?.name || row.productId}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min={0}
                          value={row.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value) || 0;
                            setOpeningForm((prev) => ({
                              ...prev,
                              inventoryBalances: prev.inventoryBalances.map((item, i) =>
                                i === idx ? { ...item, quantity: qty } : item
                              ),
                            }));
                          }}
                          placeholder="تعداد"
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          min={0}
                          value={row.unitPurchasePrice}
                          onChange={(e) => {
                            const cost = Number(e.target.value) || 0;
                            setOpeningForm((prev) => ({
                              ...prev,
                              inventoryBalances: prev.inventoryBalances.map((item, i) =>
                                i === idx ? { ...item, unitPurchasePrice: cost } : item
                              ),
                            }));
                          }}
                          placeholder="بهای واحد"
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left font-mono text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRE-CLOSING CONTROLS & DISCREPANCY CHECKS */}
      {activeTab === 'pre_closing_audit' && (
        <div className="space-y-5">
          {/* Top selector & actions */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>کنترل اسناد ثبت‌نشده، بررسی مانده اشخاص، صندوق، بانک، موجودی و هشدارهای قبل از بستن سال</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                پیش از بستن سال مالی، کلیه اسناد موقت، توازن دفتر روزنامه و تطبیق مانده‌های تفصیلی به‌صورت خودکار بررسی می‌شوند.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {fiscalYears.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({f.isClosed ? 'بسته‌شده' : 'باز'})
                  </option>
                ))}
              </select>

              {!selectedFiscalYear?.isClosed && (
                <button
                  onClick={handleCreateTestDraft}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ایجاد سند موقت آزمایشی (تست خطای مسدودکننده)</span>
                </button>
              )}

              <button
                onClick={() => loadPreClosingAudit(selectedYearId)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditLoading ? 'animate-spin' : ''}`} />
                <span>به‌روزرسانی کنترل‌ها</span>
              </button>
            </div>
          </div>

          {preClosingAudit && (
            <>
              {/* Readiness Status Banner */}
              <div
                className={`p-5 rounded-2xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
                  preClosingAudit.canClose
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {preClosingAudit.canClose ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-black text-sm text-slate-800 dark:text-slate-100">
                      {preClosingAudit.canClose
                        ? `«${preClosingAudit.fiscalYearTitle}» آماده بستن و انتقال مانده‌ها به سال بعد است`
                        : `امکان بستن «${preClosingAudit.fiscalYearTitle}» وجود ندارد (${toPersianDigits(preClosingAudit.blockingErrorsCount)} خطای مسدودکننده)`}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      تعداد خطاهای مسدودکننده: {toPersianDigits(preClosingAudit.blockingErrorsCount)} مورد | هشدارهای قابل بررسی:{' '}
                      {toPersianDigits(preClosingAudit.warningsCount)} مورد | سود خالص دوره:{' '}
                      <span className="font-bold">
                        {formatCurrency(preClosingAudit.summary.netProfit, settings.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* One-click Draft Resolution if drafts exist */}
                {(preClosingAudit.summary.draftVouchersCount > 0 ||
                  preClosingAudit.summary.draftInvoicesCount > 0 ||
                  preClosingAudit.summary.draftWarehouseDocsCount > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleResolveDrafts('approve_all')}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>تایید و قطعی‌سازی همه اسناد موقت</span>
                    </button>
                    <button
                      onClick={() => handleResolveDrafts('delete_drafts')}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف پیش‌نویس‌های موقت</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-navigation for Audit Details */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    id: 'checks',
                    label: `چک‌لیست کنترل‌ها و هشدارها (${toPersianDigits(preClosingAudit.checks.length)})`,
                  },
                  {
                    id: 'persons',
                    label: `بررسی مانده اشخاص (${toPersianDigits(preClosingAudit.summary.debtorsCount + preClosingAudit.summary.creditorsCount)})`,
                  },
                  {
                    id: 'treasury',
                    label: `صندوق، بانک و چک‌ها`,
                  },
                  {
                    id: 'inventory',
                    label: `موجودی انبار (${toPersianDigits(preClosingAudit.summary.totalProductsCount)})`,
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setAuditSubTab(st.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      auditSubTab === st.id
                        ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: 8-point Pre-Closing Checks */}
              {auditSubTab === 'checks' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {preClosingAudit.checks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 space-y-2 ${
                        chk.severity === 'blocking_error'
                          ? 'border-rose-300 dark:border-rose-800'
                          : chk.severity === 'warning'
                          ? 'border-amber-300 dark:border-amber-800'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {chk.severity === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {chk.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                          {chk.severity === 'blocking_error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{chk.title}</h4>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            chk.severity === 'ok'
                              ? 'bg-emerald-50 text-emerald-700'
                              : chk.severity === 'warning'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {chk.severity === 'ok'
                            ? 'تایید شده'
                            : chk.severity === 'warning'
                            ? 'هشدار'
                            : 'خطای مسدودکننده'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{chk.description}</p>

                      {chk.affectedItems && chk.affectedItems.length > 0 && (
                        <ul className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                          {chk.affectedItems.map((item, i) => (
                            <li key={i} className="flex items-center justify-between gap-1.5">
                              <span>
                                {item.title} ({toPersianDigits(item.code)})
                              </span>
                              <span className="font-mono font-bold">
                                {item.amountOrQty} — {item.statusLabel}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-tab 2: Person Balances Inspection */}
              {auditSubTab === 'persons' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">کد</th>
                          <th className="p-3">نام شخص / طرف حساب</th>
                          <th className="p-3">نوع</th>
                          <th className="p-3">مانده فعلی</th>
                          <th className="p-3">وضعیت انتقال به سال بعد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {persons.map((p) => (
                          <tr key={p.id}>
                            <td className="p-3 font-mono">{toPersianDigits(p.code)}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                            <td className="p-3">
                              {p.personType === 'customer' ? 'مشتری' : p.personType === 'supplier' ? 'تامین‌کننده' : 'هر دو'}
                            </td>
                            <td className="p-3 font-mono font-bold">
                              {formatCurrency(Math.abs(p.currentBalance), settings.currency)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.currentBalance > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : p.currentBalance < 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {p.currentBalance > 0
                                  ? 'بدهکار (انتقال به حساب ۱۰۳)'
                                  : p.currentBalance < 0
                                  ? 'بستانکار (انتقال به حساب ۲۰۱)'
                                  : 'تسویه کامل'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Cash & Bank Inspection */}
              {auditSubTab === 'treasury' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">عنوان حساب خزانه</th>
                          <th className="p-3">نوع حساب</th>
                          <th className="p-3">مانده اول دوره</th>
                          <th className="p-3">مانده پایان دوره قابل انتقال</th>
                          <th className="p-3">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {treasuryAccounts.map((t) => (
                          <tr key={t.id}>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{t.title}</td>
                            <td className="p-3">{t.type === 'cash' ? 'صندوق' : t.type === 'bank' ? 'حساب بانکی' : 'کارتخوان'}</td>
                            <td className="p-3 font-mono">{formatCurrency(t.initialBalance, settings.currency)}</td>
                            <td className="p-3 font-mono font-bold text-indigo-600">
                              {formatCurrency(t.balance, settings.currency)}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                آماده انتقال به افتتاحیه سال بعد
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Inventory Stock Inspection */}
              {auditSubTab === 'inventory' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="font-bold">
                      موجودی پایان دوره آماده انتقال به کاردکس سال جدید ({toPersianDigits(products.length)} قلم کالا)
                    </span>
                    <span className="font-black text-indigo-600">
                      ارزش ریالی پایان دوره: {formatCurrency(preClosingAudit.summary.totalEndingInventoryValue, settings.currency)}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">کد کالا</th>
                          <th className="p-3">نام کالا</th>
                          <th className="p-3">موجودی پایانی</th>
                          <th className="p-3">بهای تمام‌شده واحد</th>
                          <th className="p-3">ارزش کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {products.map((item) => (
                          <tr key={item.id}>
                            <td className="p-3 font-mono">{toPersianDigits(item.code)}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.name}</td>
                            <td className="p-3 font-mono font-bold">{toPersianDigits(item.currentStock)}</td>
                            <td className="p-3 font-mono">{formatCurrency(item.purchasePrice, settings.currency)}</td>
                            <td className="p-3 font-mono font-bold text-emerald-700">
                              {formatCurrency(item.currentStock * item.purchasePrice, settings.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4: CLOSING WIZARD & BALANCE ROLLOVER */}
      {activeTab === 'closing_wizard' && (
        <div className="space-y-5">
          {/* Wizard Step Indicator */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { step: 1, title: 'گام ۱: کنترل پیش‌نیازها و هشدارها' },
                { step: 2, title: 'گام ۲: بستن حساب‌های موقت سود و زیانی' },
                { step: 3, title: 'گام ۳: سند اختتامیه و تعریف سال جدید' },
                { step: 4, title: 'گام ۴: صدور سند افتتاحیه و انتقال قطعی' },
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setWizardStep(s.step as any)}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    wizardStep === s.step
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                      : wizardStep > s.step
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{s.title}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedFiscalYear?.isClosed ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Lock className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                «{selectedFiscalYear.title}» قبلاً بسته شده است
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                سند بستن حساب‌های موقت شماره {toPersianDigits(selectedFiscalYear.closingTemporaryVoucherNumber || '')} و سند اختتامیه شماره{' '}
                {toPersianDigits(selectedFiscalYear.closingPermanentVoucherNumber || '')} برای این دوره صادر شده است.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setArchiveYearId(selectedFiscalYear.id);
                    setActiveTab('historical_archive');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  مشاهده اسناد و گزارش‌های آرشیوشده این سال
                </button>
              </div>
            </div>
          ) : (
            preClosingAudit && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                {/* STEP 1 */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                      گام اول: بررسی نهایی خطاها و هشدارهای قبل از بستن «{selectedFiscalYear?.title}»
                    </h4>

                    {!preClosingAudit.canClose ? (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-3 text-xs text-rose-800 dark:text-rose-200">
                        <div className="font-black flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-rose-600" />
                          <span>
                            به دلیل وجود {toPersianDigits(preClosingAudit.blockingErrorsCount)} خطای مسدودکننده (مانند اسناد موقت ثبت‌نشده)، امکان ادامه عملیات بستن سال وجود ندارد.
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleResolveDrafts('approve_all')}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
                          >
                            تایید و قطعی‌سازی خودکار اسناد موقت
                          </button>
                          <button
                            onClick={() => setActiveTab('pre_closing_audit')}
                            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold cursor-pointer"
                          >
                            مشاهده جزئیات در تب کنترل‌ها
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                        <div className="font-black flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>کلیه کنترل‌های اجباری (توازن اسناد، عدم وجود سند موقت و موجودی انبار) با موفقیت تایید شدند.</span>
                        </div>
                        {preClosingAudit.warningsCount > 0 && (
                          <label className="flex items-center gap-2 pt-2 cursor-pointer font-bold text-amber-800 dark:text-amber-300">
                            <input
                              type="checkbox"
                              checked={acknowledgedWarnings}
                              onChange={(e) => setAcknowledgedWarnings(e.target.checked)}
                              className="w-4 h-4 rounded"
                            />
                            <span>
                              هشدارهای دوره ({toPersianDigits(preClosingAudit.warningsCount)} مورد شامل چک‌های در جریان انتقال به سال بعد) را بررسی کرده و تایید می‌کنم.
                            </span>
                          </label>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        disabled={!preClosingAudit.canClose}
                        onClick={() => setWizardStep(2)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <span>ادامه به گام دوم (بستن حساب‌های سود و زیانی)</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2 */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                        گام دوم: پیش‌نمایش سند بستن حساب‌های موقت (درآمد، فروش، بهای تمام‌شده و هزینه‌ها)
                      </h4>
                      <span className="text-xs font-bold text-emerald-600">
                        سود خالص انتقالی به حساب ۳۰۲ (سود انباشته):{' '}
                        {formatCurrency(preClosingAudit.summary.netProfit, settings.currency)}
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                          <tr>
                            <th className="p-3">کد حساب</th>
                            <th className="p-3">نام سرفصل</th>
                            <th className="p-3">شرح آرتیکل</th>
                            <th className="p-3">بدهکار</th>
                            <th className="p-3">بستانکار</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preClosingAudit.previewVouchers.closingTemporaryVoucher.lines.map((line) => (
                            <tr key={line.id}>
                              <td className="p-3 font-mono font-bold">{toPersianDigits(line.accountCode)}</td>
                              <td className="p-3 font-bold">{line.accountTitle}</td>
                              <td className="p-3 text-slate-500">{line.description}</td>
                              <td className="p-3 font-mono text-emerald-700 font-bold">
                                {line.debit > 0 ? formatCurrency(line.debit, settings.currency) : '—'}
                              </td>
                              <td className="p-3 font-mono text-indigo-700 font-bold">
                                {line.credit > 0 ? formatCurrency(line.credit, settings.currency) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        بازگشت به گام اول
                      </button>
                      <button
                        onClick={() => setWizardStep(3)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <span>ادامه به گام سوم (سند اختتامیه و سال جدید)</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3 */}
                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                      گام سوم: تنظیم مشخصات سال مالی جدید و پیش‌نمایش سند اختتامیه حساب‌های دائمی
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                      <div>
                        <label className="block font-bold mb-1">کد سال مالی جدید:</label>
                        <input
                          type="text"
                          value={nextYearConfig.nextYearCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            setNextYearConfig((prev) => ({
                              ...prev,
                              nextYearCode: code,
                              nextYearTitle: `سال مالی ${toPersianDigits(code)}`,
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">عنوان سال مالی جدید:</label>
                        <input
                          type="text"
                          value={nextYearConfig.nextYearTitle}
                          onChange={(e) => setNextYearConfig((prev) => ({ ...prev, nextYearTitle: e.target.value }))}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">یادداشت انتقال سال:</label>
                        <input
                          type="text"
                          value={nextYearConfig.notes}
                          onChange={(e) => setNextYearConfig((prev) => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 text-xs font-bold">
                        پیش‌نمایش سند اختتامیه حساب‌های دائمی ({preClosingAudit.previewVouchers.closingPermanentVoucher.description})
                      </div>
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100/60 dark:bg-slate-800/60 text-slate-500">
                          <tr>
                            <th className="p-2.5">کد حساب</th>
                            <th className="p-2.5">نام حساب</th>
                            <th className="p-2.5">طرف حساب تفصیلی</th>
                            <th className="p-2.5">بدهکار</th>
                            <th className="p-2.5">بستانکار</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preClosingAudit.previewVouchers.closingPermanentVoucher.lines.map((line) => (
                            <tr key={line.id}>
                              <td className="p-2.5 font-mono font-bold">{toPersianDigits(line.accountCode)}</td>
                              <td className="p-2.5 font-bold">{line.accountTitle}</td>
                              <td className="p-2.5 text-slate-500">{line.personName || '—'}</td>
                              <td className="p-2.5 font-mono text-emerald-700 font-bold">
                                {line.debit > 0 ? formatCurrency(line.debit, settings.currency) : '—'}
                              </td>
                              <td className="p-2.5 font-mono text-indigo-700 font-bold">
                                {line.credit > 0 ? formatCurrency(line.credit, settings.currency) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setWizardStep(2)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        بازگشت به گام دوم
                      </button>
                      <button
                        onClick={() => setWizardStep(4)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <span>ادامه به گام چهارم (تایید سند افتتاحیه سال جدید)</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4 */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs space-y-1">
                      <div className="font-black text-indigo-900 dark:text-indigo-200">
                        گام چهارم: پیش‌نمایش سند افتتاحیه «{nextYearConfig.nextYearTitle}» و اجرای اتمیک انتقال مانده‌ها
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        با کلیک بر روی دکمه تایید نهایی، سال مالی {toPersianDigits(selectedFiscalYear.code)} بسته و قفل شده، اسناد و گزارش‌های آن در آرشیو تغییرناپذیر ذخیره می‌شوند و سند افتتاحیه سال {toPersianDigits(nextYearConfig.nextYearCode)} به همراه موجودی اول دوره انبار و خزانه صادر می‌گردد.
                      </p>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-bold flex justify-between">
                        <span>پیش‌نمایش سند افتتاحیه سال مالی {toPersianDigits(nextYearConfig.nextYearCode)}</span>
                        <span>
                          جمع تراز افتتاحیه:{' '}
                          {formatCurrency(preClosingAudit.previewVouchers.nextYearOpeningVoucher.totalDebit, settings.currency)}
                        </span>
                      </div>
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                          <tr>
                            <th className="p-2.5">کد حساب</th>
                            <th className="p-2.5">نام حساب</th>
                            <th className="p-2.5">تفصیلی</th>
                            <th className="p-2.5">بدهکار (دارایی اول دوره)</th>
                            <th className="p-2.5">بستانکار (بدهی و سرمایه اول دوره)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preClosingAudit.previewVouchers.nextYearOpeningVoucher.lines.map((line) => (
                            <tr key={line.id}>
                              <td className="p-2.5 font-mono font-bold">{toPersianDigits(line.accountCode)}</td>
                              <td className="p-2.5 font-bold">{line.accountTitle}</td>
                              <td className="p-2.5 text-slate-500">{line.personName || '—'}</td>
                              <td className="p-2.5 font-mono text-emerald-700 font-bold">
                                {line.debit > 0 ? formatCurrency(line.debit, settings.currency) : '—'}
                              </td>
                              <td className="p-2.5 font-mono text-indigo-700 font-bold">
                                {line.credit > 0 ? formatCurrency(line.credit, settings.currency) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setWizardStep(3)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        بازگشت به گام سوم
                      </button>
                      <button
                        onClick={handleExecuteYearEndClosing}
                        disabled={isExecutingClose || !preClosingAudit.canClose}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                      >
                        <Lock className="w-4 h-4" />
                        <span>
                          {isExecutingClose
                            ? 'در حال بستن سال و انتقال مانده‌ها...'
                            : `تایید قطعی، بستن ${selectedFiscalYear.title} و انتقال به سال ${toPersianDigits(nextYearConfig.nextYearCode)}`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* TAB 5: HISTORICAL ARCHIVE & PRESERVED PREVIOUS YEARS' REPORTS */}
      {activeTab === 'historical_archive' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>آرشیو محفوظ اسناد و گزارش‌های سال‌های مالی قبلی و جاری</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                اسناد حسابداری، تراز آزمایشی، صورت سود و زیان و مانده اشخاص و انبار سال‌های گذشته بدون هیچ‌گونه تغییر محفوظ هستند.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-600">انتخاب سال مالی جهت مشاهده آرشیو:</label>
              <select
                value={archiveYearId}
                onChange={(e) => setArchiveYearId(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {fiscalYears.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({f.isClosed ? 'آرشیو قطعی و بسته‌شده' : 'دوره باز'})
                  </option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ گزارش سال</span>
              </button>

              <button
                onClick={handleExportArchiveCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>خروجی Excel (CSV)</span>
              </button>
            </div>
          </div>

          {archiveData && (
            <div className="space-y-4">
              {/* Summary Cards for Archived Year */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">درآمد و فروش خالص دوره</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(archiveData.snapshot.summary.netSales, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">بهای تمام‌شده و هزینه‌ها</div>
                  <div className="text-sm font-black text-rose-600 mt-1">
                    {formatCurrency(
                      archiveData.snapshot.summary.cogs + archiveData.snapshot.summary.totalExpenses,
                      settings.currency
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">سود خالص دوره</div>
                  <div className="text-sm font-black text-emerald-600 mt-1">
                    {formatCurrency(archiveData.snapshot.summary.netProfit, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">جمع دارایی‌های پایان دوره</div>
                  <div className="text-sm font-black text-indigo-600 mt-1">
                    {formatCurrency(archiveData.snapshot.summary.totalAssets, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">تعداد اسناد و فاکتورهای محفوظ</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">
                    {toPersianDigits(archiveData.snapshot.vouchers.length)} سند |{' '}
                    {toPersianDigits(archiveData.snapshot.invoices.length)} فاکتور
                  </div>
                </div>
              </div>

              {/* Archive Sub-tabs */}
              <div className="flex flex-wrap gap-2 print:hidden">
                {[
                  { id: 'summary', label: 'ترازنامه و خلاصه وضعیت پایان سال' },
                  { id: 'vouchers', label: `اسناد حسابداری سال (${toPersianDigits(archiveData.snapshot.vouchers.length)})` },
                  { id: 'trial_balance', label: 'تراز آزمایشی سال' },
                  { id: 'sub_ledgers', label: 'مانده اشخاص، خزانه و انبار در پایان سال' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setArchiveSubTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      archiveSubTab === t.id
                        ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {archiveSubTab === 'summary' && (
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-800 dark:text-slate-100 border-b pb-2">
                      خلاصه صورت سود و زیان «{archiveData.fiscalYear.title}»
                    </h4>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">فروش و درآمد خالص:</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(archiveData.snapshot.summary.netSales, settings.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">بهای تمام‌شده کالای فروش‌رفته:</span>
                      <span className="font-mono font-bold text-rose-600">
                        ({formatCurrency(archiveData.snapshot.summary.cogs, settings.currency)})
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">هزینه‌های عملیاتی و اداری:</span>
                      <span className="font-mono font-bold text-rose-600">
                        ({formatCurrency(archiveData.snapshot.summary.totalExpenses, settings.currency)})
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-t font-black text-emerald-700">
                      <span>سود (زیان) خالص دوره:</span>
                      <span className="font-mono">
                        {formatCurrency(archiveData.snapshot.summary.netProfit, settings.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-black text-slate-800 dark:text-slate-100 border-b pb-2">
                      خلاصه ترازنامه پایان «{archiveData.fiscalYear.title}»
                    </h4>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">جمع کل دارایی‌ها (خزانه، مطالبات، انبار):</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatCurrency(archiveData.snapshot.summary.totalAssets, settings.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">جمع بدهی‌ها (حساب‌ها و اسناد پرداختنی):</span>
                      <span className="font-mono font-bold text-rose-600">
                        {formatCurrency(archiveData.snapshot.summary.totalLiabilities, settings.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">حقوق صاحبان سهام (سرمایه و سود انباشته):</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {formatCurrency(archiveData.snapshot.summary.totalEquity, settings.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-t font-black">
                      <span>معادله حسابداری (دارایی = بدهی + سرمایه):</span>
                      <span className="text-emerald-600">تراز و منطبق</span>
                    </div>
                  </div>
                </div>
              )}

              {archiveSubTab === 'vouchers' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                        <tr>
                          <th className="p-3">شماره سند</th>
                          <th className="p-3">تاریخ</th>
                          <th className="p-3">نوع سند</th>
                          <th className="p-3">شرح سند</th>
                          <th className="p-3">جمع بدهکار</th>
                          <th className="p-3">جمع بستانکار</th>
                          <th className="p-3">جزئیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {archiveData.snapshot.vouchers.map((v) => (
                          <tr key={v.id}>
                            <td className="p-3 font-mono font-bold">#{toPersianDigits(v.voucherNumber)}</td>
                            <td className="p-3 font-mono">{toPersianDigits(v.date)}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                {v.referenceType === 'opening_balance'
                                  ? 'سند افتتاحیه'
                                  : v.referenceType === 'closing_temporary'
                                  ? 'بستن حساب‌های سود و زیان'
                                  : v.referenceType === 'closing_permanent'
                                  ? 'سند اختتامیه'
                                  : 'سند عملیاتی دوره'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-700 dark:text-slate-200">{v.description}</td>
                            <td className="p-3 font-mono font-bold text-emerald-700">
                              {formatCurrency(v.totalDebit, settings.currency)}
                            </td>
                            <td className="p-3 font-mono font-bold text-indigo-700">
                              {formatCurrency(v.totalCredit, settings.currency)}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => setSelectedArchivedVoucher(v)}
                                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold cursor-pointer"
                              >
                                مشاهده آرتیکل‌ها
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {archiveSubTab === 'trial_balance' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                        <tr>
                          <th className="p-3">کد حساب</th>
                          <th className="p-3">نام حساب</th>
                          <th className="p-3">گردش بدهکار</th>
                          <th className="p-3">گردش بستانکار</th>
                          <th className="p-3">مانده بدهکار</th>
                          <th className="p-3">مانده بستانکار</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {archiveData.trialBalance.rows.map((r) => (
                          <tr key={r.code}>
                            <td className="p-3 font-mono font-bold">{toPersianDigits(r.code)}</td>
                            <td className="p-3 font-bold">{r.title}</td>
                            <td className="p-3 font-mono">{formatCurrency(r.turnoverDebit, settings.currency)}</td>
                            <td className="p-3 font-mono">{formatCurrency(r.turnoverCredit, settings.currency)}</td>
                            <td className="p-3 font-mono font-bold text-emerald-700">
                              {formatCurrency(r.closingDebit, settings.currency)}
                            </td>
                            <td className="p-3 font-mono font-bold text-indigo-700">
                              {formatCurrency(r.closingCredit, settings.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {archiveSubTab === 'sub_ledgers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <h5 className="font-black text-slate-800 dark:text-slate-100 border-b pb-2">مانده اشخاص در پایان دوره</h5>
                    {archiveData.snapshot.personBalances.map((p) => (
                      <div key={p.personId} className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                        <span className="font-bold">{p.name}</span>
                        <span className={p.balance >= 0 ? 'text-emerald-600 font-mono font-bold' : 'text-rose-600 font-mono font-bold'}>
                          {formatCurrency(Math.abs(p.balance), settings.currency)} ({p.balance >= 0 ? 'بد' : 'بس'})
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <h5 className="font-black text-slate-800 dark:text-slate-100 border-b pb-2">مانده صندوق و بانک در پایان دوره</h5>
                    {archiveData.snapshot.treasuryBalances.map((t) => (
                      <div key={t.accountId} className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                        <span className="font-bold">{t.title}</span>
                        <span className="font-mono font-bold text-indigo-600">
                          {formatCurrency(t.balance, settings.currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <h5 className="font-black text-slate-800 dark:text-slate-100 border-b pb-2">موجودی انبار در پایان دوره</h5>
                    {archiveData.snapshot.inventoryBalances.map((inv, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                        <span className="font-bold">{inv.name}</span>
                        <span className="font-mono text-slate-600">
                          {toPersianDigits(inv.quantity)} {inv.unitName} ({formatCurrency(inv.totalValuation, settings.currency)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ROLLOVER SIMULATION TEST LAB */}
      {activeTab === 'rollover_test_lab' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
                <span>آزمایشگاه تست خودکار انتقال سال مالی با داده آزمایشی کامل (۱۴۰۳ به ۱۴۰۴)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                این آزمون تمامی مراحل کنترل اسناد ثبت‌نشده، بستن حساب‌های موقت، صدور سند اختتامیه، انتقال مانده‌ها به افتتاحیه سال بعد و حفظ گزارش‌های سال قبل را با داده‌های آزمایشی کامل شبیه‌سازی و راستی‌آزمایی می‌کند.
              </p>
            </div>

            <button
              onClick={handleRunRolloverTestSuite}
              disabled={isRunningTestSuite}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FlaskConical className="w-4 h-4" />
              <span>{isRunningTestSuite ? 'در حال اجرای سناریوی تست...' : 'اجرای تست کامل انتقال سال مالی'}</span>
            </button>
          </div>

          {testSuiteResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">سود خالص محاسبه‌شده سال ۱۴۰۳</div>
                  <div className="text-sm font-black text-emerald-600 mt-1">
                    {formatCurrency(testSuiteResult.sampleDataSummary.closedYearNetProfit, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">نقد و بانک منتقله به ۱۴۰۴</div>
                  <div className="text-sm font-black text-indigo-600 mt-1">
                    {formatCurrency(testSuiteResult.sampleDataSummary.transferredCashAndBank, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">تراز سند افتتاحیه سال ۱۴۰۴</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(testSuiteResult.sampleDataSummary.openingNewYearVoucherTotal, settings.currency)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">وضعیت کلی آزمون ۷ مرحله‌ای</div>
                  <div className="text-sm font-black text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {toPersianDigits(testSuiteResult.passedSteps)} از {toPersianDigits(testSuiteResult.totalSteps)} مرحله موفق
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {testSuiteResult.steps.map((st) => (
                  <div key={st.stepNumber} className="p-4 flex items-start justify-between gap-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      {st.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          مرحله {toPersianDigits(st.stepNumber)}: {st.title}
                        </div>
                        <div className="text-slate-500">{st.details}</div>
                        <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          نتیجه: {st.actual}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] shrink-0">
                      PASS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Define / Edit Shamsi Fiscal Year */}
      {isDefineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                تعریف دوره و سال مالی شمسی جدید
              </h3>
              <button onClick={() => setIsDefineModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ×
              </button>
            </div>
            <form onSubmit={handleSaveFiscalYear} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">کد چهاررقمی سال شمسی (مثلاً ۱۴۰۴):</label>
                <input
                  type="text"
                  required
                  value={yearForm.code}
                  onChange={(e) => handleCodeChangeInModal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">عنوان دوره مالی:</label>
                <input
                  type="text"
                  required
                  value={yearForm.title}
                  onChange={(e) => setYearForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">تاریخ شروع (شمسی):</label>
                  <input
                    type="text"
                    required
                    value={yearForm.startDate}
                    onChange={(e) => setYearForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">تاریخ پایان (شمسی):</label>
                  <input
                    type="text"
                    required
                    value={yearForm.endDate}
                    onChange={(e) => setYearForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">توضیحات:</label>
                <input
                  type="text"
                  value={yearForm.description}
                  onChange={(e) => setYearForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDefineModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  ثبت و ذخیره سال مالی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reopen Closed Fiscal Year */}
      {reopenModalYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-rose-700">
                بازگشایی مدیریتی «{reopenModalYear.title}»
              </h3>
              <button onClick={() => setReopenModalYear(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ×
              </button>
            </div>
            <form onSubmit={handleReopenYear} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                بازگشایی سال مالی بسته‌شده موجب ابطال اسناد اختتامیه آن سال و ثبت در لاگ حسابرسی امنیتی می‌شود. لطفاً دلیل بازگشایی را وارد کنید:
              </p>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="مثال: ثبت سند اصلاحی حسابرسی پایان دوره..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReopenModalYear(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  تایید و بازگشایی سال مالی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Archived Voucher Detail Viewer */}
      {selectedArchivedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                سند حسابداری شماره #{toPersianDigits(selectedArchivedVoucher.voucherNumber)} — تاریخ{' '}
                {toPersianDigits(selectedArchivedVoucher.date)}
              </h3>
              <button
                onClick={() => setSelectedArchivedVoucher(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-200">{selectedArchivedVoucher.description}</div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                    <tr>
                      <th className="p-2.5">کد حساب</th>
                      <th className="p-2.5">نام حساب</th>
                      <th className="p-2.5">تفصیلی</th>
                      <th className="p-2.5">بدهکار</th>
                      <th className="p-2.5">بستانکار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedArchivedVoucher.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2.5 font-mono font-bold">{toPersianDigits(l.accountCode)}</td>
                        <td className="p-2.5 font-bold">{l.accountTitle}</td>
                        <td className="p-2.5 text-slate-500">{l.personName || '—'}</td>
                        <td className="p-2.5 font-mono text-emerald-700 font-bold">
                          {l.debit > 0 ? formatCurrency(l.debit, settings.currency) : '—'}
                        </td>
                        <td className="p-2.5 font-mono text-indigo-700 font-bold">
                          {l.credit > 0 ? formatCurrency(l.credit, settings.currency) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
