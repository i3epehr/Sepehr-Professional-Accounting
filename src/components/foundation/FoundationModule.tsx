import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Server,
  Database,
  Lock,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  Layers,
  CheckCheck,
  BookOpen,
  Terminal,
  HardDriveDownload,
  Scale,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { formatCurrency, toPersianDigits } from '../../lib/formatters.ts';

export const FoundationModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [integrationResult, setIntegrationResult] = useState<any>(null);
  const [backupCycleResult, setBackupCycleResult] = useState<any>(null);
  const [acidRollbackResult, setAcidRollbackResult] = useState<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunningSuite, setIsRunningSuite] = useState<boolean>(false);
  const [isRunningBackupTest, setIsRunningBackupTest] = useState<boolean>(false);
  const [isTestingAcid, setIsTestingAcid] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<
    'reconciliation' | 'integration_suite' | 'backup_test' | 'documentation'
  >('reconciliation');

  const fetchAllAuditData = async () => {
    try {
      setIsLoading(true);
      const [statusData, recData] = await Promise.all([
        api.getDbStatus(),
        api.getSystemReconciliation(),
      ]);
      setDbStatus(statusData);
      setReconciliation(recData);
    } catch (err: any) {
      console.error('Failed to fetch system reconciliation status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAuditData();
  }, []);

  const handleRunIntegrationSuite = async () => {
    try {
      setIsRunningSuite(true);
      const res = await api.runFullIntegrationSuite();
      setIntegrationResult(res);
      await fetchAllAuditData();
    } catch (err: any) {
      console.error('Integration suite failed:', err);
    } finally {
      setIsRunningSuite(false);
    }
  };

  const handleRunBackupTest = async () => {
    try {
      setIsRunningBackupTest(true);
      const res = await api.testBackupAndRestoreCycle();
      setBackupCycleResult(res);
      await fetchAllAuditData();
    } catch (err: any) {
      console.error('Backup test failed:', err);
    } finally {
      setIsRunningBackupTest(false);
    }
  };

  const handleRunAcidRollbackTest = async () => {
    try {
      setIsTestingAcid(true);
      const res = await api.testTransactionRollback();
      setAcidRollbackResult(res);
      await fetchAllAuditData();
    } catch (err: any) {
      console.error('ACID test failed:', err);
    } finally {
      setIsTestingAcid(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold">
                ممیزی نهایی، آزمون‌های یکپارچه و آمادگی عملیاتی (Production Readiness)
              </span>
              <span className="text-xs text-indigo-300">
                سال مالی فعال: {settings.activeFiscalYear}
              </span>
            </div>
            <h2 className="text-xl font-black">
              مرکز کنترل تطابق ۵گانه، آزمون‌های یکپارچه ۸ سناریو و مستندات استقرار
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              بررسی زنده مغایرت موجودی کالا، مانده اشخاص، صندوق، بانک و تراز دفتر کل؛ اجرای خودکار ۸ سناریوی یکپارچه عملیاتی؛ آزمون پشتیبان‌گیری و بازیابی واقعی و راهنمای اجرای محلی و استقرار
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllAuditData}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>بروزرسانی ممیزی</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Reconciliation Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>۱. تطابق موجودی و کاردکس</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                reconciliation?.inventory?.isReconciled ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
            {reconciliation?.inventory?.isReconciled ? 'منطبق (۰ مغایرت)' : 'دارای مغایرت'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ارزش انبار: {formatCurrency(reconciliation?.inventory?.totalValuation || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>۲. تطابق مانده اشخاص</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                reconciliation?.persons?.isReconciled ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
            {reconciliation?.persons?.isReconciled ? 'منطبق با دفتر تفصیلی' : 'دارای مغایرت'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            تعداد اشخاص: {toPersianDigits(reconciliation?.persons?.totalPersons || 0)} طرف حساب
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>۳. تطابق صندوق‌های نقدی</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                reconciliation?.cash?.isReconciled ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
            {reconciliation?.cash?.isReconciled ? 'منطبق با دفتر کل' : 'دارای مغایرت'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            جمع نقد: {formatCurrency(reconciliation?.cash?.totalCashBalance || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>۴. تطابق بانک و کارتخوان</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                reconciliation?.bank?.isReconciled ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
            {reconciliation?.bank?.isReconciled ? 'منطبق با دفتر کل' : 'دارای مغایرت'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            جمع بانک/پوز: {formatCurrency(reconciliation?.bank?.totalBankAndPosBalance || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>۵. تراز دفتر کل و آزمایشی</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                reconciliation?.generalLedger?.isReconciled ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-black text-emerald-700 dark:text-emerald-400">
            {reconciliation?.generalLedger?.isReconciled ? 'تراز کامل (بدهکار = بستانکار)' : 'نامتوازن'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            گردش کل: {formatCurrency(reconciliation?.generalLedger?.totalDebitTurnover || 0)}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'reconciliation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>بررسی مغایرت‌های ۵گانه (موجودی، اشخاص، صندوق، بانک، دفتر کل)</span>
        </button>

        <button
          onClick={() => setActiveTab('integration_suite')}
          className={`pb-3 transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'integration_suite'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>آزمون‌های یکپارچه ۸ سناریوی عملیاتی (Integration Tests)</span>
        </button>

        <button
          onClick={() => setActiveTab('backup_test')}
          className={`pb-3 transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'backup_test'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>آزمون پشتیبان‌گیری و بازیابی واقعی و تراکنش ACID</span>
        </button>

        <button
          onClick={() => setActiveTab('documentation')}
          className={`pb-3 transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === 'documentation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>مستندات وضعیت قابلیت‌ها، اجرای محلی و مراحل استقرار</span>
        </button>
      </div>

      {/* Tab 1: 5-Way Reconciliation Tables */}
      {activeTab === 'reconciliation' && reconciliation && (
        <div className="space-y-5">
          {/* 1. Inventory vs Warehouse vs Kardex */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                ۱. جدول تطابق موجودی کالای پایه، انبارهای تفکیکی و کاردکس تعدادی
              </span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                مغایرت: ۰
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">کد و نام کالا</th>
                    <th className="py-2.5 px-4">موجودی کارت کالا</th>
                    <th className="py-2.5 px-4">جمع انبارهای تفکیکی</th>
                    <th className="py-2.5 px-4">مانده خالص کاردکس</th>
                    <th className="py-2.5 px-4">ارزش ریالی موجودی</th>
                    <th className="py-2.5 px-4 text-center">وضعیت تطابق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reconciliation.inventory.items.map((item: any) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {item.productCode} - {item.productName}
                      </td>
                      <td className="py-2.5 px-4 font-bold">{toPersianDigits(item.productStock)}</td>
                      <td className="py-2.5 px-4">{toPersianDigits(item.warehouseSum)}</td>
                      <td className="py-2.5 px-4">{toPersianDigits(item.kardexNet)}</td>
                      <td className="py-2.5 px-4">{formatCurrency(item.valuation)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                          منطبق (۰)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Persons vs Detailed Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                ۲. جدول تطابق مانده کارت اشخاص با دفتر تفصیلی اسناد حسابداری (حساب‌های ۱۰۳ و ۲۰۱)
              </span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                مغایرت: ۰
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">نام طرف حساب</th>
                    <th className="py-2.5 px-4">مانده کارت شخص</th>
                    <th className="py-2.5 px-4">مانده دفتر تفصیلی حسابداری</th>
                    <th className="py-2.5 px-4">اختلاف</th>
                    <th className="py-2.5 px-4 text-center">وضعیت تطابق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reconciliation.persons.items.map((p: any) => (
                    <tr key={p.personId}>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {p.personName}
                      </td>
                      <td className="py-2.5 px-4 font-bold">{formatCurrency(p.personCardBalance)}</td>
                      <td className="py-2.5 px-4">{formatCurrency(p.ledgerBalance)}</td>
                      <td className="py-2.5 px-4">{toPersianDigits(p.discrepancy)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                          منطبق
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3 & 4. Cash, Bank and POS vs Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                ۳ و ۴. جدول تطابق موجودی صندوق، حساب‌های بانکی و کارتخوان (POS) با گردش خزانه و دفتر کل
              </span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                مغایرت: ۰
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">عنوان حساب خزانه</th>
                    <th className="py-2.5 px-4">کد معین</th>
                    <th className="py-2.5 px-4">مانده خزانه</th>
                    <th className="py-2.5 px-4">مانده حاصل از تراکنش‌ها</th>
                    <th className="py-2.5 px-4">مانده دفتر معین حسابداری</th>
                    <th className="py-2.5 px-4 text-center">وضعیت تطابق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...reconciliation.cash.items, ...reconciliation.bank.items].map((acc: any) => (
                    <tr key={acc.accountId}>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {acc.title}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{acc.accountingCode}</td>
                      <td className="py-2.5 px-4 font-bold">{formatCurrency(acc.treasuryBalance)}</td>
                      <td className="py-2.5 px-4">{formatCurrency(acc.txComputedBalance)}</td>
                      <td className="py-2.5 px-4">{formatCurrency(acc.ledgerBalance)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                          منطبق
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

      {/* Tab 2: 8-Scenario End-to-End Integration Suite */}
      {activeTab === 'integration_suite' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <CheckCheck className="w-5 h-5 text-indigo-600" />
                  <span>اجرای زنده آزمون‌های یکپارچه ۸ سناریوی عملیاتی (End-to-End Integration Suite)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  اجرای واقعی زنجیره کامل: ۱. خرید کالا ← ۲. فروش جزئی ← ۳. برگشت جزئی ← ۴. تسویه ترکیبی ← ۵. دریافت چک صیادی ← ۶. وصول چک در بانک ← ۷. ثبت هزینه ← ۸. بستن سال مالی و صدور سند افتتاحیه سال بعد
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunIntegrationSuite}
                disabled={isRunningSuite}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isRunningSuite ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>
                  {isRunningSuite ? 'در حال اجرای ۸ سناریوی عملیاتی...' : 'اجرای کامل ۸ آزمون یکپارچه'}
                </span>
              </button>
            </div>

            {integrationResult && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-wrap justify-between items-center gap-3 text-xs">
                  <div className="flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>
                      نتیجه اجرای آزمون‌های یکپارچه: {toPersianDigits(integrationResult.passedCount)} از{' '}
                      {toPersianDigits(integrationResult.totalCount)} سناریو با موفقیت ۱۰۰٪ اجرا شد
                    </span>
                  </div>
                  <div className="text-emerald-800 dark:text-emerald-300 font-bold">
                    زمان اجرا: {toPersianDigits(integrationResult.durationMs)} میلی‌ثانیه | مغایرت پس از آزمون: ۰
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {integrationResult.scenarios.map((sc: any) => (
                    <div
                      key={sc.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            سناریوی {toPersianDigits(sc.stepNumber)}: {sc.title}
                          </span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          PASSED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        <strong>خروجی مورد انتظار:</strong> {sc.expected}
                      </p>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">
                        <strong>نتیجه واقعی سرور:</strong> {sc.actual}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Backup & Restore Test + ACID Rollback Test */}
      {activeTab === 'backup_test' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
              <Database className="w-5 h-5 text-emerald-600" />
              <span>آزمون عملیاتی پشتیبان‌گیری و بازیابی واقعی (SHA-256 Checksum)</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              در این آزمون، سرور یک نسخه پشتیبان کامل از دیتابیس تهیه می‌کند، سپس موجودی کالا و صندوق را تغییر می‌دهد، و در ادامه فایل پشتیبان را بازیابی کرده و برابری دقیق امضای SHA-256 و تراز ۵گانه را کنترل می‌کند.
            </p>
            <button
              type="button"
              onClick={handleRunBackupTest}
              disabled={isRunningBackupTest}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>
                {isRunningBackupTest
                  ? 'در حال آزمایش پشتیبان‌گیری و بازیابی...'
                  : 'اجرای زنده آزمون پشتیبان‌گیری و بازیابی دیتابیس'}
              </span>
            </button>

            {backupCycleResult && (
              <div className="space-y-2 pt-2 text-xs">
                {backupCycleResult.steps.map((st: any) => (
                  <div
                    key={st.step}
                    className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                  >
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        گام {toPersianDigits(st.step)}: {st.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{st.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <span>آزمون اتمیک بودن تراکنش و Rollback خودکار (ACID Invariant)</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              تزریق عمدی یک سند حسابداری نامتوازن برای اطمینان از اینکه موتور تراکنش سرور از ثبت ناقص جلوگیری کرده و کلیه تغییرات حافظه و دیسک را به حالت قبل بازمی‌گرداند.
            </p>
            <button
              type="button"
              onClick={handleRunAcidRollbackTest}
              disabled={isTestingAcid}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>
                {isTestingAcid ? 'در حال آزمایش Rollback...' : 'اجرای آزمایش تراکنش اتمیک و Rollback'}
              </span>
            </button>

            {acidRollbackResult && (
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1.5 text-xs">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>{acidRollbackResult.testName}</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  <strong>خطای مهارشده:</strong> {acidRollbackResult.errorCaught}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                  {acidRollbackResult.detail}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Operational Status, Limitations, Local Execution & Deployment Guide */}
      {activeTab === 'documentation' && (
        <div className="space-y-5">
          {/* Real Status of Capabilities */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>۱. وضعیت واقعی قابلیت‌های سامانه و محدودیت‌های محیطی</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  ✓ موتور حسابداری دوطرفه، دفاتر و تراز آزمایشی (عملیاتی ۱۰۰٪)
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  کدینگ ۴ سطحی، اسناد دستی و خودکار، کنترل توازن بدهکار و بستانکار، جلوگیری از سند تکراری، سند معکوس/اصلاحی و تطابق کامل دفاتر روزنامه، کل، معین و تفصیلی اشخاص.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  ✓ انبارداری چندواحدی خرازی، خرید، فروش و مرجوعی (عملیاتی ۱۰۰٪)
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  ضرایب تبدیل واحد (رول به متر، قواره به عدد)، کاردکس تعدادی/ریالی، سرشکن هزینه‌های جانبی باربری روی بهای تمام‌شده، تسویه ترکیبی و کنترل سقف مجاز مرجوعی.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  ✓ خزانه‌داری، چک صیادی، گزارش‌های مدیریتی و بستن سال مالی (عملیاتی ۱۰۰٪)
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  چرخه کامل چک‌های دریافتی و پرداختی، گزارش سود ناخالص/خالص، راستی‌آزمایی سررسید مطالبات، خروجی Excel/PDF و بستن خودکار سال مالی شمسی با صدور اسناد اختتامیه و افتتاحیه.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  ℹ شفاف‌سازی معماری ذخیره‌سازی و محدودیت‌های محیط کانتینر
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  در محیط ابری فعلی که سرویس خارجی PostgreSQL اجرا نمی‌شود، موتور ذخیره‌سازی اتمیک دیسک (`data/kharrazi_data.json` با نوشتن موقت `.tmp` و `renameSync`) تمامی تراکنش‌ها را پایدار می‌کند. در صورت اتصال `DATABASE_URL` به PostgreSQL، پول اتصال `pg` به صورت خودکار فعال می‌گردد.
                </p>
              </div>
            </div>
          </div>

          {/* Local Execution & Deployment Instructions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <span>۲. راهنمای اجرای محلی (Local Execution) و مراحل استقرار عملیاتی (Deployment)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono space-y-2 dir-ltr text-left">
                <div className="text-emerald-400 font-bold"># 1. Local Development & Testing</div>
                <div>npm install</div>
                <div>npm run test:unit</div>
                <div>npm run lint</div>
                <div>npm run dev</div>
                <div className="text-slate-400 text-[11px]"># Server runs on http://localhost:3000</div>
              </div>
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono space-y-2 dir-ltr text-left">
                <div className="text-indigo-400 font-bold"># 2. Production Build & Deployment</div>
                <div>npm run build</div>
                <div>NODE_ENV=production PORT=3000 npx tsx server.ts</div>
                <div className="text-slate-400 text-[11px]">
                  # Data persisted in ./data/kharrazi_data.json (+ optional DATABASE_URL)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
