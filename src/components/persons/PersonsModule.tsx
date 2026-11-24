import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
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
} from 'lucide-react';
import { Person, PersonType, PersonGroup } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits } from '../../lib/formatters.ts';

export const PersonsModule: React.FC = () => {
  const { formatMoney } = useSettings();
  const [persons, setPersons] = useState<Person[]>([]);
  const [personGroups, setPersonGroups] = useState<PersonGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // فیلترها
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterBalance, setFilterBalance] = useState<'all' | 'debtors' | 'creditors' | 'settled'>('all');

  // مودال‌ها
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Partial<Person> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // مودال خلاصه مالی و کاردکس
  const [summaryPerson, setSummaryPerson] = useState<{
    person: Person;
    invoicesCount: number;
    invoicesTotal: number;
    transactionsCount: number;
    chequesCount: number;
    currentBalance: number;
    canDelete: boolean;
  } | null>(null);

  // مودال قفل حذف مالی
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<{
    person: Person;
    reason: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [personsData, groupsData] = await Promise.all([
        api.getPersons(),
        api.getPersonGroups(),
      ]);
      setPersons(personsData);
      setPersonGroups(groupsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در دریافت لیست طرف‌های حساب');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    const nextCode = `${persons.length + 1001}`;
    const defaultGroup = personGroups[0];
    setEditingPerson({
      code: nextCode,
      name: '',
      personType: 'customer',
      groupId: defaultGroup?.id || '',
      groupName: defaultGroup?.name || '',
      mobile: '',
      phone: '',
      nationalCode: '',
      economicCode: '',
      creditLimit: defaultGroup?.defaultCreditLimit || 20000000,
      currentBalance: 0,
      address: '',
      isActive: true,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (p: Person) => {
    setEditingPerson({ ...p });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (p: Person) => {
    try {
      const updated = await api.togglePersonActive(p.id);
      setPersons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      alert(`خطا در تغییر وضعیت طرف حساب: ${err.message}`);
    }
  };

  const handleDelete = async (p: Person) => {
    if (!window.confirm(`آیا از درخواست حذف طرف حساب «${p.name}» اطمینان دارید؟`)) return;

    try {
      await api.deletePerson(p.id);
      setPersons((prev) => prev.filter((item) => item.id !== p.id));
      alert(`طرف حساب «${p.name}» با موفقیت حذف گردید.`);
    } catch (err: any) {
      setDeleteBlockedInfo({
        person: p,
        reason: err.message,
      });
    }
  };

  const handleDeactivateInsteadOfDelete = async () => {
    if (!deleteBlockedInfo) return;
    try {
      const updated = await api.togglePersonActive(deleteBlockedInfo.person.id);
      setPersons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDeleteBlockedInfo(null);
      alert(`وضعیت «${updated.name}» با موفقیت به «غیرفعال» تغییر یافت و کلیه سوابق مالی آن حفظ گردید.`);
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const handleViewSummary = async (p: Person) => {
    try {
      const summary = await api.getPersonFinancialSummary(p.id);
      setSummaryPerson(summary);
    } catch (err: any) {
      alert(`خطا در بارگذاری خلاصه مالی: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson?.name?.trim()) {
      alert('لطفاً نام یا عنوان طرف حساب را وارد نمایید.');
      return;
    }
    if (!editingPerson?.code?.trim()) {
      alert('لطفاً کد یکتای طرف حساب را وارد نمایید.');
      return;
    }
    if (!editingPerson?.mobile?.trim()) {
      alert('لطفاً شماره تلفن همراه را وارد نمایید.');
      return;
    }

    try {
      setIsSaving(true);
      const saved = await api.savePerson(editingPerson);
      setPersons((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      setIsModalOpen(false);
      setEditingPerson(null);
    } catch (err: any) {
      alert(`خطا در ثبت طرف حساب: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = persons.filter((p) => {
    const matchesSearch =
      p.name.includes(searchTerm) ||
      p.code.includes(searchTerm) ||
      p.mobile.includes(searchTerm) ||
      (p.phone && p.phone.includes(searchTerm)) ||
      (p.nationalCode && p.nationalCode.includes(searchTerm)) ||
      (p.address && p.address.includes(searchTerm));

    const matchesType =
      filterType === 'all' ||
      p.personType === filterType ||
      (p.personType === 'both' && (filterType === 'customer' || filterType === 'supplier'));

    const matchesGroup = filterGroup === 'all' || p.groupId === filterGroup;

    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && p.isActive) ||
      (filterActive === 'inactive' && !p.isActive);

    const matchesBalance =
      filterBalance === 'all' ||
      (filterBalance === 'debtors' && p.currentBalance > 0) ||
      (filterBalance === 'creditors' && p.currentBalance < 0) ||
      (filterBalance === 'settled' && p.currentBalance === 0);

    return matchesSearch && matchesType && matchesGroup && matchesActive && matchesBalance;
  });

  return (
    <div className="space-y-5">
      {/* پیام خطا */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={loadData} className="font-bold underline cursor-pointer">
            تلاش مجدد
          </button>
        </div>
      )}

      {/* سربرگ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                طرف‌های حساب (مشتریان، مزون‌ها، تأمین‌کنندگان و بنکداران)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                شناسه یکتا، اعتبارسنجی تکرار کد، سقف اعتبار مالی و ارتباط کامل با اسناد دریافت/پرداخت و دفاتر کل
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-200 dark:shadow-none transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت طرف حساب جدید</span>
        </button>
      </div>

      {/* فیلترها و جست‌وجوی چندگانه */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* جستجو */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو با نام، کد، شماره موبایل، تلفن، کدملی یا آدرس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
            />
          </div>

          {/* فیلتر نوع طرف حساب */}
          <div className="md:col-span-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
            >
              <option value="all">همه انواع اشخاص</option>
              <option value="customer">مشتریان (مزون‌ها و دوزندگان)</option>
              <option value="supplier">تأمین‌کنندگان و بنکداران</option>
              <option value="both">طرف حساب دوطرفه</option>
            </select>
          </div>

          {/* فیلتر گروه اشخاص */}
          <div className="md:col-span-2">
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
            >
              <option value="all">تمام گروه‌های اشخاص</option>
              {personGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* فیلتر وضعیت حساب و مانده */}
          <div className="md:col-span-2">
            <select
              value={filterBalance}
              onChange={(e) => setFilterBalance(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
            >
              <option value="all">همه مانده حساب‌ها</option>
              <option value="debtors">بدهکاران به ما (طلب ما)</option>
              <option value="creditors">بستانکاران از ما (بدهی ما)</option>
              <option value="settled">تسویه‌شده (مانده صفر)</option>
            </select>
          </div>

          {/* فیلتر فعال / غیرفعال */}
          <div className="md:col-span-2">
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-indigo-500"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فقط طرف‌حساب‌های فعال</option>
              <option value="inactive">فقط غیرفعال‌ها</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          <span>
            تعداد کل مخاطبین: <strong>{toPersianDigits(persons.length)}</strong> | فیلتر شده: <strong>{toPersianDigits(filtered.length)}</strong>
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              بدهکار (قرمز)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              بستانکار (سبز)
            </span>
          </div>
        </div>
      </div>

      {/* جدول طرف‌های حساب */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th className="py-3 px-3">کد شخص</th>
                <th className="py-3 px-4">نام و عنوان طرف حساب</th>
                <th className="py-3 px-3">نقش و گروه</th>
                <th className="py-3 px-3">شماره تماس (موبایل/تلفن)</th>
                <th className="py-3 px-3 text-left">سقف اعتبار</th>
                <th className="py-3 px-3 text-left">مانده حساب جاری</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    در حال بارگذاری لیست طرف‌های حساب از دیتابیس...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    شخصی با مشخصات مورد نظر یافت نشد.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isDebtor = p.currentBalance > 0;
                  const isCreditor = p.currentBalance < 0;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                        !p.isActive ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      {/* کد */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                          {p.code}
                        </span>
                      </td>

                      {/* نام */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{p.name}</div>
                        {p.address && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[260px]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{p.address}</span>
                          </div>
                        )}
                      </td>

                      {/* نقش و گروه */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.personType === 'customer'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                                : p.personType === 'supplier'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200'
                            }`}
                          >
                            {p.personType === 'customer' && 'مشتری'}
                            {p.personType === 'supplier' && 'تأمین‌کننده'}
                            {p.personType === 'both' && 'طرف حساب دوطرفه'}
                          </span>
                          {p.groupName && (
                            <span className="text-[10px] text-slate-400">
                              گروه: {p.groupName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* تماس */}
                      <td className="py-3 px-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        <div>{p.mobile}</div>
                        {p.phone && <div className="text-slate-400 text-[10px]">{p.phone}</div>}
                      </td>

                      {/* سقف اعتبار */}
                      <td className="py-3 px-3 text-left font-mono text-slate-500 dark:text-slate-400">
                        {p.creditLimit > 0 ? formatMoney(p.creditLimit) : 'بدون سقف'}
                      </td>

                      {/* مانده حساب */}
                      <td className="py-3 px-3 text-left font-mono">
                        <span
                          className={`font-bold inline-block px-2 py-0.5 rounded-md text-[11px] ${
                            isDebtor
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : isCreditor
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatMoney(Math.abs(p.currentBalance))}{' '}
                          {isDebtor ? '(بدهکار به ما)' : isCreditor ? '(بستانکار از ما)' : '(تسویه)'}
                        </span>
                      </td>

                      {/* وضعیت فعال */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          title={p.isActive ? 'جهت غیرفعال‌کردن کلیک کنید' : 'جهت فعال‌سازی مجدد کلیک کنید'}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer border ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {p.isActive ? 'فعال' : 'غیرفعال'}
                        </button>
                      </td>

                      {/* عملیات */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewSummary(p)}
                            title="مشاهده گردش و خلاصه مالی"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(p)}
                            title="ویرایش مشخصات طرف حساب"
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="حذف طرف حساب (بررسی ارتباط با اسناد مالی)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* مودال خلاصه مالی و گردش حساب شخص */}
      {summaryPerson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  خلاصه مالی و گردش: {summaryPerson.person.name}
                </h3>
              </div>
              <button
                onClick={() => setSummaryPerson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                <div>کد طرف حساب: <strong className="font-mono">{summaryPerson.person.code}</strong></div>
                <div>شماره موبایل: <strong className="font-mono">{summaryPerson.person.mobile}</strong></div>
                <div>گروه: <strong>{summaryPerson.person.groupName || 'عمومی'}</strong></div>
                <div>سقف اعتبار: <strong>{formatMoney(summaryPerson.person.creditLimit)}</strong></div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                  <span className="text-[10px] text-indigo-500 block">فاکتورهای ثبت‌شده</span>
                  <span className="text-base font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                    {toPersianDigits(summaryPerson.invoicesCount)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    جمع: {formatMoney(summaryPerson.invoicesTotal)}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 rounded-xl">
                  <span className="text-[10px] text-blue-500 block">تراکنش‌های خزانه</span>
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                    {toPersianDigits(summaryPerson.transactionsCount)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">دریافت/پرداخت</span>
                </div>

                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800 rounded-xl">
                  <span className="text-[10px] text-purple-500 block">چک‌های صیادی</span>
                  <span className="text-base font-bold text-purple-700 dark:text-purple-300 font-mono">
                    {toPersianDigits(summaryPerson.chequesCount)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">فقره چک</span>
                </div>
              </div>

              {/* مانده حساب نهایی */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  وضعیت مانده حساب نهایی:
                </span>
                <span
                  className={`font-mono font-bold text-sm ${
                    summaryPerson.currentBalance > 0
                      ? 'text-rose-600'
                      : summaryPerson.currentBalance < 0
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }`}
                >
                  {formatMoney(Math.abs(summaryPerson.currentBalance))}{' '}
                  {summaryPerson.currentBalance > 0
                    ? '(بدهکار به ما)'
                    : summaryPerson.currentBalance < 0
                    ? '(بستانکار از ما)'
                    : '(تسویه)'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSummaryPerson(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال قفل حذف به دلیل سوابق مالی (ممنوعیت حذف اطلاعات مرتبط با اسناد مالی) */}
      {deleteBlockedInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-amber-300 dark:border-amber-700 shadow-2xl overflow-hidden text-right">
            <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-100" />
                <h3 className="font-bold text-sm">ممنوعیت قانونی حذف طرف حساب</h3>
              </div>
              <button
                onClick={() => setDeleteBlockedInfo(null)}
                className="p-1 text-amber-100 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 leading-relaxed font-sans">
                {deleteBlockedInfo.reason}
              </div>

              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <p className="font-bold">علت قفل حذف فیزیکی:</p>
                <p className="leading-relaxed">
                  حذف طرف حسابی که دارای فاکتور، چک، دریافت/پرداخت خزانه یا سند حسابداری است، تراز دفاتر مالی را بر هم زده و زنجیره حسابرسی را مخدوش می‌کند.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-300 font-bold mb-1">
                  راهکار استاندارد: «غیرفعال‌سازی طرف حساب»
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  با غیرفعال‌سازی، نام این شخص در فرم‌های صدور فاکتور جدید پیشنهاد نخواهد شد، اما کلیه سوابق فاکتورها، دفاتر معین و تاریخچه اسناد وی محفوظ می‌ماند.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteBlockedInfo(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeactivateInsteadOfDelete}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Power className="w-4 h-4" />
                <span>غیرفعال‌کردن شخص به جای حذف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال ثبت و ویرایش طرف حساب */}
      {isModalOpen && editingPerson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {editingPerson.id ? `ویرایش طرف حساب: ${editingPerson.name}` : 'ثبت طرف حساب جدید'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    اعتبارسنجی شناسه یکتا و ارتباط با دفاتر حسابداری
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* کد طرف حساب */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-slate-500 dark:text-slate-400">
                      کد طرف حساب (یکتا) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPerson({
                          ...editingPerson,
                          code: `${persons.length + 1001 + Math.floor(Math.random() * 100)}`,
                        })
                      }
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      تولید کد جدید
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={editingPerson.code || ''}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, code: e.target.value })
                    }
                    placeholder="مثال: 1005"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                {/* نوع شخص */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    نقش / نوع طرف حساب <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingPerson.personType || 'customer'}
                    onChange={(e) =>
                      setEditingPerson({
                        ...editingPerson,
                        personType: e.target.value as PersonType,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="customer">مشتری (مزون، کارگاه خیاطی، خریدار)</option>
                    <option value="supplier">تأمین‌کننده (بنکدار، واردکننده یراق)</option>
                    <option value="both">طرف حساب دوطرفه (هم خریدار، هم فروشنده)</option>
                  </select>
                </div>
              </div>

              {/* نام کامل */}
              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                  نام کامل یا عنوان فروشگاه / مزون <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingPerson.name || ''}
                  onChange={(e) => setEditingPerson({ ...editingPerson, name: e.target.value })}
                  placeholder="مثال: مزون دوخت بهار (سرکار خانم حسینی)"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* گروه شخص */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    گروه‌بندی طرف حساب
                  </label>
                  <select
                    value={editingPerson.groupId || ''}
                    onChange={(e) => {
                      const selectedGrp = personGroups.find((g) => g.id === e.target.value);
                      setEditingPerson({
                        ...editingPerson,
                        groupId: e.target.value,
                        groupName: selectedGrp?.name || '',
                        creditLimit: selectedGrp?.defaultCreditLimit || editingPerson.creditLimit || 0,
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="">بدون گروه اختصاصی</option>
                    {personGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (تخفیف: {toPersianDigits(g.defaultDiscountPercent || 0)}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* سقف اعتبار */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    سقف اعتبار مالی (ریال)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPerson.creditLimit ?? 0}
                    onChange={(e) =>
                      setEditingPerson({
                        ...editingPerson,
                        creditLimit: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* شماره تلفن همراه */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    شماره همراه (موبایل) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingPerson.mobile || ''}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, mobile: e.target.value })
                    }
                    placeholder="09123456789"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                {/* تلفن ثابت */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    تلفن ثابت
                  </label>
                  <input
                    type="tel"
                    value={editingPerson.phone || ''}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, phone: e.target.value })
                    }
                    placeholder="02155667788"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* کد ملی */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    کد ملی / شناسه ملی
                  </label>
                  <input
                    type="text"
                    value={editingPerson.nationalCode || ''}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, nationalCode: e.target.value })
                    }
                    placeholder="۱۰ رقم کد ملی"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                {/* کد اقتصادی */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                    کد اقتصادی
                  </label>
                  <input
                    type="text"
                    value={editingPerson.economicCode || ''}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, economicCode: e.target.value })
                    }
                    placeholder="۱۲ رقم کد اقتصادی"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* آدرس */}
              <div>
                <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                  آدرس پستی یا نشانی کارگاه / فروشگاه
                </label>
                <textarea
                  rows={2}
                  value={editingPerson.address || ''}
                  onChange={(e) =>
                    setEditingPerson({ ...editingPerson, address: e.target.value })
                  }
                  placeholder="تهران، بازار بزرگ..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              {/* وضعیت فعال */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    وضعیت فعالیت طرف حساب
                  </span>
                  <span className="text-[11px] text-slate-400">
                    طرف حساب‌های فعال در لیست صدور فاکتور و اسناد خزانه نمایش داده می‌شوند.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPerson.isActive ?? true}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, isActive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* دکمه‌ها */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'در حال ثبت...' : 'ذخیره طرف حساب در پایگاه داده'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
