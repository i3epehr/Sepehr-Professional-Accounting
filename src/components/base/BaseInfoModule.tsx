import React, { useState, useEffect } from 'react';
import {
  Layers,
  Package,
  Users,
  Tag,
  Bookmark,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  AlertTriangle,
  Building,
  Percent,
  Shield,
  CreditCard,
  FolderTree,
} from 'lucide-react';
import { ProductCategory, Brand, PersonGroup, Unit } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { ProductsModule } from '../products/ProductsModule.tsx';
import { PersonsModule } from '../persons/PersonsModule.tsx';
import { UnitsModule } from '../units/UnitsModule.tsx';
import { toPersianDigits } from '../../lib/formatters.ts';

export const BaseInfoModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'persons' | 'groups' | 'categories_brands' | 'units'>('products');

  // داده‌های گروه‌های اشخاص، برندها و دسته‌ها
  const [personGroups, setPersonGroups] = useState<PersonGroup[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // مودال گروه اشخاص
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<Partial<PersonGroup> | null>(null);

  // مودال برند
  const [isBrandModalOpen, setIsBrandModalOpen] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<Partial<Brand> | null>(null);

  // مودال دسته‌بندی
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Partial<ProductCategory> | null>(null);

  const loadAuxData = async () => {
    try {
      setIsLoading(true);
      const [grps, brnds, cats] = await Promise.all([
        api.getPersonGroups(),
        api.getBrands(),
        api.getCategories(),
      ]);
      setPersonGroups(grps);
      setBrands(brnds);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load base info aux data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuxData();
  }, []);

  // ذخیره گروه اشخاص
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup?.name?.trim()) return;

    try {
      const saved = await api.savePersonGroup(editingGroup);
      setPersonGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setIsGroupModalOpen(false);
      setEditingGroup(null);
    } catch (err: any) {
      alert(`خطا در ذخیره گروه اشخاص: ${err.message}`);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف گروه «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deletePersonGroup(id);
      setPersonGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف گروه: ${err.message}`);
    }
  };

  // ذخیره برند
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand?.name?.trim()) return;

    try {
      const saved = await api.saveBrand(editingBrand);
      setBrands((prev) => {
        const idx = prev.findIndex((b) => b.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setIsBrandModalOpen(false);
      setEditingBrand(null);
    } catch (err: any) {
      alert(`خطا در ذخیره برند: ${err.message}`);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف برند «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف برند: ${err.message}`);
    }
  };

  // ذخیره دسته‌بندی
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name?.trim()) return;

    try {
      const saved = await api.saveCategory(editingCategory);
      setCategories((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (err: any) {
      alert(`خطا در ذخیره دسته‌بندی: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف دسته‌بندی «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف دسته‌بندی: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* سربرگ ماژول اطلاعات پایه */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-200 dark:shadow-none">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-slate-100">
              ماژول جامع اطلاعات پایه سیستم حسابداری
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت یکپارچه کالاها، اشخاص و طرف‌حساب‌ها، گروه‌بندی، برندها، دسته‌ها و واحدهای سنجش متصل به پایگاه داده دائمی
            </p>
          </div>
        </div>
      </div>

      {/* ناوبری تب‌های اطلاعات پایه */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 rounded-2xl shadow-xs overflow-x-auto select-none text-xs">
        {[
          { id: 'products', label: 'کاتالوگ کالاها و ملزومات', icon: Package },
          { id: 'persons', label: 'طرف‌های حساب (مشتریان و تأمین‌کنندگان)', icon: Users },
          { id: 'groups', label: 'گروه‌بندی اشخاص', icon: Building },
          { id: 'categories_brands', label: 'دسته‌بندی و برندهای کالا', icon: Tag },
          { id: 'units', label: 'واحدهای اندازه‌گیری و تبدیل‌ها', icon: ArrowRightLeft },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3.5 px-4 font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* محتوای تب‌ها */}
      <div>
        {activeTab === 'products' && <ProductsModule />}

        {activeTab === 'persons' && <PersonsModule />}

        {/* تب ۳: گروه‌بندی اشخاص */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  مدیریت گروه‌های اشخاص و طرف‌های حساب
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تفکیک مزون‌ها، تولیدکنندگان، بنکداران و تعیین درصد تخفیف و سقف اعتبار پیش‌فرض
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingGroup({
                    code: `GRP-${(personGroups.length + 1) * 10}`,
                    name: '',
                    description: '',
                    defaultDiscountPercent: 0,
                    defaultCreditLimit: 20000000,
                  });
                  setIsGroupModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف گروه جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {personGroups.map((grp) => (
                <div
                  key={grp.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                      {grp.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingGroup(grp);
                          setIsGroupModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(grp.id, grp.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{grp.name}</h4>
                    {grp.description && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {grp.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
                    <span className="text-slate-500">تخفیف گروهی:</span>
                    <strong className="text-indigo-600 font-mono">
                      {toPersianDigits(grp.defaultDiscountPercent || 0)}%
                    </strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">سقف اعتبار پیش‌فرض:</span>
                    <strong className="font-mono text-slate-700 dark:text-slate-300">
                      {grp.defaultCreditLimit ? `${toPersianDigits((grp.defaultCreditLimit / 1000000).toFixed(0))} م.ت` : 'بدون سقف'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* تب ۴: دسته‌بندی و برندهای کالا */}
        {activeTab === 'categories_brands' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ستون ۱: برندها */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    برندهای معتبر و سازندگان
                  </h3>
                  <p className="text-xs text-slate-500">دمسه، یونکس، ناکو، پروانه، دالفین و...</p>
                </div>
                <button
                  onClick={() => {
                    setEditingBrand({ name: '', country: '', description: '' });
                    setIsBrandModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت برند</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">نام برند</th>
                      <th className="py-2.5 px-3">کشور مبدأ</th>
                      <th className="py-2.5 px-3">توضیحات</th>
                      <th className="py-2.5 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {brands.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">{b.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{b.country || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[160px]">{b.description || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingBrand(b);
                                setIsBrandModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBrand(b.id, b.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ستون ۲: دسته‌بندی‌های کالا */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    شاخه‌ها و دسته‌بندی‌های کالا
                  </h3>
                  <p className="text-xs text-slate-500">نخ، روبان، دکمه، کش، ابزار خیاطی و...</p>
                </div>
                <button
                  onClick={() => {
                    setEditingCategory({
                      code: `${(categories.length + 1) * 10}`,
                      name: '',
                      description: '',
                    });
                    setIsCategoryModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت دسته</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">کد</th>
                      <th className="py-2.5 px-3">عنوان دسته</th>
                      <th className="py-2.5 px-3">توضیحات</th>
                      <th className="py-2.5 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-300">{c.code}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">{c.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[160px]">{c.description || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCategory(c);
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id, c.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* تب ۵: واحدها و تبدیل‌ها */}
        {activeTab === 'units' && <UnitsModule />}
      </div>

      {/* مودال گروه اشخاص */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingGroup.id ? 'ویرایش گروه اشخاص' : 'تعریف گروه جدید اشخاص'}
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">کد گروه</label>
                <input
                  type="text"
                  required
                  value={editingGroup.code || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">نام گروه</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مزون‌ها و دوزندگان مجلسی"
                  value={editingGroup.name || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">درصد تخفیف پیش‌فرض (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingGroup.defaultDiscountPercent || 0}
                    onChange={(e) => setEditingGroup({ ...editingGroup, defaultDiscountPercent: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">سقف اعتبار پیش‌فرض (ریال)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingGroup.defaultCreditLimit || 0}
                    onChange={(e) => setEditingGroup({ ...editingGroup, defaultCreditLimit: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">توضیحات</label>
                <textarea
                  rows={2}
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  ذخیره گروه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال برند */}
      {isBrandModalOpen && editingBrand && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingBrand.id ? 'ویرایش برند' : 'ثبت برند سازنده جدید'}
              </h3>
              <button onClick={() => setIsBrandModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBrand} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">نام برند <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: یونکس (YKK)"
                  value={editingBrand.name || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">کشور مبدأ / تولیدکننده</label>
                <input
                  type="text"
                  placeholder="مثال: ژاپن، فرانسه، ترکیه، ایران"
                  value={editingBrand.country || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, country: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">توضیحات</label>
                <textarea
                  rows={2}
                  placeholder="نخ، زیپ، روبان یا ابزار..."
                  value={editingBrand.description || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  ذخیره برند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال دسته‌بندی */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-right">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingCategory.id ? 'ویرایش دسته‌بندی' : 'ثبت دسته‌بندی جدید کالا'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">کد دسته</label>
                <input
                  type="text"
                  required
                  value={editingCategory.code || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">عنوان دسته‌بندی <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: نخ و لوازم دوخت"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">توضیحات</label>
                <textarea
                  rows={2}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  ذخیره دسته
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
