import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AccountingVoucher, AccountingAccount, VoucherLine, Person } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, getCurrentJalaliDate } from '../../lib/formatters.ts';
import {
  JournalLedgerEntry,
  LedgerAccountSummary,
  DetailedPersonLedgerSummary,
  TrialBalanceReport,
  AccountingAuditResult,
  validateDoubleEntryVoucher,
} from '../../lib/accountingCalculations.ts';

export const AccountingModule: React.FC = () => {
  const { formatMoney } = useSettings();
  const [activeTab, setActiveTab] = useState<
    'vouchers' | 'journal' | 'general' | 'subsidiary' | 'persons' | 'trialBalance' | 'audit' | 'chart'
  >('vouchers');

  // Shared Data
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('all');
  const [selectedGeneralCode, setSelectedGeneralCode] = useState<string>('all');
  const [trialBalanceColumns, setTrialBalanceColumns] = useState<'4' | '6'>('4');

  // Reports state
  const [journalData, setJournalData] = useState<{
    entries: JournalLedgerEntry[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  } | null>(null);
  const [generalLedger, setGeneralLedger] = useState<LedgerAccountSummary[]>([]);
  const [subsidiaryLedger, setSubsidiaryLedger] = useState<LedgerAccountSummary[]>([]);
  const [personLedger, setPersonLedger] = useState<DetailedPersonLedgerSummary[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [auditReport, setAuditReport] = useState<AccountingAuditResult | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedVoucherForView, setSelectedVoucherForView] = useState<AccountingVoucher | null>(null);
  const [voucherToReverse, setVoucherToReverse] = useState<AccountingVoucher | null>(null);
  const [reverseReason, setReverseReason] = useState<string>('');

  // New Voucher Form
  const [voucherDate, setVoucherDate] = useState<string>(getCurrentJalaliDate());
  const [voucherDesc, setVoucherDesc] = useState<string>('');
  const [lines, setLines] = useState<VoucherLine[]>([
    { id: '1', accountCode: '10101', accountTitle: 'صندوق اصلی فروشگاه', debit: 0, credit: 0, description: '' },
    { id: '2', accountCode: '401', accountTitle: 'درآمد حاصل از فروش کالا و ملزومات', debit: 0, credit: 0, description: '' },
  ]);
  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
    } catch (err) {
      console.error('Failed to load accounting base data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch reports on tab switch
  useEffect(() => {
    const fetchReport = async () => {
      try {
        if (activeTab === 'journal') {
          const res = await api.getJournalLedger({
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          });
          setJournalData(res);
        } else if (activeTab === 'general') {
          const res = await api.getGeneralLedger({
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          });
          setGeneralLedger(res);
        } else if (activeTab === 'subsidiary') {
          const res = await api.getSubsidiaryLedger({
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
            generalCode: selectedGeneralCode !== 'all' ? selectedGeneralCode : undefined,
          });
          setSubsidiaryLedger(res);
        } else if (activeTab === 'persons') {
          const res = await api.getDetailedPersonLedger({
            personId: selectedPersonId !== 'all' ? selectedPersonId : undefined,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          });
          setPersonLedger(res);
        } else if (activeTab === 'trialBalance') {
          const res = await api.getTrialBalance({
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          });
          setTrialBalance(res);
        } else if (activeTab === 'audit') {
          const res = await api.getAccountingAuditIntegrity();
          setAuditReport(res);
        }
      } catch (err) {
        console.error('Failed to fetch ledger report:', err);
      }
    };

    fetchReport();
  }, [activeTab, filterDateFrom, filterDateTo, selectedPersonId, selectedGeneralCode]);

  // Live Double-Entry Validation in Form
  const liveValidation = validateDoubleEntryVoucher(lines);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: `vl-new-${Date.now()}`,
        accountCode: accounts[0]?.code || '101',
        accountTitle: accounts[0]?.title || '',
        debit: 0,
        credit: 0,
        description: voucherDesc,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) {
      alert('سند حسابداری دوطرفه باید حداقل دو آرتیکل داشته باشد.');
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof VoucherLine, value: any) => {
    const updated = [...lines];
    if (field === 'accountCode') {
      const acc = accounts.find((a) => a.code === value);
      updated[idx].accountCode = value;
      if (acc) updated[idx].accountTitle = acc.title;
    } else if (field === 'personId') {
      const per = persons.find((p) => p.id === value);
      updated[idx].personId = value;
      updated[idx].personName = per ? per.name : undefined;
    } else {
      (updated[idx] as any)[field] = value;
    }
    setLines(updated);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!liveValidation.isValid) {
      setFormError(liveValidation.errorMessage || 'سند تراز نیست.');
      return;
    }

    try {
      setIsSaving(true);
      await api.createVoucher({
        date: voucherDate,
        description: voucherDesc || 'ثبت سند دستی دوطرفه حسابداری',
        lines,
      });
      setIsAddModalOpen(false);
      setVoucherDesc('');
      setLines([
        { id: '1', accountCode: '10101', accountTitle: 'صندوق اصلی فروشگاه', debit: 0, credit: 0, description: '' },
        { id: '2', accountCode: '401', accountTitle: 'درآمد حاصل از فروش کالا و ملزومات', debit: 0, credit: 0, description: '' },
      ]);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت سند حسابداری');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverseVoucher = async () => {
    if (!voucherToReverse) return;
    try {
      setIsSaving(true);
      await api.reverseVoucher(voucherToReverse.id, reverseReason || 'اصلاح سند قطعی');
      setVoucherToReverse(null);
      setReverseReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در صدور سند اصلاحی معکوس');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNum = v.voucherNumber.includes(s);
      const matchDesc = v.description.toLowerCase().includes(s);
      const matchLines = v.lines.some(
        (l) => l.accountTitle.toLowerCase().includes(s) || l.description?.toLowerCase().includes(s)
      );
      if (!matchNum && !matchDesc && !matchLines) return false;
    }
    if (filterDateFrom && v.date < filterDateFrom) return false;
    if (filterDateTo && v.date > filterDateTo) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">موتور حسابداری دوطرفه و دفاتر قانونی</h1>
            <p className="text-sm text-slate-500 mt-1">
              ثبت سند دستی، اسناد خودکار، دفاتر روزنامه، کل، معین، تفصیلی، تراز آزمایشی و کنترل توازن
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سند دستی جدید</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'vouchers'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>اسناد حسابداری</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'vouchers' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {toPersianDigits(vouchers.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'journal'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>دفتر روزنامه</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'general'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>دفتر کل</span>
        </button>

        <button
          onClick={() => setActiveTab('subsidiary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'subsidiary'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>دفتر معین</span>
        </button>

        <button
          onClick={() => setActiveTab('persons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'persons'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>دفتر تفصیلی اشخاص</span>
        </button>

        <button
          onClick={() => setActiveTab('trialBalance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'trialBalance'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>تراز آزمایشی</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>ممیزی و کنترل توازن</span>
        </button>

        <button
          onClick={() => setActiveTab('chart')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition shrink-0 ${
            activeTab === 'chart'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ListTree className="w-4 h-4" />
          <span>کدینگ حساب‌ها</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجو در شرح سند، شماره، کد یا عنوان حساب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">از تاریخ:</span>
          <input
            type="text"
            placeholder="1403/01/01"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">تا تاریخ:</span>
          <input
            type="text"
            placeholder="1403/12/29"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {activeTab === 'subsidiary' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">فیلتر حساب کل:</span>
            <select
              value={selectedGeneralCode}
              onChange={(e) => setSelectedGeneralCode(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">همه حساب‌های کل</option>
              {accounts
                .filter((a) => a.level === 'general')
                .map((a) => (
                  <option key={a.code} value={a.code}>
                    {toPersianDigits(a.code)} - {a.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        {activeTab === 'persons' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">شخص:</span>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">همه اشخاص و طرف‌های حساب</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.personType === 'customer' ? 'مشتری' : p.personType === 'supplier' ? 'تأمین‌کننده' : 'دو طرفه'})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'trialBalance' && (
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTrialBalanceColumns('4')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                trialBalanceColumns === '4' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              تراز ۴ ستونی
            </button>
            <button
              onClick={() => setTrialBalanceColumns('6')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                trialBalanceColumns === '6' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              تراز ۶ ستونی (جامع)
            </button>
          </div>
        )}
      </div>

      {/* 1. Tab: Vouchers List */}
      {activeTab === 'vouchers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">فهرست کلیه اسناد حسابداری ثبت‌شده</span>
            <span className="text-xs text-slate-500">
              تعداد اسناد: {toPersianDigits(filteredVouchers.length)} سند
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">شماره سند</th>
                  <th className="py-3 px-4">تاریخ</th>
                  <th className="py-3 px-4">شرح سند</th>
                  <th className="py-3 px-4">منشأ / عطف</th>
                  <th className="py-3 px-4 text-left">مبلغ تراز (ریال)</th>
                  <th className="py-3 px-4 text-center">وضعیت</th>
                  <th className="py-3 px-4 text-center">تراز</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      هیچ سند حسابداری مطابق با فیلترها یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((vch) => (
                    <tr key={vch.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {toPersianDigits(vch.voucherNumber)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{toPersianDigits(vch.date)}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium max-w-xs truncate">
                        {vch.description}
                        {vch.reversalOfVoucherId && (
                          <span className="mr-2 inline-block px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                            سند اصلاحی معکوس
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {vch.referenceNumber ? `عطف: ${vch.referenceNumber}` : 'دستی'}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-slate-800">
                        {formatMoney(vch.totalDebit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            vch.status === 'permanent'
                              ? 'bg-blue-100 text-blue-800'
                              : vch.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {vch.status === 'permanent'
                            ? 'بسته / قطعی'
                            : vch.status === 'approved'
                            ? 'تأیید شده'
                            : 'پیش‌نویس'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {vch.isBalanced ? (
                          <span className="text-emerald-600 flex items-center justify-center gap-1 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            تراز
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center justify-center gap-1 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4" />
                            ناهمخوان
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedVoucherForView(vch)}
                            title="مشاهده آرتیکل‌های سند"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!vch.reversalOfVoucherId && (
                            <button
                              onClick={() => {
                                setVoucherToReverse(vch);
                                setReverseReason('');
                              }}
                              title="صدور سند اصلاحی معکوس (ابطال مستند)"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            >
                              <RotateCcw className="w-4 h-4" />
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
      )}

      {/* 2. Tab: Journal Ledger (دفتر روزنامه) */}
      {activeTab === 'journal' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">دفتر روزنامه قانونی رویدادهای مالی</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت کلیه عملیات مالی به ترتیب وقوع تاریخی بر اساس استانداردهای رسمی حسابداری
              </p>
            </div>
            {journalData && (
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="text-slate-600">
                  جمع بدهکار: <strong className="font-mono text-slate-800">{formatMoney(journalData.totalDebit)}</strong>
                </span>
                <span className="text-slate-600">
                  جمع بستانکار: <strong className="font-mono text-slate-800">{formatMoney(journalData.totalCredit)}</strong>
                </span>
                <span className={`px-2.5 py-1 rounded-full font-bold ${journalData.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {journalData.isBalanced ? '✓ دفتر روزنامه کاملاً متوازن است' : '✕ عدم توازن در دفتر روزنامه'}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">ردیف</th>
                  <th className="py-3 px-3">شماره سند</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-3">کد حساب</th>
                  <th className="py-3 px-3">سرفصل و طرف حساب</th>
                  <th className="py-3 px-3">شرح آرتیکل</th>
                  <th className="py-3 px-3 text-left">بدهکار (ریال)</th>
                  <th className="py-3 px-3 text-left">بستانکار (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!journalData || journalData.entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      هیچ رکوردی در دفتر روزنامه برای این بازه ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  journalData.entries.map((entry) => (
                    <tr key={`${entry.voucherId}-${entry.rowNumber}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-xs">
                        {toPersianDigits(entry.rowNumber)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 text-xs">
                        {toPersianDigits(entry.voucherNumber)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{toPersianDigits(entry.date)}</td>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700">
                        {toPersianDigits(entry.accountCode)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">
                        {entry.accountTitle}
                        {entry.personName && (
                          <span className="text-xs text-indigo-600 mr-1.5 font-normal">
                            ({entry.personName})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{entry.description}</td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-800">
                        {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-800">
                        {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Tab: General Ledger (دفتر کل) */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">دفتر کل حسابداری (سطح حساب‌های کل)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                گردش و مانده تجمیعی حساب‌های اصلی شامل دارایی‌ها، بدهی‌ها، حقوق صاحبان سهام، درآمد و هزینه
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {generalLedger.map((acc) => (
              <div key={acc.accountCode} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-md font-bold">
                      کد {toPersianDigits(acc.accountCode)}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base">{acc.accountTitle}</h3>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500">جمع گردش بدهکار: </span>
                      <strong className="font-mono text-emerald-700 font-bold">{formatMoney(acc.totalDebit)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">جمع گردش بستانکار: </span>
                      <strong className="font-mono text-blue-700 font-bold">{formatMoney(acc.totalCredit)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">مانده نهایی دفتر کل: </span>
                      <strong className="font-mono text-indigo-700 text-sm font-bold">
                        {formatMoney(acc.closingBalance)}
                      </strong>
                      <span className={`mr-1 px-2 py-0.5 rounded text-xs ${acc.balanceNature === 'debit' ? 'bg-emerald-100 text-emerald-800' : acc.balanceNature === 'credit' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200'}`}>
                        {acc.balanceNature === 'debit' ? 'بدهکار' : acc.balanceNature === 'credit' ? 'بستانکار' : 'صفر'}
                      </span>
                    </div>
                  </div>
                </div>

                {acc.entries.length > 0 && (
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100/50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">سند</th>
                          <th className="py-2 px-3">تاریخ</th>
                          <th className="py-2 px-3">شرح</th>
                          <th className="py-2 px-3 text-left">بدهکار (ریال)</th>
                          <th className="py-2 px-3 text-left">بستانکار (ریال)</th>
                          <th className="py-2 px-3 text-left">مانده متحرک</th>
                          <th className="py-2 px-3 text-center">ماهیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {acc.entries.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{toPersianDigits(it.voucherNumber)}</td>
                            <td className="py-2 px-3 text-slate-500">{toPersianDigits(it.date)}</td>
                            <td className="py-2 px-3 text-slate-700">{it.description}</td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-emerald-700">
                              {it.debit > 0 ? formatMoney(it.debit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-blue-700">
                              {it.credit > 0 ? formatMoney(it.credit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-800">
                              {formatMoney(it.runningBalance)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[11px] text-slate-500">
                                {it.runningNature === 'debit' ? 'بد' : it.runningNature === 'credit' ? 'بس' : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tab: Subsidiary Ledger (دفتر معین) */}
      {activeTab === 'subsidiary' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">دفتر معین حسابداری (سطح تفکیکی معین)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                گردش و مانده هر حساب معین نظیر صندوق‌ها، بانک‌ها، کارتخوان‌ها، طرف‌های حساب و درآمد/هزینه‌ها
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {subsidiaryLedger.map((acc) => (
              <div key={acc.accountCode} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                      کد معین: {toPersianDigits(acc.accountCode)}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base">{acc.accountTitle}</h3>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500">گردش بدهکار: </span>
                      <strong className="font-mono text-emerald-700">{formatMoney(acc.totalDebit)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">گردش بستانکار: </span>
                      <strong className="font-mono text-blue-700">{formatMoney(acc.totalCredit)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">مانده معین: </span>
                      <strong className="font-mono text-indigo-700 text-sm font-bold">
                        {formatMoney(acc.closingBalance)}
                      </strong>
                      <span className={`mr-1 px-2 py-0.5 rounded text-xs ${acc.balanceNature === 'debit' ? 'bg-emerald-100 text-emerald-800' : acc.balanceNature === 'credit' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200'}`}>
                        {acc.balanceNature === 'debit' ? 'بدهکار' : acc.balanceNature === 'credit' ? 'بستانکار' : 'تسویه'}
                      </span>
                    </div>
                  </div>
                </div>

                {acc.entries.length > 0 && (
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100/50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">سند</th>
                          <th className="py-2 px-3">تاریخ</th>
                          <th className="py-2 px-3">شرح</th>
                          <th className="py-2 px-3 text-left">بدهکار (ریال)</th>
                          <th className="py-2 px-3 text-left">بستانکار (ریال)</th>
                          <th className="py-2 px-3 text-left">مانده لحظه‌ای</th>
                          <th className="py-2 px-3 text-center">ماهیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {acc.entries.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{toPersianDigits(it.voucherNumber)}</td>
                            <td className="py-2 px-3 text-slate-500">{toPersianDigits(it.date)}</td>
                            <td className="py-2 px-3 text-slate-700">{it.description}</td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-emerald-700">
                              {it.debit > 0 ? formatMoney(it.debit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-blue-700">
                              {it.credit > 0 ? formatMoney(it.credit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-800">
                              {formatMoney(it.runningBalance)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[11px] text-slate-500">
                                {it.runningNature === 'debit' ? 'بد' : it.runningNature === 'credit' ? 'بس' : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Tab: Detailed Person Ledger (دفتر تفصیلی اشخاص) */}
      {activeTab === 'persons' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">دفتر تفصیلی اشخاص و تطبیق مانده</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                کاردکس حسابداری مشتریان و تأمین‌کنندگان با تطبیق مانده دفتری و ثبت‌شده در سیستم
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {personLedger.map((pl) => (
              <div key={pl.personId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                      {pl.personName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{pl.personName}</h3>
                      <span className="text-xs text-slate-500">
                        {pl.personType === 'customer' ? 'مشتری' : pl.personType === 'supplier' ? 'تأمین‌کننده' : 'مشتری و تأمین‌کننده'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500">مانده دفتری اسناد: </span>
                      <strong className="font-mono text-indigo-700 text-sm font-bold">
                        {formatMoney(Math.abs(pl.currentLedgerBalance))}
                      </strong>
                      <span className={`mr-1 px-2 py-0.5 rounded text-xs ${pl.balanceNature === 'بدهکار' ? 'bg-amber-100 text-amber-800' : pl.balanceNature === 'بستانکار' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                        {pl.balanceNature}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">مانده ثبت‌شده شخص: </span>
                      <strong className="font-mono text-slate-700">
                        {formatMoney(Math.abs(pl.recordedBalance))}
                      </strong>
                    </div>

                    <div>
                      {pl.isReconciled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                          <CheckCircle2 className="w-4 h-4" />
                          تطبیق کامل با اسناد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-1 rounded">
                          <AlertCircle className="w-4 h-4" />
                          مغایرت: {formatMoney(pl.variance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {pl.entries.length > 0 ? (
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100/50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">سند</th>
                          <th className="py-2 px-3">تاریخ</th>
                          <th className="py-2 px-3">سرفصل حساب</th>
                          <th className="py-2 px-3">شرح تراکنش</th>
                          <th className="py-2 px-3 text-left">بدهکار (افزایش طلب ما)</th>
                          <th className="py-2 px-3 text-left">بستانکار (پرداخت/تسویه)</th>
                          <th className="py-2 px-3 text-left">مانده لحظه‌ای</th>
                          <th className="py-2 px-3 text-center">ماهیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pl.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{toPersianDigits(entry.voucherNumber)}</td>
                            <td className="py-2 px-3 text-slate-500">{toPersianDigits(entry.date)}</td>
                            <td className="py-2 px-3 text-slate-700">{entry.accountTitle}</td>
                            <td className="py-2 px-3 text-slate-600">{entry.description}</td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-emerald-700">
                              {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-medium text-blue-700">
                              {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-800">
                              {formatMoney(Math.abs(entry.runningBalance))}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[11px] text-slate-500">{entry.runningNature}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    گردش سندی در بازه زمانی برای این شخص ثبت نشده است.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tab: Trial Balance (تراز آزمایشی ۴ و ۶ ستونی) */}
      {activeTab === 'trialBalance' && trialBalance && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                تراز آزمایشی حساب‌ها ({trialBalanceColumns === '4' ? '۴ ستونی' : '۶ ستونی جامع'})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                کنترل توازن گردش و مانده کلیه سرفصل‌های فعال حسابداری در دوره‌های مالی
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${trialBalance.isTurnoverBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {trialBalance.isTurnoverBalanced ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                گردش طی دوره: {trialBalance.isTurnoverBalanced ? 'متوازن' : 'نامتوازن'}
              </span>

              <span className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${trialBalance.isClosingBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {trialBalance.isClosingBalanced ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                مانده پایان دوره: {trialBalance.isClosingBalanced ? 'متوازن' : 'نامتوازن'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th rowSpan={2} className="py-2 px-3 border-l border-slate-200">کد</th>
                  <th rowSpan={2} className="py-2 px-3 border-l border-slate-200">عنوان حساب</th>
                  <th rowSpan={2} className="py-2 px-3 border-l border-slate-200 text-center">سطح</th>

                  {trialBalanceColumns === '6' && (
                    <th colSpan={2} className="py-2 px-3 text-center border-l border-slate-200 bg-slate-200/60">
                      مانده ابتدای دوره
                    </th>
                  )}

                  <th colSpan={2} className="py-2 px-3 text-center border-l border-slate-200 bg-indigo-50">
                    گردش طی دوره
                  </th>

                  <th colSpan={2} className="py-2 px-3 text-center bg-emerald-50">
                    مانده پایان دوره
                  </th>
                </tr>
                <tr>
                  {trialBalanceColumns === '6' && (
                    <>
                      <th className="py-2 px-3 text-left border-l border-slate-200 bg-slate-200/40">بدهکار</th>
                      <th className="py-2 px-3 text-left border-l border-slate-200 bg-slate-200/40">بستانکار</th>
                    </>
                  )}
                  <th className="py-2 px-3 text-left border-l border-slate-200 bg-indigo-100/50">بدهکار</th>
                  <th className="py-2 px-3 text-left border-l border-slate-200 bg-indigo-100/50">بستانکار</th>
                  <th className="py-2 px-3 text-left border-l border-slate-200 bg-emerald-100/50">بدهکار</th>
                  <th className="py-2 px-3 text-left bg-emerald-100/50">بستانکار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialBalance.rows.map((row) => (
                  <tr
                    key={row.code}
                    className={`hover:bg-slate-50 ${
                      row.level === 'general' ? 'font-bold bg-slate-50/70' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-slate-700 border-l border-slate-100">
                      {toPersianDigits(row.code)}
                    </td>
                    <td className="py-2 px-3 border-l border-slate-100 text-slate-800">
                      <span className={row.level === 'subsidiary' ? 'pr-4 text-slate-600' : ''}>
                        {row.title}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center border-l border-slate-100">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${row.level === 'general' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                        {row.level === 'general' ? 'کل' : 'معین'}
                      </span>
                    </td>

                    {trialBalanceColumns === '6' && (
                      <>
                        <td className="py-2 px-3 text-left font-mono border-l border-slate-100">
                          {row.initialDebit > 0 ? formatMoney(row.initialDebit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono border-l border-slate-100">
                          {row.initialCredit > 0 ? formatMoney(row.initialCredit) : '-'}
                        </td>
                      </>
                    )}

                    <td className="py-2 px-3 text-left font-mono border-l border-slate-100 text-indigo-700">
                      {row.turnoverDebit > 0 ? formatMoney(row.turnoverDebit) : '-'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono border-l border-slate-100 text-indigo-700">
                      {row.turnoverCredit > 0 ? formatMoney(row.turnoverCredit) : '-'}
                    </td>

                    <td className="py-2 px-3 text-left font-mono border-l border-slate-100 text-emerald-700 font-bold">
                      {row.closingDebit > 0 ? formatMoney(row.closingDebit) : '-'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono text-blue-700 font-bold">
                      {row.closingCredit > 0 ? formatMoney(row.closingCredit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-200/70 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="py-3 px-3 text-center border-l border-slate-300 text-slate-800">
                    مجموع کل ستون‌ها (تراز نهایی)
                  </td>

                  {trialBalanceColumns === '6' && (
                    <>
                      <td className="py-3 px-3 text-left font-mono border-l border-slate-300">
                        {formatMoney(trialBalance.totalInitialDebit)}
                      </td>
                      <td className="py-3 px-3 text-left font-mono border-l border-slate-300">
                        {formatMoney(trialBalance.totalInitialCredit)}
                      </td>
                    </>
                  )}

                  <td className="py-3 px-3 text-left font-mono border-l border-slate-300 text-indigo-900">
                    {formatMoney(trialBalance.totalTurnoverDebit)}
                  </td>
                  <td className="py-3 px-3 text-left font-mono border-l border-slate-300 text-indigo-900">
                    {formatMoney(trialBalance.totalTurnoverCredit)}
                  </td>

                  <td className="py-3 px-3 text-left font-mono border-l border-slate-300 text-emerald-900">
                    {formatMoney(trialBalance.totalClosingDebit)}
                  </td>
                  <td className="py-3 px-3 text-left font-mono text-blue-900">
                    {formatMoney(trialBalance.totalClosingCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 7. Tab: Audit & Integrity Control (ممیزی و کنترل توازن) */}
      {activeTab === 'audit' && auditReport && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${auditReport.isIntegrityPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {auditReport.isIntegrityPassed ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">وضعیت کلی سلامت و توازن حسابداری</h2>
                <p className="text-xs text-slate-500 mt-1">
                  ارزیابی جامع توازن اسناد، تطبیق اشخاص با دفاتر، و راستی‌آزمایی مانده خزانه‌داری
                </p>
              </div>
            </div>

            <div className={`px-4 py-2 rounded-xl text-sm font-bold ${auditReport.isIntegrityPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {auditReport.isIntegrityPassed ? '✓ کلیه آزمون‌های سلامت با موفقیت پاس شدند' : '✕ سیستم دارای عدم انطباق حسابداری است'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Voucher Balance Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">توازن اسناد دوبل</span>
                {auditReport.checks.vouchersBalanced ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
              </div>
              <p className="text-xs text-slate-500">
                بررسی برابری دقیق بدهکار و بستانکار در کلیه اسناد صادرشده
              </p>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                <span className="text-slate-500">اسناد ناهمخوان:</span>
                <span className="font-bold text-slate-800">
                  {toPersianDigits(auditReport.metrics.unbalancedVouchersCount)} مورد
                </span>
              </div>
            </div>

            {/* Persons Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">تطبیق حساب اشخاص</span>
                {auditReport.checks.personsReconciled ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
              </div>
              <p className="text-xs text-slate-500">
                برابری مانده تفصیلی مشتریان و تأمین‌کنندگان با دفاتر حسابداری
              </p>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                <span className="text-slate-500">اشخاص مغایر:</span>
                <span className="font-bold text-slate-800">
                  {toPersianDigits(auditReport.metrics.personsWithVarianceCount)} نفر
                </span>
              </div>
            </div>

            {/* Treasury Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">تطبیق صندوق و بانک</span>
                {auditReport.checks.treasuryReconciled ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
              </div>
              <p className="text-xs text-slate-500">
                برابری موجودی واقعی صندوق‌ها و بانک‌ها با اسناد حسابداری
              </p>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                <span className="text-slate-500">حساب‌های مغایر:</span>
                <span className="font-bold text-slate-800">
                  {toPersianDigits(auditReport.metrics.treasuryAccountsWithVarianceCount)} حساب
                </span>
              </div>
            </div>
          </div>

          {/* Audit Trail & Issues Details */}
          {auditReport.issues.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-rose-800">مغایرت‌ها و هشدارهای نیازمند بررسی:</h3>
              <ul className="list-disc list-inside text-xs text-rose-700 space-y-1">
                {auditReport.issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 8. Tab: Chart of Accounts (کدینگ سرفصل‌ها) */}
      {activeTab === 'chart' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">درختواره کدینگ سرفصل‌های حسابداری</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                استاندارد سلسله‌مراتبی حسابداری (سطوح: گروه حساب، حساب کل، حساب معین)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">کد حساب</th>
                  <th className="py-3 px-4">عنوان حساب</th>
                  <th className="py-3 px-4">سطح</th>
                  <th className="py-3 px-4">نوع ماهیت</th>
                  <th className="py-3 px-4">کد والد</th>
                  <th className="py-3 px-4 text-left">مانده اولیه (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className={`hover:bg-slate-50 ${
                      acc.level === 'group'
                        ? 'font-bold bg-slate-100/50 text-slate-900'
                        : acc.level === 'general'
                        ? 'font-semibold text-slate-800'
                        : 'text-slate-600'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                      {toPersianDigits(acc.code)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={
                          acc.level === 'subsidiary'
                            ? 'pr-6 text-slate-700'
                            : acc.level === 'general'
                            ? 'pr-2'
                            : ''
                        }
                      >
                        {acc.title}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          acc.level === 'group'
                            ? 'bg-purple-100 text-purple-800'
                            : acc.level === 'general'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {acc.level === 'group'
                          ? 'گروه'
                          : acc.level === 'general'
                          ? 'کل'
                          : 'معین'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      {acc.type === 'asset'
                        ? 'دارایی'
                        : acc.type === 'liability'
                        ? 'بدهی'
                        : acc.type === 'equity'
                        ? 'حقوق مالکانه'
                        : acc.type === 'revenue'
                        ? 'درآمد'
                        : 'هزینه'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
                      {acc.parentCode ? toPersianDigits(acc.parentCode) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-medium text-slate-800">
                      {acc.balance ? formatMoney(acc.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Manual Voucher */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">ثبت سند دستی دوطرفه حسابداری</h3>
                  <p className="text-xs text-slate-500">
                    رعایت اصل برابری بدهکار و بستانکار و جلوگیری از صدور سند تکراری
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-6 overflow-y-auto space-y-6 flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    تاریخ سند:
                  </label>
                  <input
                    type="text"
                    required
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    شرح کلی سند:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: هزینه تنخواه دخل و باربری روزمره..."
                    value={voucherDesc}
                    onChange={(e) => setVoucherDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Lines Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">آرتیکل‌ها (سطور بدهکار و بستانکار)</h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن سطر جدید</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">کد و عنوان سرفصل</th>
                        <th className="py-2.5 px-3">شخص مرتبط (تفصیلی)</th>
                        <th className="py-2.5 px-3">شرح آرتیکل</th>
                        <th className="py-2.5 px-3 text-left w-36">بدهکار (ریال)</th>
                        <th className="py-2.5 px-3 text-left w-36">بستانکار (ریال)</th>
                        <th className="py-2.5 px-2 text-center w-10">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => (
                        <tr key={line.id} className="hover:bg-slate-50">
                          <td className="p-2">
                            <select
                              value={line.accountCode}
                              onChange={(e) => handleLineChange(idx, 'accountCode', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              {accounts.map((a) => (
                                <option key={a.code} value={a.code}>
                                  {toPersianDigits(a.code)} - {a.title} ({a.level === 'subsidiary' ? 'معین' : a.level === 'general' ? 'کل' : 'گروه'})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2">
                            <select
                              value={line.personId || ''}
                              onChange={(e) => handleLineChange(idx, 'personId', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">(اختیاری) بدون شخص</option>
                              {persons.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={line.description || ''}
                              placeholder="شرح..."
                              onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={line.debit || ''}
                              onChange={(e) => handleLineChange(idx, 'debit', Number(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-left font-mono font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={line.credit || ''}
                              onChange={(e) => handleLineChange(idx, 'credit', Number(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-left font-mono font-bold text-blue-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-left text-slate-700">
                          جمع مبالغ سند:
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-emerald-700 font-bold">
                          {formatMoney(liveValidation.totalDebit)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-blue-700 font-bold">
                          {formatMoney(liveValidation.totalCredit)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Live Balance Status Bar */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    liveValidation.isBalanced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {liveValidation.isBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {liveValidation.isBalanced
                        ? 'سند حسابداری کاملاً تراز و آماده ثبت است.'
                        : liveValidation.errorMessage || 'سند حسابداری تراز نیست.'}
                    </span>
                  </div>

                  {liveValidation.variance !== 0 && (
                    <span className="font-mono">
                      اختلاف: {formatMoney(Math.abs(liveValidation.variance))}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!liveValidation.isValid || isSaving}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSaving ? 'در حال ثبت...' : 'ثبت قطعی سند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Voucher Articles */}
      {selectedVoucherForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-800">
                    سند حسابداری شماره {toPersianDigits(selectedVoucherForView.voucherNumber)}
                  </h3>
                  <span className="text-xs text-slate-500">
                    تاریخ: {toPersianDigits(selectedVoucherForView.date)} | ثبت‌کننده: {selectedVoucherForView.createdBy}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVoucherForView(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
                <strong>شرح سند: </strong>
                <span>{selectedVoucherForView.description}</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">کد حساب</th>
                      <th className="py-2.5 px-3">سرفصل</th>
                      <th className="py-2.5 px-3">شخص تفصیلی</th>
                      <th className="py-2.5 px-3">شرح آرتیکل</th>
                      <th className="py-2.5 px-3 text-left">بدهکار (ریال)</th>
                      <th className="py-2.5 px-3 text-left">بستانکار (ریال)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVoucherForView.lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">
                          {toPersianDigits(l.accountCode)}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{l.accountTitle}</td>
                        <td className="py-2 px-3 text-indigo-600">{l.personName || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{l.description || '-'}</td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-emerald-700">
                          {l.debit > 0 ? formatMoney(l.debit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-blue-700">
                          {l.credit > 0 ? formatMoney(l.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-left">
                        مجموع تراز:
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-emerald-800">
                        {formatMoney(selectedVoucherForView.totalDebit)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-blue-800">
                        {formatMoney(selectedVoucherForView.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedVoucherForView(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reverse Voucher (سند اصلاحی معکوس) */}
      {voucherToReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-amber-700" />
                <div>
                  <h3 className="font-bold text-slate-800">صدور سند اصلاحی معکوس (ابطال مستند)</h3>
                  <p className="text-xs text-slate-500">
                    سند قطعی شماره {toPersianDigits(voucherToReverse.voucherNumber)} بدون حذف، با سند معکوس اصلاح می‌شود.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVoucherToReverse(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">شماره سند مبدأ:</span>
                  <span className="font-bold font-mono">{toPersianDigits(voucherToReverse.voucherNumber)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ سند:</span>
                  <span className="font-bold font-mono">{formatMoney(voucherToReverse.totalDebit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">شرح سند اصلی:</span>
                  <span className="text-slate-800">{voucherToReverse.description}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  دلیل مستند صدور سند اصلاحی معکوس:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="مثال: اشتباه در درج کد حسابداری یا مبلغ پرداختی، نیاز به ابطال و صدور مجدد..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <p className="text-xs text-amber-700 leading-relaxed bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                توجه: طبق اصول حسابداری، اسناد قطعی حذف فیزیکی نمی‌شوند. با تایید این عملیات، یک سند با مقادیر بدهکار و بستانکار کاملاً معکوس و دارای ردگیری حسابرسی در سیستم صادر خواهد شد.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVoucherToReverse(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-100 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleReverseVoucher}
                disabled={isSaving}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {isSaving ? 'در حال صدور...' : 'تأیید و صدور سند معکوس'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
