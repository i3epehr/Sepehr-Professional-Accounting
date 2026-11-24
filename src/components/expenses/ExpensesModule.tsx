import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Search,
  Wallet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  TrendingDown,
  TrendingUp,
  X,
  Settings,
  Scale,
  Layers,
  ArrowRightLeft,
  Truck,
  Scissors,
  Package,
  Sparkles,
  Info,
  Trash2,
  Edit2,
  Percent,
  FlaskConical,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import {
  TreasuryAccount,
  AccessoryCostType,
  AccessoryCostEntry,
  AllocationMethod,
  Product,
  AllocatedProductItem,
} from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import { allocateAccessoryCost, roundPrecision } from '../../lib/conversions.ts';

interface GeneralExpenseItem {
  id: string;
  type: 'expense' | 'income';
  category: string;
  amount: number;
  date: string;
  treasuryAccountTitle: string;
  description: string;
  recipientOrPayer: string;
}

export const ExpensesModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'accessory_costs' | 'cost_types' | 'general_expenses'>('accessory_costs');
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [costTypes, setCostTypes] = useState<AccessoryCostType[]>([]);
  const [accessoryCosts, setAccessoryCosts] = useState<AccessoryCostEntry[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpenseItem[]>([
    {
      id: 'exp-1',
      type: 'expense',
      category: 'کرایه حمل و باربری کالا',
      amount: 450000,
      date: '1403/07/10',
      treasuryAccountTitle: 'صندوق نقدی شماره ۱ فروشگاه',
      description: 'هزینه باربری دوک و نخ‌های قرقره خریداری شده از بازار بزرگ تهران',
      recipientOrPayer: 'باربری وطن',
    },
    {
      id: 'exp-2',
      type: 'expense',
      category: 'اجاره و شارژ ماهانه فروشگاه',
      amount: 15000000,
      date: '1403/07/01',
      treasuryAccountTitle: 'حساب جاری بانک ملت (اصلی)',
      description: 'پرداخت اجاره بهای مهرماه فروشگاه',
      recipientOrPayer: 'مالک تجاری پاساژ نگین',
    },
    {
      id: 'exp-3',
      type: 'expense',
      category: 'ملزومات بسته‌بندی، کارتن و پاکت',
      amount: 850000,
      date: '1403/07/14',
      treasuryAccountTitle: 'صندوق نقدی شماره ۱ فروشگاه',
      description: 'خرید ۱۰۰ عدد کیسه دسته موزی و چسب پهن',
      recipientOrPayer: 'فروشگاه پلاستیک بهار',
    },
    {
      id: 'exp-4',
      type: 'income',
      category: 'درآمدهای متفرقه و کارمزد برش روبان',
      amount: 320000,
      date: '1403/07/15',
      treasuryAccountTitle: 'صندوق نقدی شماره ۱ فروشگاه',
      description: 'کارمزد ساخت پاپیون و تزیینات روبان ساتن سفارشی',
      recipientOrPayer: 'مزون پروانه',
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAccessoryModalOpen, setIsAccessoryModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);
  const [viewingCostEntry, setViewingCostEntry] = useState<AccessoryCostEntry | null>(null);

  // Form: New Accessory Cost Sheet
  const [accTitle, setAccTitle] = useState('');
  const [accCostTypeId, setAccCostTypeId] = useState('');
  const [accAmount, setAccAmount] = useState<number>(200000);
  const [accDate, setAccDate] = useState('1403/07/20');
  const [accMethod, setAccMethod] = useState<AllocationMethod>('quantity');
  const [accTreasuryId, setAccTreasuryId] = useState('');
  const [accRecipient, setAccRecipient] = useState('');
  const [accNotes, setAccNotes] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Form: Configurable Cost Type
  const [editingType, setEditingType] = useState<AccessoryCostType | null>(null);
  const [typeForm, setTypeForm] = useState<Partial<AccessoryCostType>>({
    name: '',
    category: 'notion',
    defaultAllocationMethod: 'quantity',
    description: '',
    isActive: true,
  });

  // Form: General Expense
  const [genFormType, setGenFormType] = useState<'expense' | 'income'>('expense');
  const [genFormCategory, setGenFormCategory] = useState('کرایه حمل و باربری کالا');
  const [genFormAmount, setGenFormAmount] = useState('');
  const [genFormTreasuryId, setGenFormTreasuryId] = useState('');
  const [genFormRecipient, setGenFormRecipient] = useState('');
  const [genFormDesc, setGenFormDesc] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tAccounts, prds, types, costs] = await Promise.all([
        api.getTreasuryAccounts(),
        api.getProducts(),
        api.getAccessoryCostTypes(),
        api.getAccessoryCosts(),
      ]);
      setTreasuryAccounts(tAccounts);
      setProducts(prds);
      setCostTypes(types);
      setAccessoryCosts(costs);

      if (types.length > 0) {
        setAccCostTypeId(types[0].id);
        setAccMethod(types[0].defaultAllocationMethod || 'quantity');
      }
      if (tAccounts.length > 0) {
        setAccTreasuryId(tAccounts[0].id);
        setGenFormTreasuryId(tAccounts[0].id);
      }
      if (prds.length > 0 && selectedProductIds.length === 0) {
        // پیش‌فرض انتخاب ۲ کالا جهت سهولت تست
        setSelectedProductIds([prds[0].id, prds[1]?.id].filter(Boolean));
        setCustomQuantities({
          [prds[0].id]: 10,
          ...(prds[1] ? { [prds[1].id]: 20 } : {}),
        });
      }
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync default allocation method when cost type changes
  const handleCostTypeChange = (typeId: string) => {
    setAccCostTypeId(typeId);
    const ct = costTypes.find((t) => t.id === typeId);
    if (ct) {
      setAccMethod(ct.defaultAllocationMethod || 'quantity');
    }
  };

  // Toggle product selection in allocation
  const handleToggleProductSelection = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
      if (!customQuantities[productId]) {
        setCustomQuantities({ ...customQuantities, [productId]: 10 });
      }
    }
  };

  // Live preview calculation of cost allocation
  const calculateLiveAllocation = () => {
    const selectedProductsList = products.filter((p) => selectedProductIds.includes(p.id));
    const items = selectedProductsList.map((p) => ({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      quantity: customQuantities[p.id] || 1,
      unitName: p.baseUnitName || 'عدد',
      originalUnitCost: p.purchasePrice || 0,
      weightPerUnit: p.weight ? (p.weightUnit === 'گرم' ? p.weight / 1000 : p.weight) : 0.1,
      lengthPerUnit: p.length ? (p.lengthUnit === 'سانتی‌متر' ? p.length / 100 : p.length) : 1,
    }));

    return allocateAccessoryCost({
      totalAmount: accAmount,
      method: accMethod,
      items,
    });
  };

  const liveAllocation = calculateLiveAllocation();

  // Save new accessory cost sheet
  const handleSaveAccessoryCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accTitle.trim() || accAmount <= 0) {
      alert('لطفاً عنوان و مبلغ معتبر وارد نمایید.');
      return;
    }

    try {
      const selectedType = costTypes.find((t) => t.id === accCostTypeId);
      const selectedTreasury = treasuryAccounts.find((t) => t.id === accTreasuryId);

      const entry: Partial<AccessoryCostEntry> = {
        title: accTitle,
        costTypeId: accCostTypeId,
        costTypeName: selectedType ? selectedType.name : 'خرج‌کار و هزینه جانبی',
        amount: accAmount,
        date: accDate,
        allocationMethod: accMethod,
        targetType: accMethod === 'overhead' ? 'overhead' : 'products',
        treasuryAccountId: accTreasuryId,
        treasuryAccountTitle: selectedTreasury ? selectedTreasury.title : undefined,
        recipientOrPayer: accRecipient,
        allocatedItems: liveAllocation.allocatedItems,
        notes: accNotes,
      };

      const saved = await api.saveAccessoryCost(entry);
      setAccessoryCosts([saved, ...accessoryCosts]);
      setIsAccessoryModalOpen(false);
      setAccTitle('');
      setAccNotes('');
      alert('برگه خرج‌کار با موفقیت ثبت و بر روی کالاها تسهیم گردید.');
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const handleDeleteAccessoryCost = async (id: string, title: string) => {
    if (!window.confirm(`آیا از حذف برگه خرج‌کار «${title}» اطمینان دارید؟`)) return;
    try {
      await api.deleteAccessoryCost(id);
      setAccessoryCosts(accessoryCosts.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف برگه: ${err.message}`);
    }
  };

  // Save Cost Type
  const handleSaveCostType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name?.trim()) return;

    try {
      const saved = await api.saveAccessoryCostType({
        ...typeForm,
        id: editingType ? editingType.id : undefined,
      });

      if (editingType) {
        setCostTypes(costTypes.map((t) => (t.id === saved.id ? saved : t)));
      } else {
        setCostTypes([...costTypes, saved]);
      }
      setIsTypeModalOpen(false);
      setEditingType(null);
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    }
  };

  const handleDeleteCostType = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف نوع هزینه «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteAccessoryCostType(id);
      setCostTypes(costTypes.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف: ${err.message}`);
    }
  };

  // Save General Expense
  const handleSaveGeneralExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(genFormAmount);
    if (!amountNum || amountNum <= 0) {
      alert('مبلغ باید بزرگتر از صفر باشد.');
      return;
    }
    const selectedTreasury = treasuryAccounts.find((t) => t.id === genFormTreasuryId);

    const newGen: GeneralExpenseItem = {
      id: `gen-${Date.now()}`,
      type: genFormType,
      category: genFormCategory,
      amount: amountNum,
      date: new Date().toLocaleDateString('fa-IR'),
      treasuryAccountTitle: selectedTreasury ? selectedTreasury.title : 'صندوق فروشگاه',
      description: genFormDesc,
      recipientOrPayer: genFormRecipient || 'متفرقه',
    };

    setGeneralExpenses([newGen, ...generalExpenses]);
    setIsGeneralModalOpen(false);
    setGenFormAmount('');
    setGenFormRecipient('');
    setGenFormDesc('');
  };

  // Stats
  const totalAccessoryCostAmount = accessoryCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalGeneralExpenses = generalExpenses
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const getMethodBadge = (method: AllocationMethod) => {
    switch (method) {
      case 'quantity':
        return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">بر اساس تعداد اقلام</span>;
      case 'value':
        return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">بر اساس ارزش ریالی خرید</span>;
      case 'weight':
        return <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">بر اساس وزن فیزیکی (کیلو)</span>;
      case 'length':
        return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200">بر اساس متراژ و طول (متر)</span>;
      case 'overhead':
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-300">سربار عمومی دوره</span>;
      case 'manual':
      default:
        return <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">تخصیص مساوی / دستی</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-800">هزینه‌های جانبی و خرج‌کار بازرگانی</h2>
            <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
              مدیریت بهای تمام‌شده و تسهیم دقیق
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سیستم قابل تنظیم برای ثبت خرج‌کار یراق‌آلات، باربری، کارمزد برش، بسته‌بندی، آبکاری و سرشکن کردن هزینه‌ها بر روی بهای تمام‌شده کالاها
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'accessory_costs' && (
            <button
              onClick={() => setIsAccessoryModalOpen(true)}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-amber-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت و تسهیم خرج‌کار جدید</span>
            </button>
          )}

          {activeTab === 'cost_types' && (
            <button
              onClick={() => {
                setEditingType(null);
                setTypeForm({
                  name: '',
                  category: 'notion',
                  defaultAllocationMethod: 'quantity',
                  description: '',
                  isActive: true,
                });
                setIsTypeModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف نوع خرج‌کار / هزینه جدید</span>
            </button>
          )}

          {activeTab === 'general_expenses' && (
            <button
              onClick={() => setIsGeneralModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت هزینه عمومی فروشگاه</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">مجموع خرج‌کار و هزینه‌های تسهیم‌شده</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">
              {formatCurrency(totalAccessoryCostAmount)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {toPersianDigits(accessoryCosts.length)} برگه ثبت‌شده
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Scissors className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">انواع خرج‌کار تعریف‌شده و قابل تنظیم</span>
            <span className="text-xl font-black text-indigo-600 mt-1 block">
              {toPersianDigits(costTypes.length)} روش کسب‌وکار
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              تعداد، ارزش، وزن، متراژ و سربار
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Settings className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">هزینه‌های عمومی دوره (اجاره، قبوض، حقوق)</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">
              {formatCurrency(totalGeneralExpenses)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {toPersianDigits(generalExpenses.length)} سند هزینه
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl">
        <button
          onClick={() => setActiveTab('accessory_costs')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'accessory_costs'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>برگه‌های خرج‌کار و تسهیم بر بهای تمام‌شده ({toPersianDigits(accessoryCosts.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('cost_types')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'cost_types'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>تنظیم انواع خرج‌کار و نحوه تخصیص ({toPersianDigits(costTypes.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('general_expenses')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'general_expenses'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>هزینه‌ها و درآمدهای عمومی فروشگاه</span>
        </button>
      </div>

      {/* TAB 1: ACCESSORY COSTS REGISTRY */}
      {activeTab === 'accessory_costs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black">
                  <tr>
                    <th className="p-3.5">کد رهگیری</th>
                    <th className="p-3.5">عنوان برگه خرج‌کار / هزینه جانبی</th>
                    <th className="p-3.5">نوع هزینه</th>
                    <th className="p-3.5">نحوه تخصیص انتخابی</th>
                    <th className="p-3.5 text-left">مبلغ کل هزینه</th>
                    <th className="p-3.5">تاریخ</th>
                    <th className="p-3.5">تعداد اقلام مشمول</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {accessoryCosts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        هنوز هیچ برگه خرج‌کار یا هزینه جانبی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    accessoryCosts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-mono text-slate-500">{c.trackingCode}</td>
                        <td className="p-3.5 font-bold text-slate-800">{c.title}</td>
                        <td className="p-3.5 text-slate-600">{c.costTypeName}</td>
                        <td className="p-3.5">{getMethodBadge(c.allocationMethod)}</td>
                        <td className="p-3.5 text-left font-mono font-bold text-amber-600 text-sm">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="p-3.5 font-mono text-slate-500">{c.date}</td>
                        <td className="p-3.5 font-bold text-indigo-700">
                          {c.allocatedItems?.length > 0
                            ? `${toPersianDigits(c.allocatedItems.length)} قلم کالا`
                            : 'سربار عمومی'}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingCostEntry(c)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              مشاهده تسهیم
                            </button>
                            <button
                              onClick={() => handleDeleteAccessoryCost(c.id, c.title)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف برگه"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* TAB 2: CONFIGURABLE COST TYPES */}
      {activeTab === 'cost_types' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
            💡 <strong>انعطاف‌پذیری نحوه تخصیص:</strong> هر بنگاه یا فروشگاه تجاری ممکن است هزینه‌های جانبی را به روش خاص خود سرشکن کند. در این بخش می‌توانید نوع هزینه و روش پیش‌فرض آن را (بر اساس تعداد، ارزش ریالی، وزن کیلوگرمی، طول متراژ یا سربار) تعریف نمایید تا دقیقاً منطبق بر تعریف کسب‌وکار شما باشد.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {costTypes.map((t) => (
              <div
                key={t.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400">{t.code}</span>
                      <h4 className="font-black text-slate-800 text-sm mt-0.5">{t.name}</h4>
                    </div>
                    {getMethodBadge(t.defaultAllocationMethod)}
                  </div>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    {t.description || 'بدون توضیحات تکمیلی'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400">دسته‌بندی ماهیتی:</span>
                    <span className="font-bold text-slate-700">
                      {t.category === 'notion' && 'خرج‌کار و متعلقات تزیینی'}
                      {t.category === 'freight' && 'کرایه حمل و ترابری'}
                      {t.category === 'service' && 'کارمزد و خدمات فنی'}
                      {t.category === 'packaging' && 'بسته‌بندی و ملزومات'}
                      {t.category === 'overhead' && 'سربار عمومی'}
                      {t.category === 'other' && 'سایر'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setEditingType(t);
                      setTypeForm({
                        name: t.name,
                        category: t.category,
                        defaultAllocationMethod: t.defaultAllocationMethod,
                        description: t.description,
                        isActive: t.isActive,
                      });
                      setIsTypeModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                    title="ویرایش"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCostType(t.id, t.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL EXPENSES */}
      {activeTab === 'general_expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black">
                <tr>
                  <th className="p-3.5">ردیف</th>
                  <th className="p-3.5">سرفصل هزینه / درآمد</th>
                  <th className="p-3.5">حساب پرداخت‌کننده</th>
                  <th className="p-3.5">دریافت‌کننده / پرداخت‌کننده</th>
                  <th className="p-3.5">شرح تراکنش</th>
                  <th className="p-3.5">تاریخ</th>
                  <th className="p-3.5 text-left">مبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {generalExpenses.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3.5 font-bold text-slate-800">{exp.category}</td>
                    <td className="p-3.5 text-slate-600">{exp.treasuryAccountTitle}</td>
                    <td className="p-3.5 text-slate-700 font-semibold">{exp.recipientOrPayer}</td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{exp.description}</td>
                    <td className="p-3.5 font-mono text-slate-500">{exp.date}</td>
                    <td className="p-3.5 text-left font-mono font-black text-rose-600">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: NEW ACCESSORY COST ENTRY WITH LIVE ALLOCATION */}
      {isAccessoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">ثبت برگه خرج‌کار و تسهیم بر بهای تمام‌شده</h3>
                  <span className="text-[11px] text-slate-400">توزیع دقیق هزینه جانبی بین کالاهای خریداری‌شده</span>
                </div>
              </div>
              <button
                onClick={() => setIsAccessoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccessoryCost} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-500 mb-1">عنوان هزینه یا خرج‌کار *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: باربری محموله روبان و دکمه از بازار تهران"
                    value={accTitle}
                    onChange={(e) => setAccTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-500 mb-1">نوع خرج‌کار / هزینه</label>
                  <select
                    value={accCostTypeId}
                    onChange={(e) => handleCostTypeChange(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {costTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-500 mb-1">مبلغ کل هزینه (ریال) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={accAmount}
                    onChange={(e) => setAccAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold text-amber-600 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-500 mb-1">روش تسهیم (قابل تنظیم) *</label>
                  <select
                    value={accMethod}
                    onChange={(e) => setAccMethod(e.target.value as AllocationMethod)}
                    className="w-full border border-slate-200 bg-amber-50/50 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="quantity">تسهیم بر اساس تعداد کل اقلام (Quantity)</option>
                    <option value="value">تسهیم تناسبی بر اساس ارزش ریالی خرید (Value)</option>
                    <option value="weight">تسهیم بر اساس وزن فیزیکی کالا (Weight)</option>
                    <option value="length">تسهیم بر اساس متراژ و طول (Length)</option>
                    <option value="manual">تسهیم مساوی بین اقلام (Equal Split)</option>
                    <option value="overhead">سربار عمومی دوره (بدون سرشکن بر کالا)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-500 mb-1">صندوق یا بانک پرداخت‌کننده</label>
                  <select
                    value={accTreasuryId}
                    onChange={(e) => setAccTreasuryId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {treasuryAccounts.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({formatCurrency(t.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* کادر انتخاب کالاهای مشمول هزینه */}
              {accMethod !== 'overhead' && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">انتخاب کالاهای مشمول تسهیم هزینه:</span>
                      <span className="text-[11px] text-slate-500">
                        {toPersianDigits(selectedProductIds.length)} کالا انتخاب شده است
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                    {products.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleToggleProductSelection(p.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span>{p.name}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* پیش‌نمایش جدول تسهیم زنده */}
                  <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-2.5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-900">
                        پیش‌نمایش زنده اثر هزینه بر بهای تمام‌شده واحد (Landed Cost Matrix):
                      </span>
                      <span className="text-amber-800 font-mono font-bold">
                        {liveAllocation.formulaDescription}
                      </span>
                    </div>

                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="p-2">نام کالا</th>
                          <th className="p-2">تعداد محموله</th>
                          <th className="p-2">بهای خرید قبلی</th>
                          <th className="p-2">سهم کل هزینه</th>
                          <th className="p-2">اضافه به هر واحد</th>
                          <th className="p-2 font-black text-amber-700">بهای تمام‌شده جدید</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {liveAllocation.allocatedItems.map((item, idx) => {
                          const percentIncrease = item.originalUnitCost > 0
                            ? Math.round((item.allocatedPerUnit / item.originalUnitCost) * 100)
                            : 0;

                          return (
                            <tr key={idx} className="hover:bg-amber-50/30">
                              <td className="p-2 font-bold text-slate-800">{item.productName}</td>
                              <td className="p-2 font-mono">
                                <input
                                  type="number"
                                  min="1"
                                  value={customQuantities[item.productId] || 10}
                                  onChange={(e) =>
                                    setCustomQuantities({
                                      ...customQuantities,
                                      [item.productId]: parseFloat(e.target.value) || 1,
                                    })
                                  }
                                  className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-center font-bold"
                                />{' '}
                                {item.unitName}
                              </td>
                              <td className="p-2 font-mono text-slate-600">
                                {formatCurrency(item.originalUnitCost)}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-700">
                                {formatCurrency(item.allocatedShare)}
                              </td>
                              <td className="p-2 font-mono text-amber-600">
                                +{formatCurrency(item.allocatedPerUnit)}
                              </td>
                              <td className="p-2 font-mono font-black text-emerald-700">
                                {formatCurrency(item.newUnitCost)}{' '}
                                <span className="text-[9px] text-amber-600 mr-1">
                                  (+{toPersianDigits(percentIncrease)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-500 mb-1">طرف‌حساب / باربری / مجری</label>
                  <input
                    type="text"
                    placeholder="مثلا: باربری وطن، کارگاه دکمه‌کوبی، چاپخانه نگین"
                    value={accRecipient}
                    onChange={(e) => setAccRecipient(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-500 mb-1">یادداشت و شماره بارنامه</label>
                  <input
                    type="text"
                    placeholder="شماره بیجک یا رسید پرداخت"
                    value={accNotes}
                    onChange={(e) => setAccNotes(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccessoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  ثبت برگه و اعمال بر کالاها
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURABLE COST TYPE DEFINITION */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 text-sm">
                  {editingType ? `ویرایش نوع خرج‌کار: ${editingType.name}` : 'تعریف نوع هزینه و خرج‌کار جدید'}
                </h3>
              </div>
              <button
                onClick={() => setIsTypeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCostType} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-500 mb-1">نام عنوان هزینه / خرج‌کار *</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: کارمزد نگین‌کوبی، کرایه وانت، مارک فلزی..."
                  value={typeForm.name || ''}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">دسته‌بندی ماهیتی</label>
                <select
                  value={typeForm.category || 'notion'}
                  onChange={(e) => setTypeForm({ ...typeForm, category: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="notion">خرج‌کار و متعلقات تزیینی (دکمه، مارک، نگین)</option>
                  <option value="freight">کرایه حمل، باربری و لجستیک</option>
                  <option value="service">کارمزد خدمات (برش، آبکاری، رنگرزی)</option>
                  <option value="packaging">ملزومات بسته‌بندی، سلفون و کارتن</option>
                  <option value="overhead">سربار عمومی دوره</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">روش تخصیص پیش‌فرض کسب‌وکار</label>
                <select
                  value={typeForm.defaultAllocationMethod || 'quantity'}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, defaultAllocationMethod: e.target.value as AllocationMethod })
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="quantity">تسهیم بر اساس تعداد اقلام (Quantity)</option>
                  <option value="value">تسهیم بر اساس ارزش ریالی خرید (Value)</option>
                  <option value="weight">تسهیم بر اساس وزن فیزیکی کالا (Weight)</option>
                  <option value="length">تسهیم بر اساس متراژ و طول (Length)</option>
                  <option value="overhead">سربار عمومی دوره (Overhead)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">توضیحات و شیوه انتساب</label>
                <textarea
                  rows={2}
                  placeholder="توضیحات مربوط به استاندارد حسابداری این هزینه..."
                  value={typeForm.description || ''}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  ذخیره تنظیمات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW ALLOCATED ITEMS DETAILS */}
      {viewingCostEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">جزئیات تسهیم خرج‌کار: {viewingCostEntry.title}</h3>
                  <span className="text-[11px] font-mono text-slate-400">کد رهگیری: {viewingCostEntry.trackingCode}</span>
                </div>
              </div>
              <button
                onClick={() => setViewingCostEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">مبلغ کل هزینه:</span>
                  <span className="font-black text-amber-600 text-sm">
                    {formatCurrency(viewingCostEntry.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">روش تسهیم:</span>
                  <div className="mt-0.5">{getMethodBadge(viewingCostEntry.allocationMethod)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تاریخ ثبت:</span>
                  <span className="font-bold text-slate-700 font-mono">{viewingCostEntry.date}</span>
                </div>
              </div>

              {viewingCostEntry.allocatedItems && viewingCostEntry.allocatedItems.length > 0 ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">نام کالا</th>
                        <th className="p-2.5">تعداد</th>
                        <th className="p-2.5">بهای اولیه واحد</th>
                        <th className="p-2.5">سهم از کل هزینه</th>
                        <th className="p-2.5">سرشکن بر واحد</th>
                        <th className="p-2.5 text-emerald-700">بهای تمام‌شده جدید</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {viewingCostEntry.allocatedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{item.productName}</td>
                          <td className="p-2.5 font-mono">
                            {toPersianDigits(item.quantity)} {item.unitName}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {formatCurrency(item.originalUnitCost)}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-indigo-700">
                            {formatCurrency(item.allocatedShare)}
                          </td>
                          <td className="p-2.5 font-mono text-amber-600 font-bold">
                            +{formatCurrency(item.allocatedPerUnit)}
                          </td>
                          <td className="p-2.5 font-mono font-black text-emerald-700">
                            {formatCurrency(item.newUnitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-slate-500 text-center rounded-xl">
                  این هزینه به صورت سربار عمومی دوره ثبت شده و بر کالاهای انفرادی سرشکن نشده است.
                </div>
              )}

              {viewingCostEntry.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-slate-600">
                  <strong>یادداشت:</strong> {viewingCostEntry.notes}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingCostEntry(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERAL EXPENSE ENTRY */}
      {isGeneralModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 text-sm">ثبت هزینه عمومی فروشگاه</h3>
              </div>
              <button
                onClick={() => setIsGeneralModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGeneralExpense} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-500 mb-1">سرفصل هزینه</label>
                <select
                  value={genFormCategory}
                  onChange={(e) => setGenFormCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="اجاره و شارژ ماهانه فروشگاه">اجاره و شارژ ماهانه فروشگاه</option>
                  <option value="کرایه حمل و باربری کالا">کرایه حمل و باربری کالا</option>
                  <option value="حقوق و دستمزد پرسنل و شاگرد">حقوق و دستمزد پرسنل و شاگرد</option>
                  <option value="ملزومات بسته‌بندی، کارتن و پاکت">ملزومات بسته‌بندی، کارتن و پاکت</option>
                  <option value="قبوض برق، آب و اینترنت">قبوض برق، آب و اینترنت</option>
                  <option value="پذیرایی و ملزومات مصرفی">پذیرایی و ملزومات مصرفی</option>
                  <option value="سایر هزینه‌های پیش‌بینی‌نشده">سایر هزینه‌های پیش‌بینی‌نشده</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">مبلغ هزینه (ریال) *</label>
                <input
                  type="number"
                  required
                  placeholder="مثلاً: ۴۵۰,۰۰۰"
                  value={genFormAmount}
                  onChange={(e) => setGenFormAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">صندوق یا بانک پرداخت‌کننده</label>
                <select
                  value={genFormTreasuryId}
                  onChange={(e) => setGenFormTreasuryId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {treasuryAccounts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({formatCurrency(t.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">دریافت‌کننده وجه</label>
                <input
                  type="text"
                  placeholder="نام شخص یا شرکت دریافت‌کننده"
                  value={genFormRecipient}
                  onChange={(e) => setGenFormRecipient(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-500 mb-1">شرح هزینه</label>
                <textarea
                  rows={2}
                  placeholder="توضیحات تکمیلی..."
                  value={genFormDesc}
                  onChange={(e) => setGenFormDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGeneralModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  ثبت هزینه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
