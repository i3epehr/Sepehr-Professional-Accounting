import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  CreditCard,
  Building,
  UserCheck,
  CheckCircle2,
  X,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  Power,
  ShieldAlert,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Tag,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Person, PersonType, PersonGroup } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { StatCardsGrid, StatCardItem } from '../common/StatCardsGrid.tsx';
import { StandardModal } from '../common/StandardModal.tsx';
import { Pagination } from '../common/Pagination.tsx';

type PersonsView = 'all' | 'debtors' | 'creditors' | 'statement' | 'groups';

export const PersonsHub: React.FC = () => {
  const { formatMoney } = useSettings();

  const [activeView, setActiveView] = useState<PersonsView>('all');
  const [persons, setPersons] = useState<Person[]>([]);
  const [personGroups, setPersonGroups] = useState<PersonGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Statement view state
  const [selectedStatementPersonId, setSelectedStatementPersonId] = useState<string>('');
  const [statementSummary, setStatementSummary] = useState<any>(null);
  const [isStatementLoading, setIsStatementLoading] = useState<boolean>(false);

  // Modals
  const [isPersonModalOpen, setIsPersonModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Partial<Person> | null>(null);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Group Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupLimit, setNewGroupLimit] = useState<number>(20000000);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [pers, grps] = await Promise.all([api.getPersons(), api.getPersonGroups()]);
      setPersons(pers);
      setPersonGroups(grps);

      if (pers.length > 0 && !selectedStatementPersonId) {
        setSelectedStatementPersonId(pers[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load persons data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch statement when statement person changes
  useEffect(() => {
    if (!selectedStatementPersonId) return;
    const fetchSummary = async () => {
      try {
        setIsStatementLoading(true);
        const data = await api.getPersonFinancialSummary(selectedStatementPersonId);
        setStatementSummary(data);
      } catch (err: any) {
        console.error('Failed to load person statement:', err);
      } finally {
        setIsStatementLoading(false);
      }
    };
    fetchSummary();
  }, [selectedStatementPersonId]);

  // Statistics
  const stats = useMemo(() => {
    let totalDebtors = 0;
    let debtorsCount = 0;
    let totalCreditors = 0;
    let creditorsCount = 0;
    let settledCount = 0;

    persons.forEach((p) => {
      if (p.currentBalance > 0) {
        totalDebtors += p.currentBalance;
        debtorsCount++;
      } else if (p.currentBalance < 0) {
        totalCreditors += Math.abs(p.currentBalance);
        creditorsCount++;
      } else {
        settledCount++;
      }
    });

    return {
      totalPersons: persons.length,
      totalDebtors,
      debtorsCount,
      totalCreditors,
      creditorsCount,
      settledCount,
    };
  }, [persons]);

  const statCards: StatCardItem[] = [
    {
      title: 'کل طرف‌های حساب',
      value: `${toPersianDigits(stats.totalPersons)} نفر / شرکت`,
      subtitle: <span>مشتریان و تأمین‌کنندگان فعال</span>,
      icon: Users,
      color: 'indigo',
    },
    {
      title: 'مجموع مطالبات از بدهکاران',
      value: formatMoney(stats.totalDebtors),
      subtitle: <span className="text-rose-600 font-bold">{toPersianDigits(stats.debtorsCount)} بدهکار</span>,
      icon: TrendingUp,
      color: 'rose',
    },
    {
      title: 'مجموع دیون به بنکداران و بستانکاران',
      value: formatMoney(stats.totalCreditors),
      subtitle: <span className="text-emerald-600 font-bold">{toPersianDigits(stats.creditorsCount)} بستانکار</span>,
      icon: TrendingDown,
      color: 'emerald',
    },
    {
      title: 'طرف‌های حساب بی‌حساب (تسویه)',
      value: `${toPersianDigits(stats.settledCount)} شخص`,
      subtitle: <span>مانده حساب صفر</span>,
      icon: UserCheck,
      color: 'slate',
    },
  ];

  const pillItems: SectionPillItem<PersonsView>[] = [
    {
      id: 'all',
      label: 'همه طرف‌های حساب',
      icon: Users,
      badge: toPersianDigits(persons.length),
    },
    {
      id: 'debtors',
      label: 'بدهکاران (مطالبات)',
      icon: TrendingUp,
      activeColor: 'bg-rose-600 text-white shadow-xs',
      badge: toPersianDigits(stats.debtorsCount),
    },
    {
      id: 'creditors',
      label: 'بستانکاران (تعهدات)',
      icon: TrendingDown,
      activeColor: 'bg-emerald-600 text-white shadow-xs',
      badge: toPersianDigits(stats.creditorsCount),
    },
    {
      id: 'statement',
      label: 'گردش حساب و معین اشخاص',
      icon: FileText,
    },
    {
      id: 'groups',
      label: 'گروه‌بندی و سقف اعتبار',
      icon: Tag,
      badge: toPersianDigits(personGroups.length),
    },
  ];

  // Filtered Persons List
  const filteredPersons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return persons.filter((p) => {
      if (activeView === 'debtors' && p.currentBalance <= 0) return false;
      if (activeView === 'creditors' && p.currentBalance >= 0) return false;
      if (selectedGroupFilter !== 'all' && p.groupId !== selectedGroupFilter) return false;
      if (selectedTypeFilter !== 'all' && p.personType !== selectedTypeFilter) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.mobile && p.mobile.includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        (p.groupName && p.groupName.toLowerCase().includes(q))
      );
    });
  }, [persons, activeView, searchTerm, selectedGroupFilter, selectedTypeFilter]);

  const paginatedPersons = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPersons.slice(start, start + pageSize);
  }, [filteredPersons, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedGroupFilter, selectedTypeFilter, activeView]);

  // Actions
  const handleOpenNewPerson = () => {
    const nextCode = `${persons.length + 1001}`;
    const defGroup = personGroups[0];
    setEditingPerson({
      code: nextCode,
      name: '',
      personType: 'customer',
      groupId: defGroup?.id || '',
      groupName: defGroup?.name || 'مشتریان حضوری و عادی',
      mobile: '',
      phone: '',
      creditLimit: defGroup?.defaultCreditLimit || 20000000,
      currentBalance: 0,
      isActive: true,
      notes: '',
    });
    setShowAdvancedSpecs(false);
    setIsPersonModalOpen(true);
  };

  const handleEditPerson = (p: Person) => {
    setEditingPerson({ ...p });
    setShowAdvancedSpecs(Boolean(p.nationalCode || p.economicCode || p.address || p.phone));
    setIsPersonModalOpen(true);
  };

  const handleToggleActive = async (p: Person) => {
    try {
      const updated = await api.togglePersonActive(p.id);
      setPersons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setToastMessage(`وضعیت طرف حساب به «${updated.isActive ? 'فعال' : 'غیرفعال'}» تغییر یافت.`);
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const handleDeletePerson = async (p: Person) => {
    if (!window.confirm(`آیا از حذف طرف حساب «${p.name}» اطمینان دارید؟`)) return;
    try {
      await api.deletePerson(p.id);
      setPersons((prev) => prev.filter((item) => item.id !== p.id));
      setToastMessage(`طرف حساب «${p.name}» با موفقیت حذف شد.`);
    } catch (err: any) {
      alert(`حذف طرف حساب به دلیل وجود سوابق مالی و اسناد امکان‌پذیر نیست: ${err.message} (می‌توانید شخص را غیرفعال کنید)`);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson?.name?.trim() || !editingPerson?.code?.trim()) {
      alert('لطفاً نام و کد طرف حساب را وارد کنید.');
      return;
    }

    try {
      setIsSaving(true);
      const saved = await api.savePerson({
        ...editingPerson,
        name: editingPerson.name.trim(),
        code: editingPerson.code.trim(),
      });

      setPersons((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx !== -1) {
          const list = [...prev];
          list[idx] = saved;
          return list;
        }
        return [saved, ...prev];
      });

      setIsPersonModalOpen(false);
      setEditingPerson(null);
      setToastMessage(`طرف حساب «${saved.name}» با موفقیت ذخیره شد.`);
    } catch (err: any) {
      alert(`خطا در ذخیره شخص: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const created = await api.savePersonGroup({
        name: newGroupName.trim(),
        defaultCreditLimit: newGroupLimit,
      });
      setPersonGroups((prev) => [...prev, created]);
      setNewGroupName('');
      setIsGroupModalOpen(false);
      setToastMessage('گروه‌بندی جدید اشخاص با موفقیت اضافه شد.');
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const selectedPersonForStatement = persons.find((p) => p.id === selectedStatementPersonId);

  return (
    <div className="space-y-5">
      {/* 1. Header with Primary Action Button */}
      <PageHeader
        title="مرکز مدیریت اشخاص و طرف‌های حساب"
        subtitle="فهرست و سوابق مشتریان، بنکداران و همکاران، کنترل مانده حساب، سقف اعتبار و معین اشخاص"
        icon={Users}
        primaryAction={{
          label: 'طرف حساب جدید',
          icon: Plus,
          onClick: handleOpenNewPerson,
          color: 'indigo',
        }}
        secondaryActions={[
          {
            label: 'گروه جدید اشخاص',
            icon: Tag,
            onClick: () => setIsGroupModalOpen(true),
            color: 'slate',
          },
        ]}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid cards={statCards} columns={4} />

      {/* 3. Segmented View Switcher */}
      <SectionPills items={pillItems} activeId={activeView} onChange={setActiveView} />

      {/* VIEW: ALL PERSONS / DEBTORS / CREDITORS */}
      {(activeView === 'all' || activeView === 'debtors' || activeView === 'creditors') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو با نام طرف حساب، کد، تلفن یا شماره همراه..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه گروه‌ها...</option>
                  {personGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">همه نقش‌ها (مشتری / بنکدار)...</option>
                  <option value="customer">فقط مشتریان</option>
                  <option value="supplier">فقط تأمین‌کنندگان / بنکداران</option>
                  <option value="both">دو طرفه (مشتری و بنکدار)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Persons Data Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                فهرست طرف‌های حساب ({toPersianDigits(filteredPersons.length)} مورد)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 font-bold">کد</th>
                    <th className="py-2.5 px-3 font-bold">نام طرف حساب</th>
                    <th className="py-2.5 px-3 font-bold text-center">نوع</th>
                    <th className="py-2.5 px-3 font-bold">گروه</th>
                    <th className="py-2.5 px-3 font-bold text-center">شماره تماس</th>
                    <th className="py-2.5 px-3 font-bold text-left">مانده حساب فعلی</th>
                    <th className="py-2.5 px-3 font-bold text-center">وضعیت مالی</th>
                    <th className="py-2.5 px-3 font-bold text-left">سقف اعتبار</th>
                    <th className="py-2.5 px-3 font-bold text-center w-36">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPersons.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        طرف حسابی با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    paginatedPersons.map((p, idx) => {
                      const isDebtor = p.currentBalance > 0;
                      const isCreditor = p.currentBalance < 0;
                      const isOverLimit = p.creditLimit > 0 && p.currentBalance > p.creditLimit;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                            !p.isActive ? 'opacity-50 bg-slate-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {toPersianDigits((page - 1) * pageSize + idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {toPersianDigits(p.code)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isOverLimit && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                                  فراتر از سقف
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {p.personType === 'customer'
                                ? 'مشتری'
                                : p.personType === 'supplier'
                                ? 'بنکدار'
                                : 'دو طرفه'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {p.groupName || 'عادی'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                            {toPersianDigits(p.mobile || p.phone || '-')}
                          </td>
                          <td className="py-2.5 px-3 text-left font-black">
                            <span
                              className={
                                isDebtor
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isCreditor
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-600 dark:text-slate-300'
                              }
                            >
                              {formatMoney(Math.abs(p.currentBalance))}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isDebtor ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                بدهکار
                              </span>
                            ) : isCreditor ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                بستانکار
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                                بی‌حساب
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-600 dark:text-slate-400">
                            {p.creditLimit > 0 ? formatMoney(p.creditLimit) : 'نامحدود'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* گردش حساب */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStatementPersonId(p.id);
                                  setActiveView('statement');
                                }}
                                title="مشاهده گردش حساب و معین"
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* ویرایش */}
                              <button
                                type="button"
                                onClick={() => handleEditPerson(p)}
                                title="ویرایش اطلاعات"
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* فعال/غیرفعال */}
                              <button
                                type="button"
                                onClick={() => handleToggleActive(p)}
                                title={p.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                className={`p-1.5 rounded-lg cursor-pointer transition ${
                                  p.isActive
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* حذف */}
                              <button
                                type="button"
                                onClick={() => handleDeletePerson(p)}
                                title="حذف طرف حساب"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <Pagination
                currentPage={page}
                totalItems={filteredPersons.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW: PERSON STATEMENT & LEDGER */}
      {activeView === 'statement' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                انتخاب طرف حساب جهت مشاهده معین مالی:
              </label>
              <select
                value={selectedStatementPersonId}
                onChange={(e) => setSelectedStatementPersonId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) - مانده:{' '}
                    {p.currentBalance > 0
                      ? `${formatMoney(p.currentBalance)} بدهکار`
                      : p.currentBalance < 0
                      ? `${formatMoney(Math.abs(p.currentBalance))} بستانکار`
                      : 'تسویه'}
                  </option>
                ))}
              </select>
            </div>

            {selectedPersonForStatement && (
              <div className="flex items-center gap-4 text-xs font-bold p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">مانده حساب قطعی:</span>
                  <span
                    className={`text-sm font-black ${
                      selectedPersonForStatement.currentBalance > 0
                        ? 'text-rose-600'
                        : selectedPersonForStatement.currentBalance < 0
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {formatMoney(Math.abs(selectedPersonForStatement.currentBalance))}{' '}
                    {selectedPersonForStatement.currentBalance > 0
                      ? '(بدهکار)'
                      : selectedPersonForStatement.currentBalance < 0
                      ? '(بستانکار)'
                      : '(تسویه)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">سقف اعتبار:</span>
                  <span>{formatMoney(selectedPersonForStatement.creditLimit)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Statement Summary Card */}
          {statementSummary && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                    خلاصه کارنامه مالی: {statementSummary.person?.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ کارنامه مالی</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">تعداد فاکتورها:</span>
                  <strong className="text-base font-black text-slate-800 dark:text-white">
                    {toPersianDigits(statementSummary.invoicesCount || 0)} فقره
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">مجموع خرید/فروش:</span>
                  <strong className="text-base font-black text-indigo-600 dark:text-indigo-400">
                    {formatMoney(statementSummary.invoicesTotal || 0)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">تراکنش‌های نقدی و پوز:</span>
                  <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {toPersianDigits(statementSummary.transactionsCount || 0)} پرداخت
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">چک‌های صیادی:</span>
                  <strong className="text-base font-black text-amber-600 dark:text-amber-400">
                    {toPersianDigits(statementSummary.chequesCount || 0)} فقره
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: PERSON GROUPS */}
      {activeView === 'groups' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                گروه‌بندی اشخاص و سقف اعتبار پیش‌فرض ({toPersianDigits(personGroups.length)})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              + گروه جدید اشخاص
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {personGroups.map((g) => (
              <div
                key={g.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white">{g.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{g.code || 'GRP'}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  سقف اعتبار پیش‌فرض: <strong className="text-indigo-600">{formatMoney(g.defaultCreditLimit || 0)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New / Edit Person Modal */}
      {isPersonModalOpen && editingPerson && (
        <StandardModal
          isOpen={isPersonModalOpen}
          onClose={() => setIsPersonModalOpen(false)}
          title={editingPerson.id ? `ویرایش طرف حساب «${editingPerson.name}»` : 'تعریف طرف حساب جدید'}
          subtitle="اطلاعات هویتی و مالی طرف حساب را وارد نمایید."
          icon={Users}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsPersonModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSavePerson}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'در حال ذخیره...' : 'ذخیره طرف حساب'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSavePerson} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  نام و نام خانوادگی / عنوان تجاری *
                </label>
                <input
                  type="text"
                  required
                  value={editingPerson.name || ''}
                  onChange={(e) => setEditingPerson({ ...editingPerson, name: e.target.value })}
                  placeholder="مثلاً: حاج رضا بزاز"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  کد حساب *
                </label>
                <input
                  type="text"
                  required
                  value={editingPerson.code || ''}
                  onChange={(e) => setEditingPerson({ ...editingPerson, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  نوع طرف حساب *
                </label>
                <select
                  value={editingPerson.personType || 'customer'}
                  onChange={(e) =>
                    setEditingPerson({ ...editingPerson, personType: e.target.value as PersonType })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="customer">مشتری (خریدار)</option>
                  <option value="supplier">تأمین‌کننده / بنکدار (فروشنده)</option>
                  <option value="both">دو طرفه (مشتری و بنکدار)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  گروه شخص
                </label>
                <select
                  value={editingPerson.groupId || ''}
                  onChange={(e) => {
                    const g = personGroups.find((item) => item.id === e.target.value);
                    setEditingPerson({
                      ...editingPerson,
                      groupId: e.target.value,
                      groupName: g?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {personGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  شماره همراه (موبایل)
                </label>
                <input
                  type="text"
                  value={editingPerson.mobile || ''}
                  onChange={(e) => setEditingPerson({ ...editingPerson, mobile: e.target.value })}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  سقف اعتبار مجاز نسیه (ریال)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingPerson.creditLimit || 0}
                  onChange={(e) =>
                    setEditingPerson({ ...editingPerson, creditLimit: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {/* Collapsible Supplementary Fields (Section 5) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => setShowAdvancedSpecs((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <span>اطلاعات تکمیلی مالیاتی و آدرس (کد ملی، شناسه اقتصادی، آدرس، تلفن ثابت)</span>
                {showAdvancedSpecs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvancedSpecs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">کد ملی / شناسه ملی</label>
                    <input
                      type="text"
                      value={editingPerson.nationalCode || ''}
                      onChange={(e) => setEditingPerson({ ...editingPerson, nationalCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">کد اقتصادی</label>
                    <input
                      type="text"
                      value={editingPerson.economicCode || ''}
                      onChange={(e) => setEditingPerson({ ...editingPerson, economicCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">تلفن ثابت</label>
                    <input
                      type="text"
                      value={editingPerson.phone || ''}
                      onChange={(e) => setEditingPerson({ ...editingPerson, phone: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">آدرس کامل</label>
                    <input
                      type="text"
                      value={editingPerson.address || ''}
                      onChange={(e) => setEditingPerson({ ...editingPerson, address: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </StandardModal>
      )}

      {/* New Group Modal */}
      {isGroupModalOpen && (
        <StandardModal
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          title="تعریف گروه جدید طرف‌های حساب"
          icon={Tag}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                ثبت گروه
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1">نام گروه *</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="مثلاً: مشتریان عمده و همکاران"
                className="w-full p-2 border rounded-xl text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1">سقف اعتبار پیش‌فرض (ریال)</label>
              <input
                type="number"
                min="0"
                value={newGroupLimit}
                onChange={(e) => setNewGroupLimit(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border rounded-xl text-xs font-bold"
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
