import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  X,
  History,
  Check,
  ArrowRightLeft,
  User,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { Cheque, ChequeStatus, Person, TreasuryAccount } from '../../types/index.ts';
import { toPersianDigits, formatCurrency, getCurrentJalaliDate } from '../../lib/formatters.ts';

export const ChequesModule: React.FC = () => {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'received' | 'issued'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // New Cheque Form (Supports direct endorsement Customer A -> Supplier B)
  const [chequeType, setChequeType] = useState<'received' | 'issued'>('received');
  const [directEndorse, setDirectEndorse] = useState<boolean>(false);
  const [chequeNumber, setChequeNumber] = useState('');
  const [sayadNumber, setSayadNumber] = useState('');
  const [bankName, setBankName] = useState('بانک ملت');
  const [branchName, setBranchName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(getCurrentJalaliDate());
  const [personId, setPersonId] = useState('');
  const [endorseTargetPersonId, setEndorseTargetPersonId] = useState('');
  const [notes, setNotes] = useState('');
  const [createError, setCreateError] = useState('');

  // Transition Form
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [targetStatus, setTargetStatus] = useState<ChequeStatus>('collected');
  const [bankAccountId, setBankAccountId] = useState('');
  const [transferredPersonId, setTransferredPersonId] = useState('');
  const [bounceReason, setBounceReason] = useState('کسری موجودی در حساب صادرکننده');
  const [transitionDesc, setTransitionDesc] = useState('');
  const [transitionError, setTransitionError] = useState('');

  // History Target
  const [historyCheque, setHistoryCheque] = useState<Cheque | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cList, pList, aList] = await Promise.all([
        api.getCheques().catch(() => []),
        api.getPersons().catch(() => []),
        api.getTreasuryAccounts().catch(() => []),
      ]);
      setCheques(cList);
      setPersons(pList);
      setAccounts(aList);
      if (pList.length > 0) {
        const customer = pList.find((p) => p.personType === 'customer') || pList[0];
        const supplier = pList.find((p) => p.personType === 'supplier' && p.id !== customer.id) || pList[pList.length - 1];
        setPersonId(customer.id);
        setTransferredPersonId(supplier.id);
        setEndorseTargetPersonId(supplier.id);
      }
      if (aList.length > 0) {
        setBankAccountId(aList.find((a) => a.type === 'bank')?.id || aList[0].id);
      }
    } catch (err) {
      console.error('Failed to load cheques:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const amountNum = parseFloat(amount) || 0;
    if (!chequeNumber.trim() || amountNum <= 0) {
      setCreateError('شماره سریال چک و مبلغ بزرگتر از صفر الزامی است.');
      return;
    }
    if (chequeType === 'received' && directEndorse && personId === endorseTargetPersonId) {
      setCreateError('شخص واگذارکننده (مشتری) و شخص گیرنده خرج چک (تأمین‌کننده) نمی‌توانند یکسان باشند.');
      return;
    }

    try {
      await api.saveCheque({
        chequeNumber: chequeNumber.trim(),
        sayadNumber: sayadNumber.trim(),
        bankName,
        branchName,
        amount: amountNum,
        issueDate: getCurrentJalaliDate(),
        dueDate,
        personId,
        chequeType,
        status: chequeType === 'received' && directEndorse ? 'transferred' : 'registered',
        transferredPersonId: chequeType === 'received' && directEndorse ? endorseTargetPersonId : undefined,
        notes,
      });

      setIsModalOpen(false);
      setChequeNumber('');
      setSayadNumber('');
      setAmount('');
      setNotes('');
      setDirectEndorse(false);
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'خطا در ثبت چک');
    }
  };

  const handleOpenTransition = (c: Cheque, status: ChequeStatus) => {
    setSelectedCheque(c);
    setTargetStatus(status);
    setTransitionError('');
    setTransitionDesc('');
    const otherPerson = persons.find((p) => p.id !== c.personId && (p.personType === 'supplier' || p.personType === 'both')) || persons.find((p) => p.id !== c.personId);
    if (otherPerson) {
      setTransferredPersonId(otherPerson.id);
    }
    setIsTransitionModalOpen(true);
  };

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;
    setTransitionError('');

    try {
      await api.transitionChequeStatus(selectedCheque.id, targetStatus, {
        bankAccountId,
        transferredPersonId,
        bounceReason,
        description: transitionDesc,
      });

      setIsTransitionModalOpen(false);
      setSelectedCheque(null);
      await loadData();
    } catch (err: any) {
      setTransitionError(err.message || 'خطا در تغییر وضعیت چک.');
    }
  };

  const filteredCheques = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cheques.filter((c) => {
      const matchesSearch =
        !q ||
        c.chequeNumber.toLowerCase().includes(q) ||
        (c.sayadNumber && c.sayadNumber.includes(q)) ||
        (c.sayadId && c.sayadId.includes(q)) ||
        c.personName.toLowerCase().includes(q) ||
        (c.transferredPersonName && c.transferredPersonName.toLowerCase().includes(q)) ||
        c.bankName.toLowerCase().includes(q);
      const matchesType = filterType === 'all' || c.chequeType === filterType;
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [cheques, searchTerm, filterType, filterStatus]);

  const totalInProcess = cheques
    .filter((c) => c.status === 'registered' || c.status === 'in_process' || c.status === 'deposited')
    .reduce((s, c) => s + c.amount, 0);

  const selectedEndorseTarget = useMemo(
    () => persons.find((p) => p.id === transferredPersonId) || null,
    [persons, transferredPersonId]
  );

  const getStatusBadge = (c: Cheque) => {
    switch (c.status) {
      case 'registered':
      case 'in_process':
        return (
          <span className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
            نزد صندوق
          </span>
        );
      case 'deposited':
        return (
          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold border border-blue-200 dark:border-blue-800">
            واگذار به بانک
          </span>
        );
      case 'collected':
      case 'cleared':
        return (
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
            وصول / پاس شده
          </span>
        );
      case 'transferred':
        return (
          <div className="inline-flex flex-col items-center">
            <span className="text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-200 dark:border-purple-800">
              خرج شده به شخص ثالث
            </span>
            {c.transferredPersonName && (
              <span className="text-[9.5px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                ← {c.transferredPersonName}
              </span>
            )}
          </div>
        );
      case 'bounced':
        return (
          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold border border-rose-200 dark:border-rose-800">
            برگشت خورده
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
            {c.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
            مدیریت اسناد تجاری، چک‌های صیادی و خرج چک
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            دریافت، پرداخت، واگذاری به بانک و خرج مستقیم چک مشتری به بنکدار با اصلاح خودکار حساب هر دو شخص
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setChequeType('received');
              setDirectEndorse(true);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>ثبت و خرج مستقیم چک</span>
          </button>
          <button
            onClick={() => {
              setDirectEndorse(false);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت چک جدید</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">چک‌های در جریان و سررسید:</span>
          <div className="mt-1.5 text-lg font-black text-indigo-600 dark:text-indigo-400">
            {formatCurrency(totalInProcess)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">چک‌های دریافتی از مشتریان:</span>
          <div className="mt-1.5 text-lg font-black text-emerald-600 dark:text-emerald-400">
            {toPersianDigits(cheques.filter((c) => c.chequeType === 'received').length)} فقره
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">چک‌های خرج‌شده (واگذار به غیر):</span>
          <div className="mt-1.5 text-lg font-black text-purple-600 dark:text-purple-400">
            {toPersianDigits(cheques.filter((c) => c.status === 'transferred').length)} فقره
          </div>
        </div>
      </div>

      {/* Instant Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی فوری شماره چک، شناسه صیاد، نام واگذارکننده یا گیرنده خرج چک..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'received', 'issued'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === type
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {type === 'all' ? 'همه چک‌ها' : type === 'received' ? 'دریافتی' : 'پرداختی'}
            </button>
          ))}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="registered">نزد صندوق</option>
            <option value="deposited">واگذار به بانک</option>
            <option value="transferred">خرج‌شده به شخص ثالث</option>
            <option value="collected">وصول / پاس شده</option>
            <option value="bounced">برگشتی</option>
          </select>
        </div>
      </div>

      {/* Cheques Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">نوع</th>
                <th className="py-3 px-4">شماره چک</th>
                <th className="py-3 px-4">شناسه صیاد</th>
                <th className="py-3 px-4">بانک عامل</th>
                <th className="py-3 px-4">طرف حساب اصلی</th>
                <th className="py-3 px-4">سررسید</th>
                <th className="py-3 px-4 text-left">مبلغ چک</th>
                <th className="py-3 px-4 text-center">وضعیت / گیرنده خرج</th>
                <th className="py-3 px-4 text-center">عملیات خزانه‌داری</th>
                <th className="py-3 px-4 text-center">سوابق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    هیچ چکی با مشخصات جستجو شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      {c.chequeType === 'received' ? (
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                          دریافتی
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-800">
                          پرداختی
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {toPersianDigits(c.chequeNumber)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {c.sayadNumber || c.sayadId ? toPersianDigits(c.sayadNumber || c.sayadId || '') : '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{c.bankName}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">{c.personName}</td>
                    <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {toPersianDigits(c.dueDate)}
                    </td>
                    <td className="py-3 px-4 text-left font-black text-slate-900 dark:text-white">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(c)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {c.chequeType === 'received' && (c.status === 'registered' || c.status === 'in_process') && (
                          <>
                            <button
                              onClick={() => handleOpenTransition(c, 'transferred')}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                              title="خرج چک و انتقال به شخص ثالث"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>خرج چک</span>
                            </button>
                            <button
                              onClick={() => handleOpenTransition(c, 'collected')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              وصول
                            </button>
                            <button
                              onClick={() => handleOpenTransition(c, 'deposited')}
                              className="px-2 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              به بانک
                            </button>
                          </>
                        )}

                        {c.chequeType === 'received' && c.status === 'deposited' && (
                          <>
                            <button
                              onClick={() => handleOpenTransition(c, 'collected')}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              وصول قطعی
                            </button>
                            <button
                              onClick={() => handleOpenTransition(c, 'bounced')}
                              className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              برگشت
                            </button>
                          </>
                        )}

                        {c.chequeType === 'issued' && (c.status === 'registered' || c.status === 'in_process') && (
                          <>
                            <button
                              onClick={() => handleOpenTransition(c, 'collected')}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              پاس شد
                            </button>
                            <button
                              onClick={() => handleOpenTransition(c, 'bounced')}
                              className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              برگشت
                            </button>
                          </>
                        )}

                        {(c.status === 'collected' || c.status === 'cleared' || c.status === 'transferred') && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5" /> ثبت‌شده
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setHistoryCheque(c);
                          setIsHistoryModalOpen(true);
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                      >
                        <History className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Cheque / Direct Endorsement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-800 dark:text-white">
                {directEndorse ? 'ثبت چک دریافتی از مشتری و خرج مستقیم به تامین‌کننده' : 'ثبت چک صیادی جدید'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCheque} className="p-4 space-y-3 text-xs">
              {createError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl font-bold border border-rose-200 dark:border-rose-800">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChequeType('received')}
                  className={`py-2 rounded-xl font-bold transition cursor-pointer ${
                    chequeType === 'received'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  چک دریافتی (از مشتری)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChequeType('issued');
                    setDirectEndorse(false);
                  }}
                  className={`py-2 rounded-xl font-bold transition cursor-pointer ${
                    chequeType === 'issued'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  چک پرداختی (به بنکدار)
                </button>
              </div>

              {chequeType === 'received' && (
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-purple-800 dark:text-purple-300">
                    خرج همزمان چک و انتقال مستقیم به طرف حساب سوم
                  </span>
                  <input
                    type="checkbox"
                    checked={directEndorse}
                    onChange={(e) => setDirectEndorse(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">شماره سریال چک *</label>
                  <input
                    type="text"
                    required
                    placeholder="784512"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">شناسه صیاد (۱۶ رقم)</label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="2105874512963341"
                    value={sayadNumber}
                    onChange={(e) => setSayadNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">بانک عامل *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">شعبه</label>
                  <input
                    type="text"
                    placeholder="شعبه بازار"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {chequeType === 'received' ? 'واگذارکننده چک (مشتری بستانکارشونده) *' : 'گیرنده چک (بنکدار بدهکارشونده) *'}
                </label>
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — (مانده فعلی: {formatCurrency(Math.abs(p.currentBalance))}{' '}
                      {p.currentBalance > 0 ? 'بدهکار' : p.currentBalance < 0 ? 'بستانکار' : 'تسویه'})
                    </option>
                  ))}
                </select>
              </div>

              {chequeType === 'received' && directEndorse && (
                <div>
                  <label className="block font-medium text-purple-700 dark:text-purple-300 mb-1">
                    گیرنده خرج چک (تأمین‌کننده / شخص ثالث بدهکارشونده) *
                  </label>
                  <select
                    value={endorseTargetPersonId}
                    onChange={(e) => setEndorseTargetPersonId(e.target.value)}
                    className="w-full p-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl font-bold"
                  >
                    {persons
                      .filter((p) => p.id !== personId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — (مانده فعلی: {formatCurrency(Math.abs(p.currentBalance))}{' '}
                          {p.currentBalance > 0 ? 'بدهکار' : p.currentBalance < 0 ? 'بستانکار' : 'تسویه'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">مبلغ چک (ریال) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">تاریخ سررسید *</label>
                  <input
                    type="text"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">توضیحات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات سند..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {directEndorse ? 'ثبت چک و خرج همزمان' : 'ثبت چک در سیستم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transition / Cheque Endorsement (خرج چک و انتقال) Modal */}
      {isTransitionModalOpen && selectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-800 dark:text-white text-sm">
                {targetStatus === 'transferred'
                  ? `خرج چک و انتقال به شخص ثالث (شماره ${toPersianDigits(selectedCheque.chequeNumber)})`
                  : `تغییر وضعیت چک شماره ${toPersianDigits(selectedCheque.chequeNumber)}`}
              </h3>
              <button onClick={() => setIsTransitionModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {transitionError && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-bold">
                {transitionError}
              </div>
            )}

            <form onSubmit={handleExecuteTransition} className="mt-4 space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">صادرکننده / واگذارکننده:</span>
                  <strong className="text-slate-800 dark:text-white">{selectedCheque.personName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ چک:</span>
                  <strong className="text-emerald-600 font-black">{formatCurrency(selectedCheque.amount)}</strong>
                </div>
              </div>

              {(targetStatus === 'deposited' || targetStatus === 'collected') && (
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">حساب بانکی مرتبط *</label>
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
                <div className="space-y-3">
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                      انتخاب شخص گیرنده چک (تأمین‌کننده / شخص ثالث) *
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
                            {p.name} ({p.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  {selectedEndorseTarget && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 space-y-1.5">
                      <div className="font-bold text-purple-800 dark:text-purple-300">
                        پیش‌نمایش اصلاح خودکار حساب گیرنده ({selectedEndorseTarget.name}):
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">مانده قبل از خرج چک:</span>
                        <strong className="font-bold">
                          {formatCurrency(Math.abs(selectedEndorseTarget.currentBalance))} (
                          {selectedEndorseTarget.currentBalance < 0
                            ? 'بستانکار'
                            : selectedEndorseTarget.currentBalance > 0
                            ? 'بدهکار'
                            : 'تسویه'}
                          )
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">مانده پس از دریافت چک:</span>
                        <strong className="text-purple-700 dark:text-purple-300 font-black">
                          {formatCurrency(Math.abs(selectedEndorseTarget.currentBalance + selectedCheque.amount))} (
                          {selectedEndorseTarget.currentBalance + selectedCheque.amount < 0
                            ? 'بستانکار'
                            : selectedEndorseTarget.currentBalance + selectedCheque.amount > 0
                            ? 'بدهکار'
                            : 'تسویه'}
                          )
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {targetStatus === 'bounced' && (
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">علت برگشت *</label>
                  <select
                    value={bounceReason}
                    onChange={(e) => setBounceReason(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="کسری موجودی در حساب صادرکننده">کسری موجودی در حساب صادرکننده</option>
                    <option value="عدم تطابق امضا">عدم تطابق امضا</option>
                    <option value="مسدودی حساب">مسدودی حساب</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">شرح سند حسابداری</label>
                <input
                  type="text"
                  placeholder="توضیحات..."
                  value={transitionDesc}
                  onChange={(e) => setTransitionDesc(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  تأیید و ثبت سند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-white">
                <History className="w-4 h-4 text-indigo-600" />
                <span>گردش چک شماره {toPersianDigits(historyCheque.chequeNumber)}</span>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {!historyCheque.statusHistory || historyCheque.statusHistory.length === 0 ? (
                <p className="text-center text-slate-400 py-4">سابقه‌ای ثبت نشده است.</p>
              ) : (
                historyCheque.statusHistory.map((item, idx) => (
                  <div key={item.id || idx} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center font-bold text-slate-800 dark:text-white">
                      <span>{item.actionTitle}</span>
                      <span className="text-slate-400 text-[11px]">{toPersianDigits(item.date)}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
